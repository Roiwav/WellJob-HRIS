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
 * - Compact floating Messenger window
 * - Launcher stays near the lower-right corner
 * - Keeps clear vertical separation from
 *   the Smart Suggestions button
 *
 * Mobile:
 * - Uses most of the available viewport
 * - Keeps a small safe margin around the window
 *
 * The existing Messenger page is reused in compact mode.
 */

export default function FloatingMessenger() {
  const { unreadCount } = useChat();

  const [isOpen, setIsOpen] = useState(false);

  const safeUnreadCount = Math.max(
    0,
    Number(unreadCount) || 0
  );

  const unreadLabel =
    safeUnreadCount > 99
      ? "99+"
      : String(safeUnreadCount);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-[1160] sm:bottom-6 sm:right-6">
          <div className="group relative flex items-center">
            <div className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
              Open Messenger
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
              }}
              aria-label="Open Messenger"
              aria-expanded={false}
              aria-controls="welljob-floating-messenger"
              title="Messenger"
              className="relative flex h-14 w-14 items-center justify-center rounded-full border border-blue-500/20 bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:border-blue-400/20 dark:focus:ring-offset-slate-950"
            >
              <FiMessageCircle
                size={23}
                aria-hidden="true"
              />

              {safeUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
                  {unreadLabel}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          id="welljob-floating-messenger"
          role="dialog"
          aria-modal="false"
          aria-label="WELLJOB Messenger"
          className="
            fixed inset-2 z-[1200]
            flex min-h-0 min-w-0
            flex-col overflow-hidden
            rounded-2xl
            border border-slate-200/90
            bg-white
            shadow-2xl
            dark:border-slate-700
            dark:bg-slate-900

            sm:inset-auto
            sm:bottom-6
            sm:right-6
            sm:h-[min(520px,calc(100dvh-4.5rem))]
            sm:w-[min(680px,calc(100vw-3rem))]
          "
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <FiMessageCircle
                  size={20}
                  aria-hidden="true"
                />

                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 bg-emerald-500 dark:border-slate-900"
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white sm:text-[15px]">
                  WELLJOB Messenger
                </h2>

                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Private and group conversations
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
              }}
              aria-label="Close Messenger window"
              title="Close Messenger"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <FiX
                size={19}
                aria-hidden="true"
              />
            </button>
          </header>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-900">
            <Suspense
              fallback={
                <div
                  className="flex h-full items-center justify-center p-6 text-sm font-medium text-slate-500 dark:text-slate-400"
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