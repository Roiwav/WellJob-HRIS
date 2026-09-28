/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER - CHAT CONTEXT
 * ==================================================
 *
 * Vercel-safe Messenger notification state.
 *
 * Realtime transport:
 * - No persistent Socket.IO client is created here.
 * - Unread state and lightweight notification metadata
 *   are refreshed through authenticated REST polling.
 * - Aiven remains the source of truth.
 *
 * Security:
 * - Uses the existing WELLJOB authentication token.
 * - Never exposes message bodies in toast notifications.
 * - Ignores stale responses after account/session changes.
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

import { useAuth } from "./useAuth";

import {
  chatApi,
  getChatToken,
} from "../services/chatApi";

const CHAT_NOTIFICATION_POLL_MS = 5000;

const ChatContext = createContext(null);

function normalizeUnread(value) {
  const count = Number(value ?? 0);

  return Number.isSafeInteger(count) && count >= 0
    ? count
    : 0;
}

function threadTimestamp(thread) {
  const value =
    thread?.lastAt ||
    thread?.updatedAt ||
    thread?.createdAt;

  const time =
    new Date(value || 0)
      .getTime();

  return Number.isFinite(time)
    ? time
    : 0;
}

function threadTitle(thread) {
  if (thread?.kind === "group") {
    return String(
      thread?.name ||
      "Group conversation"
    ).trim();
  }

  return String(
    thread?.partner?.fullName ||
    thread?.partner?.username ||
    "a WELLJOB user"
  ).trim();
}

function snapshotThreads(threads) {
  const snapshot =
    new Map();

  for (const thread of threads) {
    if (thread?.id == null) {
      continue;
    }

    snapshot.set(
      String(thread.id),
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

export function ChatProvider({ children }) {
  const { user } =
    useAuth();

  const currentUserId =
    Number(
      user?.id ??
      0
    );

  const token =
    user
      ? getChatToken(user)
      : "";

  const isAuthenticated =
    Number.isSafeInteger(
      currentUserId
    ) &&
    currentUserId > 0 &&
    Boolean(token);

  const sessionKey =
    isAuthenticated
      ? `${currentUserId}:${token}`
      : null;

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [toast, setToast] =
    useState(null);

  const unreadRequestIdRef =
    useRef(0);

  const notificationRequestIdRef =
    useRef(0);

  const activeSessionRef =
    useRef(null);

  const threadSnapshotRef =
    useRef(new Map());

  const snapshotReadyRef =
    useRef(false);

  activeSessionRef.current =
    sessionKey;

  const refreshUnread =
    useCallback(
      async () => {
        const requestId =
          ++unreadRequestIdRef.current;

        const requestedSession =
          sessionKey;

        if (
          !isAuthenticated ||
          !requestedSession
        ) {
          setUnreadCount(0);

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

          setUnreadCount(
            normalizeUnread(
              unreadResult?.unreadCount
            )
          );

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
                      currentUnread <= 0 ||
                      thread?.id == null
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
                  (a, b) =>
                    threadTimestamp(b) -
                    threadTimestamp(a)
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
            "CHAT NOTIFICATION POLL ERROR:",
            error
          );
        }
      },
      [
        isAuthenticated,
        sessionKey,
      ]
    );

  useEffect(() => {
    unreadRequestIdRef.current +=
      1;

    notificationRequestIdRef.current +=
      1;

    threadSnapshotRef.current =
      new Map();

    snapshotReadyRef.current =
      false;

    setToast(null);

    if (
      !isAuthenticated ||
      !sessionKey
    ) {
      setUnreadCount(0);

      return undefined;
    }

    let active =
      true;

    void pollNotificationState({
      allowToast:
        false,
    });

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

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout =
      window.setTimeout(
        () => {
          setToast(null);
        },
        4500
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [toast]);

  const value =
    useMemo(
      () => ({
        /*
         * Retained as null for compatibility with any
         * component that still reads context.socket.
         *
         * The Vercel production Messenger transport is
         * REST polling, not a persistent process-local
         * Socket.IO connection.
         */
        socket:
          null,

        realtimeMode:
          "polling",

        unreadCount,

        refreshUnread,

        currentUserId,

        user,
      }),
      [
        unreadCount,
        refreshUnread,
        currentUserId,
        user,
      ]
    );

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
            {toast.isGroup
              ? "New group message"
              : "New chat message"}
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
