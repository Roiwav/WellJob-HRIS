const db = require("../config/db");

const COMPANY_LOCATIONS = {
  "SM Supermalls": "Calamba City, Laguna",
  "Robinsons Retail Holdings": "Calamba City, Laguna",
  "Ayala Land Inc.": "Makati City",
  "Jollibee Foods Corporation": "Pasig City",
  "San Miguel Corporation": "Mandaluyong City",
  "PLDT Inc.": "Makati City",
  "Globe Telecom": "Taguig City",
  "BDO Unibank": "Makati City",
  Metrobank: "Makati City",
  "Puregold Price Club": "Quezon City",
  "Wilcon Depot": "Quezon City",
  "DMCI Holdings": "Makati City",
  "Megaworld Corporation": "Taguig City",
  "Unilab Inc.": "Mandaluyong City",
  "Nestlé Philippines": "Makati City",
  "Coca-Cola Philippines": "Taguig City",
  "Pepsi-Cola Products Philippines": "Muntinlupa City",
  "Toyota Philippines": "Santa Rosa, Laguna",
  "Honda Philippines": "Batangas",
  "Accenture Philippines": "Taguig City",
  "IBM Philippines": "Quezon City",
  "Teleperformance Philippines": "Pasig City",
  "Concentrix Philippines": "Quezon City",
  "Sitel Philippines": "Makati City",
};

function normalizeDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toISOString().slice(0, 10);
}

function mapEmployeeToDeployment(employee) {
  const company = employee.company || "-";

  return {
    id: employee.id,
    employeeId: employee.id,
    employee: employee.name || "Unknown Employee",
    company,
    location: COMPANY_LOCATIONS[company] || "-",
    start: normalizeDate(
      employee.contractStart || employee.contract_start || employee.created_at
    ),
    status: "Active",
    employmentType:
      employee.employmentType || employee.employment_type || "Permanent",
    contractStart: normalizeDate(
      employee.contractStart || employee.contract_start
    ),
    contractEnd: normalizeDate(employee.contractEnd || employee.contract_end),
    createdAt: employee.created_at,
    updatedAt: employee.updated_at,
  };
}

exports.getDeployments = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT
        id,
        name,
        company,
        status,
        contractStart,
        contractEnd,
        created_at,
        archived
      FROM employees
      WHERE 
        archived = 0
        AND LOWER(TRIM(status)) IN ('deployed', 'active deployed')
      ORDER BY created_at DESC
    `);

    const deployments = rows.map(mapEmployeeToDeployment);

    res.json(deployments);
  } catch (err) {
    console.error("GET DEPLOYMENTS ERROR:", err);

    res.status(500).json({
      error:
        err.sqlMessage || err.message || "Failed to fetch deployments",
    });
  }
};

exports.updateDeploymentStatus = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required." });
    }

    if (!["Completed", "Cancelled"].includes(status)) {
      return res.status(400).json({
        error: "Deployment status must be Completed or Cancelled.",
      });
    }

    const [employeeRows] = await db.promise().query(
      `SELECT * FROM employees WHERE id = ? LIMIT 1`,
      [employeeId]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }

    await db.promise().query(
      `
      UPDATE employees
      SET 
        status = ?,
        company = NULL
      WHERE id = ?
      `,
      ["Floating / Standby", employeeId]
    );

    res.json({
      success: true,
      message:
        status === "Cancelled"
          ? "Deployment cancelled successfully."
          : "Deployment marked as completed successfully.",
      employeeId,
      deploymentStatus: status,
      employeeStatus: "Floating / Standby",
    });
  } catch (err) {
    console.error("UPDATE DEPLOYMENT STATUS ERROR:", err);

    res.status(500).json({
      error:
        err.sqlMessage || err.message || "Failed to update deployment status",
    });
  }
};