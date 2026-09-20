
/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER API ROUTES
 * ==================================================
 *
 * Features:
 * - Authorized user directory
 * - Private one-to-one conversations
 * - Message creation and persistence
 * - Conversation history
 * - Unread message counting
 * - Read receipts
 * - Socket.IO notifications
 *
 * Security:
 * - Existing WELLJOB authentication
 * - Current user role validation
 * - Current account status validation
 * - HR Coordinator company assignment validation
 * - Conversation membership authorization
 * - Server-controlled sender identity
 *
 * IMPORTANT:
 *
 * The Messenger uses existing WELLJOB user
 * accounts and the existing MySQL database.
 *
 * It does not grant access to employee records,
 * deployment records, documents, or incidents.
 */

const express = require("express");

const db = require("../config/db");

const {
  chatAuth,
  isChatRole,
  normalizeRole,
} = require("../middleware/chatAuth");

const {
  config,
  col,
  table,
  userSelect,
} = require("../config/chatConfig");

const {
  publishToUsers,
} = require("../services/chatSocket");

const router = express.Router();

/*
 * ==================================================
 * AUTHENTICATION
 * ==================================================
 *
 * Every Messenger API endpoint requires
 * an authenticated WELLJOB user.
 */

router.use(chatAuth);

/*
 * ==================================================
 * CONFIGURATION
 * ==================================================
 */

const MAX_MESSAGE_LENGTH = 2000;

const MESSAGE_PAGE_SIZE = 50;

/*
 * ==================================================
 * ID VALIDATION
 * ==================================================
 */

function validId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const normalized = String(value).trim();

  if (!/^[1-9][0-9]*$/.test(normalized)) {
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

/*
 * ==================================================
 * ACCOUNT VALIDATION
 * ==================================================
 *
 * A user is eligible for new chat activity
 * only when:
 *
 * 1. The account is ACTIVE.
 * 2. The role is authorized for Messenger.
 * 3. An HR Coordinator has an assigned company.
 *
 * Existing conversation history is preserved
 * even if another participant later becomes
 * inactive.
 */

function isEligibleChatUser(user) {
  if (!user) {
    return false;
  }

  const accountStatus = String(
    user.accountStatus || ""
  )
    .trim()
    .toUpperCase();

  const role = normalizeRole(user.role);

  if (accountStatus !== "ACTIVE") {
    return false;
  }

  if (!isChatRole(role)) {
    return false;
  }

  if (role === "HR_COORDINATOR") {
    const assignedCompany = String(
      user.assignedCompany ?? ""
    ).trim();

    if (!assignedCompany) {
      return false;
    }
  }

  return true;
}

/*
 * ==================================================
 * PUBLIC USER DTO
 * ==================================================
 *
 * Return only information needed to display
 * a WELLJOB user inside the Messenger.
 *
 * Never expose passwords, JWT secrets,
 * token_version, or employee records.
 */

function userDto(user) {
  return {
    id: Number(user.id),

    username: user.username,

    fullName:
      user.fullName ?? null,

    role:
      normalizeRole(user.role),

    /*
     * Profile picture filename from
     * users.avatar_filename.
     *
     * The filename is not a public URL.
     */
    avatarFilename:
      user.avatarFilename ?? null,

    /*
     * Retained for compatibility with
     * the existing Messenger frontend.
     *
     * The profile picture will be loaded
     * through an authenticated request.
     */
    avatarUrl: null,
  };
}

/*
 * ==================================================
 * MESSAGE DTO
 * ==================================================
 */

function messageDto(row) {
  return {
    id: String(row.id),

    conversationId:
      String(row.conversation_id),

    senderId:
      Number(row.sender_id),

    body: row.body,

    createdAt:
      row.created_at,

    readAt:
      row.read_at,
  };
}

/*
 * ==================================================
 * DATABASE USER LOOKUP
 * ==================================================
 *
 * Uses the actual WELLJOB users table.
 *
 * Additional account fields are used only
 * for server-side eligibility validation.
 */

async function findChatUser(userId) {
  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        ${userSelect("u")},

        u.${col("status")}
          AS accountStatus,

        u.${col("assigned_company")}
          AS assignedCompany

      FROM ${table} u

      WHERE
        u.${col(config.userIdColumn)} = ?

      LIMIT 1
      `,
      [userId]
    );

  return rows[0] ?? null;
}

/*
 * ==================================================
 * CONVERSATION MEMBERSHIP
 * ==================================================
 *
 * A conversation is accessible only when
 * the authenticated user is one of its
 * two participants.
 *
 * A random conversation ID does not grant
 * access to another user's messages.
 */

async function findConversation(
  conversationId,
  userId
) {
  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        id,
        user1_id,
        user2_id,
        created_at,
        updated_at

      FROM chat_conversations

      WHERE
        id = ?

        AND (
          user1_id = ?
          OR user2_id = ?
        )

      LIMIT 1
      `,
      [
        conversationId,
        userId,
        userId,
      ]
    );

  return rows[0] ?? null;
}

/*
 * ==================================================
 * ERROR HANDLER
 * ==================================================
 */

function serverError(res, error) {
  console.error(
    "WELLJOB CHAT ERROR:",
    error
  );

  return res
    .status(500)
    .json({
      success: false,

      error:
        "Chat request failed. Please try again.",
    });
}

/*
 * ==================================================
 * SOCKET.IO EVENT HELPER
 * ==================================================
 *
 * Database operations must not fail just
 * because a recipient is temporarily offline.
 *
 * Socket.IO event delivery is handled
 * independently after the database operation
 * has successfully completed.
 */

function notifyChatUsers(
  userIds,
  eventName,
  payload
) {
  try {
    Promise.resolve(
      publishToUsers(
        userIds,
        eventName,
        payload
      )
    ).catch((error) => {
      console.error(
        "CHAT NOTIFICATION ERROR:",
        error
      );
    });
  } catch (error) {
    console.error(
      "CHAT NOTIFICATION ERROR:",
      error
    );
  }
}

/*
 * ==================================================
 * GET /api/chat/users
 * ==================================================
 *
 * Returns existing WELLJOB users who are
 * currently eligible for Messenger.
 *
 * The currently logged-in user is excluded.
 *
 * No employee, document, deployment, or
 * incident records are returned.
 */

router.get(
  "/users",

  async (req, res) => {
    try {
      const currentUserId =
        req.chatUser.id;

      const [rows] = await db
        .promise()
        .query(
          `
          SELECT
            ${userSelect("u")},

            u.${col("status")}
              AS accountStatus,

            u.${col("assigned_company")}
              AS assignedCompany

          FROM ${table} u

          WHERE
            u.${col(config.userIdColumn)} <> ?

          ORDER BY
            u.${col(config.usernameColumn)} ASC
          `,
          [currentUserId]
        );

      const users = rows
        .filter(isEligibleChatUser)
        .map(userDto);

      return res.json(users);
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * GET /api/chat/unread-count
 * ==================================================
 *
 * Counts unread incoming messages across
 * conversations involving the current user.
 */

router.get(
  "/unread-count",

  async (req, res) => {
    try {
      const currentUserId =
        req.chatUser.id;

      const [rows] = await db
        .promise()
        .query(
          `
          SELECT
            COUNT(*) AS total

          FROM chat_messages m

          INNER JOIN chat_conversations c
            ON c.id = m.conversation_id

          WHERE
            (
              c.user1_id = ?
              OR c.user2_id = ?
            )

            AND m.sender_id <> ?

            AND m.read_at IS NULL
          `,
          [
            currentUserId,
            currentUserId,
            currentUserId,
          ]
        );

      return res.json({
        unreadCount:
          Number(rows[0]?.total || 0),
      });
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * GET /api/chat/conversations
 * ==================================================
 *
 * Returns the current user's existing
 * private conversations.
 *
 * Only conversations in which the current
 * user is a participant are returned.
 *
 * Historical conversations remain accessible
 * when another participant becomes inactive.
 *
 * However, new messages cannot be sent to
 * an ineligible recipient.
 */

router.get(
  "/conversations",

  async (req, res) => {
    const currentUserId =
      req.chatUser.id;

    try {
      const [rows] = await db
        .promise()
        .query(
          `
          SELECT

            c.id AS conversationId,

            c.created_at AS createdAt,

            c.updated_at AS updatedAt,

            ${userSelect("u")},

            u.${col("status")}
              AS accountStatus,

            u.${col("assigned_company")}
              AS assignedCompany,

            (
              SELECT m.body

              FROM chat_messages m

              WHERE
                m.conversation_id = c.id

              ORDER BY
                m.id DESC

              LIMIT 1
            ) AS lastBody,

            (
              SELECT m.created_at

              FROM chat_messages m

              WHERE
                m.conversation_id = c.id

              ORDER BY
                m.id DESC

              LIMIT 1
            ) AS lastAt,

            (
              SELECT COUNT(*)

              FROM chat_messages m

              WHERE
                m.conversation_id = c.id

                AND m.sender_id <> ?

                AND m.read_at IS NULL
            ) AS unreadCount

          FROM chat_conversations c

          INNER JOIN ${table} u

            ON u.${col(config.userIdColumn)}
              = IF(
                c.user1_id = ?,
                c.user2_id,
                c.user1_id
              )

          WHERE
            c.user1_id = ?
            OR c.user2_id = ?

          ORDER BY
            COALESCE(
              lastAt,
              c.updated_at
            ) DESC,

            c.id DESC
          `,
          [
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
          ]
        );

      const conversations =
        rows.map((row) => ({
          id:
            String(row.conversationId),

          createdAt:
            row.createdAt,

          updatedAt:
            row.updatedAt,

          partner:
            userDto(row),

          canMessage:
            isEligibleChatUser(row),

          lastBody:
            row.lastBody,

          lastAt:
            row.lastAt,

          unreadCount:
            Number(
              row.unreadCount || 0
            ),
        }));

      return res.json(
        conversations
      );
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * POST /api/chat/conversations
 * ==================================================
 *
 * Creates or retrieves a private conversation
 * between two authorized WELLJOB users.
 *
 * The sender is always determined by the
 * authenticated server-side session.
 */

router.post(
  "/conversations",

  async (req, res) => {
    const recipientId =
      validId(
        req.body?.recipientId
      );

    const currentUserId =
      req.chatUser.id;

    if (
      !recipientId ||
      recipientId === currentUserId
    ) {
      return res
        .status(400)
        .json({
          error:
            "Choose a different valid user.",
        });
    }

    try {
      const recipient =
        await findChatUser(
          recipientId
        );

      if (
        !isEligibleChatUser(
          recipient
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Recipient is not available for chat.",
          });
      }

      /*
       * Normalize participant ordering.
       *
       * This prevents duplicate conversations
       * when the same two users initiate
       * messaging in different directions.
       */

      const user1Id =
        Math.min(
          currentUserId,
          recipientId
        );

      const user2Id =
        Math.max(
          currentUserId,
          recipientId
        );

      const [result] =
        await db
          .promise()
          .query(
            `
            INSERT INTO chat_conversations
              (
                user1_id,
                user2_id
              )

            VALUES (?, ?)

            ON DUPLICATE KEY UPDATE
              id = LAST_INSERT_ID(id)
            `,
            [
              user1Id,
              user2Id,
            ]
          );

      return res
        .status(200)
        .json({
          conversationId:
            String(result.insertId),
        });
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * GET /api/chat/conversations/:id/messages
 * ==================================================
 *
 * Retrieves message history for an authorized
 * conversation participant.
 *
 * Message pagination is limited to
 * 50 messages per request.
 */

router.get(
  "/conversations/:id/messages",

  async (req, res) => {
    const conversationId =
      validId(
        req.params.id
      );

    if (!conversationId) {
      return res
        .status(400)
        .json({
          error:
            "Invalid conversation.",
        });
    }

    const hasBeforeCursor =
      req.query.before !== undefined;

    const before =
      hasBeforeCursor
        ? validId(
            req.query.before
          )
        : null;

    if (
      hasBeforeCursor &&
      !before
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid message cursor.",
        });
    }

    try {
      const conversation =
        await findConversation(
          conversationId,
          req.chatUser.id
        );

      if (!conversation) {
        return res
          .status(404)
          .json({
            error:
              "Conversation not found.",
          });
      }

      /*
       * Load newest messages first.
       *
       * Retrieve one extra row to determine
       * whether older messages still exist.
       */

      const parameters = [
        conversationId,
      ];

      let cursorCondition = "";

      if (before) {
        cursorCondition =
          "AND id < ?";

        parameters.push(
          before
        );
      }

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              conversation_id,
              sender_id,
              body,
              created_at,
              read_at

            FROM chat_messages

            WHERE
              conversation_id = ?

              ${cursorCondition}

            ORDER BY
              id DESC

            LIMIT 51
            `,
            parameters
          );

      const hasMore =
        rows.length >
        MESSAGE_PAGE_SIZE;

      const messages =
        rows
          .slice(
            0,
            MESSAGE_PAGE_SIZE
          )
          .reverse()
          .map(messageDto);

      return res.json({
        messages,

        hasMore,
      });
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * POST /api/chat/conversations/:id/messages
 * ==================================================
 *
 * Creates a new private message.
 *
 * SECURITY:
 *
 * - Sender identity comes from req.chatUser.
 * - Conversation membership is validated.
 * - Recipient eligibility is rechecked.
 * - Message length is validated.
 * - Message is persisted in MySQL.
 *
 * A Socket.IO event is published only after
 * the database operation succeeds.
 */

router.post(
  "/conversations/:id/messages",

  async (req, res) => {
    const conversationId =
      validId(
        req.params.id
      );

    const rawBody =
      req.body?.body;

    if (!conversationId) {
      return res
        .status(400)
        .json({
          error:
            "Invalid conversation.",
        });
    }

    if (
      typeof rawBody !== "string"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Message must contain 1–2000 characters.",
        });
    }

    const body =
      rawBody.trim();

    if (
      body.length === 0 ||
      body.length >
        MAX_MESSAGE_LENGTH
    ) {
      return res
        .status(400)
        .json({
          error:
            "Message must contain 1–2000 characters.",
        });
    }

    try {
      const senderId =
        req.chatUser.id;

      /*
       * The current user must belong
       * to the conversation.
       */

      const conversation =
        await findConversation(
          conversationId,
          senderId
        );

      if (!conversation) {
        return res
          .status(404)
          .json({
            error:
              "Conversation not found.",
          });
      }

      /*
       * Determine the other participant.
       *
       * Never accept recipient identity
       * directly from the message body.
       */

      const user1Id =
        Number(
          conversation.user1_id
        );

      const user2Id =
        Number(
          conversation.user2_id
        );

      const recipientId =
        user1Id === senderId
          ? user2Id
          : user1Id;

      /*
       * Verify current recipient eligibility.
       *
       * Inactive accounts and HR Coordinators
       * without company assignments cannot
       * receive new messages.
       */

      const recipient =
        await findChatUser(
          recipientId
        );

      if (
        !isEligibleChatUser(
          recipient
        )
      ) {
        return res
          .status(403)
          .json({
            error:
              "Recipient is no longer available for chat.",
          });
      }

      /*
       * Save the message in MySQL.
       */

      const [insert] =
        await db
          .promise()
          .query(
            `
            INSERT INTO chat_messages
              (
                conversation_id,
                sender_id,
                body
              )

            VALUES (?, ?, ?)
            `,
            [
              conversationId,
              senderId,
              body,
            ]
          );

      /*
       * Update conversation activity timestamp.
       */

      await db
        .promise()
        .query(
          `
          UPDATE chat_conversations

          SET
            updated_at = CURRENT_TIMESTAMP(3)

          WHERE
            id = ?
          `,
          [
            conversationId,
          ]
        );

      /*
       * Retrieve the newly saved message.
       */

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              conversation_id,
              sender_id,
              body,
              created_at,
              read_at

            FROM chat_messages

            WHERE
              id = ?

            LIMIT 1
            `,
            [
              insert.insertId,
            ]
          );

      const message =
        messageDto(
          rows[0]
        );

      /*
       * Respond with the saved message.
       */

      res
        .status(201)
        .json({
          message,
        });

      /*
       * Notify sender and recipient.
       *
       * Socket.IO service revalidates
       * the connected recipient sessions.
       */

      notifyChatUsers(
        [
          senderId,
          recipientId,
        ],

        "chat:message",

        {
          message,

          sender: {
            id:
              senderId,

            username:
              req.chatUser.username,

            fullName:
              req.chatUser.fullName ??
              null,
          },
        }
      );

      return;
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * POST /api/chat/conversations/:id/read
 * ==================================================
 *
 * Marks incoming messages as read.
 *
 * A user cannot mark another user's
 * conversation as read.
 *
 * Only messages received by the current
 * user are updated.
 */

router.post(
  "/conversations/:id/read",

  async (req, res) => {
    const conversationId =
      validId(
        req.params.id
      );

    if (!conversationId) {
      return res
        .status(400)
        .json({
          error:
            "Invalid conversation.",
        });
    }

    try {
      const currentUserId =
        req.chatUser.id;

      const conversation =
        await findConversation(
          conversationId,
          currentUserId
        );

      if (!conversation) {
        return res
          .status(404)
          .json({
            error:
              "Conversation not found.",
          });
      }

      /*
       * Mark unread incoming messages as read.
       *
       * The current user's own outgoing messages
       * are not modified.
       */

      const [result] =
        await db
          .promise()
          .query(
            `
            UPDATE chat_messages

            SET
              read_at = CURRENT_TIMESTAMP(3)

            WHERE
              conversation_id = ?

              AND sender_id <> ?

              AND read_at IS NULL
            `,
            [
              conversationId,
              currentUserId,
            ]
          );

      const updated =
        Number(
          result.affectedRows || 0
        );

      /*
       * Respond with the number of
       * updated messages.
       */

      res.json({
        updated,
      });

      /*
       * Notify both conversation participants
       * when the read status changes.
       */

      if (updated > 0) {
        notifyChatUsers(
          [
            Number(
              conversation.user1_id
            ),

            Number(
              conversation.user2_id
            ),
          ],

          "chat:read",

          {
            conversationId:
              String(
                conversationId
              ),

            readerId:
              currentUserId,
          }
        );
      }

      return;
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

/*
 * ==================================================
 * EXPORT ROUTER
 * ==================================================
 */

module.exports = router;