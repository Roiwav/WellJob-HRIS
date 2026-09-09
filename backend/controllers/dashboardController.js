const db = require("../config/db");

const EXPIRABLE_DOCUMENTS = [
  "Barangay Clearance",
  "NBI/Police Clearance",
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isDeployedStatus(status) {
  const value = normalizeText(status);

  return (
    value === "deployed" ||
    value === "active deployed"
  );
}

function isFloatingStatus(status) {
  const value = normalizeText(status);

  return [
    "floating / standby",
    "floating/standby",
    "floating",
    "standby",
  ].includes(value);
}

function isCurrentWorkforceStatus(status) {
  return (
    isDeployedStatus(status) ||
    isFloatingStatus(status)
  );
}

function isActiveIncidentStatus(status) {
  return [
    "open",
    "investigating",
    "for review",
    "for_review",
  ].includes(normalizeText(status));
}

function mapEmployees(
  employeeRows,
  expiringDocumentRows
) {
  const documentsByEmployeeId =
    new Map();

  for (const document of expiringDocumentRows) {
    const employeeId = String(
      document.employeeId
    );

    if (
      !documentsByEmployeeId.has(
        employeeId
      )
    ) {
      documentsByEmployeeId.set(
        employeeId,
        []
      );
    }

    documentsByEmployeeId
      .get(employeeId)
      .push({
        id: document.id,
        name: document.name,
        expirationDate:
          document.expirationDate,
      });
  }

  return employeeRows.map(
    (employee) => ({
      id: employee.id,
      employeeId: employee.id,
      name: employee.name,
      company: employee.company,
      status: employee.status,
      contractStart:
        employee.contractStart,
      createdAt: employee.createdAt,
      archived:
        Number(employee.archived) === 1,
      documents:
        documentsByEmployeeId.get(
          String(employee.id)
        ) || [],
      hasDeploymentHistory:
        Number(
          employee.hasDeploymentHistory
        ) === 1,
      hasActiveDeployment:
        Number(
          employee.hasActiveDeployment
        ) === 1,
    })
  );
}

function buildKpis(
  employees,
  incidents,
  expiringDocumentCount
) {
  const currentEmployees =
    employees.filter((employee) =>
      isCurrentWorkforceStatus(
        employee.status
      )
    );

  const deployed =
    currentEmployees.filter(
      (employee) => {
        if (
          !isDeployedStatus(
            employee.status
          )
        ) {
          return false;
        }

        if (
          employee.hasActiveDeployment
        ) {
          return true;
        }

        return (
          !employee.hasDeploymentHistory
        );
      }
    ).length;

  const available =
    currentEmployees.filter(
      (employee) =>
        isFloatingStatus(
          employee.status
        )
    ).length;

  const activeIncidents =
    incidents.filter((incident) =>
      isActiveIncidentStatus(
        incident.status
      )
    ).length;

  return {
    total: currentEmployees.length,
    deployed,
    available,
    activeIncidents,
    expiringDocs:
      Number(expiringDocumentCount) || 0,
  };
}

exports.getDashboardOverview = async (
  req,
  res
) => {
  let connection;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    const [employeeRows] =
      await connection.query(`
        SELECT
          e.id,
          e.name,
          e.company,
          e.status,
          e.contractStart AS contractStart,
          e.created_at AS createdAt,
          e.archived,
          EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_any
            WHERE da_any.employee_id = e.id
            LIMIT 1
          ) AS hasDeploymentHistory,
          EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_active
            WHERE
              da_active.employee_id = e.id
              AND da_active.status = 'Active'
            LIMIT 1
          ) AS hasActiveDeployment
        FROM employees AS e
        WHERE e.archived = 0
        ORDER BY
          e.created_at DESC,
          e.id DESC
      `);

    const [expiringDocumentRows] =
      await connection.query(
        `
        SELECT
          d.id,
          d.employee_id AS employeeId,
          d.name,
          d.expiration_date AS expirationDate
        FROM employee_documents AS d
        INNER JOIN employees AS e
          ON e.id = d.employee_id
        WHERE
          e.archived = 0
          AND d.name IN (?, ?)
          AND d.expiration_date IS NOT NULL
          AND d.expiration_date >= CURDATE()
          AND d.expiration_date < DATE_ADD(
            CURDATE(),
            INTERVAL 31 DAY
          )
        ORDER BY
          d.expiration_date ASC,
          d.id ASC
        `,
        EXPIRABLE_DOCUMENTS
      );

    const [incidentRows] =
      await connection.query(`
        SELECT
          i.id,
          i.employee_id AS employeeId,
          COALESCE(
            NULLIF(TRIM(i.employee_name), ''),
            e.name,
            'Unknown Employee'
          ) AS employee,
          COALESCE(
            NULLIF(TRIM(i.company), ''),
            e.company,
            ''
          ) AS company,
          i.violation_type AS violation,
          i.severity,
          i.status,
          i.incident_date AS date,
          i.incident_date AS reportedAt,
          i.created_at AS createdAt
        FROM incidents AS i
        LEFT JOIN employees AS e
          ON e.id = i.employee_id
        ORDER BY
          i.created_at DESC,
          i.id DESC
      `);

    const [deploymentTrendRows] =
      await connection.query(`
        SELECT
          DATE_FORMAT(
            da.start_date,
            '%Y-%m-01'
          ) AS date,
          COUNT(*) AS employees
        FROM deployment_assignments AS da
        INNER JOIN employees AS e
          ON e.id = da.employee_id
        WHERE
          e.archived = 0
          AND da.start_date IS NOT NULL
        GROUP BY
          YEAR(da.start_date),
          MONTH(da.start_date)
        ORDER BY
          YEAR(da.start_date) ASC,
          MONTH(da.start_date) ASC
      `);

    const employees = mapEmployees(
      employeeRows,
      expiringDocumentRows
    );

    const incidents =
      incidentRows.map(
        (incident) => ({
          id: incident.id,
          employeeId:
            incident.employeeId,
          employee:
            incident.employee,
          company: incident.company,
          violation:
            incident.violation,
          severity:
            incident.severity,
          status: incident.status,
          date: incident.date,
          reportedAt:
            incident.reportedAt,
          createdAt:
            incident.createdAt,
        })
      );

    const deploymentTrend =
      deploymentTrendRows.map(
        (row) => ({
          date: row.date,
          employees:
            Number(row.employees) || 0,
        })
      );

    const kpis = buildKpis(
      employees,
      incidents,
      expiringDocumentRows.length
    );

    return res.json({
      kpis,
      employees,
      incidents,
      deploymentTrend,
      meta: {
        generatedAt:
          new Date().toISOString(),
        employeeRows:
          employees.length,
        incidentRows:
          incidents.length,
        deploymentTrendRows:
          deploymentTrend.length,
        expiringDocumentRows:
          expiringDocumentRows.length,
      },
    });
  } catch (error) {
    console.error(
      "GET DASHBOARD OVERVIEW ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Failed to fetch dashboard overview",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
