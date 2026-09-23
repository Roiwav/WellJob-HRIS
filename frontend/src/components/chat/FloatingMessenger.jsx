import {
  Suspense,
  lazy,
  useEffect,
  useState,
} from "react";

import {
  FiMessageCircle,
  FiX,
} from "react-icons/fi";

import { useChat } from "../../context/ChatContext";

const Messenger = lazy(() =>
  import("../../pages/Messenger")
);

/*
 * ==================================================
 * WELLJOB SOLUTIONS
 * FLOATING MESSENGER
 * ==================================================
 *
 * Desktop:
 * - Floating Messenger window
 * - User sidebar on the left
 * - Conversation panel on the right
 *
 * Mobile:
 * - One panel at a time
 *
 * Messenger button remains above
 * the existing Smart Suggestions button.
 */

export default function FloatingMessenger() {
  const { unreadCount } = useChat();

  const [isOpen, setIsOpen] =
    useState(false);

  const safeUnreadCount = Math.max(
    0,
    Number(unreadCount) || 0
  );

  const unreadLabel =
    safeUnreadCount > 99
      ? "99+"
      : String(safeUnreadCount);

  /*
   * Close using Escape.
   */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isOpen]);

  return (
    <>
      {/*
       * ==========================================
       * FLOATING MESSENGER BUTTON
       * ==========================================
       */}

      <div className="fixed bottom-[10.5rem] right-6 z-[1160]">
        <div className="group relative flex items-center">
          <div className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
            Messenger
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(
                (previous) => !previous
              );
            }}
            aria-label={
              isOpen
                ? "Close Messenger"
                : "Open Messenger"
            }
            aria-expanded={isOpen}
            aria-controls="welljob-floating-messenger"
            title="Messenger"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            {isOpen ? (
              <FiX
                size={23}
                aria-hidden="true"
              />
            ) : (
              <FiMessageCircle
                size={23}
                aria-hidden="true"
              />
            )}

            {!isOpen &&
              safeUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
                  {unreadLabel}
                </span>
              )}
          </button>
        </div>
      </div>

      {/*
       * ==========================================
       * FLOATING MESSENGER WINDOW
       * ==========================================
       *
       * Desktop:
       * Width: 620px
       * Height: 440px
       *
       * The width allows the Messenger
       * user sidebar and conversation
       * to appear side by side.
       */}

      {isOpen && (
        <div
          id="welljob-floating-messenger"
          className="
            fixed inset-3 z-[1200]
            flex min-h-0 min-w-0
            flex-col overflow-hidden
            rounded-2xl
            border border-slate-200
            bg-white shadow-2xl
            dark:border-slate-700
            dark:bg-slate-900

            sm:inset-auto
            sm:bottom-[15rem]
            sm:right-6
            sm:h-[min(440px,calc(100dvh-16.5rem))]
            sm:min-h-0
            sm:w-[min(620px,calc(100vw-3rem))]
          "
        >
          {/*
           * ======================================
           * WINDOW HEADER
           * ======================================
           */}

          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <FiMessageCircle
                  size={19}
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  WELLJOB Messenger
                </h2>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Private and group messages
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
              }}
              aria-label="Close Messenger window"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-red-100 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <FiX
                size={18}
                aria-hidden="true"
              />
            </button>
          </header>

          {/*
           * ======================================
           * MESSENGER CONTENT
           * ======================================
           *
           * Reuses the existing Messenger
           * with floating mode enabled.
           */}

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <Suspense
              fallback={
                <div
                  className="flex h-full items-center justify-center p-5 text-sm text-slate-500 dark:text-slate-400"
                  role="status"
                >
                  Loading Messenger...
                </div>
              }
            >
              <Messenger compact />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}