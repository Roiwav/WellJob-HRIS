import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiLogOut,
  FiMessageCircle,
  FiPaperclip,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  chatApi,
  downloadChatAttachment,
  uploadChatPdfs as uploadChatAttachments,
} from "../services/chatApi";
import { useChat } from "../context/ChatContext";
import AuthenticatedAvatar from "../components/profile/AuthenticatedAvatar";

const MAX_FILE_SIZE =
  15 * 1024 * 1024;
const MAX_FILES = 30;
const CHAT_POLL_INTERVAL_MS = 4000;
const MESSAGE_MAX_LENGTH = 2000;
const CHAT_TIME_ZONE = "Asia/Manila";

const ACCEPTED_ATTACHMENT_EXTENSIONS =
  new Set([
    "pdf",
    "docx",
    "xls",
    "xlsx",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
  ]);

const ACCEPTED_FILE_INPUT = [
  ".pdf",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",");

const solidButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const subtleButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function same(left, right) {
  return (
    left !== null &&
    left !== undefined &&
    right !== null &&
    right !== undefined &&
    String(left) ===
      String(right)
  );
}

function nameOf(user) {
  return (
    user?.fullName ||
    user?.name ||
    "Team member"
  );
}

function friendlyRole(value) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[-\s]+/g, "_");

  const labels = {
    SUPER_ADMIN:
      "Super Admin",
    HR_MANAGER:
      "HR Manager",
    HR_STAFF:
      "HR Staff",
    HR_COORDINATOR:
      "HR Coordinator",
    IT_SUPPORT:
      "IT Support",
  };

  if (!normalized) {
    return "Team member";
  }

  return (
    labels[normalized] ||
    normalized
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
}

function parseTimestamp(value) {
  const date =
    new Date(
      value || 0
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function formattedTime(value) {
  const date =
    parseTimestamp(
      value
    );

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        CHAT_TIME_ZONE,
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    date
  );
}

function compactThreadTime(value) {
  const date =
    parseTimestamp(
      value
    );

  if (!date) {
    return "";
  }

  const now =
    Date.now();

  const difference =
    Math.max(
      0,
      now -
        date.getTime()
    );

  const minute =
    60 * 1000;
  const hour =
    60 * minute;
  const day =
    24 * hour;

  if (
    difference <
    minute
  ) {
    return "Now";
  }

  if (
    difference <
    hour
  ) {
    return `${Math.floor(
      difference /
        minute
    )}m`;
  }

  if (
    difference <
    day
  ) {
    return `${Math.floor(
      difference /
        hour
    )}h`;
  }

  if (
    difference <
    7 * day
  ) {
    return new Intl.DateTimeFormat(
      "en-PH",
      {
        timeZone:
          CHAT_TIME_ZONE,
        weekday:
          "short",
      }
    ).format(
      date
    );
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        CHAT_TIME_ZONE,
      month:
        "short",
      day:
        "numeric",
    }
  ).format(
    date
  );
}

function bytes(value) {
  const size =
    Number(
      value || 0
    );

  if (
    size <
    1024
  ) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${(
      size /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    size /
    1048576
  ).toFixed(2)} MB`;
}

function fileExtension(name) {
  const value =
    String(name || "")
      .trim()
      .toLowerCase();

  const dotIndex =
    value.lastIndexOf(
      "."
    );

  if (
    dotIndex < 0 ||
    dotIndex ===
      value.length - 1
  ) {
    return "";
  }

  return value.slice(
    dotIndex + 1
  );
}

function isAcceptedFile(file) {
  if (
    !file ||
    Number(file.size) <=
      0
  ) {
    return false;
  }

  return ACCEPTED_ATTACHMENT_EXTENSIONS.has(
    fileExtension(
      file.name
    )
  );
}

function isImageAttachment(
  attachment
) {
  const extension =
    fileExtension(
      attachment?.name
    );

  return [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
  ].includes(
    extension
  );
}

function attachmentTypeLabel(name) {
  const extension =
    fileExtension(
      name
    );

  if (
    [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
    ].includes(
      extension
    )
  ) {
    return "Image";
  }

  if (
    extension ===
    "pdf"
  ) {
    return "PDF";
  }

  if (
    extension ===
    "docx"
  ) {
    return "Word file";
  }

  if (
    [
      "xls",
      "xlsx",
    ].includes(
      extension
    )
  ) {
    return "Excel file";
  }

  return "File";
}

function ChatImageAttachment({
  attachment,
  onOpen,
  onDownload,
  disabled = false,
}) {
  const [
    imageUrl,
    setImageUrl,
  ] = useState("");

  const [
    imageError,
    setImageError,
  ] = useState(false);

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const retriedRef =
    useRef(false);

  useEffect(() => {
    if (
      !attachment?.id ||
      attachment.local
    ) {
      return undefined;
    }

    let cancelled =
      false;

    async function load() {
      try {
        const result =
          await chatApi(
            `/attachments/${encodeURIComponent(
              attachment.id
            )}/download`
          );

        if (
          !cancelled
        ) {
          setImageUrl(
            String(
              result?.downloadUrl ||
                ""
            )
          );
        }
      } catch {
        if (
          !cancelled
        ) {
          setImageError(
            true
          );
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    attachment?.id,
    attachment?.local,
    refreshKey,
  ]);

  if (
    attachment.local
  ) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-current/20 p-3 text-xs font-medium opacity-80">
        Sending image...
      </div>
    );
  }

  if (
    !imageUrl
  ) {
    return (
      <button
        type="button"
        disabled={
          disabled
        }
        onClick={() => {
          retriedRef.current =
            false;

          setImageError(
            false
          );

          setRefreshKey(
            (value) =>
              value + 1
          );
        }}
        className="flex w-full items-center justify-center rounded-xl border border-current/20 p-3 text-center text-xs font-medium transition hover:bg-black/5 disabled:cursor-default dark:hover:bg-white/5"
      >
        {imageError
          ? "Reload image"
          : "Loading image..."}
      </button>
    );
  }

  return (
    <div className="group/image relative overflow-hidden rounded-xl border border-current/20 bg-black/5 dark:bg-black/20">
      <button
        type="button"
        disabled={
          disabled
        }
        onClick={() =>
          onOpen?.(
            attachment,
            imageUrl
          )
        }
        className="block w-full cursor-zoom-in disabled:cursor-default"
        aria-label={`Open ${attachment.name}`}
        title="Open image"
      >
        <img
          src={
            imageUrl
          }
          alt={
            attachment.name ||
            "Shared image"
          }
          loading="lazy"
          className="max-h-72 w-full object-contain"
          onError={() => {
            if (
              retriedRef.current
            ) {
              setImageError(
                true
              );

              setImageUrl(
                ""
              );

              return;
            }

            retriedRef.current =
              true;

            setImageUrl(
              ""
            );

            setRefreshKey(
              (value) =>
                value + 1
            );
          }}
        />
      </button>

      <button
        type="button"
        disabled={
          disabled
        }
        onClick={(
          event
        ) => {
          event.stopPropagation();

          onDownload?.(
            attachment
          );
        }}
        aria-label={`Download ${attachment.name}`}
        title="Download"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white opacity-0 shadow-sm transition hover:bg-black/70 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 group-hover/image:opacity-100"
      >
        <FiDownload />
      </button>
    </div>
  );
}

function merged(
  previous,
  incoming
) {
  if (!incoming?.id) {
    return previous;
  }

  const index =
    previous.findIndex(
      (item) =>
        same(
          item.id,
          incoming.id
        )
    );

  if (
    index <
    0
  ) {
    return [
      ...previous,
      incoming,
    ];
  }

  return previous.map(
    (
      item,
      itemIndex
    ) =>
      itemIndex ===
      index
        ? {
            ...item,
            ...incoming,
          }
        : item
  );
}

function mergedBatch(
  previous,
  incoming = []
) {
  let next =
    previous;
  let changed =
    false;

  for (
    const item of
    incoming
  ) {
    if (!item?.id) {
      continue;
    }

    const index =
      next.findIndex(
        (current) =>
          same(
            current.id,
            item.id
          )
      );

    if (
      index <
      0
    ) {
      if (!changed) {
        next = [
          ...next,
        ];
      }

      next.push(
        item
      );

      changed =
        true;

      continue;
    }

    const combined = {
      ...next[index],
      ...item,
    };

    if (
      JSON.stringify(
        next[index]
      ) !==
      JSON.stringify(
        combined
      )
    ) {
      if (!changed) {
        next = [
          ...next,
        ];
      }

      next[index] =
        combined;

      changed =
        true;
    }
  }

  return changed
    ? next
    : previous;
}

function messageStatusLabel(
  message,
  isGroup,
  isMine
) {
  if (!isMine) {
    return "";
  }

  if (
    message?.deliveryState ===
    "sending"
  ) {
    return "Sending…";
  }

  if (
    message?.deliveryState ===
    "failed"
  ) {
    return "Not sent";
  }

  if (isGroup) {
    const seen =
      Number(
        message?.seenByCount ||
          0
      );

    const recipients =
      Number(
        message?.recipientCount ||
          0
      );

    if (
      seen >
      0
    ) {
      if (
        recipients >
          0 &&
        seen >=
          recipients
      ) {
        return "Seen by everyone";
      }

      return `Seen by ${seen}`;
    }

    if (
      message?.deliveryState ===
      "delivered"
    ) {
      return "Delivered";
    }

    return "Sent";
  }

  if (
    message?.readAt
  ) {
    return "Seen";
  }

  if (
    message?.deliveryState ===
    "delivered"
  ) {
    return "Delivered";
  }

  return "Sent";
}

function MessageText({
  body,
}) {
  if (!body) {
    return null;
  }

  const parts =
    String(body).split(
      /(@[A-Za-z0-9._-]+)/g
    );

  return (
    <p className="whitespace-pre-wrap break-words leading-5">
      {parts.map(
        (
          part,
          index
        ) =>
          part.startsWith(
            "@"
          ) ? (
            <span
              key={`${part}-${index}`}
              className="font-semibold underline decoration-current/30 underline-offset-2"
            >
              {part}
            </span>
          ) : (
            <span
              key={`${index}-${part.slice(0, 8)}`}
            >
              {part}
            </span>
          )
      )}
    </p>
  );
}

/**
 * Shared member picker for Create Group and Add Members.
 */
function MemberSelector({
  users,
  selected,
  setSelected,
  search,
  setSearch,
  maxSelected,
  disabled = false,
  emptyMessage = "No people available.",
}) {
  const normalized =
    search
      .trim()
      .toLowerCase();

  const visible =
    users.filter(
      (account) =>
        [
          account.fullName,
          account.username,
          account.role,
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
          .toLowerCase()
          .includes(
            normalized
          )
    );

  return (
    <>
      <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900">
        <FiSearch
          className="shrink-0 text-slate-400"
          aria-hidden="true"
        />

        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={(
            event
          ) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search people..."
          aria-label="Search people"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white"
        />
      </label>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
        {visible.length ===
          0 && (
          <p className="p-3 text-center text-xs text-slate-500">
            {users.length ===
            0
              ? emptyMessage
              : "No one matches your search."}
          </p>
        )}

        {visible.map(
          (account) => {
            const checked =
              selected.some(
                (value) =>
                  same(
                    value,
                    account.id
                  )
              );

            return (
              <label
                key={
                  account.id
                }
                className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={
                    checked
                  }
                  disabled={
                    disabled ||
                    (
                      !checked &&
                      selected.length >=
                        maxSelected
                    )
                  }
                  onChange={(
                    event
                  ) =>
                    setSelected(
                      (
                        previous
                      ) =>
                        event
                          .target
                          .checked
                          ? previous.some(
                              (
                                value
                              ) =>
                                same(
                                  value,
                                  account.id
                                )
                            )
                            ? previous
                            : [
                                ...previous,
                                account.id,
                              ]
                          : previous.filter(
                              (
                                value
                              ) =>
                                !same(
                                  value,
                                  account.id
                                )
                            )
                    )
                  }
                />

                <AuthenticatedAvatar
                  user={
                    account
                  }
                  small
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {nameOf(
                      account
                    )}
                  </span>

                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {friendlyRole(
                      account.role
                    )}
                  </span>
                </span>
              </label>
            );
          }
        )}
      </div>

      <p className="text-xs text-slate-500">
        {selected.length} selected
      </p>
    </>
  );
}

export default function Messenger({
  compact = false,
}) {
  const {
    user,
    currentUserId,
    refreshUnread,
    socket,
  } = useChat();

  const [
    directory,
    setDirectory,
  ] = useState([]);

  const [
    threads,
    setThreads,
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
    members,
    setMembers,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    newMessageMode,
    setNewMessageMode,
  ] = useState(false);

  const [
    newMessageSearch,
    setNewMessageSearch,
  ] = useState("");

  const [
    draft,
    setDraft,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    loading,
    setLoading,
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
    creating,
    setCreating,
  ] = useState(false);

  const [
    groupName,
    setGroupName,
  ] = useState("");

  const [
    chosen,
    setChosen,
  ] = useState([]);

  const [
    createSearch,
    setCreateSearch,
  ] = useState("");

  const [
    addChosen,
    setAddChosen,
  ] = useState([]);

  const [
    addSearch,
    setAddSearch,
  ] = useState("");

  const [
    addError,
    setAddError,
  ] = useState("");

  const [
    showMembers,
    setShowMembers,
  ] = useState(false);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    memberActionConfirm,
    setMemberActionConfirm,
  ] = useState(null);

  const [
    renameDialog,
    setRenameDialog,
  ] = useState(false);

  const [
    renameValue,
    setRenameValue,
  ] = useState("");

  const [
    renameError,
    setRenameError,
  ] = useState("");

  const [
    imagePreview,
    setImagePreview,
  ] = useState(null);

  const [
    fileProgress,
    setFileProgress,
  ] = useState(null);

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState([]);

  const [
    mentionQuery,
    setMentionQuery,
  ] = useState(null);

  const uploadRef =
    useRef(null);

  const composerRef =
    useRef(null);

  const listRef =
    useRef(null);

  const historyVersion =
    useRef(0);

  const activeRef =
    useRef(null);

  const scrollRestore =
    useRef(null);

  const overviewVersion =
    useRef(0);

  const followBottom =
    useRef(true);

  const pollInFlight =
    useRef(false);

  activeRef.current =
    activeId;

  const active =
    threads.find(
      (thread) =>
        same(
          thread.id,
          activeId
        )
    );

  const isGroup =
    active?.kind ===
    "group";

  const gid =
    isGroup
      ? String(
          active.id
        ).slice(
          2
        )
      : null;

  const title =
    isGroup
      ? active?.name
      : nameOf(
          active?.partner
        );

  const myMember =
    members.find(
      (member) =>
        same(
          member.id,
          currentUserId
        )
    );

  const admin =
    Boolean(
      myMember?.isAdmin
    );

  const availableToAdd =
    directory.filter(
      (account) =>
        !members.some(
          (member) =>
            same(
              account.id,
              member.id
            )
        )
    );

  const freeGroupSlots =
    Math.max(
      0,
      30 -
        members.length
    );

  const selectedBytes =
    selectedFiles.reduce(
      (
        total,
        file
      ) =>
        total +
        Number(
          file.size || 0
        ),
      0
    );

  const loadOverview =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!user) {
          setDirectory(
            []
          );

          setThreads(
            []
          );

          setLoading(
            false
          );

          return [];
        }

        const requestId =
          ++overviewVersion.current;

        try {
          const [
            users,
            conversations,
          ] =
            await Promise.all([
              chatApi(
                "/users"
              ),
              chatApi(
                "/conversations"
              ),
            ]);

          if (
            requestId !==
            overviewVersion.current
          ) {
            return [];
          }

          const list =
            Array.isArray(
              conversations
            )
              ? conversations
              : [];

          setDirectory(
            Array.isArray(
              users
            )
              ? users
              : []
          );

          setThreads(
            list.map(
              (thread) =>
                same(
                  thread.id,
                  activeRef.current
                )
                  ? {
                      ...thread,
                      unreadCount:
                        0,
                    }
                  : thread
            )
          );

          setActiveId(
            (previous) =>
              previous !==
                null &&
              previous !==
                undefined &&
              !list.some(
                (thread) =>
                  same(
                    thread.id,
                    previous
                  )
              )
                ? null
                : previous
          );

          return list;
        } catch {
          if (
            requestId ===
              overviewVersion.current &&
            !silent
          ) {
            setError(
              "Messages could not be loaded. Please try again."
            );
          }

          return [];
        } finally {
          if (
            requestId ===
            overviewVersion.current
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        user,
      ]
    );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadMembers =
    useCallback(
      async (
        conversationId,
        {
          silent = false,
        } = {}
      ) => {
        if (
          !String(
            conversationId
          ).startsWith(
            "g:"
          )
        ) {
          setMembers(
            []
          );

          return [];
        }

        try {
          const result =
            await chatApi(
              `/groups/${String(
                conversationId
              ).slice(
                2
              )}/members`
            );

          const list =
            Array.isArray(
              result
            )
              ? result
              : [];

          if (
            same(
              activeRef.current,
              conversationId
            )
          ) {
            setMembers(
              list
            );
          }

          return list;
        } catch {
          if (
            same(
              activeRef.current,
              conversationId
            ) &&
            !silent
          ) {
            setError(
              "Group could not be loaded. Please try again."
            );
          }

          return [];
        }
      },
      []
    );

  const markRead =
    useCallback(
      async (
        conversationId
      ) => {
        try {
          await chatApi(
            `/conversations/${encodeURIComponent(
              conversationId
            )}/read`,
            {
              method:
                "POST",
            }
          );

          setThreads(
            (previous) =>
              previous.map(
                (thread) =>
                  same(
                    thread.id,
                    conversationId
                  )
                    ? {
                        ...thread,
                        unreadCount:
                          0,
                      }
                    : thread
              )
          );

          await refreshUnread();
        } catch (cause) {
          console.error(
            "Chat read update failed:",
            cause
          );
        }
      },
      [
        refreshUnread,
      ]
    );

  useEffect(() => {
    const conversationId =
      activeId;

    const version =
      ++historyVersion.current;

    setMessages(
      []
    );
    setMembers(
      []
    );
    setHasMore(
      false
    );
    setShowMembers(
      false
    );
    setAdding(
      false
    );
    setAddChosen(
      []
    );
    setAddSearch(
      ""
    );
    setAddError(
      ""
    );
    setSelectedFiles(
      []
    );
    setFileProgress(
      null
    );
    setMentionQuery(
      null
    );
    setLoadingMessages(
      Boolean(
        conversationId
      )
    );

    scrollRestore.current =
      null;

    followBottom.current =
      true;

    if (!conversationId) {
      return undefined;
    }

    async function run() {
      try {
        const response =
          await chatApi(
            `/conversations/${encodeURIComponent(
              conversationId
            )}/messages`
          );

        if (
          version !==
            historyVersion.current ||
          !same(
            activeRef.current,
            conversationId
          )
        ) {
          return;
        }

        const incoming =
          Array.isArray(
            response?.messages
          )
            ? response.messages
            : [];

        setMessages(
          incoming.reduce(
            merged,
            []
          )
        );

        setHasMore(
          Boolean(
            response?.hasMore
          )
        );

        void markRead(
          conversationId
        );

        void loadMembers(
          conversationId
        );
      } catch {
        if (
          version ===
          historyVersion.current
        ) {
          setError(
            "Messages could not be opened. Please try again."
          );
        }
      } finally {
        if (
          version ===
          historyVersion.current
        ) {
          setLoadingMessages(
            false
          );
        }
      }
    }

    void run();

    return () => {
      historyVersion.current +=
        1;
    };
  }, [
    activeId,
    markRead,
    loadMembers,
  ]);

  useEffect(() => {
    const element =
      listRef.current;

    if (!element) {
      return;
    }

    const restore =
      scrollRestore.current;

    if (restore) {
      element.scrollTop =
        element.scrollHeight -
        restore.height +
        restore.top;

      scrollRestore.current =
        null;

      return;
    }

    if (
      followBottom.current
    ) {
      element.scrollTop =
        element.scrollHeight;
    }
  }, [
    messages,
    activeId,
  ]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled =
      false;

    async function poll() {
      if (
        cancelled ||
        pollInFlight.current ||
        document.hidden
      ) {
        return;
      }

      pollInFlight.current =
        true;

      try {
        const list =
          await loadOverview({
            silent:
              true,
          });

        if (cancelled) {
          return;
        }

        const conversationId =
          activeRef.current;

        if (conversationId) {
          const response =
            await chatApi(
              `/conversations/${encodeURIComponent(
                conversationId
              )}/messages`
            );

          if (
            !cancelled &&
            same(
              activeRef.current,
              conversationId
            )
          ) {
            const incoming =
              Array.isArray(
                response?.messages
              )
                ? response.messages
                : [];

            setMessages(
              (previous) =>
                mergedBatch(
                  previous,
                  incoming
                )
            );

            setHasMore(
              Boolean(
                response?.hasMore
              )
            );

            const activeThread =
              list.find(
                (thread) =>
                  same(
                    thread.id,
                    conversationId
                  )
              );

            if (
              Number(
                activeThread?.unreadCount ||
                  0
              ) >
              0
            ) {
              await markRead(
                conversationId
              );
            }

            if (
              String(
                conversationId
              ).startsWith(
                "g:"
              )
            ) {
              await loadMembers(
                conversationId,
                {
                  silent:
                    true,
                }
              );
            }
          }
        }

        await refreshUnread();
      } catch (cause) {
        if (
          !cancelled
        ) {
          console.error(
            "CHAT POLL ERROR:",
            cause
          );
        }
      } finally {
        pollInFlight.current =
          false;
      }
    }

    const timer =
      window.setInterval(
        () => {
          void poll();
        },
        CHAT_POLL_INTERVAL_MS
      );

    const onVisible =
      () => {
        if (
          !document.hidden
        ) {
          void poll();
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisible
    );

    window.addEventListener(
      "focus",
      onVisible
    );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        timer
      );

      document.removeEventListener(
        "visibilitychange",
        onVisible
      );

      window.removeEventListener(
        "focus",
        onVisible
      );
    };
  }, [
    user,
    loadOverview,
    loadMembers,
    markRead,
    refreshUnread,
  ]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket.on !==
        "function" ||
      typeof socket.off !==
        "function"
    ) {
      return undefined;
    }

    const onMessage =
      ({
        message,
      } = {}) => {
        if (
          !message?.id
        ) {
          return;
        }

        if (
          same(
            message.conversationId,
            activeRef.current
          )
        ) {
          followBottom.current =
            true;

          setMessages(
            (previous) =>
              merged(
                previous,
                message
              )
          );

          if (
            !same(
              message.senderId,
              currentUserId
            )
          ) {
            void markRead(
              message.conversationId
            );
          }
        }

        void loadOverview({
          silent:
            true,
        });
      };

    const onDelivered =
      (receipt = {}) => {
        if (
          !receipt?.messageId
        ) {
          return;
        }

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                same(
                  message.id,
                  receipt.messageId
                )
                  ? {
                      ...message,
                      deliveryState:
                        "delivered",
                      deliveredAt:
                        receipt.deliveredAt ||
                        null,
                      deliveredCount:
                        Number(
                          receipt.deliveredCount ||
                            0
                        ),
                      recipientCount:
                        Number(
                          receipt.recipientCount ||
                            message.recipientCount ||
                            0
                        ),
                    }
                  : message
            )
        );
      };

    const onRead =
      (receipt = {}) => {
        if (
          !receipt?.conversationId
        ) {
          return;
        }

        if (
          String(
            receipt.conversationId
          ).startsWith(
            "g:"
          )
        ) {
          return;
        }

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                same(
                  message.conversationId,
                  receipt.conversationId
                ) &&
                same(
                  message.senderId,
                  currentUserId
                )
                  ? {
                      ...message,
                      readAt:
                        receipt.readAt ||
                        new Date()
                          .toISOString(),
                    }
                  : message
            )
        );
      };

    const onChanged =
      () => {
        void loadOverview({
          silent:
            true,
        });

        if (
          String(
            activeRef.current ||
              ""
          ).startsWith(
            "g:"
          )
        ) {
          void loadMembers(
            activeRef.current,
            {
              silent:
                true,
            }
          );
        }
      };

    socket.on(
      "chat:message",
      onMessage
    );

    socket.on(
      "chat:delivered",
      onDelivered
    );

    socket.on(
      "chat:read",
      onRead
    );

    socket.on(
      "chat:changed",
      onChanged
    );

    return () => {
      socket.off(
        "chat:message",
        onMessage
      );

      socket.off(
        "chat:delivered",
        onDelivered
      );

      socket.off(
        "chat:read",
        onRead
      );

      socket.off(
        "chat:changed",
        onChanged
      );
    };
  }, [
    socket,
    currentUserId,
    loadOverview,
    loadMembers,
    markRead,
  ]);

  useEffect(() => {
    if (
      !creating &&
      !adding &&
      !showMembers &&
      !memberActionConfirm &&
      !renameDialog &&
      !imagePreview
    ) {
      return undefined;
    }

    const onKeyDown =
      (event) => {
        if (
          event.key !==
          "Escape"
        ) {
          return;
        }

        if (busy) {
          return;
        }

        if (
          imagePreview
        ) {
          setImagePreview(
            null
          );

          return;
        }

        if (
          memberActionConfirm
        ) {
          setMemberActionConfirm(
            null
          );

          return;
        }

        if (renameDialog) {
          setRenameDialog(
            false
          );

          setRenameError(
            ""
          );

          return;
        }

        if (adding) {
          setAdding(
            false
          );

          return;
        }

        if (creating) {
          setCreating(
            false
          );

          return;
        }

        if (showMembers) {
          setShowMembers(
            false
          );
        }
      };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [
    creating,
    adding,
    showMembers,
    memberActionConfirm,
    renameDialog,
    imagePreview,
    busy,
  ]);

  const directByPartner =
    useMemo(
      () =>
        new Map(
          threads
            .filter(
              (thread) =>
                thread.kind !==
                  "group" &&
                thread.partner
            )
            .map(
              (thread) => [
                String(
                  thread.partner.id
                ),
                thread,
              ]
            )
        ),
      [
        threads,
      ]
    );

  const recentThreads =
    useMemo(() => {
      const searchText =
        query
          .trim()
          .toLowerCase();

      return [
        ...threads,
      ]
        .filter(
          (thread) =>
            (
              thread.kind ===
              "group"
                ? thread.name
                : nameOf(
                    thread.partner
                  )
            )
              .toLowerCase()
              .includes(
                searchText
              )
        )
        .sort(
          (
            first,
            second
          ) => {
            const newer =
              parseTimestamp(
                second.lastAt ||
                  second.createdAt
              )?.getTime() ||
              0;

            const older =
              parseTimestamp(
                first.lastAt ||
                  first.createdAt
              )?.getTime() ||
              0;

            return (
              newer -
              older
            );
          }
        );
    }, [
      threads,
      query,
    ]);

  const newMessageUsers =
    useMemo(() => {
      const searchText =
        newMessageSearch
          .trim()
          .toLowerCase();

      return directory
        .filter(
          (account) =>
            !same(
              account.id,
              currentUserId
            )
        )
        .filter(
          (account) =>
            [
              account.fullName,
              account.username,
              account.role,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase()
              .includes(
                searchText
              )
        )
        .sort(
          (
            first,
            second
          ) =>
            nameOf(
              first
            ).localeCompare(
              nameOf(
                second
              )
            )
        );
    }, [
      directory,
      currentUserId,
      newMessageSearch,
    ]);

  const mentionCandidates =
    useMemo(() => {
      if (
        !isGroup ||
        mentionQuery ===
          null
      ) {
        return [];
      }

      const searchText =
        mentionQuery
          .trim()
          .toLowerCase();

      return members
        .filter(
          (member) =>
            !same(
              member.id,
              currentUserId
            )
        )
        .filter(
          (member) =>
            [
              member.fullName,
              member.username,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase()
              .includes(
                searchText
              )
        )
        .slice(
          0,
          6
        );
    }, [
      isGroup,
      mentionQuery,
      members,
      currentUserId,
    ]);

  function report() {
    setError(
      "Something went wrong. Please try again."
    );
  }

  async function openUser(
    account
  ) {
    if (busy) {
      return;
    }

    setError(
      ""
    );

    const existing =
      directByPartner.get(
        String(
          account.id
        )
      );

    if (existing) {
      setActiveId(
        existing.id
      );

      setNewMessageMode(
        false
      );

      setNewMessageSearch(
        ""
      );

      return;
    }

    setBusy(
      true
    );

    try {
      const result =
        await chatApi(
          "/conversations",
          {
            method:
              "POST",
            body:
              JSON.stringify({
                recipientId:
                  account.id,
              }),
          }
        );

      await loadOverview();

      setActiveId(
        result.conversationId
      );

      setNewMessageMode(
        false
      );

      setNewMessageSearch(
        ""
      );
    } catch {
      report();
    } finally {
      setBusy(
        false
      );
    }
  }

  async function createGroup(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      chosen.length <
        1 ||
      groupName
        .trim()
        .length <
        2
    ) {
      return;
    }

    setBusy(
      true
    );

    setError(
      ""
    );

    try {
      const result =
        await chatApi(
          "/groups",
          {
            method:
              "POST",
            body:
              JSON.stringify({
                name:
                  groupName.trim(),
                memberIds:
                  chosen,
              }),
          }
        );

      setCreating(
        false
      );

      setChosen(
        []
      );

      setGroupName(
        ""
      );

      setCreateSearch(
        ""
      );

      await loadOverview();

      setActiveId(
        result.conversationId
      );
    } catch {
      report();
    } finally {
      setBusy(
        false
      );
    }
  }

  function chooseFiles(
    fileList
  ) {
    if (
      !fileList?.length
    ) {
      return;
    }

    const incoming =
      Array.from(
        fileList
      );

    const invalid =
      incoming.find(
        (file) =>
          !isAcceptedFile(
            file
          )
      );

    if (invalid) {
      setError(
        "That file type is not supported. You can send PDF, Word, Excel, and image files."
      );

      return;
    }

    const combined = [
      ...selectedFiles,
      ...incoming,
    ];

    if (
      combined.length >
      MAX_FILES
    ) {
      setError(
        `You can attach up to ${MAX_FILES} files in one message.`
      );

      return;
    }

    const total =
      combined.reduce(
        (
          size,
          file
        ) =>
          size +
          Number(
            file.size || 0
          ),
        0
      );

    if (
      total >
      MAX_FILE_SIZE
    ) {
      setError(
        "Your selected files are over the 15 MB total limit. Remove a file or choose smaller files."
      );

      return;
    }

    setSelectedFiles(
      combined
    );

    setError(
      ""
    );
  }

  function handlePaste(
    event
  ) {
    const items =
      Array.from(
        event.clipboardData?.items ||
          []
      );

    const pastedImages =
      items
        .filter(
          (item) =>
            item.kind ===
              "file" &&
            String(
              item.type || ""
            ).startsWith(
              "image/"
            )
        )
        .map(
          (item) =>
            item.getAsFile()
        )
        .filter(
          Boolean
        );

    if (
      pastedImages.length ===
      0
    ) {
      return;
    }

    event.preventDefault();

    const normalized =
      pastedImages.map(
        (
          file,
          index
        ) => {
          if (
            fileExtension(
              file.name
            )
          ) {
            return file;
          }

          const extension =
            String(
              file.type || ""
            ).includes(
              "jpeg"
            )
              ? "jpg"
              : String(
                    file.type ||
                      ""
                  )
                    .split(
                      "/"
                    )[1] ||
                "png";

          return new File(
            [
              file,
            ],
            `Pasted image ${index + 1}.${extension}`,
            {
              type:
                file.type ||
                "image/png",
            }
          );
        }
      );

    chooseFiles(
      normalized
    );
  }

  function updateMentionQuery(
    value,
    cursorPosition
  ) {
    if (!isGroup) {
      setMentionQuery(
        null
      );

      return;
    }

    const beforeCursor =
      value.slice(
        0,
        cursorPosition
      );

    const match =
      beforeCursor.match(
        /(?:^|\s)@([A-Za-z0-9._-]*)$/
      );

    setMentionQuery(
      match
        ? match[1]
        : null
    );
  }

  function insertMention(
    member
  ) {
    const textarea =
      composerRef.current;

    const cursor =
      textarea?.selectionStart ??
      draft.length;

    const beforeCursor =
      draft.slice(
        0,
        cursor
      );

    const afterCursor =
      draft.slice(
        cursor
      );

    const match =
      beforeCursor.match(
        /(?:^|\s)@([A-Za-z0-9._-]*)$/
      );

    if (!match) {
      setMentionQuery(
        null
      );

      return;
    }

    const mention =
      `@${
        member?.username ||
        nameOf(
          member
        )
          .replace(
            /\s+/g,
            ""
          )
      }`;

    const start =
      cursor -
      (
        match[1]
          .length +
        1
      );

    const next =
      `${draft.slice(
        0,
        start
      )}${mention} ${afterCursor}`;

    if (
      next.length >
      MESSAGE_MAX_LENGTH
    ) {
      return;
    }

    setDraft(
      next
    );

    setMentionQuery(
      null
    );

    window.setTimeout(
      () => {
        const nextCursor =
          start +
          mention.length +
          1;

        textarea?.focus();

        textarea?.setSelectionRange(
          nextCursor,
          nextCursor
        );
      },
      0
    );
  }

  async function sendMessage(
    event
  ) {
    event.preventDefault();

    const conversationId =
      activeId;

    const body =
      draft.trim();

    const originalDraft =
      draft;

    const files = [
      ...selectedFiles,
    ];

    if (
      sending ||
      !conversationId ||
      active?.canMessage ===
        false ||
      (
        !body &&
        !files.length
      ) ||
      body.length >
        MESSAGE_MAX_LENGTH
    ) {
      return;
    }

    const total =
      files.reduce(
        (
          size,
          file
        ) =>
          size +
          Number(
            file.size || 0
          ),
        0
      );

    if (
      total >
      MAX_FILE_SIZE
    ) {
      setError(
        "Your selected files are over the 15 MB total limit."
      );

      return;
    }

    const optimisticId =
      `local-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    const optimisticMessage = {
      id:
        optimisticId,
      conversationId:
        String(
          conversationId
        ),
      senderId:
        currentUserId,
      body,
      createdAt:
        new Date()
          .toISOString(),
      readAt:
        null,
      isSystem:
        false,
      deliveryState:
        "sending",
      attachments:
        files.map(
          (
            file,
            index
          ) => ({
            id:
              `${optimisticId}-file-${index}`,
            name:
              file.name,
            size:
              file.size,
            local:
              true,
          })
        ),
    };

    setSending(
      true
    );

    setError(
      ""
    );

    if (
      files.length
    ) {
      setFileProgress(
        0
      );
    }

    followBottom.current =
      true;

    setMessages(
      (previous) => [
        ...previous,
        optimisticMessage,
      ]
    );

    setDraft(
      ""
    );

    setSelectedFiles(
      []
    );

    setMentionQuery(
      null
    );

    try {
      const response =
        files.length
          ? await uploadChatAttachments(
              conversationId,
              files,
              body,
              setFileProgress
            )
          : await chatApi(
              `/conversations/${encodeURIComponent(
                conversationId
              )}/messages`,
              {
                method:
                  "POST",
                body:
                  JSON.stringify({
                    body,
                  }),
              }
            );

      if (
        same(
          activeRef.current,
          conversationId
        )
      ) {
        setMessages(
          (previous) =>
            merged(
              previous.filter(
                (message) =>
                  !same(
                    message.id,
                    optimisticId
                  )
              ),
              {
                ...response.message,
                deliveryState:
                  response.message
                    ?.readAt
                    ? "seen"
                    : "sent",
              }
            )
        );
      }

      await loadOverview({
        silent:
          true,
      });
    } catch {
      if (
        same(
          activeRef.current,
          conversationId
        )
      ) {
        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                same(
                  message.id,
                  optimisticId
                )
                  ? {
                      ...message,
                      deliveryState:
                        "failed",
                    }
                  : message
            )
        );

        if (
          !draft &&
          originalDraft
        ) {
          setDraft(
            originalDraft
          );
        }

        if (
          selectedFiles.length ===
            0 &&
          files.length >
            0
        ) {
          setSelectedFiles(
            files
          );
        }
      }

      report();
    } finally {
      setSending(
        false
      );

      setFileProgress(
        null
      );

      if (
        uploadRef.current
      ) {
        uploadRef.current.value =
          "";
      }
    }
  }

  async function downloadFile(
    attachment
  ) {
    if (
      attachment?.local
    ) {
      return;
    }

    try {
      setError(
        ""
      );

      await downloadChatAttachment(
        attachment.id,
        attachment.name
      );
    } catch {
      report();
    }
  }

  async function older() {
    if (
      !hasMore ||
      busy ||
      loadingOlder ||
      !messages.length
    ) {
      return;
    }

    const conversationId =
      activeId;

    const version =
      historyVersion.current;

    setLoadingOlder(
      true
    );

    followBottom.current =
      false;

    const element =
      listRef.current;

    try {
      const firstServerMessage =
        messages.find(
          (message) =>
            !String(
              message.id
            ).startsWith(
              "local-"
            )
        );

      if (!firstServerMessage) {
        return;
      }

      const response =
        await chatApi(
          `/conversations/${encodeURIComponent(
            conversationId
          )}/messages?before=${firstServerMessage.id}`
        );

      if (
        version !==
          historyVersion.current ||
        !same(
          activeRef.current,
          conversationId
        )
      ) {
        return;
      }

      scrollRestore.current =
        element
          ? {
              top:
                element.scrollTop,
              height:
                element.scrollHeight,
            }
          : null;

      setMessages(
        (previous) => [
          ...(
            response.messages ||
            []
          ).filter(
            (message) =>
              !previous.some(
                (current) =>
                  same(
                    current.id,
                    message.id
                  )
              )
          ),
          ...previous,
        ]
      );

      setHasMore(
        Boolean(
          response.hasMore
        )
      );
    } catch {
      report();
    } finally {
      setLoadingOlder(
        false
      );
    }
  }

  async function changeMember(
    action,
    userId
  ) {
    if (busy) {
      return;
    }

    setBusy(
      true
    );

    setError(
      ""
    );

    try {
      if (
        action ===
        "add"
      ) {
        await chatApi(
          `/groups/${gid}/members`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                userId,
              }),
          }
        );
      } else if (
        action ===
        "remove"
      ) {
        await chatApi(
          `/groups/${gid}/members/${userId}`,
          {
            method:
              "DELETE",
          }
        );
      } else if (
        action ===
        "admin"
      ) {
        await chatApi(
          `/groups/${gid}/members/${userId}/admin`,
          {
            method:
              "PATCH",
            body:
              JSON.stringify({
                isAdmin:
                  true,
              }),
          }
        );
      }

      await loadOverview({
        silent:
          true,
      });

      if (
        action ===
          "remove" &&
        same(
          userId,
          currentUserId
        )
      ) {
        setActiveId(
          null
        );

        setShowMembers(
          false
        );
      } else {
        await loadMembers(
          `g:${gid}`
        );
      }

      setAdding(
        false
      );
    } catch {
      report();
    } finally {
      setBusy(
        false
      );
    }
  }

  async function submitAddMembers(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      !admin ||
      !gid ||
      addChosen.length ===
        0
    ) {
      return;
    }

    if (
      addChosen.length >
      freeGroupSlots
    ) {
      setAddError(
        `This group has room for ${freeGroupSlots} more ${
          freeGroupSlots ===
          1
            ? "member"
            : "members"
        }.`
      );

      return;
    }

    const conversationId =
      `g:${gid}`;

    const selectedIds = [
      ...addChosen,
    ];

    let added =
      0;

    setBusy(
      true
    );

    setAddError(
      ""
    );

    try {
      for (
        const userId of
        selectedIds
      ) {
        await chatApi(
          `/groups/${gid}/members`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                userId,
              }),
          }
        );

        added +=
          1;
      }

      setAdding(
        false
      );

      setAddChosen(
        []
      );

      setAddSearch(
        ""
      );
    } catch {
      setAddChosen(
        selectedIds.slice(
          added
        )
      );

      setAddError(
        `${
          added >
          0
            ? `${added} ${
                added ===
                1
                  ? "member was"
                  : "members were"
              } added. `
            : ""
        }The remaining members could not be added. Please try again.`
      );
    } finally {
      try {
        await Promise.all([
          loadOverview({
            silent:
              true,
          }),
          loadMembers(
            conversationId
          ),
        ]);
      } catch (
        refreshError
      ) {
        console.error(
          "Unable to refresh group members:",
          refreshError
        );
      }

      setBusy(
        false
      );
    }
  }

  function openRenameDialog() {
    setRenameValue(
      active?.name ||
        ""
    );

    setRenameError(
      ""
    );

    setRenameDialog(
      true
    );
  }

  async function submitRename(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      !gid
    ) {
      return;
    }

    const next =
      renameValue.trim();

    if (
      next.length <
        2 ||
      next.length >
        100
    ) {
      setRenameError(
        "Enter a group name with 2 to 100 characters."
      );

      return;
    }

    if (
      next ===
      String(
        active?.name ||
          ""
      ).trim()
    ) {
      setRenameDialog(
        false
      );

      setRenameError(
        ""
      );

      return;
    }

    setBusy(
      true
    );

    setRenameError(
      ""
    );

    try {
      await chatApi(
        `/groups/${gid}/name`,
        {
          method:
            "PATCH",
          body:
            JSON.stringify({
              name:
                next,
            }),
        }
      );

      await loadOverview({
        silent:
          true,
      });

      setRenameDialog(
        false
      );

      setRenameValue(
        ""
      );
    } catch {
      setRenameError(
        "We couldn’t rename this group. Please try again."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  const itemClass =
    (selected) =>
      [
        "group flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left text-sm transition dark:border-slate-800",
        selected
          ? "bg-blue-50 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/70",
      ].join(
        " "
      );

  return (
    <main
      className={
        compact
          ? "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-900"
          : "flex h-[calc(100vh-7rem)] min-h-[560px] min-w-0 flex-col gap-4 p-3 sm:p-5"
      }
    >
      {!compact && (
        <div className="flex shrink-0 flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Messages
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Message your WELLJOB team and share files in one place.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
        >
          <span>
            {error}
          </span>

          <button
            type="button"
            className="shrink-0 font-semibold underline underline-offset-2"
            onClick={() =>
              setError(
                ""
              )
            }
          >
            Close
          </button>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <aside
          className={[
            activeId
              ? "hidden sm:flex"
              : "flex",
            compact
              ? "w-full sm:w-[230px]"
              : "w-full sm:w-72 lg:w-80",
            "min-h-0 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700",
          ].join(
            " "
          )}
        >
          {newMessageMode ? (
            <>
              <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Back to chats"
                    title="Back"
                    onClick={() => {
                      setNewMessageMode(
                        false
                      );

                      setNewMessageSearch(
                        ""
                      );
                    }}
                  >
                    <FiArrowLeft />
                  </button>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      Start a chat
                    </p>

                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      Choose someone from your team
                    </p>
                  </div>
                </div>

                <label className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950/40">
                  <FiSearch className="shrink-0 text-slate-400" />

                  <input
                    type="search"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    placeholder="Search people..."
                    value={
                      newMessageSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setNewMessageSearch(
                        event.target.value
                      )
                    }
                    autoFocus
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  onClick={() => {
                    setChosen(
                      []
                    );

                    setGroupName(
                      ""
                    );

                    setCreateSearch(
                      ""
                    );

                    setCreating(
                      true
                    );

                    setError(
                      ""
                    );
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <FiUsers />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                      New group
                    </span>

                    <span className="block truncate text-xs text-slate-500">
                      Start a group conversation
                    </span>
                  </span>
                </button>

                <p className="bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70">
                  People
                </p>

                {loading && (
                  <p className="p-4 text-center text-xs text-slate-500">
                    Loading people...
                  </p>
                )}

                {!loading &&
                  newMessageUsers.map(
                    (
                      account
                    ) => {
                      return (
                        <button
                          key={
                            account.id
                          }
                          type="button"
                          disabled={
                            busy
                          }
                          className={
                            itemClass(
                              false
                            )
                          }
                          onClick={() =>
                            openUser(
                              account
                            )
                          }
                        >
                          <AuthenticatedAvatar
                            user={
                              account
                            }
                            small
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900 dark:text-white">
                              {nameOf(
                                account
                              )}
                            </span>

                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                              {friendlyRole(
                                account.role
                              )}

                            </span>
                          </span>
                        </button>
                      );
                    }
                  )}

                {!loading &&
                  newMessageUsers.length ===
                    0 && (
                    <p className="p-5 text-center text-xs text-slate-500">
                      {newMessageSearch.trim()
                        ? "No one matches your search."
                        : "No people are available."}
                    </p>
                  )}
              </div>
            </>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-700">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => {
                    setNewMessageMode(
                      true
                    );

                    setNewMessageSearch(
                      ""
                    );

                    setError(
                      ""
                    );
                  }}
                >
                  <FiEdit2 />
                  New chat
                </button>

                <label className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950/40">
                  <FiSearch className="shrink-0 text-slate-400" />

                  <input
                    type="search"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    placeholder="Search chats..."
                    value={
                      query
                    }
                    onChange={(
                      event
                    ) =>
                      setQuery(
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading && (
                  <p className="p-4 text-center text-xs text-slate-500">
                    Loading chats...
                  </p>
                )}

                {!loading &&
                  recentThreads.length >
                    0 && (
                    <p className="bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70">
                      Recent chats
                    </p>
                  )}

                {!loading &&
                  recentThreads.map(
                    (
                      thread
                    ) => (
                      <button
                        key={
                          thread.id
                        }
                        type="button"
                        className={
                          itemClass(
                            same(
                              thread.id,
                              activeId
                            )
                          )
                        }
                        onClick={() =>
                          setActiveId(
                            thread.id
                          )
                        }
                      >
                        {thread.kind ===
                        "group" ? (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <FiUsers />
                          </span>
                        ) : (
                          <AuthenticatedAvatar
                            user={
                              thread.partner
                            }
                            small
                          />
                        )}

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white">
                              {thread.kind ===
                              "group"
                                ? thread.name
                                : nameOf(
                                    thread.partner
                                  )}
                            </span>

                            <span className="shrink-0 text-[10px] text-slate-400">
                              {compactThreadTime(
                                thread.lastAt ||
                                  thread.createdAt
                              )}
                            </span>
                          </span>

                          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                            {thread.lastBody ||
                              "No messages yet"}
                          </span>
                        </span>

                        {Number(
                          thread.unreadCount ||
                            0
                        ) >
                          0 && (
                          <span className="min-w-6 shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-center text-xs font-bold text-white">
                            {thread.unreadCount}
                          </span>
                        )}
                      </button>
                    )
                  )}

                {!loading &&
                  recentThreads.length ===
                    0 && (
                    <div className="p-6 text-center">
                      <FiMessageCircle
                        className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
                        size={
                          34
                        }
                      />

                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {query.trim()
                          ? "No chats match your search."
                          : "No chats yet"}
                      </p>

                      {!query.trim() && (
                        <button
                          type="button"
                          className="mt-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          onClick={() =>
                            setNewMessageMode(
                              true
                            )
                          }
                        >
                          Start a chat
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}
        </aside>

        <section
          className={[
            activeId
              ? "flex"
              : "hidden sm:flex",
            "min-h-0 min-w-0 flex-1 flex-col",
          ].join(
            " "
          )}
        >
          {active ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden"
                  aria-label="Back to chats"
                  onClick={() =>
                    setActiveId(
                      null
                    )
                  }
                >
                  <FiArrowLeft />
                </button>

                {isGroup ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <FiUsers />
                  </span>
                ) : (
                  <AuthenticatedAvatar
                    user={
                      active.partner
                    }
                    small
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                    {title}
                  </span>

                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {isGroup
                      ? members.length
                        ? `${members.length} ${
                            members.length === 1
                              ? "member"
                              : "members"
                          }`
                        : "Group conversation"
                      : friendlyRole(
                          active.partner
                            ?.role
                        )}
                  </span>
                </span>

                {isGroup && (
                  <button
                    type="button"
                    className={
                      subtleButton
                    }
                    onClick={() =>
                      setShowMembers(
                        true
                      )
                    }
                    title="Members"
                    aria-label="View group members"
                  >
                    <FiUsers />
                    <span className="hidden lg:inline">
                      Members
                    </span>
                  </button>
                )}
              </header>

              <div
                ref={
                  listRef
                }
                onScroll={(
                  event
                ) => {
                  const element =
                    event.currentTarget;

                  followBottom.current =
                    element.scrollHeight -
                      element.scrollTop -
                      element.clientHeight <
                    96;
                }}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950/40 sm:px-4"
              >
                {hasMore && (
                  <button
                    type="button"
                    disabled={
                      loadingOlder
                    }
                    onClick={
                      older
                    }
                    className={`${subtleButton} mx-auto block text-xs`}
                  >
                    {loadingOlder
                      ? "Loading..."
                      : "Show earlier messages"}
                  </button>
                )}

                {loadingMessages && (
                  <p className="py-5 text-center text-xs text-slate-500">
                    Loading messages...
                  </p>
                )}

                {!loadingMessages &&
                  !messages.length && (
                    <div className="mx-auto max-w-sm py-12 text-center">
                      <FiMessageCircle
                        className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
                        size={
                          36
                        }
                      />

                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Start the conversation
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Send a message or add a file.
                      </p>
                    </div>
                  )}

                {messages.map(
                  (
                    message
                  ) => {
                    if (
                      message.isSystem
                    ) {
                      return (
                        <div
                          key={
                            message.id
                          }
                          className="flex justify-center py-1"
                        >
                          <div
                            role="status"
                            className="max-w-[95%] rounded-full bg-slate-200 px-3 py-1.5 text-center text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {message.body}

                            <span className="ml-2 whitespace-nowrap text-slate-500">
                              {formattedTime(
                                message.createdAt
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const mine =
                      same(
                        message.senderId,
                        currentUserId
                      );

                    const files =
                      Array.isArray(
                        message.attachments
                      ) &&
                      message.attachments
                        .length >
                        0
                        ? message.attachments
                        : message.attachment
                          ? [
                              message.attachment,
                            ]
                          : [];

                    const status =
                      messageStatusLabel(
                        message,
                        isGroup,
                        mine
                      );

                    return (
                      <div
                        key={
                          message.id
                        }
                        className={`flex ${
                          mine
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={[
                            "min-w-0 max-w-[88%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[75%]",
                            mine
                              ? message.deliveryState ===
                                "failed"
                                ? "border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
                                : "bg-blue-600 text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white",
                          ].join(
                            " "
                          )}
                        >
                          {isGroup &&
                            !mine && (
                              <p className="mb-1 text-[11px] font-bold text-blue-600 dark:text-blue-300">
                                {message.senderName ||
                                  members.find(
                                    (
                                      member
                                    ) =>
                                      same(
                                        member.id,
                                        message.senderId
                                      )
                                  )
                                    ?.fullName ||
                                  "Group member"}
                              </p>
                            )}

                          <MessageText
                            body={
                              message.body
                            }
                          />

                          {files.length >
                            0 && (
                            <div
                              className={
                                message.body
                                  ? "mt-2 space-y-1.5"
                                  : "space-y-1.5"
                              }
                            >
                              {files.map(
                                (
                                  attachment
                                ) =>
                                  isImageAttachment(
                                    attachment
                                  ) ? (
                                    <ChatImageAttachment
                                      key={
                                        attachment.id
                                      }
                                      attachment={
                                        attachment
                                      }
                                      disabled={
                                        message.deliveryState ===
                                        "failed"
                                      }
                                      onDownload={
                                        downloadFile
                                      }
                                      onOpen={(
                                        selectedAttachment,
                                        imageUrl
                                      ) =>
                                        setImagePreview({
                                          attachment:
                                            selectedAttachment,
                                          url:
                                            imageUrl,
                                        })
                                      }
                                    />
                                  ) : (
                                    <button
                                      key={
                                        attachment.id
                                      }
                                      type="button"
                                      disabled={
                                        attachment.local
                                      }
                                      onClick={() =>
                                        downloadFile(
                                          attachment
                                        )
                                      }
                                      className={[
                                        "flex w-full max-w-full items-center gap-2 rounded-xl border p-2.5 text-left transition",
                                        mine &&
                                        message.deliveryState !==
                                          "failed"
                                          ? "border-blue-300/70 bg-blue-500/30 hover:bg-blue-500/40"
                                          : "border-slate-300 bg-white/70 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:bg-slate-900/70",
                                        attachment.local
                                          ? "cursor-default"
                                          : "",
                                      ].join(
                                        " "
                                      )}
                                    >
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10">
                                        <FiPaperclip />
                                      </span>

                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold">
                                          {attachment.name}
                                        </span>

                                        <span className="block text-[10px] opacity-80">
                                          {attachmentTypeLabel(
                                            attachment.name
                                          )}{" "}
                                          •{" "}
                                          {bytes(
                                            attachment.size
                                          )}
                                        </span>
                                      </span>

                                      {!attachment.local && (
                                        <FiDownload className="shrink-0" />
                                      )}
                                    </button>
                                  )
                              )}
                            </div>
                          )}

                          <p
                            className={[
                              "mt-1.5 flex flex-wrap items-center justify-end gap-x-1 text-[10px]",
                              mine &&
                              message.deliveryState !==
                                "failed"
                                ? "text-blue-100"
                                : message.deliveryState ===
                                    "failed"
                                  ? "text-red-600 dark:text-red-300"
                                  : "text-slate-400",
                            ].join(
                              " "
                            )}
                          >
                            <span>
                              {formattedTime(
                                message.createdAt
                              )}
                            </span>

                            {mine &&
                              status && (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {status}
                                  </span>
                                </>
                              )}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {selectedFiles.length >
                0 && (
                <div className="shrink-0 border-t border-slate-200 bg-blue-50 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <strong>
                      {selectedFiles.length}{" "}
                      {selectedFiles.length ===
                      1
                        ? "file"
                        : "files"}{" "}
                      ready •{" "}
                      {bytes(
                        selectedBytes
                      )}{" "}
                      / 15 MB
                    </strong>

                    <button
                      type="button"
                      className="shrink-0 font-semibold text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-300"
                      disabled={
                        sending
                      }
                      onClick={() =>
                        setSelectedFiles(
                          []
                        )
                      }
                    >
                      Remove all
                    </button>
                  </div>

                  <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                    {selectedFiles.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 dark:border-slate-600 dark:bg-slate-900"
                        >
                          <FiPaperclip className="shrink-0 text-slate-400" />

                          <span className="max-w-[180px] truncate">
                            {file.name}
                          </span>

                          <span className="shrink-0 text-slate-400">
                            {bytes(
                              file.size
                            )}
                          </span>

                          <button
                            type="button"
                            title={`Remove ${file.name}`}
                            aria-label={`Remove ${file.name}`}
                            disabled={
                              sending
                            }
                            onClick={() =>
                              setSelectedFiles(
                                (
                                  previous
                                ) =>
                                  previous.filter(
                                    (
                                      _,
                                      itemIndex
                                    ) =>
                                      itemIndex !==
                                      index
                                  )
                              )
                            }
                            className="shrink-0 rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <FiX />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="relative shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {mentionCandidates.length >
                  0 && (
                  <div className="absolute bottom-full left-12 z-20 mb-2 w-[min(320px,calc(100%-4rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800">
                      Choose a person
                    </p>

                    {mentionCandidates.map(
                      (
                        member
                      ) => (
                        <button
                          key={
                            member.id
                          }
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          onMouseDown={(
                            event
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            insertMention(
                              member
                            )
                          }
                        >
                          <AuthenticatedAvatar
                            user={
                              member
                            }
                            small
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900 dark:text-white">
                              {nameOf(
                                member
                              )}
                            </span>


                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}

                <form
                  onSubmit={
                    sendMessage
                  }
                  className="flex items-end gap-2 p-3"
                >
                  <input
                    ref={
                      uploadRef
                    }
                    type="file"
                    multiple
                    accept={
                      ACCEPTED_FILE_INPUT
                    }
                    className="hidden"
                    onChange={(
                      event
                    ) => {
                      chooseFiles(
                        event.target
                          .files
                      );

                      event.target.value =
                        "";
                    }}
                  />

                  <button
                    type="button"
                    title="Add files"
                    aria-label="Add files"
                    disabled={
                      sending ||
                      loadingMessages ||
                      active.canMessage ===
                        false
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() =>
                      uploadRef.current?.click()
                    }
                  >
                    <FiPaperclip />
                  </button>

                  <div className="min-w-0 flex-1">
                    <textarea
                      ref={
                        composerRef
                      }
                      value={
                        draft
                      }
                      maxLength={
                        MESSAGE_MAX_LENGTH
                      }
                      rows={
                        1
                      }
                      onPaste={
                        handlePaste
                      }
                      onChange={(
                        event
                      ) => {
                        const value =
                          event.target
                            .value;

                        setDraft(
                          value
                        );

                        updateMentionQuery(
                          value,
                          event.target
                            .selectionStart
                        );
                      }}
                      onClick={(
                        event
                      ) =>
                        updateMentionQuery(
                          event.currentTarget
                            .value,
                          event.currentTarget
                            .selectionStart
                        )
                      }
                      onKeyUp={(
                        event
                      ) => {
                        if (
                          [
                            "ArrowUp",
                            "ArrowDown",
                            "ArrowLeft",
                            "ArrowRight",
                          ].includes(
                            event.key
                          )
                        ) {
                          updateMentionQuery(
                            event.currentTarget
                              .value,
                            event.currentTarget
                              .selectionStart
                          );
                        }
                      }}
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                            "Escape" &&
                          mentionQuery !==
                            null
                        ) {
                          event.preventDefault();

                          setMentionQuery(
                            null
                          );

                          return;
                        }

                        if (
                          event.key ===
                            "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent
                            .isComposing &&
                          mentionQuery ===
                            null
                        ) {
                          event.preventDefault();

                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder={
                        active.canMessage ===
                        false
                          ? "This person is currently unavailable."
                          : "Write a message..."
                      }
                      disabled={
                        sending ||
                        active.canMessage ===
                          false
                      }
                      className="max-h-28 min-h-10 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    />


                  </div>

                  <button
                    type="submit"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      sending ||
                      (
                        !draft.trim() &&
                        !selectedFiles.length
                      ) ||
                      loadingMessages ||
                      active.canMessage ===
                        false
                    }
                    aria-label="Send"
                    title="Send"
                  >
                    <FiSend />
                  </button>
                </form>

                {fileProgress !==
                  null && (
                  <div
                    className="border-t border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-300"
                    role="status"
                  >
                    Sending files… {fileProgress}%
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-300">
                <FiMessageCircle
                  size={
                    30
                  }
                />
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Choose a chat
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Open a recent conversation or start a new one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {showMembers &&
        isGroup && (
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-3"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !busy
              ) {
                setShowMembers(
                  false
                );
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Group members"
              className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                    {title}
                  </h2>

                  <p className="text-xs text-slate-500">
                    {members.length}{" "}
                    {members.length ===
                    1
                      ? "member"
                      : "members"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    setShowMembers(
                      false
                    )
                  }
                  aria-label="Close members"
                  className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FiX />
                </button>
              </div>

              {admin && (
                <div className="flex gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
                  <button
                    type="button"
                    className={
                      subtleButton
                    }
                    onClick={
                      openRenameDialog
                    }
                    disabled={
                      busy
                    }
                  >
                    <FiEdit2 />
                    Rename
                  </button>

                  <button
                    type="button"
                    className={
                      subtleButton
                    }
                    disabled={
                      busy ||
                      freeGroupSlots <=
                        0
                    }
                    onClick={() => {
                      setAddChosen(
                        []
                      );

                      setAddSearch(
                        ""
                      );

                      setAddError(
                        ""
                      );

                      setAdding(
                        true
                      );
                    }}
                  >
                    <FiUserPlus />
                    Add members
                  </button>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {members.map(
                  (
                    member
                  ) => (
                    <div
                      key={
                        member.id
                      }
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <AuthenticatedAvatar
                        user={
                          member
                        }
                        small
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {nameOf(
                            member
                          )}
                          {same(
                            member.id,
                            currentUserId
                          )
                            ? " (You)"
                            : ""}
                        </span>

                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {member.isAdmin
                            ? "Group admin"
                            : friendlyRole(
                                member.role
                              )}
                        </span>
                      </span>

                      {admin &&
                        !member.isAdmin && (
                          <button
                            type="button"
                            title="Make group admin"
                            aria-label={`Make ${nameOf(
                              member
                            )} a group admin`}
                            disabled={
                              busy
                            }
                            onClick={() =>
                              changeMember(
                                "admin",
                                member.id
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                          >
                            <FiShield />
                          </button>
                        )}

                      {(admin ||
                        same(
                          member.id,
                          currentUserId
                        )) && (
                        <button
                          type="button"
                          title={
                            same(
                              member.id,
                              currentUserId
                            )
                              ? "Leave group"
                              : "Remove from group"
                          }
                          aria-label={
                            same(
                              member.id,
                              currentUserId
                            )
                              ? "Leave group"
                              : `Remove ${nameOf(
                                  member
                                )} from group`
                          }
                          disabled={
                            busy
                          }
                          onClick={() => {
                            const leaving =
                              same(
                                member.id,
                                currentUserId
                              );

                            setMemberActionConfirm({
                              userId:
                                member.id,
                              name:
                                nameOf(
                                  member
                                ),
                              leaving,
                            });
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          {same(
                            member.id,
                            currentUserId
                          ) ? (
                            <FiLogOut />
                          ) : (
                            <FiTrash2 />
                          )}
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </section>
          </div>
        )}

      {imagePreview && (
        <div
          className="fixed inset-0 z-[2400] flex items-center justify-center bg-black/85 p-4"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setImagePreview(
                null
              );
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {imagePreview.attachment
                  ?.name ||
                  "Image"}
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      imagePreview.attachment
                    )
                  }
                  title="Download"
                  aria-label="Download image"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  <FiDownload />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setImagePreview(
                      null
                    )
                  }
                  title="Close"
                  aria-label="Close image preview"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  <FiX />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black p-3">
              <img
                src={
                  imagePreview.url
                }
                alt={
                  imagePreview.attachment
                    ?.name ||
                  "Shared image"
                }
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>
          </section>
        </div>
      )}

      {renameDialog &&
        isGroup &&
        admin && (
          <div
            className="fixed inset-0 z-[2260] flex items-center justify-center bg-black/60 p-3"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !busy
              ) {
                setRenameDialog(
                  false
                );

                setRenameError(
                  ""
                );
              }
            }}
          >
            <form
              onSubmit={
                submitRename
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="rename-group-title"
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <h2
                    id="rename-group-title"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    Rename Group
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Enter a new name for this group.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRenameDialog(
                      false
                    );

                    setRenameError(
                      ""
                    );
                  }}
                  disabled={
                    busy
                  }
                  aria-label="Close rename group"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <FiX />
                </button>
              </div>

              <div className="px-5 pb-5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Group name

                  <input
                    type="text"
                    value={
                      renameValue
                    }
                    maxLength={
                      100
                    }
                    onChange={(
                      event
                    ) => {
                      setRenameValue(
                        event.target.value
                      );

                      if (
                        renameError
                      ) {
                        setRenameError(
                          ""
                        );
                      }
                    }}
                    placeholder="Enter group name"
                    autoFocus
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                {renameError && (
                  <p
                    role="alert"
                    className="mt-2 text-xs font-medium text-red-600 dark:text-red-300"
                  >
                    {renameError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                <button
                  type="button"
                  className={
                    subtleButton
                  }
                  disabled={
                    busy
                  }
                  onClick={() => {
                    setRenameDialog(
                      false
                    );

                    setRenameError(
                      ""
                    );
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    solidButton
                  }
                  disabled={
                    busy ||
                    renameValue
                      .trim()
                      .length <
                      2
                  }
                >
                  {busy
                    ? "Saving..."
                    : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        )}

      {memberActionConfirm && (
        <div
          className="fixed inset-0 z-[2250] flex items-center justify-center bg-black/60 p-3"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !busy
            ) {
              setMemberActionConfirm(
                null
              );
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="member-action-title"
            aria-describedby="member-action-description"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3 p-5">
              <span
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  memberActionConfirm.leaving
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                ].join(
                  " "
                )}
              >
                {memberActionConfirm.leaving ? (
                  <FiLogOut
                    size={20}
                    aria-hidden="true"
                  />
                ) : (
                  <FiTrash2
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <h2
                  id="member-action-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {memberActionConfirm.leaving
                    ? "Leave Group?"
                    : "Remove Member?"}
                </h2>

                <p
                  id="member-action-description"
                  className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300"
                >
                  {memberActionConfirm.leaving
                    ? `Are you sure you want to leave ${title || "this group"}?`
                    : `Remove ${memberActionConfirm.name} from ${title || "this group"}?`}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMemberActionConfirm(
                    null
                  )
                }
                disabled={
                  busy
                }
                aria-label="Close confirmation"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <FiX />
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() =>
                  setMemberActionConfirm(
                    null
                  )
                }
                disabled={
                  busy
                }
                className={subtleButton}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() => {
                  const pending =
                    memberActionConfirm;

                  if (!pending) {
                    return;
                  }

                  void changeMember(
                    "remove",
                    pending.userId
                  ).finally(
                    () => {
                      setMemberActionConfirm(
                        null
                      );
                    }
                  );
                }}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                  memberActionConfirm.leaving
                    ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                    : "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
                ].join(
                  " "
                )}
              >
                {busy ? (
                  "Please wait..."
                ) : memberActionConfirm.leaving ? (
                  <>
                    <FiLogOut />
                    Leave Group
                  </>
                ) : (
                  <>
                    <FiTrash2 />
                    Remove
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {creating && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 p-3"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !busy
            ) {
              setCreating(
                false
              );
            }
          }}
        >
          <form
            onSubmit={
              createGroup
            }
            role="dialog"
            aria-modal="true"
            aria-label="Create group"
            className="flex max-h-[88vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  New group
                </h2>

                <p className="text-xs text-slate-500">
                  Give the group a name and choose who to include.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  setCreating(
                    false
                  )
                }
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FiX />
              </button>
            </div>

            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Group name
              <input
                value={
                  groupName
                }
                maxLength={
                  100
                }
                onChange={(
                  event
                ) =>
                  setGroupName(
                    event.target.value
                  )
                }
                placeholder="Example: HR Team"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700"
                required
                autoFocus
              />
            </label>

            <p className="text-xs leading-5 text-slate-500">
              Members added later will only see messages sent after they join.
            </p>

            <MemberSelector
              users={
                directory
              }
              selected={
                chosen
              }
              setSelected={
                setChosen
              }
              search={
                createSearch
              }
              setSearch={
                setCreateSearch
              }
              maxSelected={
                29
              }
              disabled={
                busy
              }
            />

            <button
              type="submit"
              className={
                solidButton
              }
              disabled={
                busy ||
                groupName
                  .trim()
                  .length <
                  2 ||
                chosen.length <
                  1
              }
            >
              {busy
                ? "Creating..."
                : "Create group"}
            </button>
          </form>
        </div>
      )}

      {adding &&
        isGroup &&
        admin && (
          <div
            className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/60 p-3"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !busy
              ) {
                setAdding(
                  false
                );
              }
            }}
          >
            <form
              onSubmit={
                submitAddMembers
              }
              role="dialog"
              aria-modal="true"
              aria-label="Add members"
              className="flex max-h-[88vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Add members
                  </h2>

                  <p className="text-xs text-slate-500">
                    Choose members to add to {title}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    setAdding(
                      false
                    )
                  }
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FiX />
                </button>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                New members will only see messages sent after they join.
              </p>

              {addError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                >
                  {addError}
                </p>
              )}

              <MemberSelector
                users={
                  availableToAdd
                }
                selected={
                  addChosen
                }
                setSelected={
                  setAddChosen
                }
                search={
                  addSearch
                }
                setSearch={
                  setAddSearch
                }
                maxSelected={
                  freeGroupSlots
                }
                disabled={
                  busy
                }
                emptyMessage="Everyone available is already a member of this group."
              />

              <button
                type="submit"
                className={
                  solidButton
                }
                disabled={
                  busy ||
                  addChosen.length <
                    1 ||
                  addChosen.length >
                    freeGroupSlots
                }
              >
                {busy
                  ? "Adding..."
                  : `Add ${
                      addChosen.length
                    } ${
                      addChosen.length ===
                      1
                        ? "member"
                        : "members"
                    }`}
              </button>
            </form>
          </div>
        )}
    </main>
  );
}