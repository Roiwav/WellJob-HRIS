import {
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { API_BASE } from "../config/api";
import authenticatedFetch from "../utils/authenticatedFetch";

/*
 * The raw one-time handoff token is carried only in
 * the URL fragment:
 *
 *   /mobile-handoff#<token>
 *
 * Browser URL fragments are not sent to Vercel or the
 * backend as part of the HTTP request. The token is
 * submitted to the API only after the authenticated HR
 * Staff user explicitly activates the handoff.
 */
const HANDOFF_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

const MOBILE_HANDOFF_SESSION_KEY =
  "welljob_employee_mobile_handoff";

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

function getFriendlyResolveMessage(
  status,
  data
) {
  const backendMessage =
    getResponseMessage(
      data,
      ""
    );

  if (backendMessage) {
    return backendMessage;
  }

  switch (status) {
    case 400:
      return "This mobile handoff link is invalid.";

    case 403:
      return "This mobile handoff belongs to a different WELLJOB account.";

    case 404:
      return "This mobile handoff is invalid or no longer available.";

    case 409:
      return "This mobile handoff can no longer be activated.";

    case 410:
      return "This mobile handoff has expired or has already been used.";

    default:
      return "Unable to activate the mobile document handoff. Please try again.";
  }
}

function saveResolvedHandoff(
  employeeId,
  purpose
) {
  try {
    sessionStorage.setItem(
      MOBILE_HANDOFF_SESSION_KEY,
      JSON.stringify({
        employeeId,
        purpose,
        openCompliance: true,
        resolvedAt:
          Date.now(),
      })
    );
  } catch (error) {
    console.warn(
      "Unable to persist mobile handoff state:",
      error
    );
  }
}

export default function EmployeeMobileHandoff() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const token =
    useMemo(
      () => {
        const rawHash =
          String(
            location.hash || ""
          ).trim();

        if (
          !rawHash.startsWith(
            "#"
          )
        ) {
          return "";
        }

        return rawHash
          .slice(1)
          .trim();
      },
      [
        location.hash,
      ]
    );

  const tokenLooksValid =
    HANDOFF_TOKEN_PATTERN.test(
      token
    );

  const [
    isActivating,
    setIsActivating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(
    tokenLooksValid
      ? ""
      : "This mobile handoff link is invalid."
  );

  const handleActivate =
    async () => {
      if (
        isActivating ||
        !tokenLooksValid
      ) {
        return;
      }

      setError("");
      setIsActivating(true);

      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/employee-mobile-handoffs/resolve`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },

              body:
                JSON.stringify({
                  token,
                }),
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
          setError(
            getFriendlyResolveMessage(
              response.status,
              data
            )
          );

          return;
        }

        const employeeId =
          Number(
            data
              ?.employee
              ?.id
          );

        if (
          !Number.isSafeInteger(
            employeeId
          ) ||
          employeeId <= 0
        ) {
          setError(
            "The mobile handoff was activated, but the employee record could not be identified. Generate a new QR code from the desktop."
          );

          return;
        }

        const purpose =
          String(
            data?.purpose ||
              "EMPLOYEE_DOCUMENT_CAPTURE"
          ).trim();

        saveResolvedHandoff(
          employeeId,
          purpose
        );

        /*
         * Replace the handoff route after successful
         * activation. This also removes the raw token
         * fragment from the browser address/history
         * entry before the employee document workflow
         * continues.
         */
        navigate(
          "/employees",
          {
            replace:
              true,

            state: {
              mobileDocumentHandoff: {
                employeeId,
                purpose,
                openCompliance:
                  true,
                resolvedAt:
                  Date.now(),
              },
            },
          }
        );
      } catch (activationError) {
        console.error(
          "Employee mobile handoff activation failed:",
          activationError
        );

        setError(
          "Network error. Check your connection and try again."
        );
      } finally {
        setIsActivating(
          false
        );
      }
    };

  const handleBackToEmployees =
    () => {
      if (
        isActivating
      ) {
        return;
      }

      navigate(
        "/employees",
        {
          replace:
            true,
        }
      );
    };

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-xl items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="border-b border-white/10 bg-gradient-to-br from-indigo-600/20 via-slate-900 to-cyan-500/10 px-5 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20">
                <Smartphone
                  size={24}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                  Secure Mobile Handoff
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Continue employee documents on this phone
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Activate the temporary handoff, then continue to the employee compliance documents for camera capture or file upload.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-7 sm:py-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <SecurityItem
                icon={
                  <ShieldCheck
                    size={18}
                    aria-hidden="true"
                  />
                }
                title="Account-bound"
                description="Only the HR Staff account that created the QR can use it."
              />

              <SecurityItem
                icon={
                  <LockKeyhole
                    size={18}
                    aria-hidden="true"
                  />
                }
                title="Short-lived"
                description="The handoff expires automatically after a short period."
              />

              <SecurityItem
                icon={
                  <Camera
                    size={18}
                    aria-hidden="true"
                  />
                }
                title="One-time"
                description="After activation, the QR cannot be used again."
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <TriangleAlert
                    className="mt-0.5 shrink-0 text-red-300"
                    size={20}
                    aria-hidden="true"
                  />

                  <div>
                    <p className="font-extrabold text-red-200">
                      Handoff unavailable
                    </p>

                    <p className="mt-1 text-sm leading-6 text-red-100/80">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-300"
                    size={20}
                    aria-hidden="true"
                  />

                  <div>
                    <p className="font-extrabold text-emerald-200">
                      Ready to continue
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-100/80">
                      Your QR link is ready for secure activation. The token itself is not displayed on this screen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 px-4 py-3">
              <p className="text-xs leading-5 text-amber-100/85">
                For security, activation happens only when you tap the button below. This prevents accidental one-time use caused by browser previews or automatic page loading.
              </p>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={
                  handleActivate
                }
                disabled={
                  isActivating ||
                  !tokenLooksValid
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-950/30 transition hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivating ? (
                  <>
                    <LoaderCircle
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    Activating...
                  </>
                ) : error ? (
                  <>
                    <RefreshCw
                      size={18}
                      aria-hidden="true"
                    />
                    Try Activation Again
                  </>
                ) : (
                  <>
                    <Camera
                      size={18}
                      aria-hidden="true"
                    />
                    Continue to Employee Documents
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={
                  handleBackToEmployees
                }
                disabled={
                  isActivating
                }
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft
                  size={17}
                  aria-hidden="true"
                />
                Back to Employees
              </button>
            </div>

            <p className="text-center text-[11px] leading-5 text-slate-500">
              WELLJOB employee compliance documents remain protected by your authenticated HR Staff session and the existing private document-storage controls.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SecurityItem({
  icon,
  title,
  description,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-cyan-300">
        {icon}
      </div>

      <p className="mt-3 text-sm font-extrabold text-white">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}