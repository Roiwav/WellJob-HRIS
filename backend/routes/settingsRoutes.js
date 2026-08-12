// routes/settingsRoutes.js

const express = require("express");

const router = express.Router();

const db = require("../config/db");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

/*
 * GET CURRENT MAINTENANCE STATUS
 *
 * IT_SUPPORT only.
 *
 * The route remains reachable while maintenance mode
 * is active, but the requester must still have a valid
 * authenticated IT_SUPPORT account.
 */
router.get(
  "/settings/maintenance-status",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    try {
      const [rows] =
        await db.promise().query(
          `
          SELECT setting_value
          FROM system_settings
          WHERE setting_name = 'maintenance_mode'
          LIMIT 1
          `
        );

      if (rows.length === 0) {
        return res.status(404).json({
          error: "Setting not found",
        });
      }

      const settingValue =
        rows[0].setting_value;

      const isMaintenanceOn =
        settingValue === 1 ||
        settingValue === true ||
        String(settingValue) === "1";

      return res.status(200).json({
        isMaintenanceOn,
      });
    } catch (error) {
      console.error(
        "Maintenance status database error:",
        error
      );

      return res.status(500).json({
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
 * Authorization comes from req.user.
 * Request body values are used only as setting data,
 * never as authority.
 */
router.post(
  "/settings/toggle-maintenance",
  verifyToken,
  authorizeRoles("IT_SUPPORT"),
  async (req, res) => {
    const { status } = req.body || {};

    if (typeof status !== "boolean") {
      return res.status(400).json({
        error:
          "Maintenance status must be true or false.",
      });
    }

    try {
      await db.promise().query(
        `
        UPDATE system_settings
        SET setting_value = ?
        WHERE setting_name = 'maintenance_mode'
        `,
        [status ? 1 : 0]
      );

      return res.status(200).json({
        message:
          "System Maintenance Mode successfully updated!",
        isMaintenanceOn: status,
      });
    } catch (error) {
      console.error(
        "Maintenance toggle database error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to update maintenance mode.",
      });
    }
  }
);

module.exports = router;