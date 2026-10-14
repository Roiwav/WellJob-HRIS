"use strict";

require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");

const {
  evaluateStartInvestigation,
} = require("../utils/incidentInvestigationPolicy");

function getConfiguration() {
  const database = String(
    process.env.TEST_DB_NAME || ""
  ).trim();

  if (!database) {
    return null;
  }

  const host = String(
    process.env.TEST_DB_HOST || ""
  ).trim();
  const user = String(
    process.env.TEST_DB_USER || ""
  ).trim();

  if (!host || !user) {
    throw new Error(
      "TEST_DB_HOST and TEST_DB_USER are required when TEST_DB_NAME is configured."
    );
  }

  if (
    !/(test|isolated|ci)/i.test(database) ||
    database === String(
      process.env.DB_NAME || ""
    ).trim()
  ) {
    throw new Error(
      "TEST_DB_NAME must identify a separate isolated test database and must not equal DB_NAME."
    );
  }

  return {
    host,
    port: Number(
      process.env.TEST_DB_PORT || 3306
    ),
    user,
    password:
      process.env.TEST_DB_PASSWORD || "",
    database,
    ssl: process.env.TEST_DB_SSL_CA_BASE64
      ? {
          ca: Buffer.from(
            process.env.TEST_DB_SSL_CA_BASE64,
            "base64"
          ).toString("utf8"),
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          servername: process.env.TEST_DB_HOST,
        }
      : undefined,
  };
}

const configuration = getConfiguration();
const integrationTest = configuration
  ? test
  : test.skip;
const tableName =
  "incident_claim_concurrency_test";

async function resetFixture(seed) {
  const connection =
    await mysql.createConnection(
      configuration
    );

  try {
    await connection.query(
      `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT NOT NULL PRIMARY KEY,
        company VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        report_creator_id INT NOT NULL,
        report_creator_role VARCHAR(80) NOT NULL,
        investigation_started_by_id INT NULL,
        investigation_started_at DATETIME NULL
      ) ENGINE=InnoDB
      `
    );

    await connection.query(
      `DELETE FROM ${tableName}`
    );

    await connection.query(
      `
      INSERT INTO ${tableName}
      (
        id,
        company,
        status,
        report_creator_id,
        report_creator_role,
        investigation_started_by_id,
        investigation_started_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        1,
        seed.company,
        seed.status || "Open",
        seed.reportCreatorId,
        seed.reportCreatorRole,
        seed.investigatorId || null,
        seed.investigationStartedAt || null,
      ]
    );
  } finally {
    await connection.end();
  }
}

async function claim(actor) {
  const connection =
    await mysql.createConnection(
      configuration
    );

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT *
      FROM ${tableName}
      WHERE id = 1
      FOR UPDATE
      `
    );

    const policy =
      evaluateStartInvestigation({
        actor,
        incident: rows[0],
      });

    if (!policy.allowed) {
      await connection.rollback();
      return {
        statusCode: policy.statusCode,
        code: policy.code,
        affectedRows: 0,
      };
    }

    const [result] = await connection.query(
      `
      UPDATE ${tableName}
      SET
        status = 'Investigating',
        investigation_started_by_id = ?,
        investigation_started_at = NOW()
      WHERE id = 1
        AND LOWER(TRIM(COALESCE(status, ''))) = 'open'
        AND investigation_started_at IS NULL
      `,
      [actor.userId]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();
      return {
        statusCode: 409,
        code: "INVESTIGATION_ALREADY_STARTED",
        affectedRows: 0,
      };
    }

    await connection.commit();
    return {
      statusCode: 200,
      code: "CLAIMED",
      affectedRows: 1,
      userId: actor.userId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function expectSingleWinner(
  seed,
  firstActor,
  secondActor
) {
  await resetFixture(seed);

  const results = await Promise.all([
    claim(firstActor),
    claim(secondActor),
  ]);

  const winners = results.filter(
    (result) => result.affectedRows === 1
  );
  const conflicts = results.filter(
    (result) => result.statusCode === 409
  );

  assert.equal(winners.length, 1);
  assert.equal(conflicts.length, 1);

  const verification =
    await mysql.createConnection(
      configuration
    );

  try {
    const [rows] = await verification.query(
      `SELECT * FROM ${tableName} WHERE id = 1`
    );
    assert.equal(rows[0].status, "Investigating");
    assert.ok(rows[0].investigation_started_at);
    assert.equal(
      rows[0].investigation_started_by_id,
      winners[0].userId
    );
  } finally {
    await verification.end();
  }
}

integrationTest(
  "two assigned coordinators race and exactly one wins",
  async () => {
    await expectSingleWinner(
      {
        company: "Company A",
        reportCreatorId: 10,
        reportCreatorRole: "HR_COORDINATOR",
      },
      {
        userId: 11,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      },
      {
        userId: 12,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    );
  }
);

integrationTest(
  "HR Manager creator and assigned coordinator race and exactly one wins",
  async () => {
    await expectSingleWinner(
      {
        company: "Company A",
        reportCreatorId: 20,
        reportCreatorRole: "HR_MANAGER",
      },
      {
        userId: 20,
        role: "HR_MANAGER",
      },
      {
        userId: 11,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    );
  }
);

integrationTest(
  "HR Manager and assigned coordinator race on a reliable legacy HR Staff report and exactly one wins",
  async () => {
    await expectSingleWinner(
      {
        company: "Company A",
        reportCreatorId: 21,
        reportCreatorRole: "HR_STAFF",
      },
      {
        userId: 20,
        role: "HR_MANAGER",
      },
      {
        userId: 11,
        role: "HR_COORDINATOR",
        assignedCompany: "Company A",
      }
    );
  }
);

integrationTest(
  "repeated clicks and claims after Open return 409",
  async () => {
    await resetFixture({
      company: "Company A",
      reportCreatorId: 20,
      reportCreatorRole: "HR_MANAGER",
    });

    const actor = {
      userId: 20,
      role: "HR_MANAGER",
    };

    const first = await claim(actor);
    const repeated = await claim(actor);
    const lateCoordinator = await claim({
      userId: 11,
      role: "HR_COORDINATOR",
      assignedCompany: "Company A",
    });

    assert.equal(first.statusCode, 200);
    assert.equal(repeated.statusCode, 409);
    assert.equal(lateCoordinator.statusCode, 409);
  }
);

test.after(async () => {
  if (!configuration) {
    return;
  }

  const connection =
    await mysql.createConnection(
      configuration
    );

  try {
    await connection.query(
      `DROP TABLE IF EXISTS ${tableName}`
    );
  } finally {
    await connection.end();
  }
});