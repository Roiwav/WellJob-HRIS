import { useEffect } from "react";

import {
  FiActivity,
  FiChevronRight,
  FiClock,
  FiMousePointer,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import welljobLogo from "../../assets/welljob.png";

export default function WelljobStandbyScreen({
  mode = "idle",
  onDismiss,
  autoDismissMs = 0,
}) {
  const isIntro = mode === "intro";

  useEffect(() => {
    if (
      !isIntro ||
      !autoDismissMs ||
      autoDismissMs <= 0
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onDismiss?.();
    }, autoDismissMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    autoDismissMs,
    isIntro,
    onDismiss,
  ]);

  useEffect(() => {
    if (!isIntro) {
      return undefined;
    }

    const handleEnterKey = (event) => {
      if (
        event.key !== "Enter" ||
        event.repeat
      ) {
        return;
      }

      const target = event.target;

      const isInteractiveTarget =
        target instanceof HTMLElement &&
        Boolean(
          target.closest(
            "button, a, input, textarea, select, [contenteditable='true']"
          )
        );

      if (isInteractiveTarget) {
        return;
      }

      event.preventDefault();
      onDismiss?.();
    };

    window.addEventListener(
      "keydown",
      handleEnterKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEnterKey
      );
    };
  }, [
    isIntro,
    onDismiss,
  ]);

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#020817] text-white"
      role="presentation"
      onClick={
        isIntro
          ? undefined
          : onDismiss
      }
    >
      <style>{`
        @keyframes welljob-ring-clockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes welljob-ring-counter {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes welljob-soft-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -8px, 0); }
        }

        @keyframes welljob-grid-shift {
          from { background-position: 0 0; }
          to { background-position: 52px 52px; }
        }

        @keyframes welljob-pulse-glow {
          0%, 100% {
            opacity: .55;
            transform: scale(.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.12);
          }
        }

        @keyframes welljob-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @keyframes welljob-sheen {
          0% {
            transform: translateX(-150%);
            opacity: 0;
          }
          25% { opacity: .55; }
          75% { opacity: .55; }
          100% {
            transform: translateX(150%);
            opacity: 0;
          }
        }

        @keyframes welljob-horizon {
          0%, 100% {
            opacity: .45;
            transform: translateX(-2%) scaleX(.98);
          }
          50% {
            opacity: .9;
            transform: translateX(2%) scaleX(1.02);
          }
        }

        @keyframes welljob-star-pulse {
          0%, 100% { opacity: .2; }
          50% { opacity: .9; }
        }

        .welljob-grid {
          background-image:
            linear-gradient(rgba(56,189,248,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.055) 1px, transparent 1px);
          background-size: 52px 52px;
          animation: welljob-grid-shift 34s linear infinite;
        }

        .welljob-ring-cyan {
          animation: welljob-ring-clockwise 10s linear infinite;
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .welljob-ring-violet {
          animation: welljob-ring-counter 15s linear infinite;
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .welljob-ring-dots {
          animation: welljob-ring-clockwise 21s linear infinite;
          transform-origin: 50% 50%;
          will-change: transform;
        }

        .welljob-logo-float {
          animation: welljob-soft-float 5s ease-in-out infinite;
        }

        .welljob-sheen {
          animation: welljob-sheen 4.8s ease-in-out infinite;
        }

        .welljob-pulse {
          animation: welljob-pulse-glow 2.4s ease-in-out infinite;
        }

        .welljob-horizon {
          animation: welljob-horizon 6s ease-in-out infinite;
        }

        .welljob-star {
          animation: welljob-star-pulse 3.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .welljob-grid,
          .welljob-logo-float,
          .welljob-sheen,
          .welljob-horizon,
          .welljob-star {
            animation: none !important;
          }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(79,70,229,0.30),transparent_28%),radial-gradient(circle_at_83%_16%,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_83%_84%,rgba(124,58,237,0.24),transparent_32%)]" />

      <div className="welljob-grid absolute inset-0 opacity-90" />

      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-blue-950/35 via-indigo-950/10 to-transparent" />

      <div className="welljob-horizon absolute -bottom-8 left-[-10%] h-20 w-[120%] rounded-[50%] border-t border-cyan-400/45 shadow-[0_-8px_34px_rgba(34,211,238,0.18)]" />

      <div className="welljob-horizon absolute -bottom-14 left-[-8%] h-20 w-[116%] rounded-[50%] border-t border-violet-400/35 shadow-[0_-6px_30px_rgba(139,92,246,0.15)] [animation-delay:-2s]" />

      <span className="welljob-star absolute left-[7%] top-[22%] h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.95)]" />
      <span className="welljob-star absolute left-[47%] top-[14%] h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_12px_rgba(165,180,252,0.95)] [animation-delay:-1.2s]" />
      <span className="welljob-star absolute right-[7%] top-[30%] h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.95)] [animation-delay:-2.4s]" />
      <span className="welljob-star absolute bottom-[18%] left-[32%] h-1 w-1 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.95)] [animation-delay:-.8s]" />

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-400/20 bg-slate-950/80 p-1.5 shadow-[0_0_24px_rgba(59,130,246,0.16)] backdrop-blur">
              <img
                src={welljobLogo}
                alt="Welljob Solutions"
                className="h-full w-full object-contain"
                draggable="false"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-wide text-white sm:text-base">
                WELLJOB SOLUTIONS
              </p>

              <p className="truncate text-[9px] font-bold uppercase tracking-[0.28em] text-slate-400 sm:text-[10px]">
                Human Resource Information System
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-1.5 text-[11px] font-semibold text-slate-200 shadow-[0_0_20px_rgba(34,211,238,0.08)] backdrop-blur sm:flex">
            <span className="welljob-pulse h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]" />

            {isIntro
              ? "System Ready"
              : "Standby Mode"}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-6 pt-1 sm:px-8 lg:px-12">
          <div className="mx-auto grid w-full max-w-[1380px] items-center gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(440px,1.12fr)] lg:gap-8 xl:gap-10">
            <section className="order-2 flex flex-col justify-center text-center lg:order-1 lg:min-h-[420px] lg:text-left">
              <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80 lg:justify-start">
                <span>People</span>
                <span className="text-slate-600">•</span>
                <span>Deployment</span>
                <span className="text-slate-600">•</span>
                <span>Compliance</span>
                <span className="text-slate-600">•</span>
                <span>Growth</span>
              </div>

              <div className="mb-5 h-px w-full max-w-[540px] bg-gradient-to-r from-sky-400/70 via-indigo-400/30 to-transparent lg:mx-0" />

              <div className="mb-4 inline-flex items-center justify-center gap-2 self-center rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200 lg:self-start">
                {isIntro ? (
                  <>
                    <FiActivity aria-hidden="true" />
                    Integrated Workforce Operations
                  </>
                ) : (
                  <>
                    <FiClock aria-hidden="true" />
                    System on Standby
                  </>
                )}
              </div>

              <h1 className="text-[clamp(2.8rem,5vw,5.45rem)] font-extrabold leading-[0.9] tracking-[-0.05em] text-white">
                WELLJOB

                <span className="mt-1 block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
                  SOLUTIONS HRIS
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-[640px] text-sm leading-6 text-slate-300 sm:text-[15px] lg:mx-0 lg:max-w-[590px]">
                {isIntro
                  ? "A centralized platform for workforce records, deployment monitoring, incident management, compliance, and HR decision support."
                  : "Your current workspace is preserved. Move the mouse, press any key, click, touch, or scroll to continue exactly where you left off."}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:justify-start">
                <span>Centralized Records</span>
                <span className="text-cyan-500/50">•</span>
                <span>Secure Access</span>
                <span className="text-violet-500/50">•</span>
                <span>Decision Support</span>
              </div>

              {isIntro ? (
                <div className="mt-7">
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="group inline-flex min-h-11 items-center justify-center gap-3 rounded-xl border border-white/70 bg-white px-6 py-2.5 text-sm font-extrabold text-slate-950 shadow-[0_0_30px_rgba(96,165,250,0.20)] transition hover:-translate-y-0.5 hover:bg-sky-50 hover:shadow-[0_0_38px_rgba(96,165,250,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Enter HRIS

                    <FiChevronRight
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>

                  <p className="mt-2.5 text-[11px] text-slate-500">
                    Ready when you are.
                  </p>
                </div>
              ) : (
                <div className="mt-7 inline-flex items-center gap-3 self-center rounded-xl border border-cyan-400/15 bg-slate-950/45 px-4 py-3 text-left shadow-[0_10px_30px_rgba(2,8,23,0.18)] backdrop-blur lg:self-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                    <FiMousePointer aria-hidden="true" />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white">
                      Resume your workspace
                    </p>

                    <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                      Any mouse, keyboard, touch, click, or scroll activity will restore your screen.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="order-1 flex justify-center lg:order-2">
              <div className="relative h-[340px] w-[340px] sm:h-[400px] sm:w-[400px] xl:h-[455px] xl:w-[455px]">
                <div className="absolute inset-[4%] rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="welljob-ring-dots absolute inset-[2%] rounded-full border border-dotted border-indigo-300/20">
                  <span className="absolute left-[18%] top-[2%] h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_12px_rgba(165,180,252,0.95)]" />
                  <span className="absolute bottom-[8%] right-[17%] h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.95)]" />
                  <span className="absolute right-[1%] top-[48%] h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.95)]" />
                </div>

                <div
                  className="welljob-ring-cyan absolute inset-[8%] rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 12deg, transparent 0deg 32deg, rgba(34,211,238,.95) 32deg 82deg, transparent 82deg 178deg, rgba(56,189,248,.72) 178deg 218deg, transparent 218deg 360deg)",
                    WebkitMask:
                      "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                    mask:
                      "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                  }}
                >
                  <span className="absolute left-1/2 top-[-5px] h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(34,211,238,1),0_0_38px_rgba(34,211,238,.5)]" />
                </div>

                <div
                  className="welljob-ring-violet absolute inset-[14%] rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 180deg, transparent 0deg 55deg, rgba(168,85,247,.90) 55deg 118deg, transparent 118deg 222deg, rgba(217,70,239,.72) 222deg 270deg, transparent 270deg 360deg)",
                    WebkitMask:
                      "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                    mask:
                      "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                  }}
                >
                  <span className="absolute bottom-[-4px] left-[24%] h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_20px_rgba(232,121,249,1),0_0_34px_rgba(168,85,247,.5)]" />
                </div>

                <div className="absolute inset-[20%] rounded-full border border-blue-400/20 shadow-[0_0_42px_rgba(59,130,246,0.08)]" />

                <div className="welljob-logo-float absolute left-1/2 top-1/2 flex h-[142px] w-[205px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[26px] border border-blue-400/35 bg-[#030817]/95 p-3 shadow-[0_0_28px_rgba(59,130,246,0.25),0_0_72px_rgba(79,70,229,0.16)] sm:h-[164px] sm:w-[238px] xl:h-[184px] xl:w-[266px]">
                  <div className="welljob-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <img
                    src={welljobLogo}
                    alt="Welljob Solutions"
                    className="relative z-10 h-full w-full object-contain"
                    draggable="false"
                  />
                </div>

                <div className="absolute left-[1%] top-[29%] z-20 inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-slate-950/90 px-3 py-2 text-[10px] font-extrabold text-slate-200 shadow-[0_0_22px_rgba(34,211,238,0.12)] backdrop-blur">
                  <FiUsers
                    className="text-cyan-300"
                    aria-hidden="true"
                  />
                  Workforce
                </div>

                <div className="absolute bottom-[19%] right-[-1%] z-20 inline-flex items-center gap-2 rounded-xl border border-violet-400/35 bg-slate-950/90 px-3 py-2 text-[10px] font-extrabold text-slate-200 shadow-[0_0_22px_rgba(168,85,247,0.14)] backdrop-blur">
                  <FiSettings
                    className="text-violet-300"
                    aria-hidden="true"
                  />
                  Operations
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="px-5 pb-4 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-[1380px] flex-col gap-2 border-t border-white/[0.07] pt-3 text-[9px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              WELLJOB Solutions &amp; General Services Inc.
            </span>

            <span>
              Workforce Operations • Compliance • Decision Support
            </span>
          </div>

          {isIntro &&
            autoDismissMs > 0 && (
              <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                  style={{
                    animation: `welljob-progress ${Math.max(
                      autoDismissMs,
                      1000
                    )}ms ease-out forwards`,
                    transformOrigin: "left center",
                  }}
                />
              </div>
            )}
        </footer>
      </div>
    </div>
  );
}