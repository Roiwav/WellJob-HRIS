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
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

const MAINTENANCE_SETTING_NAME =
  "maintenance_mode";

const VIOLATION_RULES_READ_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
];

const VIOLATION_RULES_WRITE_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
];

const MAX_CONFIGURATION_BYTES =
  1024 * 1024;

function isMaintenanceEnabled(
  value
) {
  return (
    value === 1 ||
    value === true ||
    String(value) === "1"
  );
}

function getCurrentUserName(
  user
) {
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

async function getSystemSetting(
  settingName
) {
  const [rows] =
    await db
      .promise()
      .query(
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

  return (
    rows[0] ||
    null
  );
}

async function getMaintenanceSetting() {
  return getSystemSetting(
    MAINTENANCE_SETTING_NAME
  );
}

/*
 * ==================================================
 * MAINTENANCE SETTINGS
 * ==================================================
 */

router.get(
  "/settings/maintenance-status",

  verifyToken,

  authorizeRoles(
    "IT_SUPPORT"
  ),

  async (
    req,
    res
  ) => {
    try {
      const setting =
        await getMaintenanceSetting();

      if (!setting) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Maintenance setting not found",

            message:
              "The maintenance_mode system setting is not configured.",
          });
      }

      return res
        .status(200)
        .json({
          isMaintenanceOn:
            isMaintenanceEnabled(
              setting.setting_value
            ),
        });
    } catch (error) {
      console.error(
        "Maintenance status database error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to fetch maintenance status.",
        });
    }
  }
);

router.post(
  "/settings/toggle-maintenance",

  verifyToken,

  authorizeRoles(
    "IT_SUPPORT"
  ),

  async (
    req,
    res
  ) => {
    const {
      status,
    } =
      req.body || {};

    if (
      typeof status !==
      "boolean"
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            "Maintenance status must be true or false.",
        });
    }

    try {
      const existingSetting =
        await getMaintenanceSetting();

      if (
        !existingSetting
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Maintenance setting not found",

            message:
              "The maintenance_mode system setting is not configured.",
          });
      }

      const previousStatus =
        isMaintenanceEnabled(
          existingSetting
            .setting_value
        );

      const [
        updateResult,
      ] =
        await db
          .promise()
          .query(
            `
            UPDATE system_settings
            SET setting_value = ?
            WHERE setting_name = ?
            `,
            [
              status
                ? 1
                : 0,

              MAINTENANCE_SETTING_NAME,
            ]
          );

      if (
        Number(
          updateResult
            ?.affectedRows ||
            0
        ) !== 1
      ) {
        console.error(
          "Maintenance update did not affect exactly one row:",
          updateResult
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "Maintenance mode update could not be confirmed.",
          });
      }

      const persistedSetting =
        await getMaintenanceSetting();

      if (
        !persistedSetting
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Maintenance mode state could not be verified after update.",
          });
      }

      const persistedStatus =
        isMaintenanceEnabled(
          persistedSetting
            .setting_value
        );

      if (
        persistedStatus !==
        status
      ) {
        console.error(
          "Maintenance state verification mismatch:",
          {
            requestedStatus:
              status,

            persistedStatus,
          }
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "Maintenance mode state verification failed.",
          });
      }

      await logAudit({
        userId:
          req.user?.userId ??
          req.user?.id,

        username:
          req.user
            ?.username,

        role:
          req.user?.role,

        category:
          AUDIT_CATEGORY
            .TECHNICAL,

        action:
          "TOGGLE_MAINTENANCE_MODE",

        description:
          previousStatus ===
          persistedStatus
            ? `Maintenance mode confirmed ${
                persistedStatus
                  ? "ON"
                  : "OFF"
              }.`
            : `Maintenance mode changed from ${
                previousStatus
                  ? "ON"
                  : "OFF"
              } to ${
                persistedStatus
                  ? "ON"
                  : "OFF"
              }.`,
      });

      return res
        .status(200)
        .json({
          message:
            "System Maintenance Mode successfully updated!",

          isMaintenanceOn:
            persistedStatus,
        });
    } catch (error) {
      console.error(
        "Maintenance toggle database error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to update maintenance mode.",
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

  authorizeRoles(
    ...VIOLATION_RULES_READ_ROLES
  ),

  async (
    req,
    res
  ) => {
    try {
      const configuration =
        await getViolationRulesConfiguration();

      if (!configuration) {
        return res
          .status(200)
          .json({
            success: true,

            configured:
              false,

            rules: null,

            metadata: {
              updatedAt:
                null,

              updatedBy:
                null,

              updatedByRole:
                null,
            },
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          configured:
            true,

          rules:
            configuration.rules,

          metadata:
            configuration.metadata,
        });
    } catch (error) {
      console.error(
        "Violation rules fetch error:",
        error
      );

      return res
        .status(500)
        .json({
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

  authorizeRoles(
    ...VIOLATION_RULES_WRITE_ROLES
  ),

  async (
    req,
    res
  ) => {
    /*
     * Strict validation for new writes.
     *
     * Legacy multi-severity compatibility is
     * intentionally enabled only while reading
     * already-stored configuration.
     */
    const normalizedResult =
      normalizeViolationRules(
        req.body?.rules
      );

    if (
      !normalizedResult.valid
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            normalizedResult.error,
        });
    }

    const nextConfiguration = {
      rules:
        normalizedResult.rules,

      metadata: {
        updatedAt:
          new Date()
            .toISOString(),

        updatedBy:
          getCurrentUserName(
            req.user
          ),

        updatedByRole:
          req.user?.role ||
          "Authorized User",
      },
    };

    let serializedConfiguration;

    try {
      serializedConfiguration =
        JSON.stringify(
          nextConfiguration
        );
    } catch {
      return res
        .status(400)
        .json({
          success: false,

          error:
            "Violation rules configuration could not be serialized.",
        });
    }

    if (
      Buffer.byteLength(
        serializedConfiguration,
        "utf8"
      ) >
      MAX_CONFIGURATION_BYTES
    ) {
      return res
        .status(413)
        .json({
          success: false,

          error:
            "Violation rules configuration is too large.",
        });
    }

    try {
      const previousConfiguration =
        await getViolationRulesConfiguration();

      const [
        saveResult,
      ] =
        await db
          .promise()
          .query(
            `
            INSERT INTO system_settings (
              setting_name,
              setting_value
            )
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
              setting_value =
                VALUES(setting_value)
            `,
            [
              VIOLATION_RULES_SETTING_NAME,

              serializedConfiguration,
            ]
          );

      if (
        Number(
          saveResult
            ?.affectedRows ||
            0
        ) < 1
      ) {
        console.error(
          "Violation rules save did not affect a settings row:",
          saveResult
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "Violation rules update could not be confirmed.",
          });
      }

      const persistedConfiguration =
        await getViolationRulesConfiguration();

      if (
        !persistedConfiguration
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Violation rules configuration could not be verified after saving.",
          });
      }

      const requestedRulesSnapshot =
        JSON.stringify(
          normalizedResult.rules
        );

      const persistedRulesSnapshot =
        JSON.stringify(
          persistedConfiguration.rules
        );

      if (
        requestedRulesSnapshot !==
        persistedRulesSnapshot
      ) {
        console.error(
          "Violation rules persistence verification mismatch."
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "Violation rules persistence verification failed.",
          });
      }

      const categoryCount =
        persistedConfiguration
          .rules.length;

      const ruleCount =
        countViolationRules(
          persistedConfiguration
            .rules
        );

      const previousRuleCount =
        previousConfiguration
          ? countViolationRules(
              previousConfiguration
                .rules
            )
          : 0;

      await logAudit({
        userId:
          req.user?.userId ??
          req.user?.id,

        username:
          req.user
            ?.username,

        role:
          req.user?.role,

        category:
          getAuditCategory(),

        action:
          "UPDATE_VIOLATION_RULES",

        description:
          `Updated system violation rules configuration: ${
            categoryCount
          } categor${
            categoryCount ===
            1
              ? "y"
              : "ies"
          }, ${
            ruleCount
          } rule${
            ruleCount ===
            1
              ? ""
              : "s"
          }${
            previousConfiguration
              ? ` (previously ${
                  previousRuleCount
                } rule${
                  previousRuleCount ===
                  1
                    ? ""
                    : "s"
                })`
              : ""
          }.`,
      });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Violation rules were updated successfully.",

          configured:
            true,

          rules:
            persistedConfiguration
              .rules,

          metadata:
            persistedConfiguration
              .metadata,
        });
    } catch (error) {
      console.error(
        "Violation rules update error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to update violation rules configuration.",
        });
    }
  }
);

module.exports = router;