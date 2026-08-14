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
    String(
      req.user?.role || ""
    )
      .trim()
      .toUpperCase();

  let userId =
    authenticatedId;

  let fullName =
    username ||
    "Authenticated User";

  if (
    authenticatedId !==
      undefined &&
    authenticatedId !== null &&
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
 * The IT Support frontend generates a one-time
 * temporary password locally and sends it here.
 *
 * The backend hashes it immediately and never
 * returns the raw password in the response.
 */
exports.resetPassword =
  async (
    req,
    res
  ) => {
    const {
      id,
    } = req.params;

    const {
      temporaryPassword,
    } =
      req.body || {};

    try {
      /*
       * Require a valid temporary password
       * from the authorized frontend.
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
              id,
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

      const user =
        users[0];

      const actor =
        await getAuthenticatedActor(
          req
        );

      /*
       * SECURITY:
       * Hash before persistence.
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
          UPDATE users
          SET
            password = ?,
            must_change_password = 1
          WHERE id = ?
          `,
          [
            hash,
            id,
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
 */
exports.toggleStatus =
  async (
    req,
    res
  ) => {
    const {
      id,
    } = req.params;

    try {
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
              id,
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

      const user =
        users[0];

      const actor =
        await getAuthenticatedActor(
          req
        );

      const newStatus =
        user.status ===
        "Active"
          ? "Inactive"
          : "Active";

      await db
        .promise()
        .query(
          `
          UPDATE users
          SET status = ?
          WHERE id = ?
          `,
          [
            newStatus,
            id,
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