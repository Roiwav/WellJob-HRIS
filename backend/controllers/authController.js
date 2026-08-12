const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

/**
 * Returns the JWT secret loaded from backend/.env.
 *
 * Environment loading is initialized in backend/server.js before
 * the application routes/controllers are imported.
 */
function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret) {
    return null;
  }

  return secret;
}

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    // ❌ FAILED LOGIN 1:
    // HINDI NAKITA ANG USERNAME SA DATABASE
    if (users.length === 0) {
      await logAudit({
        userId: "-",
        username,
        full_name: "Unknown User",
        role: "-",
        action: "LOGIN_FAILED",
        description: `Failed login attempt (Unknown username: ${username})`,
      });

      return res.status(401).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const match = await bcrypt.compare(
      password,
      user.password
    );

    // ❌ FAILED LOGIN 2:
    // TAMA ANG USERNAME PERO MALI ANG PASSWORD
    if (!match) {
      await logAudit({
        userId: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        action: "LOGIN_FAILED",
        description: `Failed login attempt for ${user.full_name} (Incorrect Password)`,
      });

      return res.status(401).json({
        message: "Invalid password",
      });
    }

    // 🔐 GET JWT SECRET FROM ENVIRONMENT CONFIGURATION
    const jwtSecret = getJwtSecret();

    if (!jwtSecret) {
      console.error(
        "JWT configuration error: JWT_SECRET is not configured."
      );

      return res.status(500).json({
        message: "Authentication service configuration error",
      });
    }

    // ✅ SUCCESSFUL LOGIN
    // Token contains authenticated identity information.
    // Signature and expiration will later be verified by authMiddleware.
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: "8h",
      }
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      action: "Login Success",
      description: `${user.full_name} successfully logged into the system`,
    });

    return res.json({
      token,
      user,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: "Login error",
    });
  }
};