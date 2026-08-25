// routes/settingsRoutes.js

const express = require("express");

const db = require("../config/db");
const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

const MAINTENANCE_SETTING_NAME =
  "maintenance_mode";

const VIOLATION_RULES_SETTING_NAME =
  "violation_rules";

const VIOLATION_RULES_READ_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
];

const VIOLATION_RULES_WRITE_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
];

const SEVERITY_SCORE =
  Object.freeze({
    Minor: 1,
    Major: 2,
    Critical: 3,
  });

const ALLOWED_SEVERITIES =
  new Set(
    Object.keys(
      SEVERITY_SCORE
    )
  );

const MAX_VIOLATION_CATEGORIES = 50;
const MAX_VIOLATION_RULES = 1000;

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

function normalizeString(
  value,
  maxLength = null
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (
    maxLength &&
    normalized.length >
      maxLength
  ) {
    return normalized.slice(
      0,
      maxLength
    );
  }

  return normalized;
}

function normalizeSeverity(
  value,
  {
    allowLegacyMultiple = false,
  } = {}
) {
  const rawValues =
    Array.isArray(value)
      ? value
      : value !== null &&
          value !== undefined &&
          value !== ""
        ? [value]
        : [];

  const normalizedValues =
    rawValues.map(
      (item) =>
        normalizeString(
          item,
          50
        )
    );

  if (
    normalizedValues.length ===
    0
  ) {
    return {
      valid: false,

      error:
        "Exactly one severity is required.",

      severity: [],
    };
  }

  if (
    normalizedValues.some(
      (severity) =>
        !ALLOWED_SEVERITIES.has(
          severity
        )
    )
  ) {
    return {
      valid: false,

      error:
        "Severity must be Minor, Major, or Critical.",

      severity: [],
    };
  }

  const uniqueSeverities = [
    ...new Set(
      normalizedValues
    ),
  ];

  if (
    !allowLegacyMultiple &&
    (
      normalizedValues.length !==
        1 ||
      uniqueSeverities.length !==
        1
    )
  ) {
    return {
      valid: false,

      error:
        "Exactly one severity is required. Select only Minor, Major, or Critical.",

      severity: [],
    };
  }

  /*
   * Backward compatibility:
   *
   * Older stored configurations may contain
   * more than one valid severity.
   *
   * Reads remain available by resolving those
   * legacy values to the highest severity.
   *
   * All new writes remain strict and must
   * contain exactly one severity.
   */
  const normalizedSeverity =
    allowLegacyMultiple
      ? [
          uniqueSeverities.reduce(
            (
              highest,
              current
            ) =>
              SEVERITY_SCORE[
                current
              ] >
              SEVERITY_SCORE[
                highest
              ]
                ? current
                : highest,

            uniqueSeverities[0]
          ),
        ]
      : uniqueSeverities;

  return {
    valid: true,
    error: null,

    severity:
      normalizedSeverity,
  };
}

function normalizePenalty(
  penalty,
  index
) {
  if (
    typeof penalty ===
    "string"
  ) {
    return normalizeString(
      penalty,
      2000
    );
  }

  if (
    !penalty ||
    typeof penalty !==
      "object" ||
    Array.isArray(penalty)
  ) {
    return "";
  }

  const numericOffenseNo =
    Number(
      penalty.offenseNo
    );

  return {
    offenseNo:
      Number.isInteger(
        numericOffenseNo
      ) &&
      numericOffenseNo > 0 &&
      numericOffenseNo <= 100
        ? numericOffenseNo
        : index + 1,

    label:
      normalizeString(
        penalty.label ||
          `Offense ${
            index + 1
          }`,
        250
      ),

    action:
      normalizeString(
        penalty.action,
        2000
      ),
  };
}

function hasValidPenalty(
  penalty
) {
  if (
    typeof penalty ===
    "string"
  ) {
    return Boolean(
      penalty.trim()
    );
  }

  return Boolean(
    penalty &&
      typeof penalty ===
        "object" &&
      !Array.isArray(
        penalty
      ) &&
      penalty.action
  );
}

function normalizeViolationRules(
  rules,
  {
    allowLegacyMultipleSeverity =
      false,
  } = {}
) {
  if (
    !Array.isArray(rules)
  ) {
    return {
      valid: false,

      error:
        "Violation rules must be an array.",

      rules: [],
    };
  }

  if (
    rules.length === 0
  ) {
    return {
      valid: false,

      error:
        "At least one violation category is required.",

      rules: [],
    };
  }

  if (
    rules.length >
    MAX_VIOLATION_CATEGORIES
  ) {
    return {
      valid: false,

      error:
        `Violation rules cannot contain more than ${MAX_VIOLATION_CATEGORIES} categories.`,

      rules: [],
    };
  }

  let totalRuleCount = 0;

  const normalizedGroups = [];

  for (
    let groupIndex = 0;
    groupIndex <
    rules.length;
    groupIndex += 1
  ) {
    const group =
      rules[groupIndex];

    if (
      !group ||
      typeof group !==
        "object" ||
      Array.isArray(group)
    ) {
      return {
        valid: false,

        error:
          `Violation category ${
            groupIndex + 1
          } is invalid.`,

        rules: [],
      };
    }

    const category =
      normalizeString(
        group.category,
        250
      );

    if (!category) {
      return {
        valid: false,

        error:
          `Violation category ${
            groupIndex + 1
          } must have a name.`,

        rules: [],
      };
    }

    if (
      !Array.isArray(
        group.rows
      ) ||
      group.rows.length === 0
    ) {
      return {
        valid: false,

        error:
          `${category} must contain at least one violation rule.`,

        rules: [],
      };
    }

    const normalizedRows = [];

    for (
      let rowIndex = 0;
      rowIndex <
      group.rows.length;
      rowIndex += 1
    ) {
      const rule =
        group.rows[rowIndex];

      const rulePrefix =
        `${category}, Rule ${
          rowIndex + 1
        }`;

      if (
        !rule ||
        typeof rule !==
          "object" ||
        Array.isArray(rule)
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix} is invalid.`,

          rules: [],
        };
      }

      totalRuleCount += 1;

      if (
        totalRuleCount >
        MAX_VIOLATION_RULES
      ) {
        return {
          valid: false,

          error:
            `Violation rules cannot contain more than ${MAX_VIOLATION_RULES} rules.`,

          rules: [],
        };
      }

      const id =
        normalizeString(
          rule.id,
          255
        );

      const section =
        normalizeString(
          rule.section,
          150
        );

      const violation =
        normalizeString(
          rule.violation,
          500
        );

      const description =
        normalizeString(
          rule.description,
          10000
        );

      const penaltyLevel =
        normalizeString(
          rule.penaltyLevel,
          500
        );

      const severityResult =
        normalizeSeverity(
          rule.severity,
          {
            allowLegacyMultiple:
              allowLegacyMultipleSeverity,
          }
        );

      const penalties =
        Array.isArray(
          rule.penalties
        )
          ? rule.penalties
              .map(
                (
                  penalty,
                  penaltyIndex
                ) =>
                  normalizePenalty(
                    penalty,
                    penaltyIndex
                  )
              )
              .filter(
                hasValidPenalty
              )
          : [];

      if (!section) {
        return {
          valid: false,

          error:
            `${rulePrefix}: section is required.`,

          rules: [],
        };
      }

      if (!violation) {
        return {
          valid: false,

          error:
            `${rulePrefix}: violation title is required.`,

          rules: [],
        };
      }

      if (!description) {
        return {
          valid: false,

          error:
            `${rulePrefix}: description is required.`,

          rules: [],
        };
      }

      if (!penaltyLevel) {
        return {
          valid: false,

          error:
            `${rulePrefix}: penalty level is required.`,

          rules: [],
        };
      }

      if (
        !severityResult.valid
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix}: ${severityResult.error}`,

          rules: [],
        };
      }

      if (
        penalties.length === 0
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix}: at least one penalty is required.`,

          rules: [],
        };
      }

      normalizedRows.push({
        ...(id
          ? {
              id,
            }
          : {}),

        section,
        violation,
        description,
        penaltyLevel,

        severity:
          severityResult.severity,

        penalties,
      });
    }

    normalizedGroups.push({
      category,

      rows:
        normalizedRows,
    });
  }

  return {
    valid: true,
    error: null,

    rules:
      normalizedGroups,
  };
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
  return (
    AUDIT_CATEGORY
      .SYSTEM_CONFIGURATION ||
    AUDIT_CATEGORY.TECHNICAL
  );
}

function countViolationRules(
  rules = []
) {
  return rules.reduce(
    (
      total,
      group
    ) =>
      total +
      (
        Array.isArray(
          group?.rows
        )
          ? group.rows.length
          : 0
      ),
    0
  );
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

function parseViolationRulesSetting(
  settingValue
) {
  if (
    settingValue === null ||
    settingValue ===
      undefined ||
    String(
      settingValue
    ).trim() === ""
  ) {
    return null;
  }

  let parsedValue;

  try {
    parsedValue =
      typeof settingValue ===
      "string"
        ? JSON.parse(
            settingValue
          )
        : settingValue;
  } catch {
    throw new Error(
      "The stored violation rules configuration contains invalid JSON."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object" ||
    Array.isArray(
      parsedValue
    )
  ) {
    throw new Error(
      "The stored violation rules configuration is invalid."
    );
  }

  /*
   * Stored configuration uses legacy-compatible
   * reads so an older multi-severity record does
   * not make the configuration endpoint unusable.
   *
   * PUT requests below still use strict validation.
   */
  const normalizedResult =
    normalizeViolationRules(
      parsedValue.rules,
      {
        allowLegacyMultipleSeverity:
          true,
      }
    );

  if (
    !normalizedResult.valid
  ) {
    throw new Error(
      `The stored violation rules configuration is invalid: ${normalizedResult.error}`
    );
  }

  return {
    rules:
      normalizedResult.rules,

    metadata: {
      updatedAt:
        parsedValue?.metadata
          ?.updatedAt ||
        null,

      updatedBy:
        parsedValue?.metadata
          ?.updatedBy ||
        null,

      updatedByRole:
        parsedValue?.metadata
          ?.updatedByRole ||
        null,
    },
  };
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
      const setting =
        await getSystemSetting(
          VIOLATION_RULES_SETTING_NAME
        );

      if (!setting) {
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

      const configuration =
        parseViolationRulesSetting(
          setting.setting_value
        );

      if (
        !configuration
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Violation rules configuration is empty.",
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
     * No legacy multi-severity compatibility
     * is enabled here.
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
      const existingSetting =
        await getSystemSetting(
          VIOLATION_RULES_SETTING_NAME
        );

      const previousConfiguration =
        existingSetting
          ? parseViolationRulesSetting(
              existingSetting
                .setting_value
            )
          : null;

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

      const persistedSetting =
        await getSystemSetting(
          VIOLATION_RULES_SETTING_NAME
        );

      if (
        !persistedSetting
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Violation rules configuration could not be verified after saving.",
          });
      }

      const persistedConfiguration =
        parseViolationRulesSetting(
          persistedSetting
            .setting_value
        );

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