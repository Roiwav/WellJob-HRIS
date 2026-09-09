const db = require("../config/db");

function mapKpiEmployee(row) {
  return {
    id: row.id,

    name:
      row.name ||
      "Unknown Employee",

    company:
      row.company ||
      "Unassigned",

    status:
      row.status ||
      "Unknown",
  };
}

function mapKpiIncident(row) {
  const reportedAt =
    row.createdAt ||
    row.incidentDate ||
    null;

  return {
    id:
      row.id,

    employeeId:
      row.employeeId,

    employeeName:
      row.employeeName ||
      "Unknown Employee",

    company:
      row.company ||
      "",

    violation:
      row.violation ||
      "",

    severity:
      row.severity ||
      "Minor",

    status:
      row.status ||
      "Open",

    incidentDate:
      row.incidentDate ||
      null,

    reportedAt,

    description:
      row.description ||
      "",
  };
}

exports.getKpiData = async (
  req,
  res
) => {
  try {
    const [
      employeeResult,
      incidentResult,
    ] =
      await Promise.all([
        db
          .promise()
          .query(`
            SELECT
              e.id,
              e.name,
              e.company,
              e.status
            FROM employees AS e
            WHERE e.archived = 0
            ORDER BY
              e.id ASC
          `),

        db
          .promise()
          .query(`
            SELECT
              i.id,
              i.employee_id AS employeeId,

              COALESCE(
                NULLIF(
                  TRIM(
                    i.employee_name
                  ),
                  ''
                ),
                e.name
              ) AS employeeName,

              COALESCE(
                NULLIF(
                  TRIM(
                    i.company
                  ),
                  ''
                ),
                e.company,
                ''
              ) AS company,

              i.violation_type AS violation,
              i.severity,
              i.status,
              i.incident_date AS incidentDate,
              i.created_at AS createdAt,
              i.description

            FROM incidents AS i

            INNER JOIN employees AS e
              ON e.id = i.employee_id

            WHERE e.archived = 0

            ORDER BY
              i.created_at DESC,
              i.id DESC
          `),
      ]);

    const [employeeRows] =
      employeeResult;

    const [incidentRows] =
      incidentResult;

    const employeesRaw =
      employeeRows.map(
        mapKpiEmployee
      );

    const incidentsRaw =
      incidentRows.map(
        mapKpiIncident
      );

    return res.json({
      employeesRaw,
      incidentsRaw,

      fetchedAt:
        new Date().toISOString(),

      meta: {
        employeeRows:
          employeesRaw.length,

        incidentRows:
          incidentsRaw.length,
      },
    });
  } catch (error) {
    console.error(
      "GET KPI DATA ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Failed to load KPI analytics data.",
      });
  }
};