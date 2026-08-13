// routes/settingsRoutes.js

const express = require("express");

const router = express.Router();

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

const MAINTENANCE_SETTING_NAME =
  "maintenance_mode";

function isMaintenanceEnabled(
  settingValue
) {
  return (
    settingValue === 1 ||
    settingValue === true ||
    String(settingValue) === "1"
  );
}

async function getMaintenanceSetting() {
  const [rows] =
    await db.promise().query(
      `
      SELECT
        setting_name,
        setting_value
      FROM system_settings
      WHERE setting_name = ?
      LIMIT 1
      `,
      [
        MAINTENANCE_SETTING_NAME,
      ]
    );

  return rows[0] || null;
}

/*
 * GET CURRENT MAINTENANCE STATUS
 *
 * IT_SUPPORT only.
 *
 * This route remains reachable through the
 * maintenance middleware bypass so legitimate
 * technical recovery remains possible.
 *
 * Authentication and authorization are still
 * enforced here using the verified JWT identity.
 */
router.get(
  "/settings/maintenance-status",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    try {
      const setting =
        await getMaintenanceSetting();

      /*
       * The required system setting must already
       * exist. Do not silently invent or insert
       * configuration during a read request.
       */
      if (!setting) {
        return res.status(404).json({
          success: false,
          error:
            "Maintenance setting not found",
          message:
            "The maintenance_mode system setting is not configured.",
        });
      }

      return res.status(200).json({
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

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch maintenance status.",
      });
    }
  }
);

/*
 * TOGGLE MAINTENANCE MODE
 *
 * Sensitive technical control.
 * IT_SUPPORT only.
 *
 * Security authority comes exclusively from
 * req.user after verifyToken + authorizeRoles.
 *
 * Request-body status is configuration data only.
 * It is never used for identity or authorization.
 */
router.post(
  "/settings/toggle-maintenance",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    const { status } =
      req.body || {};

    if (
      typeof status !==
      "boolean"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Maintenance status must be true or false.",
      });
    }

    try {
      /*
       * First verify that the required configuration
       * row actually exists.
       */
      const existingSetting =
        await getMaintenanceSetting();

      if (!existingSetting) {
        return res.status(404).json({
          success: false,
          error:
            "Maintenance setting not found",
          message:
            "The maintenance_mode system setting is not configured.",
        });
      }

      const previousStatus =
        isMaintenanceEnabled(
          existingSetting.setting_value
        );

      const nextValue =
        status ? 1 : 0;

      const [updateResult] =
        await db.promise().query(
          `
          UPDATE system_settings
          SET setting_value = ?
          WHERE setting_name = ?
          `,
          [
            nextValue,
            MAINTENANCE_SETTING_NAME,
          ]
        );

      /*
       * UPDATE must match exactly the required
       * maintenance configuration row.
       */
      if (
        Number(
          updateResult?.affectedRows ||
            0
        ) !== 1
      ) {
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

      /*
       * Re-read persisted state.
       *
       * Never report success based only on the
       * request body's desired value.
       */
      const persistedSetting =
        await getMaintenanceSetting();

      if (!persistedSetting) {
        return res.status(500).json({
          success: false,
          error:
            "Maintenance mode state could not be verified after update.",
        });
      }

      const persistedStatus =
        isMaintenanceEnabled(
          persistedSetting.setting_value
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

        return res.status(500).json({
          success: false,
          error:
            "Maintenance mode state verification failed.",
        });
      }

      /*
       * Trusted technical audit.
       *
       * Actor identity comes only from req.user.
       */
      await logAudit({
        userId:
          req.user?.userId ??
          req.user?.id,

        username:
          req.user?.username,

        role:
          req.user?.role,

        category:
          AUDIT_CATEGORY.TECHNICAL,

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

      /*
       * Preserve the frontend's existing successful
       * response contract.
       */
      return res.status(200).json({
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

      return res.status(500).json({
        success: false,
        error:
          "Failed to update maintenance mode.",
      });
    }
  }
);

module.exports = router;