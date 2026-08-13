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
  const secret = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!secret) {
    return null;
  }

  return secret;
}

function isInactiveAccount(status) {
  return (
    String(status || "")
      .trim()
      .toLowerCase() === "inactive"
  );
}

function normalizeMustChangePassword(value) {
  return (
    value === true ||
    value === 1 ||
    String(value || "").trim() === "1"
  );
}

/**
 * Build the only user fields that may be returned
 * to the frontend after successful authentication.
 *
 * Password/password hash and any unrelated database
 * columns are intentionally excluded.
 */
function buildSafeUser(user) {
  const mustChangePassword =
    normalizeMustChangePassword(
      user.must_change_password
    );

  return {
    id: user.id,

    user_id: user.user_id,
    userId: user.user_id,

    full_name: user.full_name,
    fullName: user.full_name,

    username: user.username,

    role: user.role,

    status: user.status,

    must_change_password:
      mustChangePassword ? 1 : 0,

    mustChangePassword,
  };
}

exports.login = async (req, res) => {
  const username =
    String(
      req.body?.username || ""
    ).trim();

  const password =
    String(
      req.body?.password || ""
    );

  if (!username || !password) {
    return res.status(400).json({
      message:
        "Username and password are required",
    });
  }

  try {
    const [users] =
      await db.promise().query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          password,
          role,
          status,
          must_change_password
        FROM users
        WHERE username = ?
        LIMIT 1
        `,
        [username]
      );

    /*
     * FAILED LOGIN:
     * Username does not exist.
     */
    if (users.length === 0) {
      await logAudit({
        userId: "-",
        username,
        full_name:
          "Unknown User",
        role: "-",
        action:
          "LOGIN_FAILED",
        description:
          `Failed login attempt (Unknown username: ${username})`,
      });

      return res.status(401).json({
        message:
          "User not found",
      });
    }

    const user =
      users[0];

    /*
     * ACCOUNT SECURITY:
     * An inactive account must never be
     * allowed to authenticate or receive
     * a JWT.
     */
    if (
      isInactiveAccount(
        user.status
      )
    ) {
      await logAudit({
        userId:
          user.user_id,
        username:
          user.username,
        full_name:
          user.full_name,
        role:
          user.role,
        action:
          "LOGIN_FAILED",
        description:
          `Failed login attempt for ${user.full_name} (Inactive Account)`,
      });

      return res.status(403).json({
        message:
          "Account is inactive. Please contact IT Support.",
      });
    }

    const match =
      await bcrypt.compare(
        password,
        user.password
      );

    /*
     * FAILED LOGIN:
     * Username exists but password
     * verification failed.
     */
    if (!match) {
      await logAudit({
        userId:
          user.user_id,
        username:
          user.username,
        full_name:
          user.full_name,
        role:
          user.role,
        action:
          "LOGIN_FAILED",
        description:
          `Failed login attempt for ${user.full_name} (Incorrect Password)`,
      });

      return res.status(401).json({
        message:
          "Invalid password",
      });
    }

    const jwtSecret =
      getJwtSecret();

    if (!jwtSecret) {
      console.error(
        "JWT configuration error: JWT_SECRET is not configured."
      );

      return res.status(500).json({
        message:
          "Authentication service configuration error",
      });
    }

    /*
     * Preserve the existing authenticated
     * JWT identity contract.
     */
    const token =
      jwt.sign(
        {
          id: user.id,
          username:
            user.username,
          role:
            user.role,
        },
        jwtSecret,
        {
          expiresIn: "8h",
        }
      );

    await logAudit({
      userId:
        user.user_id,
      username:
        user.username,
      full_name:
        user.full_name,
      role:
        user.role,
      action:
        "Login Success",
      description:
        `${user.full_name} successfully logged into the system`,
    });

    /*
     * SECURITY:
     * Never return the raw database user row.
     *
     * In particular, user.password must never
     * leave the backend.
     */
    const safeUser =
      buildSafeUser(
        user
      );

    return res.status(200).json({
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err
    );

    return res.status(500).json({
      message:
        "Login error",
    });
  }
};