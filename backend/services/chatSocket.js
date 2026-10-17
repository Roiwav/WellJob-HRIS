/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER SOCKET.IO SERVICE
 * ==================================================
 *
 * Real-time message delivery for the existing
 * single-server WELLJOB deployment.
 *
 * Security:
 *
 * - Existing JWT authentication
 * - Current account status validation
 * - Token version validation
 * - Role validation
 * - HR Coordinator company assignment validation
 * - Server-controlled private rooms
 * - Periodic session revalidation
 * - Recipient validation before event delivery
 *
 * No client-controlled message publishing.
 * No client-controlled room joining.
 */

const { Server } = require("socket.io");
const db = require("../config/db");

const {
  resolveUser,
} = require("../middleware/chatAuth");

let io = null;

/*
 * ==================================================
 * CONFIGURATION
 * ==================================================
 */

const SESSION_CHECK_INTERVAL =
  60 * 1000;

/*
 * Keep authentication tokens server-side.
 *
 * The token is not included in socket.data
 * or transmitted through chat events.
 */

const socketTokens = new Map();

/*
 * ==================================================
 * USER ID VALIDATION
 * ==================================================
 */

function normalizeUserId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  if (
    !/^[1-9][0-9]*$/.test(
      normalized
    )
  ) {
    return null;
  }

  const userId =
    Number(normalized);

  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return userId;
}

/*
 * ==================================================
 * PRIVATE USER ROOM
 * ==================================================
 */

function roomForUser(userId) {
  const normalizedId =
    normalizeUserId(userId);

  if (!normalizedId) {
    throw new Error(
      "Invalid chat user ID."
    );
  }

  return `chat:user:${normalizedId}`;
}

/*
 * ==================================================
 * SOCKET DISCONNECTION
 * ==================================================
 */

function disconnectSocket(socket) {
  if (!socket) {
    return;
  }

  socketTokens.delete(
    socket.id
  );

  if (socket.connected) {
    socket.disconnect(true);
  }
}

/*
 * ==================================================
 * SESSION REVALIDATION
 * ==================================================
 *
 * Revalidate a connected local Socket instance
 * using the existing WELLJOB authentication.
 */

async function revalidateSocket(socket) {
  if (
    !socket ||
    !socket.connected
  ) {
    return false;
  }

  const token =
    socketTokens.get(
      socket.id
    );

  if (!token) {
    disconnectSocket(socket);

    return false;
  }

  try {
    const currentUser =
      await resolveUser(token);

    const originalUserId =
      normalizeUserId(
        socket.data?.chatUser?.id
      );

    const currentUserId =
      normalizeUserId(
        currentUser?.id
      );

    /*
     * A connected socket cannot change
     * account identity.
     */

    if (
      !originalUserId ||
      !currentUserId ||
      originalUserId !== currentUserId
    ) {
      disconnectSocket(socket);

      return false;
    }

    /*
     * Recheck connection state after
     * the asynchronous database lookup.
     */

    if (!socket.connected) {
      return false;
    }

    if (
      socketTokens.get(
        socket.id
      ) !== token
    ) {
      disconnectSocket(socket);

      return false;
    }

    /*
     * Refresh authenticated user information.
     */

    socket.data.chatUser =
      currentUser;

    return true;
  } catch (error) {
    /*
     * Fail closed.
     *
     * Invalid, revoked, expired, or otherwise
     * unverifiable sessions are disconnected.
     */

    disconnectSocket(socket);

    return false;
  }
}

/*
 * ==================================================
 * SOCKET.IO INITIALIZATION
 * ==================================================
 */

function initChatSocket(
  httpServer,
  allowedOrigin
) {
  if (io) {
    return io;
  }

  if (!httpServer) {
    throw new Error(
      "An existing HTTP server is required."
    );
  }

  io = new Server(
    httpServer,
    {
      cors: {
        origin: allowedOrigin,

        methods: [
          "GET",
          "POST",
        ],
      },

      transports: [
        "websocket",
        "polling",
      ],
    }
  );

  /*
   * ==================================================
   * INITIAL CONNECTION AUTHENTICATION
   * ==================================================
   */

  io.use(
    async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token;

        if (
          typeof token !== "string" ||
          !token.trim()
        ) {
          return next(
            new Error(
              "Chat authentication required."
            )
          );
        }

        const authenticatedUser =
          await resolveUser(token);

        const userId =
          normalizeUserId(
            authenticatedUser?.id
          );

        if (!userId) {
          return next(
            new Error(
              "Invalid chat user."
            )
          );
        }

        /*
         * Store authenticated user information.
         *
         * The token is stored separately
         * when the socket connects.
         */

        socket.data.chatUser =
          authenticatedUser;

        socket.data.pendingChatToken =
          token;

        return next();
      } catch (error) {
        return next(
          new Error(
            "Chat authentication failed."
          )
        );
      }
    }
  );

  /*
   * ==================================================
   * SOCKET CONNECTION
   * ==================================================
   */

  io.on(
    "connection",
    (socket) => {
      const userId =
        normalizeUserId(
          socket.data?.chatUser?.id
        );

      const token =
        socket.data.pendingChatToken;

      /*
       * Remove the temporary token
       * from socket.data.
       */

      delete socket.data.pendingChatToken;

      if (
        !userId ||
        typeof token !== "string" ||
        !token
      ) {
        disconnectSocket(socket);

        return;
      }

      /*
       * Store the token privately on
       * the backend.
       */

      socketTokens.set(
        socket.id,
        token
      );

      /*
       * Join the authenticated user's
       * server-controlled private room.
       */

      socket.join(
        roomForUser(userId)
      );

      /*
       * ==================================================
       * PERIODIC SESSION REVALIDATION
       * ==================================================
       */

      let checkingSession =
        false;

      const sessionTimer =
        setInterval(
          async () => {
            if (
              !socket.connected ||
              checkingSession
            ) {
              return;
            }

            checkingSession =
              true;

            try {
              await revalidateSocket(
                socket
              );
            } finally {
              checkingSession =
                false;
            }
          },
          SESSION_CHECK_INTERVAL
        );

      /*
       * Prevent the timer from keeping
       * the Node.js process running alone.
       */

      if (
        typeof sessionTimer.unref ===
        "function"
      ) {
        sessionTimer.unref();
      }

      /*
       * ==================================================
       * DISCONNECTION CLEANUP
       * ==================================================
       */

      socket.on(
        "disconnect",
        () => {
          clearInterval(
            sessionTimer
          );

          socketTokens.delete(
            socket.id
          );

          delete socket.data.chatUser;
        }
      );

      /*
       * No incoming client event can:
       *
       * - publish an arbitrary message
       * - join another user's private room
       * - retrieve another user's conversation
       *
       * Message creation is handled by
       * authenticated REST API routes.
       */
    }
  );

  return io;
}

/*
 * ==================================================
 * PUBLISH EVENTS TO USERS
 * ==================================================
 *
 * Called by chatRoutes.js after an authorized
 * database operation succeeds.
 *
 * This implementation uses actual local Socket
 * instances rather than fetchSockets().
 *
 * It is intended for WELLJOB's existing
 * single-server deployment.
 */

function getMessageDeliveryContext(
  eventName,
  payload
) {
  if (
    eventName !==
      "chat:message" ||
    !payload?.message ||
    payload.message.isSystem
  ) {
    return null;
  }

  const senderId =
    normalizeUserId(
      payload?.sender?.id ??
        payload?.message?.senderId
    );

  const messageId =
    normalizeUserId(
      payload?.message?.id
    );

  const conversationId =
    String(
      payload?.message?.conversationId ||
        ""
    ).trim();

  if (
    !senderId ||
    !messageId ||
    !conversationId
  ) {
    return null;
  }

  return {
    senderId,
    messageId:
      String(
        messageId
      ),
    conversationId,
  };
}

async function canReceiveGroupMessage(
  userId,
  payload
) {
  const conversationId =
    String(
      payload?.message?.conversationId ||
        ""
    );

  if (
    !/^g:[1-9]\d*$/.test(
      conversationId
    )
  ) {
    return true;
  }

  const groupId =
    Number(
      conversationId.slice(
        2
      )
    );

  const messageId =
    normalizeUserId(
      payload?.message?.id
    );

  if (
    !Number.isSafeInteger(
      groupId
    ) ||
    groupId <= 0 ||
    !messageId
  ) {
    return false;
  }

  try {
    const [membershipRows] =
      await db
        .promise()
        .query(
          `
          SELECT 1
          FROM chat_group_members
          WHERE group_id = ?
            AND user_id = ?
            AND joined_after_message_id < ?
          LIMIT 1
          `,
          [
            groupId,
            userId,
            messageId,
          ]
        );

    return (
      membershipRows.length >
      0
    );
  } catch (error) {
    console.error(
      "CHAT GROUP DELIVERY VALIDATION ERROR:",
      error
    );

    return false;
  }
}

async function emitToVerifiedUser(
  userId,
  eventName,
  payload
) {
  if (!io) {
    return 0;
  }

  const room =
    roomForUser(
      userId
    );

  const connectedSockets =
    io.of("/").sockets;

  if (
    eventName ===
      "chat:message" &&
    !await canReceiveGroupMessage(
      userId,
      payload
    )
  ) {
    return 0;
  }

  let deliveredSocketCount =
    0;

  for (
    const socket of
    connectedSockets.values()
  ) {
    const socketUserId =
      normalizeUserId(
        socket.data?.chatUser?.id
      );

    /*
     * The socket must belong to the intended
     * authenticated recipient.
     */
    if (
      !socket.connected ||
      socketUserId !==
        userId ||
      !socket.rooms.has(
        room
      )
    ) {
      continue;
    }

    /*
     * Revalidate immediately before delivery.
     *
     * Revoked, expired, disabled, or otherwise
     * invalid sessions fail closed.
     */
    const isAuthorized =
      await revalidateSocket(
        socket
      );

    if (!isAuthorized) {
      continue;
    }

    const currentUserId =
      normalizeUserId(
        socket.data?.chatUser?.id
      );

    if (
      !socket.connected ||
      currentUserId !==
        userId ||
      !socket.rooms.has(
        room
      )
    ) {
      continue;
    }

    socket.emit(
      eventName,
      payload
    );

    deliveredSocketCount +=
      1;
  }

  return deliveredSocketCount;
}

/*
 * ==================================================
 * PUBLISH EVENTS TO USERS
 * ==================================================
 *
 * Called by chatRoutes.js after an authorized
 * database operation succeeds.
 *
 * Delivery semantics:
 *
 * - "Sent" is established by the successful REST
 *   message creation response.
 *
 * - "Delivered" is established here only when the
 *   server actually emits the new chat:message event
 *   to at least one currently connected, revalidated
 *   recipient socket.
 *
 * - "Seen" remains controlled by the existing
 *   chat:read workflow and persisted read state.
 *
 * Delivery receipts are real-time session state only.
 * They are not persisted to MySQL in this phase.
 */

async function publishToUsers(
  userIds,
  eventName,
  payload
) {
  if (!io) {
    return {
      deliveredUserIds:
        [],
      deliveredSocketCount:
        0,
    };
  }

  if (
    !Array.isArray(
      userIds
    ) ||
    typeof eventName !==
      "string" ||
    !eventName.trim()
  ) {
    return {
      deliveredUserIds:
        [],
      deliveredSocketCount:
        0,
    };
  }

  const uniqueUserIds =
    [
      ...new Set(
        userIds
          .map(
            normalizeUserId
          )
          .filter(
            (userId) =>
              userId !==
              null
          )
      ),
    ];

  const deliveredUserIds =
    [];

  let deliveredSocketCount =
    0;

  for (
    const userId of
    uniqueUserIds
  ) {
    const socketCount =
      await emitToVerifiedUser(
        userId,
        eventName,
        payload
      );

    if (
      socketCount >
      0
    ) {
      deliveredUserIds.push(
        userId
      );

      deliveredSocketCount +=
        socketCount;
    }
  }

  /*
   * Server-generated real-time delivery receipt.
   *
   * Never trust a client to claim that another user
   * received a message. A receipt is created only
   * from the actual verified Socket.IO delivery path.
   */
  const deliveryContext =
    getMessageDeliveryContext(
      eventName,
      payload
    );

  if (deliveryContext) {
    const recipientUserIds =
      uniqueUserIds.filter(
        (userId) =>
          userId !==
          deliveryContext.senderId
      );

    const deliveredRecipientIds =
      deliveredUserIds.filter(
        (userId) =>
          userId !==
          deliveryContext.senderId
      );

    if (
      deliveredRecipientIds.length >
      0
    ) {
      const deliveryReceipt = {
        conversationId:
          deliveryContext.conversationId,

        messageId:
          deliveryContext.messageId,

        deliveredAt:
          new Date()
            .toISOString(),

        deliveredCount:
          deliveredRecipientIds.length,

        recipientCount:
          recipientUserIds.length,

        fullyDelivered:
          deliveredRecipientIds.length >=
          recipientUserIds.length,
      };

      await emitToVerifiedUser(
        deliveryContext.senderId,
        "chat:delivered",
        deliveryReceipt
      );
    }
  }

  return {
    deliveredUserIds,
    deliveredSocketCount,
  };
}

/*
 * ==================================================
 * EXPORTS
 * ==================================================
 */

module.exports = {
  initChatSocket,
  publishToUsers,
};