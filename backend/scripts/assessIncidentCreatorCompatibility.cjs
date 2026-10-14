"use strict";

require("dotenv").config();

const mysql = require("mysql2/promise");

function getSslOptions() {
  const encoded = String(
    process.env.DB_SSL_CA_BASE64 || ""
  ).trim();

  if (!encoded) {
    return undefined;
  }

  return {
    ca: Buffer.from(
      encoded,
      "base64"
    ).toString("utf8"),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    servername: process.env.DB_HOST,
  };
}

async function main() {
  const connection =
    await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: getSslOptions(),
    });

  try {
    await connection.query(
      "SET SESSION TRANSACTION READ ONLY"
    );
    await connection.beginTransaction();

    const queries = {
      incidentTotals: `
        SELECT
          COUNT(*) AS totalIncidents,
          SUM(
            LOWER(TRIM(COALESCE(status, ''))) <>
            'closed'
          ) AS nonClosedIncidents,
          SUM(
            LOWER(TRIM(COALESCE(status, ''))) =
            'closed'
          ) AS closedIncidents
        FROM incidents
      `,
      nonClosedWithoutReliableCreator: `
        SELECT COUNT(*) AS affected
        FROM incidents AS i
        WHERE
          LOWER(TRIM(COALESCE(i.status, ''))) <>
            'closed'
          AND NOT EXISTS (
            SELECT 1
            FROM incident_timeline AS t
            WHERE
              t.incident_id = i.id
              AND t.action_type = 'CREATE_INCIDENT'
              AND TRIM(
                CAST(t.created_by_id AS CHAR)
              ) REGEXP '^[1-9][0-9]*$'
              AND UPPER(
                TRIM(COALESCE(t.created_by_role, ''))
              ) IN (
                'HR_MANAGER',
                'HR_STAFF',
                'HR_COORDINATOR'
              )
          )
      `,
      nonClosedCreatorRoles: `
        SELECT
          UPPER(
            TRIM(
              COALESCE(
                creator.created_by_role,
                'MISSING'
              )
            )
          ) AS creatorRole,
          COUNT(*) AS incidentCount
        FROM incidents AS i
        LEFT JOIN incident_timeline AS creator
          ON creator.id = (
            SELECT t.id
            FROM incident_timeline AS t
            WHERE
              t.incident_id = i.id
              AND t.action_type = 'CREATE_INCIDENT'
            ORDER BY t.id ASC
            LIMIT 1
          )
        WHERE
          LOWER(TRIM(COALESCE(i.status, ''))) <>
            'closed'
        GROUP BY creatorRole
        ORDER BY incidentCount DESC
      `,
      unreliableNonClosedByStatus: `
        SELECT
          COALESCE(NULLIF(TRIM(i.status), ''), 'UNKNOWN')
            AS status,
          COUNT(*) AS incidentCount,
          SUM(
            TRIM(
              COALESCE(
                i.investigation_started_by_id,
                ''
              )
            ) REGEXP '^[1-9][0-9]*$'
          ) AS withCanonicalInvestigator,
          SUM(
            TRIM(
              COALESCE(
                i.resolution_submitted_by_id,
                ''
              )
            ) REGEXP '^[1-9][0-9]*$'
          ) AS withCanonicalSubmitter
        FROM incidents AS i
        WHERE
          LOWER(TRIM(COALESCE(i.status, ''))) <>
            'closed'
          AND NOT EXISTS (
            SELECT 1
            FROM incident_timeline AS t
            WHERE
              t.incident_id = i.id
              AND t.action_type = 'CREATE_INCIDENT'
              AND TRIM(
                CAST(t.created_by_id AS CHAR)
              ) REGEXP '^[1-9][0-9]*$'
              AND UPPER(
                TRIM(COALESCE(t.created_by_role, ''))
              ) IN (
                'HR_MANAGER',
                'HR_STAFF',
                'HR_COORDINATOR'
              )
          )
        GROUP BY status
        ORDER BY incidentCount DESC
      `,
      unreliableNonClosedLastActions: `
        SELECT
          COALESCE(
            NULLIF(TRIM(i.status), ''),
            'UNKNOWN'
          ) AS status,
          COALESCE(
            NULLIF(TRIM(i.last_action_type), ''),
            'MISSING'
          ) AS lastActionType,
          COUNT(*) AS incidentCount,
          SUM(
            TRIM(
              COALESCE(i.last_action_by_id, '')
            ) REGEXP '^[1-9][0-9]*$'
          ) AS withCanonicalLastActor
        FROM incidents AS i
        WHERE
          LOWER(TRIM(COALESCE(i.status, ''))) <>
            'closed'
          AND NOT EXISTS (
            SELECT 1
            FROM incident_timeline AS t
            WHERE
              t.incident_id = i.id
              AND t.action_type = 'CREATE_INCIDENT'
              AND TRIM(
                CAST(t.created_by_id AS CHAR)
              ) REGEXP '^[1-9][0-9]*$'
              AND UPPER(
                TRIM(COALESCE(t.created_by_role, ''))
              ) IN (
                'HR_MANAGER',
                'HR_STAFF',
                'HR_COORDINATOR'
              )
          )
        GROUP BY status, lastActionType
        ORDER BY status, lastActionType
      `,
      workflowAuditCoverage: `
        SELECT
          action,
          COUNT(*) AS eventCount,
          SUM(user_id IS NOT NULL)
            AS withCanonicalUserId
        FROM audit_logs
        WHERE
          category = 'OPERATIONAL'
          AND action IN (
            'CREATE_INCIDENT',
            'START_INVESTIGATION',
            'SUBMIT_RESOLUTION',
            'SUBMIT_INVESTIGATION',
            'RETURN_INCIDENT',
            'CLOSE_INCIDENT'
          )
        GROUP BY action
        ORDER BY action
      `,
      duplicateCreatorEvents: `
        SELECT COUNT(*) AS affected
        FROM (
          SELECT incident_id
          FROM incident_timeline
          WHERE action_type = 'CREATE_INCIDENT'
          GROUP BY incident_id
          HAVING COUNT(*) > 1
        ) AS duplicate_events
      `,
      orphanCreatorEvents: `
        SELECT COUNT(*) AS affected
        FROM incident_timeline AS t
        LEFT JOIN incidents AS i
          ON i.id = t.incident_id
        WHERE
          t.action_type = 'CREATE_INCIDENT'
          AND i.id IS NULL
      `,
      creatorUserIntegrity: `
        SELECT
          COUNT(*) AS creatorEvents,
          SUM(u.id IS NULL) AS missingUserRows,
          SUM(
            u.id IS NOT NULL
            AND UPPER(
              TRIM(COALESCE(t.created_by_role, ''))
            ) <>
            UPPER(TRIM(COALESCE(u.role, '')))
          ) AS currentRoleMismatchRows
        FROM incident_timeline AS t
        LEFT JOIN users AS u
          ON u.id = t.created_by_id
        WHERE t.action_type = 'CREATE_INCIDENT'
      `,
    };

    const report = {};

    for (const [name, sql] of
      Object.entries(queries)) {
      const [rows] =
        await connection.query(sql);
      report[name] = rows;
    }

    await connection.rollback();
    console.log(
      JSON.stringify(report, null, 2)
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    "Incident creator compatibility assessment failed:",
    error.message
  );
  process.exitCode = 1;
});