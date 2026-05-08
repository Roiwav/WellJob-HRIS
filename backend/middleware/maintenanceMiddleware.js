const db = require('../config/db'); // I-adjust ang path kung nasa config folder ang db.js mo
const jwt = require('jsonwebtoken');

const checkMaintenanceMode = async (req, res, next) => {
    // 1. Huwag i-block ang login at maintenance toggle/status routes
    // Kailangan itong i-bypass para makapag-log in pa rin ang IT Support at ma-turn off ang system
    const bypassRoutes = ['/login', '/settings/toggle-maintenance', '/settings/maintenance-status'];
    
    if (bypassRoutes.some(route => req.path.includes(route))) {
        return next();
    }

    try {
        // 2. I-check sa database kung naka-ON ang maintenance (Ginamit ang .promise())
        const [rows] = await db.promise().query("SELECT setting_value FROM system_settings WHERE setting_name = 'maintenance_mode'");
        const isMaintenanceOn = rows.length > 0 ? (rows[0].setting_value === 1 || rows[0].setting_value === true) : false;

        // Kapag naka-maintenance mode
        if (isMaintenanceOn) {
            // 3. I-check kung sino ang nagre-request gamit ang JWT token sa headers
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                
                // I-decode ang token para makita ang role ng user
                const decoded = jwt.decode(token);

                // TANGING Technical IT Support lang ang i-allow natin na makapasok
                if (decoded && decoded.role === 'Technical IT Support') {
                    return next();
                }
            }

            // 4. Para sa Super Admin, HR Manager, HR Staff, at iba pa, ibato ang 503 error
            return res.status(503).json({ message: "System is currently under maintenance. Please try again later." });
        }

        // Kung hindi naka-maintenance, tuloy lang ang normal flow
        next();
    } catch (error) {
        console.error("Maintenance middleware error:", error);
        next(); // Kung may error sa database check, palusutin na lang para hindi masira ang system
    }
};

module.exports = checkMaintenanceMode;