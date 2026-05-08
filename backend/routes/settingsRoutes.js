// routes/settingsRoutes.js
const express = require("express");
const router = express.Router();

// Siguraduhing tama ang path ng iyong database connection file
const db = require("../config/db"); // O palitan ng tamang path gaya ng "../config/db"

// API para i-update ang Maintenance Mode status
router.post("/settings/toggle-maintenance", async (req, res) => {
    const { status } = req.body; 

    try {
        const updateQuery = "UPDATE system_settings SET setting_value = ? WHERE setting_name = 'maintenance_mode'";
        
        // --- FIX: Ginamit natin ang .promise().query() ---
        await db.promise().query(updateQuery, [status]);

        res.status(200).json({ 
            message: "System Maintenance Mode successfully updated!", 
            isMaintenanceOn: status 
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "May error sa pag-update ng database." });
    }
});

// API para i-fetch ang current status (para pag-load ng page, tama ang button)
router.get("/settings/maintenance-status", async (req, res) => {
    try {
        // --- FIX: Ginamit natin ang .promise().query() ---
        const [rows] = await db.promise().query("SELECT setting_value FROM system_settings WHERE setting_name = 'maintenance_mode'");
        
        if (rows.length > 0) {
            // I-convert sa boolean incase 1 o 0 ang ibalik ng MySQL
            const isMaintenance = rows[0].setting_value === 1 || rows[0].setting_value === true;
            res.status(200).json({ isMaintenanceOn: isMaintenance });
        } else {
            res.status(404).json({ error: "Setting not found" });
        }
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to fetch status." });
    }
});

module.exports = router;