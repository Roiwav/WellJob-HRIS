// routes/settingsRoutes.js

const express = require("express");

const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const {
  VIOLATION_RULES_SETTING_NAME,
  normalizeViolationRules,
  getViolationRulesConfiguration,
  countViolationRules,
} = require("../utils/violationPolicyService");

const {
  PERFORMANCE_EVALUATION_SETTING_NAME,
  getDefaultPerformanceEvaluationConfiguration,
  normalizePerformanceEvaluationConfiguration,
  getPerformanceEvaluationConfiguration,
} = require("../utils/performanceEvaluationService");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

const MAINTENANCE_SETTING_NAME = "maintenance_mode";

const SYSTEM_CONFIGURATION_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
];

const VIOLATION_RULES_READ_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
  "HR_STAFF",
  "HR_COORDINATOR",
];

const VIOLATION_RULES_WRITE_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
];

const PERFORMANCE_EVALUATION_READ_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
];

const PERFORMANCE_EVALUATION_WRITE_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
];

const COMPANY_MASTER_READ_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
];

const COMPANY_MASTER_WRITE_ROLES = [
  ...SYSTEM_CONFIGURATION_ROLES,
];

const MAX_CONFIGURATION_BYTES = 1024 * 1024;
const MAX_COMPANY_NAME_LENGTH = 255;
const MAX_POSITION_NAME_LENGTH = 150;

function isMaintenanceEnabled(value) {
  return (
    value === 1 ||
    value === true ||
    String(value) === "1"
  );
}

function getCurrentUserName(user) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.username ||
    "Authorized User"
  );
}

function getAuditCategory() {
  return AUDIT_CATEGORY.OPERATIONAL;
}

function normalizeSingleLineText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveInteger(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isDuplicateEntryError(error) {
  return (
    error?.code === "ER_DUP_ENTRY" ||
    Number(error?.errno) === 1062
  );
}

function mapCompanyRow(row) {
  return {
    id: Number(row.id),
    companyName: row.company_name,
    isActive: Boolean(Number(row.is_active)),
    positionCount: Number(row.position_count || 0),
    activePositionCount: Number(row.active_position_count || 0),
    assignedHrCoordinatorCount: Number(
      row.assigned_hr_coordinator_count || 0
    ),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapPositionRow(row) {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    companyName: row.company_name,
    positionName: row.position_name,
    isActive: Boolean(Number(row.is_active)),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function getSystemSetting(settingName) {
  const [rows] = await db.promise().query(
    `
    SELECT
      setting_name,
      setting_value
    FROM system_settings
    WHERE setting_name = ?
    LIMIT 1
    `,
    [settingName]
  );

  return rows[0] || null;
}

async function getMaintenanceSetting() {
  return getSystemSetting(MAINTENANCE_SETTING_NAME);
}

async function getClientCompanyById(companyId) {
  const [rows] = await db.promise().query(
    `
    SELECT
      id,
      company_name,
      is_active,
      created_at,
      updated_at
    FROM client_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  return rows[0] || null;
}

async function getCompanyPositionById(positionId) {
  const [rows] = await db.promise().query(
    `
    SELECT
      cp.id,
      cp.company_id,
      cp.position_name,
      cp.is_active,
      cp.created_at,
      cp.updated_at,
      cc.company_name,
      cc.is_active AS company_is_active
    FROM company_positions AS cp
    INNER JOIN client_companies AS cc
      ON cc.id = cp.company_id
    WHERE cp.id = ?
    LIMIT 1
    `,
    [positionId]
  );

  return rows[0] || null;
}

/*
 * ==================================================
 * MAINTENANCE SETTINGS
 * ==================================================
 */

router.get(
  "/settings/maintenance-status",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    try {
      const setting = await getMaintenanceSetting();

      if (!setting) {
        return res.status(404).json({
          success: false,
          error: "Maintenance setting not found",
          message:
            "The maintenance_mode system setting is not configured.",
        });
      }

      return res.status(200).json({
        isMaintenanceOn: isMaintenanceEnabled(
          setting.setting_value
        ),
      });
    } catch (error) {
      console.error(
        "Maintenance status database error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch maintenance status.",
      });
    }
  }
);

router.post(
  "/settings/toggle-maintenance",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    const { status } = req.body || {};

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Maintenance status must be true or false.",
      });
    }

    try {
      const existingSetting = await getMaintenanceSetting();

      if (!existingSetting) {
        return res.status(404).json({
          success: false,
          error: "Maintenance setting not found",
          message:
            "The maintenance_mode system setting is not configured.",
        });
      }

      const previousStatus = isMaintenanceEnabled(
        existingSetting.setting_value
      );

      const [updateResult] = await db.promise().query(
        `
        UPDATE system_settings
        SET setting_value = ?
        WHERE setting_name = ?
        `,
        [status ? 1 : 0, MAINTENANCE_SETTING_NAME]
      );

      if (Number(updateResult?.affectedRows || 0) !== 1) {
        console.error(
          "Maintenance update did not affect exactly one row:",
          updateResult
        );

        return res.status(500).json({
          success: false,
          error:
            "Maintenance mode update could not be confirmed.",
        });
      }

      const persistedSetting = await getMaintenanceSetting();

      if (!persistedSetting) {
        return res.status(500).json({
          success: false,
          error:
            "Maintenance mode state could not be verified after update.",
        });
      }

      const persistedStatus = isMaintenanceEnabled(
        persistedSetting.setting_value
      );

      if (persistedStatus !== status) {
        console.error(
          "Maintenance state verification mismatch:",
          {
            requestedStatus: status,
            persistedStatus,
          }
        );

        return res.status(500).json({
          success: false,
          error:
            "Maintenance mode state verification failed.",
        });
      }

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: AUDIT_CATEGORY.TECHNICAL,
        action: "TOGGLE_MAINTENANCE_MODE",
        description:
          previousStatus === persistedStatus
            ? `Maintenance mode confirmed ${
                persistedStatus ? "ON" : "OFF"
              }.`
            : `Maintenance mode changed from ${
                previousStatus ? "ON" : "OFF"
              } to ${persistedStatus ? "ON" : "OFF"}.`,
      });

      return res.status(200).json({
        message:
          "System Maintenance Mode successfully updated!",
        isMaintenanceOn: persistedStatus,
      });
    } catch (error) {
      console.error(
        "Maintenance toggle database error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to update maintenance mode.",
      });
    }
  }
);

/*
 * ==================================================
 * VIOLATION RULES CONFIGURATION
 * ==================================================
 */

router.get(
  "/settings/violation-rules",
  verifyToken,
  authorizeRoles(...VIOLATION_RULES_READ_ROLES),
  async (req, res) => {
    try {
      const configuration =
        await getViolationRulesConfiguration();

      if (!configuration) {
        return res.status(200).json({
          success: true,
          configured: false,
          rules: null,
          metadata: {
            updatedAt: null,
            updatedBy: null,
            updatedByRole: null,
          },
        });
      }

      return res.status(200).json({
        success: true,
        configured: true,
        rules: configuration.rules,
        metadata: configuration.metadata,
      });
    } catch (error) {
      console.error(
        "Violation rules fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch violation rules configuration.",
      });
    }
  }
);

router.put(
  "/settings/violation-rules",
  verifyToken,
  authorizeRoles(...VIOLATION_RULES_WRITE_ROLES),
  async (req, res) => {
    const normalizedResult = normalizeViolationRules(
      req.body?.rules
    );

    if (!normalizedResult.valid) {
      return res.status(400).json({
        success: false,
        error: normalizedResult.error,
      });
    }

    const nextConfiguration = {
      rules: normalizedResult.rules,
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: getCurrentUserName(req.user),
        updatedByRole:
          req.user?.role || "Authorized User",
      },
    };

    let serializedConfiguration;

    try {
      serializedConfiguration = JSON.stringify(
        nextConfiguration
      );
    } catch {
      return res.status(400).json({
        success: false,
        error:
          "Violation rules configuration could not be serialized.",
      });
    }

    if (
      Buffer.byteLength(serializedConfiguration, "utf8") >
      MAX_CONFIGURATION_BYTES
    ) {
      return res.status(413).json({
        success: false,
        error:
          "Violation rules configuration is too large.",
      });
    }

    try {
      const previousConfiguration =
        await getViolationRulesConfiguration();

      const [saveResult] = await db.promise().query(
        `
        INSERT INTO system_settings (
          setting_name,
          setting_value
        )
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
        `,
        [
          VIOLATION_RULES_SETTING_NAME,
          serializedConfiguration,
        ]
      );

      if (Number(saveResult?.affectedRows || 0) < 1) {
        console.error(
          "Violation rules save did not affect a settings row:",
          saveResult
        );

        return res.status(500).json({
          success: false,
          error:
            "Violation rules update could not be confirmed.",
        });
      }

      const persistedConfiguration =
        await getViolationRulesConfiguration();

      if (!persistedConfiguration) {
        return res.status(500).json({
          success: false,
          error:
            "Violation rules configuration could not be verified after saving.",
        });
      }

      const requestedRulesSnapshot = JSON.stringify(
        normalizedResult.rules
      );

      const persistedRulesSnapshot = JSON.stringify(
        persistedConfiguration.rules
      );

      if (
        requestedRulesSnapshot !== persistedRulesSnapshot
      ) {
        console.error(
          "Violation rules persistence verification mismatch."
        );

        return res.status(500).json({
          success: false,
          error:
            "Violation rules persistence verification failed.",
        });
      }

      const categoryCount =
        persistedConfiguration.rules.length;

      const ruleCount = countViolationRules(
        persistedConfiguration.rules
      );

      const previousRuleCount = previousConfiguration
        ? countViolationRules(previousConfiguration.rules)
        : 0;

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: "UPDATE_VIOLATION_RULES",
        description:
          `Updated system violation rules configuration: ${categoryCount} categor${
            categoryCount === 1 ? "y" : "ies"
          }, ${ruleCount} rule${ruleCount === 1 ? "" : "s"}${
            previousConfiguration
              ? ` (previously ${previousRuleCount} rule${
                  previousRuleCount === 1 ? "" : "s"
                })`
              : ""
          }.`,
      });

      return res.status(200).json({
        success: true,
        message:
          "Violation rules were updated successfully.",
        configured: true,
        rules: persistedConfiguration.rules,
        metadata: persistedConfiguration.metadata,
      });
    } catch (error) {
      console.error(
        "Violation rules update error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to update violation rules configuration.",
      });
    }
  }
);

/*
 * ==================================================
 * PERFORMANCE EVALUATION CONFIGURATION
 * ==================================================
 */

router.get(
  "/settings/performance-evaluation",
  verifyToken,
  authorizeRoles(...PERFORMANCE_EVALUATION_READ_ROLES),
  async (req, res) => {
    try {
      const configuration =
        await getPerformanceEvaluationConfiguration();

      if (!configuration) {
        const defaultConfiguration =
          getDefaultPerformanceEvaluationConfiguration();

        return res.status(200).json({
          success: true,
          configured: false,
          schemaVersion: defaultConfiguration.schemaVersion,
          ratingScale: defaultConfiguration.ratingScale,
          kpiFactors: defaultConfiguration.kpiFactors,
          metadata: defaultConfiguration.metadata,
        });
      }

      return res.status(200).json({
        success: true,
        configured: true,
        schemaVersion: configuration.schemaVersion,
        ratingScale: configuration.ratingScale,
        kpiFactors: configuration.kpiFactors,
        metadata: configuration.metadata,
      });
    } catch (error) {
      console.error(
        "Performance evaluation fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch performance evaluation configuration.",
      });
    }
  }
);

router.put(
  "/settings/performance-evaluation",
  verifyToken,
  authorizeRoles(...PERFORMANCE_EVALUATION_WRITE_ROLES),
  async (req, res) => {
    const normalizedResult =
      normalizePerformanceEvaluationConfiguration({
        ratingScale: req.body?.ratingScale,
        kpiFactors: req.body?.kpiFactors,
      });

    if (!normalizedResult.valid) {
      return res.status(400).json({
        success: false,
        error: normalizedResult.error,
      });
    }

    const nextConfiguration = {
      ...normalizedResult.configuration,
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: getCurrentUserName(req.user),
        updatedByRole:
          req.user?.role || "Authorized User",
      },
    };

    let serializedConfiguration;

    try {
      serializedConfiguration = JSON.stringify(
        nextConfiguration
      );
    } catch {
      return res.status(400).json({
        success: false,
        error:
          "Performance evaluation configuration could not be serialized.",
      });
    }

    if (
      Buffer.byteLength(serializedConfiguration, "utf8") >
      MAX_CONFIGURATION_BYTES
    ) {
      return res.status(413).json({
        success: false,
        error:
          "Performance evaluation configuration is too large.",
      });
    }

    try {
      const previousConfiguration =
        await getPerformanceEvaluationConfiguration();

      const [saveResult] = await db.promise().query(
        `
        INSERT INTO system_settings (
          setting_name,
          setting_value
        )
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
        `,
        [
          PERFORMANCE_EVALUATION_SETTING_NAME,
          serializedConfiguration,
        ]
      );

      if (Number(saveResult?.affectedRows || 0) < 1) {
        console.error(
          "Performance evaluation save did not affect a settings row:",
          saveResult
        );

        return res.status(500).json({
          success: false,
          error:
            "Performance evaluation update could not be confirmed.",
        });
      }

      const persistedConfiguration =
        await getPerformanceEvaluationConfiguration();

      if (!persistedConfiguration) {
        return res.status(500).json({
          success: false,
          error:
            "Performance evaluation configuration could not be verified after saving.",
        });
      }

      const requestedSnapshot = JSON.stringify({
        ratingScale:
          normalizedResult.configuration.ratingScale,
        kpiFactors:
          normalizedResult.configuration.kpiFactors,
      });

      const persistedSnapshot = JSON.stringify({
        ratingScale: persistedConfiguration.ratingScale,
        kpiFactors: persistedConfiguration.kpiFactors,
      });

      if (requestedSnapshot !== persistedSnapshot) {
        console.error(
          "Performance evaluation persistence verification mismatch."
        );

        return res.status(500).json({
          success: false,
          error:
            "Performance evaluation persistence verification failed.",
        });
      }

      const ratingRangeCount =
        persistedConfiguration.ratingScale.length;

      const factorCount =
        persistedConfiguration.kpiFactors.length;

      const previousRatingRangeCount =
        previousConfiguration?.ratingScale?.length || 0;

      const previousFactorCount =
        previousConfiguration?.kpiFactors?.length || 0;

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: "UPDATE_PERFORMANCE_EVALUATION",
        description:
          `Updated performance evaluation framework: ${ratingRangeCount} rating range${
            ratingRangeCount === 1 ? "" : "s"
          } and ${factorCount} KPI factor${
            factorCount === 1 ? "" : "s"
          }${
            previousConfiguration
              ? ` (previously ${previousRatingRangeCount} rating range${
                  previousRatingRangeCount === 1 ? "" : "s"
                } and ${previousFactorCount} KPI factor${
                  previousFactorCount === 1 ? "" : "s"
                })`
              : ""
          }.`,
      });

      return res.status(200).json({
        success: true,
        message:
          "Performance evaluation framework was updated successfully.",
        configured: true,
        schemaVersion: persistedConfiguration.schemaVersion,
        ratingScale: persistedConfiguration.ratingScale,
        kpiFactors: persistedConfiguration.kpiFactors,
        metadata: persistedConfiguration.metadata,
      });
    } catch (error) {
      console.error(
        "Performance evaluation update error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to update performance evaluation configuration.",
      });
    }
  }
);

/*
 * ==================================================
 * CLIENT COMPANY MASTER CONFIGURATION
 * ==================================================
 *
 * These endpoints are part of System Configuration.
 * Only Super Admin and HR Manager may view or manage
 * this master data.
 *
 * Company records are never hard-deleted. Deactivation
 * removes them from future selectable choices while
 * existing operational records remain intact.
 */

router.get(
  "/settings/client-companies",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_READ_ROLES),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `
        SELECT
          cc.id,
          cc.company_name,
          cc.is_active,
          cc.created_at,
          cc.updated_at,

          COUNT(DISTINCT cp.id) AS position_count,

          COUNT(
            DISTINCT CASE
              WHEN cp.is_active = 1
                THEN cp.id
              ELSE NULL
            END
          ) AS active_position_count,

          COUNT(
            DISTINCT CASE
              WHEN u.role = 'HR_COORDINATOR'
                THEN u.id
              ELSE NULL
            END
          ) AS assigned_hr_coordinator_count

        FROM client_companies AS cc

        LEFT JOIN company_positions AS cp
          ON cp.company_id = cc.id

        LEFT JOIN users AS u
          ON u.role = 'HR_COORDINATOR'
          AND (
            CONVERT(
              TRIM(u.assigned_company)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
          ) =
          (
            CONVERT(
              TRIM(cc.company_name)
              USING utf8mb4
            ) COLLATE utf8mb4_unicode_ci
          )

        GROUP BY
          cc.id,
          cc.company_name,
          cc.is_active,
          cc.created_at,
          cc.updated_at

        ORDER BY
          cc.is_active DESC,
          cc.company_name ASC,
          cc.id ASC
        `
      );

      return res.status(200).json({
        success: true,
        companies: rows.map(mapCompanyRow),
      });
    } catch (error) {
      console.error(
        "Client companies fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch client companies.",
      });
    }
  }
);

router.post(
  "/settings/client-companies",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_WRITE_ROLES),
  async (req, res) => {
    const companyName = normalizeSingleLineText(
      req.body?.companyName ?? req.body?.company_name
    );

    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: "Company name is required.",
      });
    }

    if (companyName.length > MAX_COMPANY_NAME_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Company name must not exceed ${MAX_COMPANY_NAME_LENGTH} characters.`,
      });
    }

    try {
      const [existingRows] = await db.promise().query(
        `
        SELECT
          id,
          company_name,
          is_active
        FROM client_companies
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(?))
        LIMIT 1
        `,
        [companyName]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];

        return res.status(409).json({
          success: false,
          error:
            Number(existing.is_active) === 1
              ? "That client company already exists."
              : "That client company already exists but is inactive. Reactivate it instead of creating a duplicate.",
          company: {
            id: Number(existing.id),
            companyName: existing.company_name,
            isActive: Boolean(Number(existing.is_active)),
          },
        });
      }

      const [insertResult] = await db.promise().query(
        `
        INSERT INTO client_companies (
          company_name,
          is_active
        )
        VALUES (?, 1)
        `,
        [companyName]
      );

      const companyId = Number(insertResult.insertId);
      const persistedCompany = await getClientCompanyById(
        companyId
      );

      if (!persistedCompany) {
        return res.status(500).json({
          success: false,
          error:
            "Client company could not be verified after creation.",
        });
      }

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: "ADD_CLIENT_COMPANY",
        description: `Added client company "${persistedCompany.company_name}" to System Configuration.`,
      });

      return res.status(201).json({
        success: true,
        message: "Client company added successfully.",
        company: mapCompanyRow({
          ...persistedCompany,
          position_count: 0,
          active_position_count: 0,
          assigned_hr_coordinator_count: 0,
        }),
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        return res.status(409).json({
          success: false,
          error:
            "That client company already exists. Reactivate the existing record if it is inactive.",
        });
      }

      console.error(
        "Client company creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to add client company.",
      });
    }
  }
);

router.patch(
  "/settings/client-companies/:companyId/status",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_WRITE_ROLES),
  async (req, res) => {
    const companyId = parsePositiveInteger(
      req.params?.companyId
    );

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "A valid company ID is required.",
      });
    }

    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "isActive must be true or false.",
      });
    }

    try {
      const existingCompany = await getClientCompanyById(
        companyId
      );

      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          error: "Client company not found.",
        });
      }

      const previousStatus = Boolean(
        Number(existingCompany.is_active)
      );

      if (!isActive) {
        const [assignmentRows] = await db.promise().query(
          `
          SELECT
            COUNT(*) AS count
          FROM users
          WHERE role = 'HR_COORDINATOR'
            AND LOWER(TRIM(assigned_company)) =
                LOWER(TRIM(?))
          `,
          [existingCompany.company_name]
        );

        const assignedCoordinatorCount = Number(
          assignmentRows[0]?.count || 0
        );

        if (assignedCoordinatorCount > 0) {
          return res.status(409).json({
            success: false,
            error:
              "This company cannot be deactivated while an HR Coordinator is assigned to it. Reassign the HR Coordinator first.",
            assignedHrCoordinatorCount:
              assignedCoordinatorCount,
          });
        }
      }

      if (previousStatus !== isActive) {
        const [updateResult] = await db.promise().query(
          `
          UPDATE client_companies
          SET is_active = ?
          WHERE id = ?
          `,
          [isActive ? 1 : 0, companyId]
        );

        if (Number(updateResult?.affectedRows || 0) !== 1) {
          return res.status(500).json({
            success: false,
            error:
              "Client company status update could not be confirmed.",
          });
        }
      }

      const persistedCompany = await getClientCompanyById(
        companyId
      );

      if (!persistedCompany) {
        return res.status(500).json({
          success: false,
          error:
            "Client company could not be verified after the status update.",
        });
      }

      const persistedStatus = Boolean(
        Number(persistedCompany.is_active)
      );

      if (persistedStatus !== isActive) {
        return res.status(500).json({
          success: false,
          error:
            "Client company status verification failed.",
        });
      }

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: isActive
          ? "REACTIVATE_CLIENT_COMPANY"
          : "DEACTIVATE_CLIENT_COMPANY",
        description:
          previousStatus === persistedStatus
            ? `Client company "${persistedCompany.company_name}" status was confirmed as ${
                persistedStatus ? "Active" : "Inactive"
              }.`
            : `Client company "${persistedCompany.company_name}" was ${
                persistedStatus ? "reactivated" : "deactivated"
              } in System Configuration.`,
      });

      return res.status(200).json({
        success: true,
        message: `Client company ${
          persistedStatus ? "activated" : "deactivated"
        } successfully.`,
        company: {
          id: Number(persistedCompany.id),
          companyName: persistedCompany.company_name,
          isActive: persistedStatus,
          createdAt: persistedCompany.created_at || null,
          updatedAt: persistedCompany.updated_at || null,
        },
      });
    } catch (error) {
      console.error(
        "Client company status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to update client company status.",
      });
    }
  }
);

/*
 * ==================================================
 * COMPANY POSITION MASTER CONFIGURATION
 * ==================================================
 */

router.get(
  "/settings/client-companies/:companyId/positions",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_READ_ROLES),
  async (req, res) => {
    const companyId = parsePositiveInteger(
      req.params?.companyId
    );

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "A valid company ID is required.",
      });
    }

    try {
      const company = await getClientCompanyById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          error: "Client company not found.",
        });
      }

      const [rows] = await db.promise().query(
        `
        SELECT
          cp.id,
          cp.company_id,
          cp.position_name,
          cp.is_active,
          cp.created_at,
          cp.updated_at,
          cc.company_name
        FROM company_positions AS cp
        INNER JOIN client_companies AS cc
          ON cc.id = cp.company_id
        WHERE cp.company_id = ?
        ORDER BY
          cp.is_active DESC,
          cp.position_name ASC,
          cp.id ASC
        `,
        [companyId]
      );

      return res.status(200).json({
        success: true,
        company: {
          id: Number(company.id),
          companyName: company.company_name,
          isActive: Boolean(Number(company.is_active)),
        },
        positions: rows.map(mapPositionRow),
      });
    } catch (error) {
      console.error(
        "Company positions fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch company positions.",
      });
    }
  }
);

router.post(
  "/settings/client-companies/:companyId/positions",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_WRITE_ROLES),
  async (req, res) => {
    const companyId = parsePositiveInteger(
      req.params?.companyId
    );

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "A valid company ID is required.",
      });
    }

    const positionName = normalizeSingleLineText(
      req.body?.positionName ?? req.body?.position_name
    );

    if (!positionName) {
      return res.status(400).json({
        success: false,
        error: "Position name is required.",
      });
    }

    if (positionName.length > MAX_POSITION_NAME_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Position name must not exceed ${MAX_POSITION_NAME_LENGTH} characters.`,
      });
    }

    try {
      const company = await getClientCompanyById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          error: "Client company not found.",
        });
      }

      if (Number(company.is_active) !== 1) {
        return res.status(409).json({
          success: false,
          error:
            "Positions cannot be added to an inactive client company. Reactivate the company first.",
        });
      }

      const [existingRows] = await db.promise().query(
        `
        SELECT
          id,
          position_name,
          is_active
        FROM company_positions
        WHERE company_id = ?
          AND LOWER(TRIM(position_name)) =
              LOWER(TRIM(?))
        LIMIT 1
        `,
        [companyId, positionName]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];

        return res.status(409).json({
          success: false,
          error:
            Number(existing.is_active) === 1
              ? "That position already exists for this company."
              : "That position already exists for this company but is inactive. Reactivate it instead of creating a duplicate.",
          position: {
            id: Number(existing.id),
            positionName: existing.position_name,
            isActive: Boolean(Number(existing.is_active)),
          },
        });
      }

      const [insertResult] = await db.promise().query(
        `
        INSERT INTO company_positions (
          company_id,
          position_name,
          is_active
        )
        VALUES (?, ?, 1)
        `,
        [companyId, positionName]
      );

      const positionId = Number(insertResult.insertId);
      const persistedPosition =
        await getCompanyPositionById(positionId);

      if (!persistedPosition) {
        return res.status(500).json({
          success: false,
          error:
            "Company position could not be verified after creation.",
        });
      }

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: "ADD_COMPANY_POSITION",
        description: `Added position "${persistedPosition.position_name}" for client company "${persistedPosition.company_name}".`,
      });

      return res.status(201).json({
        success: true,
        message: "Company position added successfully.",
        position: mapPositionRow(persistedPosition),
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        return res.status(409).json({
          success: false,
          error:
            "That position already exists for this company. Reactivate the existing position if it is inactive.",
        });
      }

      console.error(
        "Company position creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to add company position.",
      });
    }
  }
);

router.patch(
  "/settings/company-positions/:positionId/status",
  verifyToken,
  authorizeRoles(...COMPANY_MASTER_WRITE_ROLES),
  async (req, res) => {
    const positionId = parsePositiveInteger(
      req.params?.positionId
    );

    if (!positionId) {
      return res.status(400).json({
        success: false,
        error: "A valid position ID is required.",
      });
    }

    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "isActive must be true or false.",
      });
    }

    try {
      const existingPosition =
        await getCompanyPositionById(positionId);

      if (!existingPosition) {
        return res.status(404).json({
          success: false,
          error: "Company position not found.",
        });
      }

      if (
        isActive &&
        Number(existingPosition.company_is_active) !== 1
      ) {
        return res.status(409).json({
          success: false,
          error:
            "This position cannot be reactivated while its client company is inactive. Reactivate the company first.",
        });
      }

      const previousStatus = Boolean(
        Number(existingPosition.is_active)
      );

      if (previousStatus !== isActive) {
        const [updateResult] = await db.promise().query(
          `
          UPDATE company_positions
          SET is_active = ?
          WHERE id = ?
          `,
          [isActive ? 1 : 0, positionId]
        );

        if (Number(updateResult?.affectedRows || 0) !== 1) {
          return res.status(500).json({
            success: false,
            error:
              "Company position status update could not be confirmed.",
          });
        }
      }

      const persistedPosition =
        await getCompanyPositionById(positionId);

      if (!persistedPosition) {
        return res.status(500).json({
          success: false,
          error:
            "Company position could not be verified after the status update.",
        });
      }

      const persistedStatus = Boolean(
        Number(persistedPosition.is_active)
      );

      if (persistedStatus !== isActive) {
        return res.status(500).json({
          success: false,
          error:
            "Company position status verification failed.",
        });
      }

      await logAudit({
        userId: req.user?.userId ?? req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        category: getAuditCategory(),
        action: isActive
          ? "REACTIVATE_COMPANY_POSITION"
          : "DEACTIVATE_COMPANY_POSITION",
        description:
          previousStatus === persistedStatus
            ? `Position "${persistedPosition.position_name}" for "${persistedPosition.company_name}" status was confirmed as ${
                persistedStatus ? "Active" : "Inactive"
              }.`
            : `Position "${persistedPosition.position_name}" for "${persistedPosition.company_name}" was ${
                persistedStatus ? "reactivated" : "deactivated"
              }.`,
      });

      return res.status(200).json({
        success: true,
        message: `Company position ${
          persistedStatus ? "activated" : "deactivated"
        } successfully.`,
        position: mapPositionRow(persistedPosition),
      });
    } catch (error) {
      console.error(
        "Company position status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to update company position status.",
      });
    }
  }
);

module.exports = router;
