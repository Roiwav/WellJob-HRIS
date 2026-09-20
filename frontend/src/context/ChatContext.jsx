
/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER - CHAT CONTEXT
 * ==================================================
 *
 * Features:
 * - Uses existing WELLJOB authentication
 * - Connects to the existing Socket.IO backend
 * - Receives real-time message notifications
 * - Tracks unread messages
 * - Displays new-message toast notifications
 * - Cleans up connections on logout
 * - Prevents stale unread responses after
 *   account changes
 *
 * IMPORTANT:
 *
 * ChatProvider must be rendered inside:
 *
 * 1. The existing React Router
 * 2. The existing WELLJOB AuthProvider
 *
 * Do not create another authentication provider
 * or another BrowserRouter for the Messenger.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { io } from "socket.io-client";

import { useAuth } from "./useAuth";

import {
  CHAT_SERVER_URL,
  chatApi,
  getChatToken,
} from "../services/chatApi";

/*
 * ==================================================
 * CHAT CONTEXT
 * ==================================================
 */

const ChatContext = createContext(null);

/*
 * ==================================================
 * CHAT PROVIDER
 * ==================================================
 */

export function ChatProvider({ children }) {
  /*
   * Use the existing WELLJOB authentication.
   */

  const { user } = useAuth();

  /*
   * IMPORTANT:
   *
   * The Messenger backend uses users.id,
   * which is the numeric database primary key.
   *
   * Do not use users.user_id as a fallback
   * because it represents a different
   * identifier in the WELLJOB system.
   */

  const currentUserId = Number(
    user?.id ?? 0
  );

  /*
   * Retrieve the existing login token.
   *
   * The current WELLJOB frontend stores
   * the JWT in localStorage under "token".
   */

  const token = user
    ? getChatToken(user)
    : "";

  const isAuthenticated =
    Number.isSafeInteger(currentUserId) &&
    currentUserId > 0 &&
    Boolean(token);

  /*
   * ==================================================
   * STATE
   * ==================================================
   */

  const [socket, setSocket] =
    useState(null);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [toast, setToast] =
    useState(null);

  /*
   * ==================================================
   * REQUEST AND SESSION TRACKING
   * ==================================================
   *
   * Prevent responses from a previous user
   * session from updating the current user's
   * unread message count.
   */

  const requestIdRef = useRef(0);

  const activeSessionRef = useRef(null);

  const sessionKey = isAuthenticated
    ? `${currentUserId}:${token}`
    : null;

  activeSessionRef.current = sessionKey;

  /*
   * ==================================================
   * REFRESH UNREAD MESSAGE COUNT
   * ==================================================
   *
   * This function may be called by:
   *
   * - Socket.IO connection events
   * - New message notifications
   * - Read receipt events
   * - Messenger page components
   * - Sidebar notification components
   */

  const refreshUnread = useCallback(
    async () => {
      const requestId =
        ++requestIdRef.current;

      const requestedSession =
        sessionKey;

      if (
        !isAuthenticated ||
        !requestedSession
      ) {
        setUnreadCount(0);

        return;
      }

      try {
        const result = await chatApi(
          "/unread-count"
        );

        /*
         * Ignore responses belonging to
         * a previous account or session.
         */

        if (
          requestId !==
            requestIdRef.current ||
          activeSessionRef.current !==
            requestedSession
        ) {
          return;
        }

        const count = Number(
          result?.unreadCount ?? 0
        );

        setUnreadCount(
          Number.isSafeInteger(count) &&
            count >= 0
            ? count
            : 0
        );
      } catch (error) {
        /*
         * Ignore outdated request errors
         * after a session change.
         */

        if (
          requestId !==
            requestIdRef.current ||
          activeSessionRef.current !==
            requestedSession
        ) {
          return;
        }

        console.error(
          "CHAT UNREAD REFRESH ERROR:",
          error
        );
      }
    },
    [
      isAuthenticated,
      sessionKey,
    ]
  );

  /*
   * ==================================================
   * SOCKET.IO CONNECTION
   * ==================================================
   *
   * A connection is established only when
   * an authenticated WELLJOB user is present.
   *
   * The same token used by the existing login
   * is supplied during the socket handshake.
   */

  useEffect(() => {
    /*
     * Invalidate pending unread requests
     * whenever the authenticated session
     * changes.
     */

    requestIdRef.current += 1;

    /*
     * ==================================================
     * LOGGED-OUT STATE
     * ==================================================
     */

    if (
      !isAuthenticated ||
      !sessionKey
    ) {
      setSocket(null);

      setUnreadCount(0);

      setToast(null);

      return;
    }

    /*
     * ==================================================
     * INITIALIZE SOCKET.IO CLIENT
     * ==================================================
     */

    const client = io(
      CHAT_SERVER_URL,
      {
        auth: {
          token,
        },

        transports: [
          "websocket",
          "polling",
        ],

        autoConnect: false,
      }
    );

    let active = true;

    /*
     * Make the current socket available
     * to Messenger components.
     */

    setSocket(client);

    /*
     * ==================================================
     * CONNECTION EVENT
     * ==================================================
     *
     * Refresh unread messages after a
     * successful socket connection.
     */

    const handleConnect = () => {
      if (!active) {
        return;
      }

      refreshUnread();
    };

    /*
     * ==================================================
     * NEW MESSAGE EVENT
     * ==================================================
     *
     * The backend publishes chat:message
     * after successfully saving a message.
     *
     * The sender is identified by the
     * authenticated server-side user ID.
     */

    const handleNewMessage = ({
      sender,
    } = {}) => {
      if (!active) {
        return;
      }

      /*
       * Update the unread message count.
       */

      refreshUnread();

      const senderId = Number(
        sender?.id ?? 0
      );

      /*
       * Do not display a new-message toast
       * when the event represents a message
       * sent by the current user.
       */

      if (
        senderId === currentUserId
      ) {
        return;
      }

      const senderName =
        String(
          sender?.fullName ||
            sender?.username ||
            "a WELLJOB user"
        ).trim();

      /*
       * Only show the sender's name.
       *
       * The notification does not expose
       * sensitive message content.
       */

      setToast({
        title: senderName,
        receivedAt: Date.now(),
      });
    };

    /*
     * ==================================================
     * READ RECEIPT EVENT
     * ==================================================
     */

    const handleReadReceipt = () => {
      if (!active) {
        return;
      }

      refreshUnread();
    };

    /*
     * ==================================================
     * CONNECTION ERROR
     * ==================================================
     */

    const handleConnectError = (
      error
    ) => {
      if (!active) {
        return;
      }

      console.error(
        "CHAT SOCKET CONNECTION ERROR:",
        error?.message ||
          "Unable to connect to Messenger."
      );
    };

    /*
     * ==================================================
     * REGISTER SOCKET EVENTS
     * ==================================================
     */

    client.on(
      "connect",
      handleConnect
    );

    client.on(
      "chat:message",
      handleNewMessage
    );

    client.on(
      "chat:read",
      handleReadReceipt
    );

    client.on(
      "connect_error",
      handleConnectError
    );

    /*
     * ==================================================
     * ESTABLISH CONNECTION
     * ==================================================
     */

    client.connect();

    /*
     * Load unread messages even if the
     * Socket.IO connection is temporarily
     * unavailable.
     */

    refreshUnread();

    /*
     * ==================================================
     * CLEANUP
     * ==================================================
     *
     * Disconnect the previous socket when:
     *
     * - The user logs out
     * - The authenticated session changes
     * - ChatProvider unmounts
     *
     * This prevents stale socket connections
     * from remaining active in the frontend.
     */

    return () => {
      active = false;

      requestIdRef.current += 1;

      client.removeAllListeners();

      client.disconnect();

      setSocket(
        (previousSocket) =>
          previousSocket === client
            ? null
            : previousSocket
      );
    };
  }, [
    isAuthenticated,
    sessionKey,
    token,
    currentUserId,
    refreshUnread,
  ]);

  /*
   * ==================================================
   * CHAT TOAST AUTO-DISMISS
   * ==================================================
   *
   * A new-message notification is displayed
   * for approximately 4.5 seconds.
   */

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = setTimeout(
      () => {
        setToast(null);
      },
      4500
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [toast]);

  /*
   * ==================================================
   * SHARED CHAT CONTEXT VALUE
   * ==================================================
   */

  const value = useMemo(
    () => ({
      socket,

      unreadCount,

      refreshUnread,

      currentUserId,

      user,
    }),
    [
      socket,
      unreadCount,
      refreshUnread,
      currentUserId,
      user,
    ]
  );

  /*
   * ==================================================
   * RENDER PROVIDER
   * ==================================================
   */

  return (
    <ChatContext.Provider
      value={value}
    >
      {children}

      {isAuthenticated && toast && (
        <Link
          to="/chat"
          onClick={() => {
            setToast(null);
          }}
          className="
            fixed bottom-5 right-5
            z-[1100]
            w-[calc(100%-2.5rem)]
            max-w-xs
            rounded-2xl
            border border-blue-200
            bg-white
            p-4
            text-sm text-slate-900
            shadow-xl
            transition
            hover:shadow-2xl
            dark:border-slate-700
            dark:bg-slate-900
            dark:text-white
          "
          role="status"
        >
          <span
            className="
              block
              font-semibold
            "
          >
            New chat message
          </span>

          <span
            className="
              mt-1
              block
              text-slate-600
              dark:text-slate-300
            "
          >
            From {toast.title}
          </span>
        </Link>
      )}
    </ChatContext.Provider>
  );
}

/*
 * ==================================================
 * USE CHAT HOOK
 * ==================================================
 *
 * Allows Messenger components to access
 * real-time chat functionality.
 */

export function useChat() {
  const context = useContext(
    ChatContext
  );

  if (!context) {
    throw new Error(
      "useChat must be used within a ChatProvider."
    );
  }

  return context;
}