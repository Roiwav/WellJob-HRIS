import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiClock,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiX,
} from "react-icons/fi";

import {
  QRCodeSVG,
} from "qrcode.react";

import { API_BASE } from "../../config/api";
import authenticatedFetch from "../../utils/authenticatedFetch";

const DEFAULT_EXPIRY_SECONDS =
  15 * 60;

function normalizePositiveInteger(
  value
) {
  const parsed =
    Number(
      value
    );

  return (
    Number.isSafeInteger(
      parsed
    ) &&
    parsed > 0
  )
    ? parsed
    : null;
}

function getResponseMessage(
  data,
  fallback
) {
  if (
    typeof data === "string" &&
    data.trim()
  ) {
    return data.trim();
  }

  return String(
    data?.error ||
      data?.message ||
      fallback ||
      ""
  ).trim();
}

function formatRemainingTime(
  totalSeconds
) {
  const safeSeconds =
    Math.max(
      Number(
        totalSeconds ||
          0
      ),
      0
    );

  const minutes =
    Math.floor(
      safeSeconds /
        60
    );

  const seconds =
    safeSeconds %
    60;

  return `${minutes}:${String(
    seconds
  ).padStart(
    2,
    "0"
  )}`;
}

export default function EmployeeMobileHandoffPanel({
  employeeId,
  employeeName = "",
  disabled = false,
}) {
  const normalizedEmployeeId =
    normalizePositiveInteger(
      employeeId
    );

  const [
    handoff,
    setHandoff,
  ] =
    useState(null);

  const [
    isGenerating,
    setIsGenerating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] =
    useState(0);

  const handoffUrl =
    useMemo(
      () => {
        const token =
          String(
            handoff?.token ||
              ""
          ).trim();

        if (
          !token ||
          typeof window ===
            "undefined"
        ) {
          return "";
        }

        const handoffUrl =
          new URL(
            "/mobile-handoff",
            window.location.origin
          );

        /*
         * Keep the raw one-time token in the URL
         * fragment. Browsers do not send fragments to
         * Vercel/the web server in the HTTP request.
         */
        handoffUrl.hash =
          token;

        return handoffUrl.toString();
      },
      [
        handoff,
      ]
    );

  useEffect(
    () => {
      if (
        !handoff ||
        remainingSeconds <=
          0
      ) {
        return undefined;
      }

      const timer =
        window.setInterval(
          () => {
            setRemainingSeconds(
              (
                current
              ) =>
                Math.max(
                  current -
                    1,
                  0
                )
            );
          },
          1000
        );

      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    [
      handoff,
      remainingSeconds,
    ]
  );

  useEffect(
    () => {
      if (
        handoff &&
        remainingSeconds ===
          0
      ) {
        setHandoff(
          null
        );
      }
    },
    [
      handoff,
      remainingSeconds,
    ]
  );

  const handleGenerate =
    async () => {
      if (
        disabled ||
        isGenerating ||
        !normalizedEmployeeId
      ) {
        return;
      }

      setError("");
      setIsGenerating(
        true
      );

      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/employees/${encodeURIComponent(
              normalizedEmployeeId
            )}/mobile-handoff`,
            {
              method:
                "POST",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok
        ) {
          setHandoff(
            null
          );

          setRemainingSeconds(
            0
          );

          setError(
            getResponseMessage(
              data,
              "Unable to create a secure mobile handoff."
            )
          );

          return;
        }

        const token =
          String(
            data?.token ||
              ""
          ).trim();

        if (!token) {
          throw new Error(
            "The server did not return a mobile handoff token."
          );
        }

        const expiresInSeconds =
          normalizePositiveInteger(
            data?.expiresInSeconds
          ) ||
          DEFAULT_EXPIRY_SECONDS;

        setHandoff({
          token,
          expiresAt:
            data?.expiresAt ||
            null,
        });

        setRemainingSeconds(
          expiresInSeconds
        );
      } catch (generationError) {
        console.error(
          "Create employee mobile handoff failed:",
          generationError
        );

        setHandoff(
          null
        );

        setRemainingSeconds(
          0
        );

        setError(
          "Unable to create the QR code. Check your connection and try again."
        );
      } finally {
        setIsGenerating(
          false
        );
      }
    };

  const handleClear =
    () => {
      if (
        isGenerating
      ) {
        return;
      }

      /*
       * Clearing the screen does not extend or reuse
       * the token. It will expire automatically.
       * Generating a new QR revokes the prior live
       * handoff on the backend.
       */
      setHandoff(
        null
      );

      setRemainingSeconds(
        0
      );

      setError(
        ""
      );
    };

  return (
    <section className="hidden overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 shadow-sm dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-slate-900 dark:to-cyan-500/5 md:block">
      <div className="flex items-start justify-between gap-4 border-b border-indigo-100 px-5 py-4 dark:border-indigo-500/15">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <FiSmartphone
              size={20}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900 dark:text-white">
              Continue Documents on Phone
            </h3>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-400">
              Scan a temporary QR code with your phone to continue this employee&apos;s compliance documents using the camera.
            </p>
          </div>
        </div>

        {handoff && (
          <button
            type="button"
            onClick={
              handleClear
            }
            disabled={
              isGenerating
            }
            aria-label="Close mobile handoff QR code"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <FiX
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="p-5">
        {!handoff ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <FiShield
                  className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300"
                  aria-hidden="true"
                />

                <p className="leading-6">
                  The QR is temporary, one-time use, and tied to the same HR Staff account.
                </p>
              </div>

              {employeeName && (
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Employee: {employeeName}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  {error}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={
                handleGenerate
              }
              disabled={
                disabled ||
                isGenerating ||
                !normalizedEmployeeId
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSmartphone
                aria-hidden="true"
              />

              {isGenerating
                ? "Generating..."
                : "Show QR Code"}
            </button>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {handoffUrl ? (
                <QRCodeSVG
                  value={
                    handoffUrl
                  }
                  size={190}
                  level="M"
                  marginSize={1}
                  title="Secure WELLJOB mobile document handoff QR code"
                />
              ) : (
                <div className="flex h-[190px] w-[190px] items-center justify-center text-center text-xs font-semibold text-red-600">
                  QR code unavailable
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                Scan with your phone camera
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Open the link on your phone, sign in with the same HR Staff account if needed, then tap Continue to Employee Documents.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <FiClock
                  aria-hidden="true"
                />

                Expires in{" "}
                {formatRemainingTime(
                  remainingSeconds
                )}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Generating another QR automatically invalidates the previous unused QR for this employee.
              </p>

              <button
                type="button"
                onClick={
                  handleGenerate
                }
                disabled={
                  disabled ||
                  isGenerating ||
                  !normalizedEmployeeId
                }
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                <FiRefreshCw
                  aria-hidden="true"
                />

                {isGenerating
                  ? "Generating..."
                  : "Generate New QR"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}