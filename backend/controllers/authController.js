
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const {
  logAudit,
} = require("../utils/auditLogger");

/*
 * ==================================================
 * LOGIN TIMING PROTECTION
 * ==================================================
 *
 * When a username does not exist, bcrypt comparison
 * is still performed against a valid dummy hash.
 *
 * This helps reduce observable timing differences
 * between:
 *
 * - unknown usernames
 * - known usernames with incorrect passwords
 *
 * The dummy hash is not an application credential
 * and is never used to authenticate a real account.
 */

const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/*
 * ==================================================
 * JWT CONFIGURATION
 * ==================================================
 *
 * Environment loading is initialized in
 * backend/server.js before application routes
 * and controllers are imported.
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

/*
 * ==================================================
 * ACCOUNT STATUS
 * ==================================================
 */

function isInactiveAccount(status) {
  return (
    String(status || "")
      .trim()
      .toLowerCase() === "inactive"
  );
}

/*
 * ==================================================
 * COMPANY ASSIGNMENT
 * ==================================================
 */

function normalizeAssignedCompany(value) {
  const normalized = String(
    value ?? ""
  ).trim();

  return normalized || null;
}

/*
 * ==================================================
 * PASSWORD CHANGE STATUS
 * ==================================================
 */

function normalizeMustChangePassword(value) {
  return (
    value === true ||
    value === 1 ||
    String(value || "").trim() === "1"
  );
}

/*
 * ==================================================
 * TOKEN VERSION
 * ==================================================
 *
 * Every authenticated session is bound to the
 * user's current token_version in the database.
 *
 * Password resets, account deactivation, password
 * changes, and other security-sensitive operations
 * can increment token_version.
 *
 * A JWT issued with an older tokenVersion becomes
 * invalid.
 */

function normalizeTokenVersion(value) {
  const numericValue = Number(value);

  if (
    !Number.isSafeInteger(numericValue) ||
    numericValue < 1
  ) {
    return 1;
  }

  return numericValue;
}

/*
 * ==================================================
 * PROFILE PICTURE
 * ==================================================
 *
 * The users.avatar_filename column stores only
 * the server-generated image filename.
 *
 * The actual image will be stored separately
 * by the profile picture upload functionality.
 *
 * Do not generate a public image URL here.
 * Image access will be handled through a
 * dedicated authenticated endpoint.
 */

function normalizeAvatarFilename(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const filename = value.trim();

  return filename || null;
}

/*
 * ==================================================
 * SAFE USER RESPONSE
 * ==================================================
 *
 * Build the only user fields that may be returned
 * to the frontend after successful authentication.
 *
 * Password hashes and security-internal fields,
 * including token_version, are excluded.
 */

function buildSafeUser(user) {
  const mustChangePassword =
    normalizeMustChangePassword(
      user.must_change_password
    );

  const assignedCompany =
    normalizeAssignedCompany(
      user.assigned_company
    );

  const avatarFilename =
    normalizeAvatarFilename(
      user.avatar_filename
    );

  return {
    /*
     * Database user ID.
     */

    id: user.id,

    /*
     * WELLJOB business user identifier.
     */

    user_id: user.user_id,

    userId: user.user_id,

    /*
     * User name.
     */

    full_name: user.full_name,

    fullName: user.full_name,

    username: user.username,

    /*
     * Current account role.
     */

    role: user.role,

    /*
     * HR Coordinator company assignment.
     *
     * Backend authorization remains authoritative
     * through authMiddleware.
     */

    assigned_company: assignedCompany,

    assignedCompany,

    /*
     * Account status.
     */

    status: user.status,

    /*
     * Password change requirement.
     */

    must_change_password:
      mustChangePassword ? 1 : 0,

    mustChangePassword,

    /*
     * ==================================================
     * NEW: PROFILE PICTURE INFORMATION
     * ==================================================
     *
     * The filename is server-generated and is not
     * a filesystem path or a public image URL.
     *
     * null means the user has no uploaded picture.
     */

    avatar_filename: avatarFilename,

    avatarFilename,
  };
}

/*
 * ==================================================
 * USER LOGIN
 * ==================================================
 */

exports.login = async (req, res) => {
  const username = String(
    req.body?.username || ""
  ).trim();

  const password = String(
    req.body?.password || ""
  );

  if (!username || !password) {
    return res
      .status(400)
      .json({
        message:
          "Username and password are required",
      });
  }

  try {
    /*
     * ==================================================
     * FETCH USER ACCOUNT
     * ==================================================
     *
     * NEW:
     * Include avatar_filename in the SELECT query.
     *
     * This allows the frontend to know whether
     * the authenticated user has a profile picture.
     */

    const [users] = await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          avatar_filename,
          username,
          password,
          role,
          assigned_company,
          status,
          must_change_password,
          token_version
        FROM users
        WHERE username = ?
        LIMIT 1
        `,
        [username]
      );

    /*
     * ==================================================
     * UNKNOWN USERNAME
     * ==================================================
     *
     * Perform a dummy bcrypt comparison so unknown
     * usernames do not immediately return before
     * password verification.
     *
     * The client receives the same authentication
     * failure response used for an incorrect password.
     */

    if (users.length === 0) {
      await bcrypt.compare(
        password,
        DUMMY_PASSWORD_HASH
      );

      await logAudit({
        userId: "-",

        username,

        full_name: "Unknown User",

        role: "-",

        action: "LOGIN_FAILED",

        description:
          `Failed login attempt (Unknown username: ${username})`,
      });

      return res
        .status(401)
        .json({
          message:
            "Invalid username or password",
        });
    }

    const user = users[0];

    /*
     * ==================================================
     * PASSWORD VERIFICATION
     * ==================================================
     *
     * Verify the submitted password before exposing
     * account-state information.
     */

    const match = await bcrypt.compare(
      password,
      user.password
    );

    /*
     * ==================================================
     * FAILED LOGIN
     * ==================================================
     */

    if (!match) {
      await logAudit({
        userId: user.user_id,

        username: user.username,

        full_name: user.full_name,

        role: user.role,

        action: "LOGIN_FAILED",

        description:
          `Failed login attempt for ${user.full_name} (Incorrect Password)`,
      });

      return res
        .status(401)
        .json({
          message:
            "Invalid username or password",
        });
    }

    /*
     * ==================================================
     * ACCOUNT STATUS
     * ==================================================
     *
     * Only disclose inactive-account status after
     * successfully verifying the password.
     */

    if (
      isInactiveAccount(
        user.status
      )
    ) {
      await logAudit({
        userId: user.user_id,

        username: user.username,

        full_name: user.full_name,

        role: user.role,

        action: "LOGIN_FAILED",

        description:
          `Failed login attempt for ${user.full_name} (Inactive Account)`,
      });

      return res
        .status(403)
        .json({
          message:
            "Account is inactive. Please contact IT Support.",
        });
    }

    /*
     * ==================================================
     * JWT CONFIGURATION CHECK
     * ==================================================
     */

    const jwtSecret = getJwtSecret();

    if (!jwtSecret) {
      console.error(
        "JWT configuration error: JWT_SECRET is not configured."
      );

      return res
        .status(500)
        .json({
          message:
            "Authentication service configuration error",
        });
    }

    /*
     * ==================================================
     * CURRENT SESSION VERSION
     * ==================================================
     */

    const tokenVersion =
      normalizeTokenVersion(
        user.token_version
      );

    /*
     * ==================================================
     * JWT SESSION
     * ==================================================
     *
     * tokenVersion binds this JWT to the user's
     * current server-side session generation.
     *
     * The role remains in the JWT for compatibility.
     *
     * authMiddleware reloads the current role and
     * assigned company from the database for every
     * protected request.
     */

    const token = jwt.sign(
      {
        id: user.id,

        username: user.username,

        role: user.role,

        tokenVersion,
      },
      jwtSecret,
      {
        expiresIn: "8h",
      }
    );

    /*
     * ==================================================
     * LOGIN AUDIT LOG
     * ==================================================
     */

    await logAudit({
      userId: user.user_id,

      username: user.username,

      full_name: user.full_name,

      role: user.role,

      action: "Login Success",

      description:
        `${user.full_name} successfully logged into the system`,
    });

    /*
     * ==================================================
     * BUILD SAFE USER RESPONSE
     * ==================================================
     *
     * Never return the raw database user row.
     *
     * Password and token_version remain private.
     */

    const safeUser = buildSafeUser(
      user
    );

    /*
     * ==================================================
     * SUCCESSFUL LOGIN RESPONSE
     * ==================================================
     */

    return res
      .status(200)
      .json({
        token,

        user: safeUser,
      });
  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        message: "Login error",
      });
  }
};