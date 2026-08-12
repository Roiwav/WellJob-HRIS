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

const CANCELLED_REASONS = new Set([
  "Resigned",
  "AWOL",
  "Terminated",
  "End of Assignment / Pulled Out by Client",
]);

function normalizeDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function normalizeNullableDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return String(value).slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isCurrentlyDeployedEmployee(
  employee
) {
  const status =
    normalizeText(
      employee?.status
    );

  return [
    "deployed",
    "active deployed",
  ].includes(status);
}

function getDeploymentStatus(
  employee
) {
  const reason =
    employee.contractEndReason ||
    employee.contract_end_reason;

  const contractEnd =
    employee.contractEnd ||
    employee.contract_end;

  if (
    !reason &&
    !contractEnd
  ) {
    return "Active";
  }

  if (
    CANCELLED_REASONS.has(
      reason
    )
  ) {
    return "Cancelled";
  }

  return "Completed";
}

function getEmployeeStatusFromDeploymentStatus(
  status
) {
  if (
    status === "Cancelled"
  ) {
    return "Inactive";
  }

  return "Floating / Standby";
}

function mapEmployeeToDeployment(
  employee
) {
  const company =
    employee.company || "-";

  const endReason =
    employee.contractEndReason ||
    employee.contract_end_reason ||
    "";

  const endRemarks =
    employee.contractEndRemarks ||
    employee.contract_end_remarks ||
    "";

  const contractEndedAt =
    employee.contractEndedAt ||
    employee.contract_ended_at ||
    null;

  return {
    id:
      employee.id,

    employeeId:
      employee.id,

    employee:
      employee.name ||
      "Unknown Employee",

    company,

    location:
      COMPANY_LOCATIONS[
        company
      ] || "-",

    start:
      normalizeDate(
        employee.contractStart ||
        employee.contract_start ||
        employee.created_at
      ),

    status:
      getDeploymentStatus(
        employee
      ),

    employeeStatus:
      employee.status || "",

    employmentType:
      employee.employmentType ||
      employee.employment_type ||
      "Permanent",

    contractStart:
      normalizeDate(
        employee.contractStart ||
        employee.contract_start
      ),

    contractEnd:
      normalizeDate(
        employee.contractEnd ||
        employee.contract_end
      ),

    endReason,

    endRemarks,

    contractEndedAt,

    createdAt:
      employee.created_at,

    updatedAt:
      employee.updated_at,
  };
}

exports.getDeployments =
  async (
    req,
    res
  ) => {
    try {
      const [rows] =
        await db
          .promise()
          .query(`
            SELECT
              id,
              name,
              company,
              status,
              contractStart,
              contractEnd,
              contractEndReason,
              contractEndRemarks,
              contractEndedAt,
              created_at,
              updated_at,
              archived
            FROM employees
            WHERE
              archived = 0
              AND (
                LOWER(TRIM(status)) IN (
                  'deployed',
                  'active deployed'
                )
                OR contractEnd IS NOT NULL
                OR contractEndReason IS NOT NULL
              )
            ORDER BY created_at DESC
          `);

      const deployments =
        rows.map(
          mapEmployeeToDeployment
        );

      return res.json(
        deployments
      );
    } catch (err) {
      console.error(
        "GET DEPLOYMENTS ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            err.sqlMessage ||
            err.message ||
            "Failed to fetch deployments",
        });
    }
  };

exports.updateDeploymentStatus =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeId,
      } = req.params;

      const {
        status,
      } = req.body || {};

      if (!employeeId) {
        return res
          .status(400)
          .json({
            error:
              "Employee ID is required.",
          });
      }

      if (
        ![
          "Completed",
          "Cancelled",
        ].includes(status)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Deployment status must be Completed or Cancelled.",
          });
      }

      const [employeeRows] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM employees
            WHERE id = ?
            LIMIT 1
            `,
            [employeeId]
          );

      if (
        employeeRows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Employee not found.",
          });
      }

      const employee =
        employeeRows[0];

      /*
       * DEPLOYMENT WORKFLOW PROTECTION
       *
       * Only an employee with a currently active
       * deployment may be completed or cancelled.
       *
       * This prevents Floating / Standby, Inactive,
       * or already-ended employees from being
       * processed as an active deployment.
       */
      if (
        !isCurrentlyDeployedEmployee(
          employee
        )
      ) {
        return res
          .status(409)
          .json({
            error:
              "Only a currently deployed employee can have their deployment completed or cancelled.",
          });
      }

      /*
       * Archived employees must not receive
       * deployment workflow updates.
       */
      if (
        Number(
          employee.archived || 0
        ) === 1
      ) {
        return res
          .status(409)
          .json({
            error:
              "Archived employees cannot have their deployment status updated.",
          });
      }

      const employeeStatus =
        getEmployeeStatusFromDeploymentStatus(
          status
        );

      const endReason =
        status === "Cancelled"
          ? "End of Assignment / Pulled Out by Client"
          : "Completed Contract";

      await db
        .promise()
        .query(
          `
          UPDATE employees
          SET
            status = ?,
            contractEnd = COALESCE(
              contractEnd,
              CURDATE()
            ),
            contractEndReason = ?,
            contractEndedAt = NOW()
          WHERE id = ?
          `,
          [
            employeeStatus,
            endReason,
            employeeId,
          ]
        );

      return res.json({
        success: true,

        message:
          status === "Cancelled"
            ? "Deployment cancelled successfully."
            : "Deployment marked as completed successfully.",

        employeeId,

        deploymentStatus:
          status,

        employeeStatus,

        endReason,
      });
    } catch (err) {
      console.error(
        "UPDATE DEPLOYMENT STATUS ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            err.sqlMessage ||
            err.message ||
            "Failed to update deployment status",
        });
    }
  };