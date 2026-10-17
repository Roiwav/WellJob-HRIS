/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER - CHAT CONTEXT
 * ==================================================
 *
 * Shared Messenger notification and realtime state.
 *
 * Transport strategy:
 * - One authenticated Socket.IO connection is created
 *   for the signed-in account when live transport is
 *   available.
 * - REST polling remains active as a reliable fallback.
 * - Aiven remains the source of truth.
 *
 * Security:
 * - Uses the existing WELLJOB authentication token.
 * - Never exposes message bodies in toast notifications.
 * - Ignores stale responses after account/session changes.
 * - Socket authentication is refreshed by the backend.
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
import {
  io as createSocket,
} from "socket.io-client";

import { useAuth } from "./useAuth";

import {
  CHAT_SERVER_URL,
  chatApi,
  getChatToken,
} from "../services/chatApi";

const CHAT_NOTIFICATION_POLL_MS = 5000;
const CHAT_SOCKET_TIMEOUT_MS = 5000;
const CHAT_SOCKET_RECONNECT_ATTEMPTS = 5;

const ChatContext = createContext(null);

function normalizeUnread(value) {
  const count =
    Number(
      value ?? 0
    );

  return (
    Number.isSafeInteger(
      count
    ) &&
    count >= 0
  )
    ? count
    : 0;
}

function threadTimestamp(thread) {
  const value =
    thread?.lastAt ||
    thread?.updatedAt ||
    thread?.createdAt;

  const time =
    new Date(
      value || 0
    ).getTime();

  return Number.isFinite(
    time
  )
    ? time
    : 0;
}

function threadTitle(thread) {
  if (
    thread?.kind ===
    "group"
  ) {
    return String(
      thread?.name ||
        "Group chat"
    ).trim();
  }

  return String(
    thread?.partner?.fullName ||
      thread?.partner?.username ||
      "a team member"
  ).trim();
}

function snapshotThreads(threads) {
  const snapshot =
    new Map();

  for (
    const thread of
    threads
  ) {
    if (
      thread?.id ===
        null ||
      thread?.id ===
        undefined
    ) {
      continue;
    }

    snapshot.set(
      String(
        thread.id
      ),
      {
        unreadCount:
          normalizeUnread(
            thread.unreadCount
          ),

        lastAt:
          threadTimestamp(
            thread
          ),
      }
    );
  }

  return snapshot;
}

export function ChatProvider({
  children,
}) {
  const { user } =
    useAuth();

  const currentUserId =
    Number(
      user?.id ??
        0
    );

  const token =
    user
      ? getChatToken(
          user
        )
      : "";

  const isAuthenticated =
    Number.isSafeInteger(
      currentUserId
    ) &&
    currentUserId >
      0 &&
    Boolean(
      token
    );

  const sessionKey =
    isAuthenticated
      ? `${currentUserId}:${token}`
      : null;

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    toast,
    setToast,
  ] = useState(null);

  const [
    socket,
    setSocket,
  ] = useState(null);

  const [
    realtimeMode,
    setRealtimeMode,
  ] = useState(
    "polling"
  );

  const unreadRequestIdRef =
    useRef(0);

  const notificationRequestIdRef =
    useRef(0);

  const unreadWriteGenerationRef =
    useRef(0);

  const activeSessionRef =
    useRef(null);

  const threadSnapshotRef =
    useRef(
      new Map()
    );

  const snapshotReadyRef =
    useRef(false);

  useEffect(() => {
    activeSessionRef.current =
      sessionKey;
  }, [
    sessionKey,
  ]);

  const refreshUnread =
    useCallback(
      async () => {
        const requestId =
          ++unreadRequestIdRef.current;

        const unreadWriteGeneration =
          ++unreadWriteGenerationRef.current;

        const requestedSession =
          sessionKey;

        if (
          !isAuthenticated ||
          !requestedSession
        ) {
          setUnreadCount(
            0
          );

          return 0;
        }

        try {
          const result =
            await chatApi(
              "/unread-count"
            );

          if (
            requestId !==
              unreadRequestIdRef.current ||
            unreadWriteGeneration !==
              unreadWriteGenerationRef.current ||
            activeSessionRef.current !==
              requestedSession
          ) {
            return null;
          }

          const count =
            normalizeUnread(
              result?.unreadCount
            );

          setUnreadCount(
            count
          );

          return count;
        } catch (error) {
          if (
            requestId !==
              unreadRequestIdRef.current ||
            unreadWriteGeneration !==
              unreadWriteGenerationRef.current ||
            activeSessionRef.current !==
              requestedSession
          ) {
            return null;
          }

          console.error(
            "CHAT UNREAD REFRESH ERROR:",
            error
          );

          return null;
        }
      },
      [
        isAuthenticated,
        sessionKey,
      ]
    );

  const pollNotificationState =
    useCallback(
      async ({
        allowToast = true,
      } = {}) => {
        const requestId =
          ++notificationRequestIdRef.current;

        const unreadWriteGeneration =
          ++unreadWriteGenerationRef.current;

        const requestedSession =
          sessionKey;

        if (
          !isAuthenticated ||
          !requestedSession
        ) {
          return;
        }

        try {
          const [
            unreadResult,
            conversationsResult,
          ] =
            await Promise.all([
              chatApi(
                "/unread-count"
              ),

              chatApi(
                "/conversations"
              ),
            ]);

          if (
            requestId !==
              notificationRequestIdRef.current ||
            activeSessionRef.current !==
              requestedSession
          ) {
            return;
          }

          if (
            unreadWriteGeneration ===
              unreadWriteGenerationRef.current
          ) {
            setUnreadCount(
              normalizeUnread(
                unreadResult?.unreadCount
              )
            );
          }

          const conversations =
            Array.isArray(
              conversationsResult
            )
              ? conversationsResult
              : [];

          const previousSnapshot =
            threadSnapshotRef.current;

          const nextSnapshot =
            snapshotThreads(
              conversations
            );

          if (
            snapshotReadyRef.current &&
            allowToast
          ) {
            const candidates =
              conversations
                .filter(
                  (thread) => {
                    const currentUnread =
                      normalizeUnread(
                        thread?.unreadCount
                      );

                    if (
                      currentUnread <=
                        0 ||
                      thread?.id ===
                        null ||
                      thread?.id ===
                        undefined
                    ) {
                      return false;
                    }

                    const previous =
                      previousSnapshot.get(
                        String(
                          thread.id
                        )
                      );

                    if (!previous) {
                      return true;
                    }

                    return (
                      currentUnread >
                        previous.unreadCount ||
                      threadTimestamp(
                        thread
                      ) >
                        previous.lastAt
                    );
                  }
                )
                .sort(
                  (
                    first,
                    second
                  ) =>
                    threadTimestamp(
                      second
                    ) -
                    threadTimestamp(
                      first
                    )
                );

            const newest =
              candidates[0];

            if (newest) {
              setToast({
                title:
                  threadTitle(
                    newest
                  ),

                isGroup:
                  newest.kind ===
                  "group",

                receivedAt:
                  Date.now(),
              });
            }
          }

          threadSnapshotRef.current =
            nextSnapshot;

          snapshotReadyRef.current =
            true;
        } catch (error) {
          if (
            requestId !==
              notificationRequestIdRef.current ||
            activeSessionRef.current !==
              requestedSession
          ) {
            return;
          }

          console.error(
            "CHAT NOTIFICATION REFRESH ERROR:",
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
   * REST POLLING BASELINE + FALLBACK
   * ==================================================
   *
   * Polling stays enabled even when live transport is
   * connected so missed/reconnected events reconcile
   * back to the database source of truth.
   */

  useEffect(() => {
    unreadRequestIdRef.current +=
      1;

    notificationRequestIdRef.current +=
      1;

    unreadWriteGenerationRef.current +=
      1;

    threadSnapshotRef.current =
      new Map();

    snapshotReadyRef.current =
      false;

    let active =
      true;

    const resetTimer =
      window.setTimeout(
        () => {
          if (!active) {
            return;
          }

          setToast(
            null
          );

          if (
            !isAuthenticated ||
            !sessionKey
          ) {
            setUnreadCount(
              0
            );
          }
        },
        0
      );

    if (
      !isAuthenticated ||
      !sessionKey
    ) {
      return () => {
        active =
          false;

        window.clearTimeout(
          resetTimer
        );
      };
    }

    const initialPollTimer =
      window.setTimeout(
        () => {
          if (!active) {
            return;
          }

          void pollNotificationState({
            allowToast:
              false,
          });
        },
        0
      );

    const interval =
      window.setInterval(
        () => {
          if (
            active &&
            !document.hidden
          ) {
            void pollNotificationState();
          }
        },
        CHAT_NOTIFICATION_POLL_MS
      );

    const refreshOnVisible =
      () => {
        if (
          active &&
          !document.hidden
        ) {
          void pollNotificationState();
        }
      };

    window.addEventListener(
      "focus",
      refreshOnVisible
    );

    document.addEventListener(
      "visibilitychange",
      refreshOnVisible
    );

    return () => {
      active =
        false;

      window.clearTimeout(
        resetTimer
      );

      window.clearTimeout(
        initialPollTimer
      );

      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        refreshOnVisible
      );

      document.removeEventListener(
        "visibilitychange",
        refreshOnVisible
      );
    };
  }, [
    isAuthenticated,
    sessionKey,
    pollNotificationState,
  ]);

  /*
   * ==================================================
   * SINGLE SHARED LIVE SOCKET
   * ==================================================
   *
   * Messenger.jsx consumes this same socket instance.
   * No second connection is created by page components.
   *
   * If the deployment environment does not support
   * long-lived Socket.IO connections, connection failure
   * silently falls back to the polling transport above.
   */

  useEffect(() => {
    if (
      !isAuthenticated ||
      !sessionKey ||
      !token
    ) {
      return undefined;
    }

    const requestedSession =
      sessionKey;

    let disposed =
      false;

    const client =
      createSocket(
        CHAT_SERVER_URL,
        {
          auth: {
            token,
          },

          transports: [
            "websocket",
            "polling",
          ],

          timeout:
            CHAT_SOCKET_TIMEOUT_MS,

          reconnection:
            true,

          reconnectionAttempts:
            CHAT_SOCKET_RECONNECT_ATTEMPTS,

          reconnectionDelay:
            1000,

          reconnectionDelayMax:
            5000,
        }
      );

    const isCurrentSession =
      () =>
        !disposed &&
        activeSessionRef.current ===
          requestedSession;

    const onConnect =
      () => {
        if (
          !isCurrentSession()
        ) {
          client.disconnect();

          return;
        }

        /*
         * React state is updated from the actual
         * external Socket.IO connection event, not
         * synchronously from the effect body.
         */
        setSocket(
          client
        );

        setRealtimeMode(
          "live"
        );

        void pollNotificationState({
          allowToast:
            false,
        });
      };

    const onDisconnect =
      () => {
        if (
          !isCurrentSession()
        ) {
          return;
        }

        setSocket(
          (current) =>
            current ===
            client
              ? null
              : current
        );

        setRealtimeMode(
          "polling"
        );
      };

    const onConnectError =
      () => {
        if (
          !isCurrentSession()
        ) {
          return;
        }

        setSocket(
          (current) =>
            current ===
            client
              ? null
              : current
        );

        setRealtimeMode(
          "polling"
        );
      };

    const onMessage =
      ({
        message,
      } = {}) => {
        if (
          !isCurrentSession() ||
          !message?.id
        ) {
          return;
        }

        /*
         * Own sent messages do not create a notification.
         * Incoming messages trigger an immediate REST
         * reconciliation so unread count and toast state
         * remain database-backed.
         */
        if (
          Number(
            message.senderId
          ) !==
          currentUserId
        ) {
          void pollNotificationState({
            allowToast:
              true,
          });
        }
      };

    const onRead =
      (receipt = {}) => {
        if (
          !isCurrentSession() ||
          Number(
            receipt.readerId
          ) !==
            currentUserId
        ) {
          return;
        }

        void refreshUnread();
      };

    const onConversationChanged =
      () => {
        if (
          !isCurrentSession()
        ) {
          return;
        }

        void pollNotificationState({
          allowToast:
            false,
        });
      };

    client.on(
      "connect",
      onConnect
    );

    client.on(
      "disconnect",
      onDisconnect
    );

    client.on(
      "connect_error",
      onConnectError
    );

    client.on(
      "chat:message",
      onMessage
    );

    client.on(
      "chat:read",
      onRead
    );

    client.on(
      "chat:changed",
      onConversationChanged
    );

    return () => {
      disposed =
        true;

      client.off(
        "connect",
        onConnect
      );

      client.off(
        "disconnect",
        onDisconnect
      );

      client.off(
        "connect_error",
        onConnectError
      );

      client.off(
        "chat:message",
        onMessage
      );

      client.off(
        "chat:read",
        onRead
      );

      client.off(
        "chat:changed",
        onConversationChanged
      );

      client.disconnect();
    };
  }, [
    isAuthenticated,
    sessionKey,
    token,
    currentUserId,
    pollNotificationState,
    refreshUnread,
  ]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout =
      window.setTimeout(
        () => {
          setToast(
            null
          );
        },
        4500
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    toast,
  ]);

  const activeSocket =
    isAuthenticated &&
    socket?.connected
      ? socket
      : null;

  const effectiveRealtimeMode =
    activeSocket
      ? realtimeMode
      : "polling";

  const value =
    useMemo(
      () => ({
        /*
         * One shared connected socket is exposed to
         * Messenger. A disconnected/stale client is
         * hidden so page components automatically
         * continue through REST polling.
         */
        socket:
          activeSocket,

        realtimeMode:
          effectiveRealtimeMode,

        unreadCount,

        refreshUnread,

        currentUserId,

        user,
      }),
      [
        activeSocket,
        effectiveRealtimeMode,
        unreadCount,
        refreshUnread,
        currentUserId,
        user,
      ]
    );

  return (
    <ChatContext.Provider
      value={
        value
      }
    >
      {children}

      {isAuthenticated &&
        toast && (
          <Link
            to="/chat"
            onClick={() => {
              setToast(
                null
              );
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
              {toast.isGroup
                ? "New group message"
                : "New message"}
            </span>

            <span
              className="
                mt-1
                block
                text-slate-600
                dark:text-slate-300
              "
            >
              {toast.isGroup
                ? `In ${toast.title}`
                : `From ${toast.title}`}
            </span>
          </Link>
        )}
    </ChatContext.Provider>
  );
}

// ChatProvider and useChat intentionally share this module
// so existing imports remain stable throughout the HRIS.
// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  const context =
    useContext(
      ChatContext
    );

  if (!context) {
    throw new Error(
      "useChat must be used within a ChatProvider."
    );
  }

  return context;
}