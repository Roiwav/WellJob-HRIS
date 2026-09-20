import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiArrowLeft,
  FiMessageCircle,
  FiSearch,
  FiSend,
} from "react-icons/fi";

import { chatApi } from "../services/chatApi";

import { useChat } from "../context/ChatContext";

import AuthenticatedAvatar from "../components/profile/AuthenticatedAvatar";

/*
 * ==================================================
 * HELPERS
 * ==================================================
 */

function displayName(user) {
  return (
    user?.fullName ||
    user?.username ||
    "Unknown user"
  );
}

function timeLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? ""
    : date.toLocaleString();
}

function sameId(first, second) {
  if (
    first == null ||
    second == null
  ) {
    return false;
  }

  return (
    String(first) ===
    String(second)
  );
}

function upsertMessage(
  previous,
  incoming
) {
  if (
    !incoming ||
    incoming.id == null
  ) {
    return previous;
  }

  const existingIndex =
    previous.findIndex(
      (message) =>
        sameId(
          message.id,
          incoming.id
        )
    );

  if (existingIndex === -1) {
    return [
      ...previous,
      incoming,
    ];
  }

  return previous.map(
    (message, index) =>
      index === existingIndex
        ? {
            ...message,
            ...incoming,
          }
        : message
  );
}

/*
 * ==================================================
 * WELLJOB MESSENGER
 * ==================================================
 *
 * Full-page:
 * Existing two-column Messenger.
 *
 * Floating:
 * Desktop - user sidebar and chat.
 * Mobile - one panel at a time.
 *
 * Profile pictures:
 * Loaded through AuthenticatedAvatar using
 * the existing protected avatar API.
 */

export default function Messenger({
  compact = false,
}) {
  const {
    user,
    currentUserId,
    socket,
    refreshUnread,
  } = useChat();

  /*
   * ==================================================
   * STATE
   * ==================================================
   */

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    activeId,
    setActiveId,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    draft,
    setDraft,
  ] = useState("");

  const [
    loadingOverview,
    setLoadingOverview,
  ] = useState(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [
    loadingOlder,
    setLoadingOlder,
  ] = useState(false);

  const [
    openingUserId,
    setOpeningUserId,
  ] = useState(null);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
   * ==================================================
   * REFS
   * ==================================================
   */

  const messageListRef =
    useRef(null);

  const activeIdRef =
    useRef(activeId);

  const historyRequestRef =
    useRef(0);

  const overviewRequestRef =
    useRef(0);

  const loadingOlderRef =
    useRef(false);

  const preserveScrollRef =
    useRef(null);

  activeIdRef.current =
    activeId;

  /*
   * ==================================================
   * LOAD USERS AND CONVERSATIONS
   * ==================================================
   */

  const loadOverview =
    useCallback(
      async () => {
        if (!user) {
          setUsers([]);

          setConversations([]);

          setLoadingOverview(
            false
          );

          return;
        }

        const requestId =
          ++overviewRequestRef.current;

        try {
          const [
            accounts,
            threads,
          ] = await Promise.all([
            chatApi("/users"),

            chatApi(
              "/conversations"
            ),
          ]);

          if (
            requestId !==
            overviewRequestRef.current
          ) {
            return;
          }

          setUsers(
            Array.isArray(accounts)
              ? accounts
              : []
          );

          setConversations(
            Array.isArray(threads)
              ? threads
              : []
          );
        } catch (cause) {
          if (
            requestId ===
            overviewRequestRef.current
          ) {
            setError(
              cause.message ||
                "Unable to load Messenger."
            );
          }
        } finally {
          if (
            requestId ===
            overviewRequestRef.current
          ) {
            setLoadingOverview(
              false
            );
          }
        }
      },
      [user]
    );

  useEffect(() => {
    loadOverview();

    return () => {
      overviewRequestRef.current +=
        1;
    };
  }, [loadOverview]);

  /*
   * ==================================================
   * ACTIVE CONVERSATION
   * ==================================================
   */

  const activeConversation =
    useMemo(
      () =>
        conversations.find(
          (item) =>
            sameId(
              item.id,
              activeId
            )
        ),
      [
        conversations,
        activeId,
      ]
    );

  /*
   * ==================================================
   * ACTIVE CHAT PARTNER
   * ==================================================
   *
   * The conversation API returns partner information.
   *
   * Prefer the user-directory entry when available
   * so avatar changes are reflected consistently
   * between the sidebar and conversation header.
   */

  const activePartner =
    useMemo(() => {
      const partner =
        activeConversation?.partner;

      if (!partner) {
        return null;
      }

      const directoryUser =
        users.find(
          (account) =>
            sameId(
              account.id,
              partner.id
            )
        );

      return directoryUser
        ? {
            ...partner,
            ...directoryUser,
          }
        : partner;
    }, [
      activeConversation,
      users,
    ]);

  /*
   * ==================================================
   * SEARCH USERS
   * ==================================================
   */

  const searchedUsers =
    useMemo(() => {
      const search = query
        .trim()
        .toLowerCase();

      if (!search) {
        return users;
      }

      return users.filter(
        (account) =>
          [
            account.username,
            account.fullName,
            account.role,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search)
      );
    }, [
      query,
      users,
    ]);

  /*
   * ==================================================
   * EXISTING CONVERSATIONS
   * ==================================================
   */

  const conversationByPartner =
    useMemo(() => {
      return new Map(
        conversations
          .filter(
            (conversation) =>
              conversation.partner
                ?.id != null
          )
          .map(
            (conversation) => [
              String(
                conversation.partner.id
              ),

              conversation,
            ]
          )
      );
    }, [conversations]);

  /*
   * ==================================================
   * MARK MESSAGES AS READ
   * ==================================================
   */

  const markRead =
    useCallback(
      async (
        conversationId
      ) => {
        if (
          conversationId == null
        ) {
          return;
        }

        try {
          await chatApi(
            `/conversations/${conversationId}/read`,
            {
              method: "POST",
            }
          );

          setConversations(
            (previous) =>
              previous.map(
                (item) =>
                  sameId(
                    item.id,
                    conversationId
                  )
                    ? {
                        ...item,

                        unreadCount:
                          0,
                      }
                    : item
              )
          );

          await refreshUnread();
        } catch (cause) {
          console.error(
            "MARK CHAT READ ERROR:",
            cause
          );
        }
      },
      [refreshUnread]
    );

  /*
   * ==================================================
   * LOAD CONVERSATION HISTORY
   * ==================================================
   */

  useEffect(() => {
    const conversationId =
      activeId;

    const requestId =
      ++historyRequestRef.current;

    setMessages([]);

    setHasMore(false);

    setLoadingOlder(false);

    loadingOlderRef.current =
      false;

    preserveScrollRef.current =
      null;

    if (
      conversationId == null ||
      !user
    ) {
      setLoadingMessages(
        false
      );

      return;
    }

    setLoadingMessages(
      true
    );

    setError("");

    async function loadMessages() {
      try {
        const result =
          await chatApi(
            `/conversations/${conversationId}/messages`
          );

        if (
          historyRequestRef.current !==
            requestId ||
          !sameId(
            activeIdRef.current,
            conversationId
          )
        ) {
          return;
        }

        const loadedMessages =
          Array.isArray(
            result.messages
          )
            ? result.messages
            : [];

        setMessages(
          (previous) =>
            previous
              .filter(
                (message) =>
                  sameId(
                    message.conversationId,
                    conversationId
                  )
              )
              .reduce(
                upsertMessage,
                loadedMessages
              )
        );

        setHasMore(
          Boolean(
            result.hasMore
          )
        );

        markRead(
          conversationId
        );
      } catch (cause) {
        if (
          historyRequestRef.current ===
          requestId
        ) {
          setError(
            cause.message ||
              "Unable to load messages."
          );
        }
      } finally {
        if (
          historyRequestRef.current ===
          requestId
        ) {
          setLoadingMessages(
            false
          );
        }
      }
    }

    loadMessages();

    return () => {
      historyRequestRef.current +=
        1;
    };
  }, [
    activeId,
    user,
    markRead,
  ]);

  /*
   * ==================================================
   * MESSAGE LIST SCROLLING
   * ==================================================
   */

  useEffect(() => {
    const container =
      messageListRef.current;

    if (!container) {
      return;
    }

    const savedScroll =
      preserveScrollRef.current;

    if (savedScroll) {
      container.scrollTop =
        container.scrollHeight -
        savedScroll.scrollHeight +
        savedScroll.scrollTop;

      preserveScrollRef.current =
        null;

      return;
    }

    container.scrollTop =
      container.scrollHeight;
  }, [
    messages,
    activeId,
  ]);

  /*
   * ==================================================
   * REAL-TIME SOCKET EVENTS
   * ==================================================
   */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function onMessage(
      payload = {}
    ) {
      const message =
        payload.message;

      if (!message) {
        return;
      }

      loadOverview();

      if (
        !sameId(
          message.conversationId,
          activeIdRef.current
        )
      ) {
        return;
      }

      setMessages(
        (previous) =>
          upsertMessage(
            previous,
            message
          )
      );

      if (
        !sameId(
          message.senderId,
          currentUserId
        )
      ) {
        markRead(
          message.conversationId
        );
      }
    }

    function onRead(
      payload = {}
    ) {
      const {
        conversationId,
        readerId,
        readAt,
      } = payload;

      if (
        sameId(
          conversationId,
          activeIdRef.current
        ) &&
        !sameId(
          readerId,
          currentUserId
        )
      ) {
        setMessages(
          (previous) =>
            previous.map(
              (message) => {
                if (
                  sameId(
                    message.senderId,
                    currentUserId
                  ) &&
                  !message.readAt
                ) {
                  return {
                    ...message,

                    readAt:
                      readAt ||
                      new Date().toISOString(),
                  };
                }

                return message;
              }
            )
        );
      }

      loadOverview();
    }

    socket.on(
      "chat:message",
      onMessage
    );

    socket.on(
      "chat:read",
      onRead
    );

    return () => {
      socket.off(
        "chat:message",
        onMessage
      );

      socket.off(
        "chat:read",
        onRead
      );
    };
  }, [
    socket,
    currentUserId,
    loadOverview,
    markRead,
  ]);

  /*
   * ==================================================
   * OPEN CONVERSATION
   * ==================================================
   */

  async function openUser(account) {
    if (
      !account?.id ||
      openingUserId != null
    ) {
      return;
    }

    setError("");

    const existing =
      conversationByPartner.get(
        String(account.id)
      );

    if (existing) {
      setActiveId(
        existing.id
      );

      return;
    }

    setOpeningUserId(
      account.id
    );

    try {
      const response =
        await chatApi(
          "/conversations",
          {
            method: "POST",

            body: JSON.stringify({
              recipientId:
                account.id,
            }),
          }
        );

      await loadOverview();

      if (
        response.conversationId == null
      ) {
        throw new Error(
          "The server did not return a conversation ID."
        );
      }

      setActiveId(
        response.conversationId
      );
    } catch (cause) {
      setError(
        cause.message ||
          "Unable to open conversation."
      );
    } finally {
      setOpeningUserId(
        null
      );
    }
  }

  /*
   * ==================================================
   * LOAD OLDER MESSAGES
   * ==================================================
   */

  async function loadOlder() {
    if (
      activeId == null ||
      !hasMore ||
      messages.length === 0 ||
      loadingMessages ||
      loadingOlderRef.current
    ) {
      return;
    }

    const conversationId =
      activeId;

    const oldestMessageId =
      messages[0].id;

    const historyRequestId =
      historyRequestRef.current;

    const container =
      messageListRef.current;

    loadingOlderRef.current =
      true;

    setLoadingOlder(
      true
    );

    setError("");

    try {
      const result =
        await chatApi(
          `/conversations/${conversationId}/messages?before=${encodeURIComponent(
            oldestMessageId
          )}`
        );

      if (
        historyRequestRef.current !==
          historyRequestId ||
        !sameId(
          activeIdRef.current,
          conversationId
        )
      ) {
        return;
      }

      const olderMessages =
        Array.isArray(
          result.messages
        )
          ? result.messages
          : [];

      const uniqueOlderMessages =
        olderMessages.filter(
          (older) =>
            !messages.some(
              (existing) =>
                sameId(
                  existing.id,
                  older.id
                )
            )
        );

      if (
        uniqueOlderMessages.length >
          0 &&
        container
      ) {
        preserveScrollRef.current =
          {
            scrollTop:
              container.scrollTop,

            scrollHeight:
              container.scrollHeight,
          };
      }

      setMessages(
        (previous) => {
          const existingIds =
            new Set(
              previous.map(
                (message) =>
                  String(
                    message.id
                  )
              )
            );

          return [
            ...uniqueOlderMessages.filter(
              (message) =>
                !existingIds.has(
                  String(
                    message.id
                  )
                )
            ),

            ...previous,
          ];
        }
      );

      setHasMore(
        Boolean(
          result.hasMore
        )
      );
    } catch (cause) {
      if (
        historyRequestRef.current ===
        historyRequestId
      ) {
        setError(
          cause.message ||
            "Unable to load older messages."
        );
      }
    } finally {
      loadingOlderRef.current =
        false;

      setLoadingOlder(
        false
      );
    }
  }

  /*
   * ==================================================
   * SEND MESSAGE
   * ==================================================
   */

  async function sendMessage(event) {
    event.preventDefault();

    const conversationId =
      activeId;

    const text =
      draft.trim();

    if (
      conversationId == null ||
      !text ||
      sending ||
      text.length > 2000
    ) {
      return;
    }

    setSending(
      true
    );

    setError("");

    try {
      const response =
        await chatApi(
          `/conversations/${conversationId}/messages`,
          {
            method: "POST",

            body: JSON.stringify({
              body: text,
            }),
          }
        );

      if (
        sameId(
          activeIdRef.current,
          conversationId
        )
      ) {
        if (
          response.message
        ) {
          setMessages(
            (previous) =>
              upsertMessage(
                previous,
                response.message
              )
          );
        }

        setDraft(
          (currentDraft) =>
            currentDraft === draft
              ? ""
              : currentDraft
        );
      }

      loadOverview();
    } catch (cause) {
      setError(
        cause.message ||
          "Unable to send message."
      );
    } finally {
      setSending(
        false
      );
    }
  }

  /*
   * ==================================================
   * RESPONSIVE DISPLAY
   * ==================================================
   *
   * Desktop:
   * User sidebar and conversation side by side.
   *
   * Mobile:
   * One panel at a time.
   */

  const userListClass =
    activeId == null
      ? "flex"
      : "hidden sm:flex";

  const conversationClass =
    activeId == null
      ? "hidden sm:flex"
      : "flex";

  /*
   * ==================================================
   * RENDER
   * ==================================================
   */

  return (
    <main
      className={
        compact
          ? "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-900"
          : "flex h-[calc(100vh-7rem)] min-h-[520px] min-w-0 flex-col gap-3 p-3 sm:p-5"
      }
    >
      {/*
       * ==========================================
       * FULL-PAGE TITLE
       * ==========================================
       */}

      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Messenger
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Private messages between authorized
            WELLJOB users.
          </p>
        </div>
      )}

      {/*
       * ==========================================
       * ERROR MESSAGE
       * ==========================================
       */}

      {error && (
        <div
          role="alert"
          className={`shrink-0 border border-red-300 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200 ${
            compact
              ? "p-2 text-xs"
              : "rounded-lg p-3"
          }`}
        >
          {error}
        </div>
      )}

      {/*
       * ==========================================
       * CHAT CONTAINER
       * ==========================================
       */}

      <div
        className={
          compact
            ? "flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-900"
            : "flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        }
      >
        {/*
         * ======================================
         * USER SIDEBAR
         * ======================================
         */}

        <aside
          className={`${userListClass} ${
            compact
              ? "w-full sm:w-[220px]"
              : "w-full sm:w-64 lg:w-80"
          } min-h-0 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700`}
        >
          {/*
           * Search bar
           */}

          <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-700">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <FiSearch
                className="shrink-0 text-slate-400"
                size={15}
                aria-hidden="true"
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                value={query}
                onChange={(event) => {
                  setQuery(
                    event.target.value
                  );
                }}
                placeholder="Search users..."
                aria-label="Search chat users"
              />
            </label>
          </div>

          {/*
           * Scrollable user list
           */}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingOverview && (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                Loading users...
              </p>
            )}

            {!loadingOverview &&
              searchedUsers.length === 0 && (
                <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  No available users.
                </p>
              )}

            {searchedUsers.map(
              (account) => {
                const conversation =
                  conversationByPartner.get(
                    String(account.id)
                  );

                const isActive =
                  activeId != null &&
                  sameId(
                    conversation?.id,
                    activeId
                  );

                return (
                  <button
                    key={account.id}
                    type="button"
                    disabled={
                      openingUserId != null
                    }
                    onClick={() =>
                      openUser(account)
                    }
                    className={`flex w-full items-center gap-2.5 border-b border-slate-100 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800 ${
                      compact
                        ? "px-2.5 py-2"
                        : "p-3"
                    } ${
                      isActive
                        ? "bg-blue-50 dark:bg-slate-800"
                        : ""
                    }`}
                  >
                    {/*
                     * NEW: Authenticated profile picture.
                     *
                     * Displays the uploaded photo when
                     * avatarFilename is available.
                     *
                     * Otherwise, shows user initials.
                     */}

                    <AuthenticatedAvatar
                      user={account}
                      small={compact}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {displayName(
                          account
                        )}
                      </div>

                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {conversation?.lastBody ||
                          account.role?.replaceAll(
                            "_",
                            " "
                          )}
                      </div>
                    </div>

                    {Number(
                      conversation?.unreadCount
                    ) > 0 && (
                      <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </aside>

        {/*
         * ======================================
         * CONVERSATION PANEL
         * ======================================
         */}

        <section
          className={`${conversationClass} min-h-0 min-w-0 flex-1 flex-col`}
        >
          {activeId != null &&
          activePartner ? (
            <>
              {/*
               * ==================================
               * CONVERSATION HEADER
               * ==================================
               */}

              <header
                className={`flex shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-700 ${
                  compact
                    ? "px-3 py-2"
                    : "p-3"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(null);
                  }}
                  className="flex shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden"
                  aria-label="Back to conversations"
                >
                  <FiArrowLeft size={18} />
                </button>

                {/*
                 * NEW: Profile picture of
                 * the active chat partner.
                 */}

                <AuthenticatedAvatar
                  user={activePartner}
                  small={compact}
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {displayName(
                      activePartner
                    )}
                  </div>

                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {activePartner.role?.replaceAll(
                      "_",
                      " "
                    )}
                  </div>
                </div>
              </header>

              {/*
               * ==================================
               * MESSAGE HISTORY
               * ==================================
               */}

              <div
                ref={messageListRef}
                className={`min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 ${
                  compact
                    ? "p-3"
                    : "p-3 sm:p-5"
                }`}
              >
                {hasMore && (
                  <button
                    type="button"
                    disabled={
                      loadingMessages ||
                      loadingOlder
                    }
                    onClick={loadOlder}
                    className="mx-auto block rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    {loadingOlder
                      ? "Loading..."
                      : "Load older messages"}
                  </button>
                )}

                {loadingMessages && (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Loading messages...
                  </p>
                )}

                {!messages.length &&
                  !loadingMessages && (
                    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      Start your conversation.
                    </p>
                  )}

                {messages.map(
                  (message) => {
                    const mine =
                      sameId(
                        message.senderId,
                        currentUserId
                      );

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          mine
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "bg-blue-600 text-white"
                              : "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                          }`}
                        >
                          <div>
                            {message.body}
                          </div>

                          <div
                            className={`mt-1 text-right text-[10px] ${
                              mine
                                ? "text-blue-100"
                                : "text-slate-400"
                            }`}
                          >
                            {timeLabel(
                              message.createdAt
                            )}

                            {mine
                              ? message.readAt
                                ? " · Seen"
                                : " · Sent"
                              : ""}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/*
               * ==================================
               * MESSAGE COMPOSER
               * ==================================
               */}

              <form
                onSubmit={sendMessage}
                className={`flex shrink-0 items-end gap-2 border-t border-slate-200 dark:border-slate-700 ${
                  compact
                    ? "p-2"
                    : "p-3"
                }`}
              >
                <textarea
                  value={draft}
                  maxLength={2000}
                  rows={1}
                  onChange={(event) => {
                    setDraft(
                      event.target.value
                    );
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();

                      if (!sending) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder="Type a message..."
                  aria-label="Message"
                  className="max-h-24 min-h-10 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="submit"
                  disabled={
                    !draft.trim() ||
                    sending ||
                    loadingMessages
                  }
                  aria-label="Send message"
                  className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                    compact
                      ? "w-10"
                      : "px-4"
                  }`}
                >
                  <FiSend size={16} />

                  {!compact && (
                    <span>
                      {sending
                        ? "Sending..."
                        : "Send"}
                    </span>
                  )}
                </button>
              </form>
            </>
          ) : activeId != null ? (
            <div className="flex flex-1 items-center justify-center p-5 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading conversation...
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center text-slate-500 dark:text-slate-400">
              <FiMessageCircle size={40} />

              <p className="text-sm">
                Select a user to start a private chat.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}