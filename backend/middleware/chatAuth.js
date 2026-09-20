
/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER AUTHENTICATION MIDDLEWARE
 * ==================================================
 *
 * Uses the existing WELLJOB authentication system.
 *
 * Security:
 * - Reuses the existing JWT verification.
 * - Checks the current database account status.
 * - Validates token_version.
 * - Uses the current database role.
 * - Enforces HR Coordinator company assignment.
 * - Allows only authorized WELLJOB user roles.
 * - Never trusts user IDs or roles from request bodies.
 */

const db = require("../config/db");

const {
  verifyToken,
  normalizeRole,
  CANONICAL_ROLES,
} = require("./authMiddleware");

/*
 * ==================================================
 * CHAT ROLE CONFIGURATION
 * ==================================================
 *
 * Only existing WELLJOB internal system accounts
 * are allowed to access the Messenger.
 */

const allowedRoles = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
  "IT_SUPPORT",
]);

/*
 * ==================================================
 * ROLE VALIDATION
 * ==================================================
 */

function isChatRole(role) {
  const normalizedRole = normalizeRole(role);

  return (
    CANONICAL_ROLES.has(normalizedRole) &&
    allowedRoles.has(normalizedRole)
  );
}

/*
 * ==================================================
 * CHAT ERROR HELPER
 * ==================================================
 */

function createChatError(
  status,
  message
) {
  const error = new Error(message);

  error.status = status;

  return error;
}

/*
 * ==================================================
 * BUILD AUTHENTICATED CHAT USER
 * ==================================================
 *
 * The existing authMiddleware has already verified:
 *
 * - JWT signature and expiration
 * - Current account status
 * - Current user role
 * - Current token_version
 * - HR Coordinator company assignment
 *
 * We only retrieve the full name needed by
 * the Messenger interface.
 */

async function buildChatUser(
  authenticatedUser
) {
  if (
    !authenticatedUser ||
    !isChatRole(authenticatedUser.role)
  ) {
    throw createChatError(
      403,
      "Your account is not authorized to access the Messenger."
    );
  }

  const userId = Number(
    authenticatedUser.id
  );

  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    throw createChatError(
      401,
      "Invalid authenticated user."
    );
  }

  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        id,
        full_name
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

  if (rows.length === 0) {
    throw createChatError(
      401,
      "Your account is no longer available."
    );
  }

  const user = rows[0];

  return {
    id: userId,

    userId,

    username:
      authenticatedUser.username,

    fullName:
      user.full_name,

    role:
      normalizeRole(
        authenticatedUser.role
      ),

    assignedCompany:
      authenticatedUser.assignedCompany ??
      null,
  };
}

/*
 * ==================================================
 * EXPRESS CHAT AUTHENTICATION
 * ==================================================
 *
 * Used by:
 *
 * backend/routes/chatRoutes.js
 *
 * This middleware delegates JWT verification to
 * the existing WELLJOB verifyToken middleware.
 */

function chatAuth(
  req,
  res,
  next
) {
  return verifyToken(
    req,
    res,
    async () => {
      try {
        req.chatUser =
          await buildChatUser(
            req.user
          );

        return next();
      } catch (error) {
        if (error.status) {
          return res
            .status(error.status)
            .json({
              success: false,

              error:
                error.message,
            });
        }

        console.error(
          "CHAT AUTHENTICATION ERROR:",
          error
        );

        return res
          .status(503)
          .json({
            success: false,

            error:
              "Chat authentication service is temporarily unavailable.",
          });
      }
    }
  );
}

/*
 * ==================================================
 * SOCKET.IO AUTHENTICATION ADAPTER
 * ==================================================
 *
 * Socket.IO does not use an Express route.
 *
 * This adapter passes the socket's login token
 * through the existing WELLJOB verifyToken
 * middleware.
 *
 * It prevents the Messenger from maintaining
 * a separate JWT verification implementation.
 */

async function resolveUser(
  token
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw createChatError(
      401,
      "Authentication token is required."
    );
  }

  /*
   * Run the existing Express authentication
   * middleware using a minimal request adapter.
   *
   * The supplied authMiddleware reads
   * req.headers.authorization and populates
   * req.user after successful verification.
   */

  const authenticatedUser =
    await new Promise(
      (resolve, reject) => {
        const request = {
          headers: {
            authorization:
              `Bearer ${token}`,
          },

          user: null,
        };

        const response = {
          statusCode: 200,

          status(code) {
            this.statusCode =
              code;

            return this;
          },

          json(body) {
            const error =
              createChatError(
                this.statusCode,
                body?.message ||
                  body?.error ||
                  "Authentication failed."
              );

            reject(error);

            return this;
          },
        };

        const onAuthenticated =
          () => {
            if (!request.user) {
              reject(
                createChatError(
                  401,
                  "Authentication failed."
                )
              );

              return;
            }

            resolve(request.user);
          };

        try {
          Promise.resolve(
            verifyToken(
              request,
              response,
              onAuthenticated
            )
          ).catch(reject);
        } catch (error) {
          reject(error);
        }
      }
    );

  return buildChatUser(
    authenticatedUser
  );
}

/*
 * ==================================================
 * EXPORTS
 * ==================================================
 */

module.exports = {
  chatAuth,
  resolveUser,
  isChatRole,
  normalizeRole,
};