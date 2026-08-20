const bcrypt = require("bcrypt");

const db = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const {
  isValidName,
  generateAccountCredentials,
} = require("../utils/helpers");

const SUPPORTED_ACCOUNT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "IT_SUPPORT",
]);

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function parsePositiveUserId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numericId = Number(normalized);

  if (
    !Number.isSafeInteger(numericId) ||
    numericId <= 0
  ) {
    return null;
  }

  return numericId;
}

function isValidPassword(value) {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return false;
  }

  return (
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*()_+]/.test(value)
  );
}

async function getAuthenticatedActor(req) {
  const authenticatedId =
    req.user?.id ??
    req.user?.userId;

  const username = String(
    req.user?.username || ""
  ).trim();

  const role = normalizeRole(
    req.user?.role
  );

  let userId = authenticatedId;
  let fullName =
    username || "Authenticated User";

  if (
    authenticatedId !== undefined &&
    authenticatedId !== null &&
    String(authenticatedId).trim() !== ""
  ) {
    try {
      const [rows] = await db
        .promise()
        .query(
          `
          SELECT
            user_id,
            full_name
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
          [authenticatedId]
        );

      if (rows.length > 0) {
        userId =
          rows[0].user_id ??
          authenticatedId;

        fullName =
          String(
            rows[0].full_name || ""
          ).trim() ||
          fullName;
      }
    } catch (error) {
      console.error(
        "Audit actor enrichment error:",
        error
      );
    }
  }

  return {
    userId,
    username,
    fullName,
    role,
  };
}

async function getCanonicalAuthenticatedUser(
  req
) {
  const authenticatedId =
    parsePositiveUserId(
      req.user?.id ??
        req.user?.userId
    );

  if (!authenticatedId) {
    return null;
  }

  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        id,
        user_id,
        full_name,
        username,
        role,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [authenticatedId]
    );

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];

  return {
    ...user,
    role: normalizeRole(user.role),
    status: normalizeStatus(
      user.status
    ),
  };
}

function toAuditActor(user) {
  const username = String(
    user?.username || ""
  ).trim();

  return {
    userId:
      user?.user_id ??
      user?.id,

    username,

    fullName:
      String(
        user?.full_name || ""
      ).trim() ||
      username ||
      "Authenticated User",

    role: normalizeRole(user?.role),
  };
}

function canManageTargetAccount({
  requester,
  target,
}) {
  if (
    !requester ||
    requester.status !== "ACTIVE"
  ) {
    return {
      allowed: false,
      status: 403,
      message:
        "Your account is not allowed to perform account-management actions.",
    };
  }

  if (
    !SUPPORTED_ACCOUNT_ROLES.has(
      requester.role
    ) ||
    !SUPPORTED_ACCOUNT_ROLES.has(
      target.role
    )
  ) {
    return {
      allowed: false,
      status: 403,
      message:
        "This account-management action is not permitted.",
    };
  }

  if (
    Number(requester.id) ===
    Number(target.id)
  ) {
    return {
      allowed: false,
      status: 403,
      message:
        "Administrative account actions cannot target your own account.",
    };
  }

  if (target.role === "SUPER_ADMIN") {
    return {
      allowed: false,
      status: 403,
      message:
        "Super Admin accounts cannot be managed through this endpoint.",
    };
  }

  if (
    requester.role ===
    "SUPER_ADMIN"
  ) {
    return {
      allowed: true,
    };
  }

  if (
    requester.role ===
      "IT_SUPPORT" &&
    target.role === "HR_STAFF"
  ) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    status: 403,
    message:
      "You are not allowed to manage this account.",
  };
}

/*
 * ==================================================
 * GET USERS
 * ==================================================
 */

exports.getUsers = async (
  req,
  res
) => {
  try {
    const [users] = await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          role,
          status
        FROM users
        ORDER BY id DESC
        `
      );

    return res.json(users);
  } catch (error) {
    console.error(
      "FETCH USERS ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Fetch users error",
      });
  }
};

/*
 * ==================================================
 * CREATE USER
 * ==================================================
 */

exports.createUser = async (
  req,
  res
) => {
  const {
    name,
    role,
    temporaryPassword,
  } = req.body || {};

  try {
    const trimmedName = String(
      name || ""
    ).trim();

    const normalizedRole =
      normalizeRole(role);

    if (!trimmedName) {
      return res
        .status(400)
        .json({
          message:
            "Full name is required",
        });
    }

    if (!isValidName(trimmedName)) {
      return res
        .status(400)
        .json({
          message:
            "Full name must contain letters only",
        });
    }

    if (
      !SUPPORTED_ACCOUNT_ROLES.has(
        normalizedRole
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid account role is required.",
        });
    }

    if (
      typeof temporaryPassword !==
        "string" ||
      temporaryPassword.length <
        PASSWORD_MIN_LENGTH ||
      temporaryPassword.length >
        PASSWORD_MAX_LENGTH
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid temporary password is required.",
        });
    }

    const actor =
      await getAuthenticatedActor(
        req
      );

    const {
      userId,
      username,
    } =
      await generateAccountCredentials(
        normalizedRole
      );

    const hash =
      await bcrypt.hash(
        temporaryPassword,
        10
      );

    await db
      .promise()
      .query(
        `
        INSERT INTO users
        (
          user_id,
          full_name,
          username,
          password,
          role,
          status,
          must_change_password
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          'Active',
          1
        )
        `,
        [
          userId,
          trimmedName,
          username,
          hash,
          normalizedRole,
        ]
      );

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      action: "CREATE_USER",
      description:
        `${actor.fullName} created account for ${trimmedName} (${username}, ${normalizedRole}).`,
    });

    return res
      .status(201)
      .json({
        message: "User created",
        account: {
          userId,
          username,
          role: normalizedRole,
        },
      });
  } catch (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Create user error",
      });
  }
};

/*
 * ==================================================
 * RESET PASSWORD
 * ==================================================
 */

exports.resetPassword = async (
  req,
  res
) => {
  const targetId =
    parsePositiveUserId(
      req.params?.id
    );

  const {
    temporaryPassword,
  } = req.body || {};

  if (!targetId) {
    return res
      .status(400)
      .json({
        message:
          "A valid user ID is required.",
      });
  }

  if (
    typeof temporaryPassword !==
      "string" ||
    temporaryPassword.length <
      PASSWORD_MIN_LENGTH ||
    temporaryPassword.length >
      PASSWORD_MAX_LENGTH
  ) {
    return res
      .status(400)
      .json({
        message:
          "A valid temporary password is required.",
      });
  }

  try {
    const requester =
      await getCanonicalAuthenticatedUser(
        req
      );

    if (!requester) {
      return res
        .status(401)
        .json({
          message:
            "Authenticated account not found.",
        });
    }

    const [users] = await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [targetId]
      );

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          message:
            "User not found",
        });
    }

    const user = {
      ...users[0],
      role: normalizeRole(
        users[0].role
      ),
      status: normalizeStatus(
        users[0].status
      ),
    };

    const permission =
      canManageTargetAccount({
        requester,
        target: user,
      });

    if (!permission.allowed) {
      return res
        .status(
          permission.status || 403
        )
        .json({
          message:
            permission.message ||
            "This account-management action is not permitted.",
        });
    }

    const actor =
      toAuditActor(requester);

    const hash =
      await bcrypt.hash(
        temporaryPassword,
        10
      );

    const [result] = await db
      .promise()
      .query(
        `
        UPDATE users
        SET
          password = ?,
          must_change_password = 1,
          token_version = token_version + 1
        WHERE id = ?
        `,
        [hash, targetId]
      );

    if (result.affectedRows !== 1) {
      return res
        .status(409)
        .json({
          message:
            "The user account changed before the password reset could be completed. Refresh and try again.",
        });
    }

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      action: "RESET_PASSWORD",
      description:
        `${actor.fullName} reset the password for ${user.full_name} (${user.username}).`,
    });

    return res.json({
      message:
        "Password reset",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Reset error",
      });
  }
};

/*
 * ==================================================
 * TOGGLE USER STATUS
 * ==================================================
 */

exports.toggleStatus = async (
  req,
  res
) => {
  const targetId =
    parsePositiveUserId(
      req.params?.id
    );

  if (!targetId) {
    return res
      .status(400)
      .json({
        message:
          "A valid user ID is required.",
      });
  }

  try {
    const requester =
      await getCanonicalAuthenticatedUser(
        req
      );

    if (!requester) {
      return res
        .status(401)
        .json({
          message:
            "Authenticated account not found.",
        });
    }

    const [users] = await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [targetId]
      );

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          message:
            "User not found",
        });
    }

    const user = {
      ...users[0],
      role: normalizeRole(
        users[0].role
      ),
      status: normalizeStatus(
        users[0].status
      ),
    };

    const permission =
      canManageTargetAccount({
        requester,
        target: user,
      });

    if (!permission.allowed) {
      return res
        .status(
          permission.status || 403
        )
        .json({
          message:
            permission.message ||
            "This account-management action is not permitted.",
        });
    }

    if (
      user.status !== "ACTIVE" &&
      user.status !== "INACTIVE"
    ) {
      return res
        .status(409)
        .json({
          message:
            "User account has an unsupported status.",
        });
    }

    const actor =
      toAuditActor(requester);

    const newStatus =
      user.status === "ACTIVE"
        ? "Inactive"
        : "Active";

    const [result] = await db
      .promise()
      .query(
        `
        UPDATE users
        SET
          status = ?,
          token_version = token_version + 1
        WHERE id = ?
          AND UPPER(TRIM(status)) = ?
        `,
        [
          newStatus,
          targetId,
          user.status,
        ]
      );

    if (result.affectedRows !== 1) {
      return res
        .status(409)
        .json({
          message:
            "User status changed before this request could be completed. Refresh and try again.",
        });
    }

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      action: "TOGGLE_STATUS",
      description:
        `${actor.fullName} changed ${user.full_name} (${user.username}) to ${newStatus}.`,
    });

    return res.json({
      status: newStatus,
    });
  } catch (error) {
    console.error(
      "TOGGLE USER STATUS ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Toggle error",
      });
  }
};

/*
 * ==================================================
 * CHANGE OWN PASSWORD
 * ==================================================
 */

exports.changePassword = async (
  req,
  res
) => {
  const authenticatedUserId =
    parsePositiveUserId(
      req.user?.id ??
        req.user?.userId
    );

  const {
    currentPassword,
    newPassword,
  } = req.body || {};

  if (!authenticatedUserId) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "A verified authenticated user is required.",
      });
  }

  if (
    typeof currentPassword !==
      "string" ||
    !currentPassword
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Current password is required.",
      });
  }

  if (!isValidPassword(newPassword)) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "New password must be 8 to 128 characters long and include uppercase, lowercase, number, and special character.",
      });
  }

  if (
    currentPassword === newPassword
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Use a password different from your current password.",
      });
  }

  try {
    const [users] = await db
      .promise()
      .query(
        `
        SELECT
          id,
          user_id,
          full_name,
          username,
          password,
          role,
          status,
          token_version
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [authenticatedUserId]
      );

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "User not found",
        });
    }

    const user = users[0];

    if (
      normalizeStatus(
        user.status
      ) !== "ACTIVE"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Inactive accounts cannot change passwords.",
        });
    }

    const isMatch =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    if (!isMatch) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Incorrect current password",
        });
    }

    const hash =
      await bcrypt.hash(
        newPassword,
        10
      );

    /*
     * Password update and session revocation are
     * committed in the same database operation.
     *
     * Incrementing token_version immediately
     * invalidates every JWT issued before this
     * password change, including this request's
     * current session token.
     */
    const [result] = await db
      .promise()
      .query(
        `
        UPDATE users
        SET
          password = ?,
          must_change_password = 0,
          token_version = token_version + 1
        WHERE id = ?
          AND token_version = ?
          AND UPPER(TRIM(status)) = 'ACTIVE'
        `,
        [
          hash,
          user.id,
          user.token_version,
        ]
      );

    if (result.affectedRows !== 1) {
      return res
        .status(409)
        .json({
          success: false,
          message:
            "Your account changed before the password update could be completed. Please sign in again and retry.",
        });
    }

    await logAudit({
      userId: user.user_id,
      username: user.username,
      fullName:
        user.full_name,
      role: user.role,
      action:
        "CHANGE_PASSWORD",
      description:
        `${user.full_name || user.username} successfully changed their password.`,
    });

    return res.json({
      success: true,
      message:
        "Password updated successfully. Please sign in again using your new password.",
    });
  } catch (error) {
    console.error(
      "CHANGE PASSWORD ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Error changing password",
      });
  }
};