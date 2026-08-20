// userController.js

const db = require("../config/db");
const bcrypt = require("bcrypt");
const {
  logAudit,
} = require("../utils/auditLogger");

const {
  isValidName,
  generateAccountCredentials,
} = require("../utils/helpers");

/*
 * ==================================================
 * ACCOUNT ROLE / STATUS HELPERS
 * ==================================================
 */

const SUPPORTED_ACCOUNT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "IT_SUPPORT",
]);

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
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      normalized
    )
  ) {
    return null;
  }

  const numericId =
    Number(normalized);

  if (
    !Number.isSafeInteger(
      numericId
    ) ||
    numericId <= 0
  ) {
    return null;
  }

  return numericId;
}

/*
 * ==================================================
 * AUTHENTICATED AUDIT ACTOR
 * ==================================================
 *
 * SECURITY:
 * Audit actor identity must come from req.user.
 *
 * req.user contains the trusted JWT identity.
 * The database lookup below is only used to enrich
 * that trusted identity with user_id and full_name.
 *
 * Client-supplied user IDs, usernames, and roles
 * are never used for audit attribution.
 */
async function getAuthenticatedActor(
  req
) {
  const authenticatedId =
    req.user?.id ??
    req.user?.userId;

  const username =
    String(
      req.user?.username || ""
    ).trim();

  const role =
    normalizeRole(
      req.user?.role
    );

  let userId =
    authenticatedId;

  let fullName =
    username ||
    "Authenticated User";

  if (
    authenticatedId !==
      undefined &&
    authenticatedId !==
      null &&
    String(
      authenticatedId
    ).trim() !== ""
  ) {
    try {
      const [rows] =
        await db
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
            [
              authenticatedId,
            ]
          );

      if (
        rows.length > 0
      ) {
        userId =
          rows[0].user_id ??
          authenticatedId;

        fullName =
          String(
            rows[0]
              .full_name ||
              ""
          ).trim() ||
          fullName;
      }
    } catch (error) {
      /*
       * Do not replace the verified
       * req.user identity if audit
       * display enrichment fails.
       */
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

/*
 * ==================================================
 * CANONICAL AUTHENTICATED USER
 * ==================================================
 *
 * SECURITY:
 *
 * Password reset and account-status toggle are
 * privileged account-management operations.
 *
 * Route-level authorization verifies the JWT role,
 * but these operations additionally reload the
 * requester's CURRENT account state from the DB.
 *
 * Benefits:
 * - inactive requester cannot manage accounts
 * - stale JWT role cannot by itself grant authority
 * - current DB role participates in the decision
 *
 * Application-wide JWT invalidation/revocation is
 * handled separately in authMiddleware.
 */
async function getCanonicalAuthenticatedUser(
  req
) {
  const authenticatedId =
    parsePositiveUserId(
      req.user?.id ??
        req.user?.userId
    );

  if (
    !authenticatedId
  ) {
    return null;
  }

  const [rows] =
    await db
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
        [
          authenticatedId,
        ]
      );

  if (
    rows.length === 0
  ) {
    return null;
  }

  const user =
    rows[0];

  return {
    ...user,

    role:
      normalizeRole(
        user.role
      ),

    status:
      normalizeStatus(
        user.status
      ),
  };
}

/*
 * ==================================================
 * CANONICAL USER -> AUDIT ACTOR
 * ==================================================
 */

function toAuditActor(
  user
) {
  const username =
    String(
      user?.username || ""
    ).trim();

  return {
    userId:
      user?.user_id ??
      user?.id,

    username,

    fullName:
      String(
        user?.full_name ||
          ""
      ).trim() ||
      username ||
      "Authenticated User",

    role:
      normalizeRole(
        user?.role
      ),
  };
}

/*
 * ==================================================
 * ACCOUNT MANAGEMENT TARGET POLICY
 * ==================================================
 *
 * SECURITY POLICY:
 *
 * SUPER_ADMIN may administratively manage:
 * - HR_MANAGER
 * - HR_STAFF
 * - IT_SUPPORT
 *
 * IT_SUPPORT may administratively manage:
 * - HR_STAFF only
 *
 * IT_SUPPORT may NOT manage:
 * - SUPER_ADMIN
 * - HR_MANAGER
 * - another IT_SUPPORT
 *
 * SUPER_ADMIN targets are protected from these
 * reset/toggle endpoints entirely.
 *
 * A SUPER_ADMIN may change their own password using:
 * PUT /users/change-password
 *
 * A forgotten SUPER_ADMIN password should use a
 * separately controlled recovery procedure rather
 * than allowing lower-privileged accounts to reset it.
 *
 * Self-targeting is also blocked.
 *
 * Unknown/future roles fail closed automatically.
 */
function canManageTargetAccount({
  requester,
  target,
}) {
  if (
    !requester ||
    requester.status !==
      "ACTIVE"
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

  /*
   * Never permit administrative
   * reset/toggle against self.
   *
   * Own password changes use the
   * dedicated change-password route.
   */
  if (
    Number(
      requester.id
    ) ===
    Number(
      target.id
    )
  ) {
    return {
      allowed: false,

      status: 403,

      message:
        "Administrative account actions cannot target your own account.",
    };
  }

  /*
   * SUPER_ADMIN accounts are protected.
   *
   * This also prevents lower-privileged
   * accounts from taking over or disabling
   * the highest-privilege account.
   */
  if (
    target.role ===
    "SUPER_ADMIN"
  ) {
    return {
      allowed: false,

      status: 403,

      message:
        "Super Admin accounts cannot be managed through this endpoint.",
    };
  }

  /*
   * SUPER_ADMIN may manage every supported
   * non-SUPER_ADMIN account.
   */
  if (
    requester.role ===
    "SUPER_ADMIN"
  ) {
    return {
      allowed: true,
    };
  }

  /*
   * IT_SUPPORT is intentionally limited to
   * HR_STAFF technical account support.
   *
   * This prevents takeover/deactivation of:
   * - HR_MANAGER
   * - another IT_SUPPORT
   * - SUPER_ADMIN
   */
  if (
    requester.role ===
      "IT_SUPPORT" &&
    target.role ===
      "HR_STAFF"
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
exports.getUsers =
  async (
    req,
    res
  ) => {
    try {
      const [users] =
        await db
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

      return res.json(
        users
      );
    } catch (err) {
      console.error(
        "FETCH USERS ERROR:",
        err
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
 *
 * SECURITY:
 *
 * The authorized frontend generates the temporary
 * password locally and sends it to this endpoint.
 *
 * The backend:
 * - validates it
 * - hashes it immediately using bcrypt
 * - stores only the hash
 * - NEVER returns the raw password
 *
 * Existing must_change_password behavior remains.
 */
exports.createUser =
  async (
    req,
    res
  ) => {
    const {
      name,
      role,
      temporaryPassword,
    } =
      req.body || {};

    try {
      const trimmedName =
        String(
          name || ""
        ).trim();

      if (
        !trimmedName
      ) {
        return res
          .status(400)
          .json({
            message:
              "Full name is required",
          });
      }

      if (
        !isValidName(
          trimmedName
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Full name must contain letters only",
          });
      }

      /*
       * Temporary password validation.
       *
       * It must exist and be at least
       * 8 characters long.
       *
       * Maximum length prevents excessively
       * large password payloads.
       */
      if (
        typeof temporaryPassword !==
          "string" ||
        temporaryPassword.length <
          8 ||
        temporaryPassword.length >
          128
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
          role
        );

      /*
       * SECURITY:
       * Hash immediately.
       *
       * The raw temporary password is
       * never written to the database.
       */
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
            role,
          ]
        );

      await logAudit({
        userId:
          actor.userId,

        username:
          actor.username,

        fullName:
          actor.fullName,

        role:
          actor.role,

        action:
          "CREATE_USER",

        description:
          `${actor.fullName} created account for ${trimmedName} (${username}, ${role}).`,
      });

      /*
       * SECURITY:
       *
       * Do not return temporaryPassword.
       *
       * The authorized frontend already owns
       * its local one-time copy.
       */
      return res
        .status(201)
        .json({
          message:
            "User created",

          account: {
            userId,
            username,
            role,
          },
        });
    } catch (err) {
      console.error(
        "CREATE USER ERROR:",
        err
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
 *
 * SECURITY:
 *
 * In addition to route-level authorization, this
 * endpoint validates BOTH:
 *
 * 1. the requester's CURRENT database account state
 * 2. the target account role
 *
 * Allowed:
 *
 * SUPER_ADMIN
 *   -> HR_MANAGER
 *   -> HR_STAFF
 *   -> IT_SUPPORT
 *
 * IT_SUPPORT
 *   -> HR_STAFF only
 *
 * SUPER_ADMIN targets and self-targeting are blocked.
 *
 * The temporary password is hashed immediately and
 * never returned by the backend.
 */
exports.resetPassword =
  async (
    req,
    res
  ) => {
    const targetId =
      parsePositiveUserId(
        req.params?.id
      );

    const {
      temporaryPassword,
    } =
      req.body || {};

    if (
      !targetId
    ) {
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
        8 ||
      temporaryPassword.length >
        128
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid temporary password is required.",
        });
    }

    try {
      /*
       * Reload requester from the database.
       */
      const requester =
        await getCanonicalAuthenticatedUser(
          req
        );

      if (
        !requester
      ) {
        return res
          .status(401)
          .json({
            message:
              "Authenticated account not found.",
          });
      }

      /*
       * Load target account from the database.
       */
      const [users] =
        await db
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
            [
              targetId,
            ]
          );

      if (
        users.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      const user = {
        ...users[0],

        role:
          normalizeRole(
            users[0].role
          ),

        status:
          normalizeStatus(
            users[0].status
          ),
      };

      /*
       * Enforce server-side target-role hierarchy.
       */
      const permission =
        canManageTargetAccount({
          requester,
          target: user,
        });

      if (
        !permission.allowed
      ) {
        return res
          .status(
            permission.status ||
              403
          )
          .json({
            message:
              permission.message ||
              "This account-management action is not permitted.",
          });
      }

      const actor =
        toAuditActor(
          requester
        );

      /*
       * SECURITY:
       * Hash temporary password before persistence.
       */
      const hash =
        await bcrypt.hash(
          temporaryPassword,
          10
        );

      const [result] =
        await db
          .promise()
          .query(
            `
            UPDATE users
            SET
              password = ?,
              must_change_password = 1
            WHERE id = ?
            `,
            [
              hash,
              targetId,
            ]
          );

      /*
       * Defensive integrity check.
       */
      if (
        result.affectedRows !==
        1
      ) {
        return res
          .status(409)
          .json({
            message:
              "The user account changed before the password reset could be completed. Refresh and try again.",
          });
      }

      await logAudit({
        userId:
          actor.userId,

        username:
          actor.username,

        fullName:
          actor.fullName,

        role:
          actor.role,

        action:
          "RESET_PASSWORD",

        description:
          `${actor.fullName} reset the password for ${user.full_name} (${user.username}).`,
      });

      /*
       * SECURITY:
       *
       * Do not echo the raw temporary password.
       */
      return res.json({
        message:
          "Password reset",
      });
    } catch (err) {
      console.error(
        "RESET PASSWORD ERROR:",
        err
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
 *
 * SECURITY:
 *
 * Uses the same server-side target-role hierarchy
 * as resetPassword.
 *
 * SUPER_ADMIN accounts cannot be activated or
 * deactivated through this administrative endpoint.
 *
 * Self-targeting is prohibited.
 *
 * The UPDATE additionally verifies the status that
 * was originally read. This helps prevent a stale
 * request from silently overwriting a newer status
 * change.
 */
exports.toggleStatus =
  async (
    req,
    res
  ) => {
    const targetId =
      parsePositiveUserId(
        req.params?.id
      );

    if (
      !targetId
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid user ID is required.",
        });
    }

    try {
      /*
       * Reload requester from current DB state.
       */
      const requester =
        await getCanonicalAuthenticatedUser(
          req
        );

      if (
        !requester
      ) {
        return res
          .status(401)
          .json({
            message:
              "Authenticated account not found.",
          });
      }

      /*
       * Load target account.
       */
      const [users] =
        await db
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
            [
              targetId,
            ]
          );

      if (
        users.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            message:
              "User not found",
          });
      }

      const user = {
        ...users[0],

        role:
          normalizeRole(
            users[0].role
          ),

        status:
          normalizeStatus(
            users[0].status
          ),
      };

      /*
       * Enforce server-side target-role hierarchy.
       */
      const permission =
        canManageTargetAccount({
          requester,
          target: user,
        });

      if (
        !permission.allowed
      ) {
        return res
          .status(
            permission.status ||
              403
          )
          .json({
            message:
              permission.message ||
              "This account-management action is not permitted.",
          });
      }

      /*
       * Fail safely if an unexpected account status
       * exists instead of treating arbitrary values
       * as Active/Inactive.
       */
      if (
        user.status !==
          "ACTIVE" &&
        user.status !==
          "INACTIVE"
      ) {
        return res
          .status(409)
          .json({
            message:
              "User account has an unsupported status.",
          });
      }

      const actor =
        toAuditActor(
          requester
        );

      const newStatus =
        user.status ===
        "ACTIVE"
          ? "Inactive"
          : "Active";

      /*
       * Compare-and-set update.
       *
       * Only update if the account still has the
       * same status we inspected.
       */
      const [result] =
        await db
          .promise()
          .query(
            `
            UPDATE users
            SET status = ?
            WHERE id = ?
              AND UPPER(TRIM(status)) = ?
            `,
            [
              newStatus,
              targetId,
              user.status,
            ]
          );

      if (
        result.affectedRows !==
        1
      ) {
        return res
          .status(409)
          .json({
            message:
              "User status changed before this request could be completed. Refresh and try again.",
          });
      }

      await logAudit({
        userId:
          actor.userId,

        username:
          actor.username,

        fullName:
          actor.fullName,

        role:
          actor.role,

        action:
          "TOGGLE_STATUS",

        description:
          `${actor.fullName} changed ${user.full_name} (${user.username}) to ${newStatus}.`,
      });

      return res.json({
        status:
          newStatus,
      });
    } catch (err) {
      console.error(
        "TOGGLE USER STATUS ERROR:",
        err
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
exports.changePassword =
  async (
    req,
    res
  ) => {
    /*
     * SECURITY:
     *
     * The account identity comes only
     * from req.user.
     *
     * Do NOT trust these for authority:
     * - req.body.userId
     * - req.body.id
     * - req.body.username
     *
     * Those values may still be sent by
     * an older frontend, but they are
     * intentionally ignored here.
     */
    const authenticatedUserId =
      req.user?.id ??
      req.user?.userId;

    const {
      currentPassword,
      newPassword,
    } =
      req.body || {};

    if (
      authenticatedUserId ===
        undefined ||
      authenticatedUserId ===
        null ||
      String(
        authenticatedUserId
      ).trim() === ""
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "A verified authenticated user is required.",
        });
    }

    if (
      !currentPassword ||
      !newPassword
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Current password and new password are required.",
        });
    }

    try {
      /*
       * Find account using only the
       * verified JWT identity.
       */
      const [users] =
        await db
          .promise()
          .query(
            `
            SELECT *
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [
              authenticatedUserId,
            ]
          );

      if (
        users.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User not found",
          });
      }

      const user =
        users[0];

      /*
       * Verify existing password.
       */
      const isMatch =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (
        !isMatch
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

          message:
              "Incorrect current password",
          });
      }

      /*
       * Hash the new password before
       * storing it.
       */
      const hash =
        await bcrypt.hash(
          newPassword,
          10
        );

      /*
       * Save new password and clear
       * forced-change flag.
       */
      await db
        .promise()
        .query(
          `
          UPDATE users
          SET
            password = ?,
            must_change_password = 0
          WHERE id = ?
          `,
          [
            hash,
            user.id,
          ]
        );

      await logAudit({
        userId:
          user.user_id,

        username:
          user.username,

        role:
          user.role,

        action:
          "CHANGE_PASSWORD",

        description:
          "User successfully changed their password",
      });

      return res.json({
        success:
          true,

        message:
          "Password updated successfully",
      });
    } catch (err) {
      console.error(
        "Change Password Error:",
        err
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Error changing password",
        });
    }
  };