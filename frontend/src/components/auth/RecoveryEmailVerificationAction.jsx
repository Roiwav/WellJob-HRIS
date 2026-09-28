import {
  useEffect,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";

import {
  API_BASE,
} from "../../config/api";

const STATUS_URL =
  `${API_BASE}/auth/recovery-email-status`;

const REQUEST_URL =
  `${API_BASE}/auth/request-email-verification`;

function getLoginToken() {
  return String(
    localStorage.getItem("token") || ""
  ).trim();
}

function StatusBadge({
  status,
}) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <FiLoader
          className="animate-spin"
          aria-hidden="true"
        />
        Checking
      </span>
    );
  }

  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <FiCheckCircle aria-hidden="true" />
        Verified
      </span>
    );
  }

  if (status === "requested") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <FiSend aria-hidden="true" />
        Sent
      </span>
    );
  }

  if (status === "unregistered") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <FiAlertCircle aria-hidden="true" />
        Not Registered
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold text-red-700 dark:bg-red-500/15 dark:text-red-300">
        <FiAlertCircle aria-hidden="true" />
        Unavailable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      <FiAlertCircle aria-hidden="true" />
      Not Verified
    </span>
  );
}

export default function RecoveryEmailVerificationAction() {
  const [
    status,
    setStatus,
  ] = useState("loading");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  useEffect(() => {
    const controller =
      new AbortController();

    const loadRecoveryEmailStatus =
      async () => {
        setStatus("loading");
        setMessage("");
        setError("");

        const token =
          getLoginToken();

        if (!token) {
          setStatus("error");

          setError(
            "Your login session is unavailable. Please sign in again."
          );

          return;
        }

        try {
          const response =
            await fetch(
              STATUS_URL,
              {
                method: "GET",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",

                signal:
                  controller.signal,
              }
            );

          const data =
            await response
              .json()
              .catch(() => null);

          if (!response.ok) {
            if (
              response.status === 401
            ) {
              throw new Error(
                "Your login session has expired. Please sign in again."
              );
            }

            if (
              response.status === 403
            ) {
              throw new Error(
                "An active WELLJOB HRIS account is required."
              );
            }

            throw new Error(
              data?.message ||
                "Unable to load recovery email status."
            );
          }

          if (
            typeof data?.registered !==
              "boolean" ||
            typeof data?.verified !==
              "boolean"
          ) {
            throw new Error(
              "Unable to read recovery email status. Please try again."
            );
          }

          if (data.verified) {
            setStatus(
              "verified"
            );

            setMessage(
              "Your registered recovery email is verified and ready for account recovery."
            );

            return;
          }

          if (
            !data.registered
          ) {
            setStatus(
              "unregistered"
            );

            setMessage(
              "No recovery email is registered for your account. Please contact your Super Admin."
            );

            return;
          }

          setStatus(
            "unverified"
          );
        } catch (
          requestError
        ) {
          if (
            controller.signal
              .aborted
          ) {
            return;
          }

          setStatus(
            "error"
          );

          setError(
            requestError?.message ||
              "Unable to load recovery email status."
          );
        }
      };

    void loadRecoveryEmailStatus();

    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  const handleRequestVerification =
    async () => {
      if (
        isSubmitting ||
        status !== "unverified"
      ) {
        return;
      }

      setMessage("");
      setError("");

      const token =
        getLoginToken();

      if (!token) {
        setStatus(
          "error"
        );

        setError(
          "Your login session is unavailable. Please sign in again."
        );

        return;
      }

      setIsSubmitting(
        true
      );

      try {
        const response =
          await fetch(
            REQUEST_URL,
            {
              method:
                "POST",

              headers: {
                Accept:
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          if (
            response.status ===
              400 &&
            /no recovery email/i.test(
              String(
                data?.message ||
                  ""
              )
            )
          ) {
            setStatus(
              "unregistered"
            );

            setMessage(
              "No recovery email is registered for your account. Please contact your Super Admin."
            );

            return;
          }

          if (
            response.status === 401
          ) {
            setStatus(
              "error"
            );

            setError(
              "Your login session has expired. Please sign in again."
            );

            return;
          }

          if (
            response.status === 403
          ) {
            setStatus(
              "error"
            );

            setError(
              "An active WELLJOB HRIS account is required."
            );

            return;
          }

          if (
            response.status === 429
          ) {
            setError(
              "Please wait before requesting another verification email."
            );

            return;
          }

          if (
            response.status === 503
          ) {
            setError(
              "Verification email is temporarily unavailable. Please try again later."
            );

            return;
          }

          setError(
            data?.message ||
              "Unable to request email verification. Please try again."
          );

          return;
        }

        if (
          /already verified/i.test(
            String(
              data?.message ||
                ""
            )
          )
        ) {
          setStatus(
            "verified"
          );

          setMessage(
            "Your registered recovery email is already verified."
          );

          return;
        }

        setStatus(
          "requested"
        );

        setMessage(
          "Verification email sent. Check your inbox and spam folder, then open the verification link."
        );
      } catch {
        setError(
          "Network error. Check your connection and try again."
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  const handleRetry =
    () => {
      if (
        isSubmitting
      ) {
        return;
      }

      setStatus(
        "loading"
      );

      setRefreshKey(
        (current) =>
          current + 1
      );
    };

  const isLoading =
    status === "loading";

  const isVerified =
    status === "verified";

  const isUnregistered =
    status === "unregistered";

  const isRequested =
    status === "requested";

  const isError =
    status === "error";

  const canRequest =
    status === "unverified" &&
    !isSubmitting;

  const isBusy =
    isLoading ||
    isSubmitting;

  return (
    <div className="space-y-4">
      <div
        className={[
          "rounded-2xl border p-4 transition-colors sm:p-5",

          isVerified
            ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
            : isError
              ? "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20"
              : isUnregistered
                ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",

              isVerified
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : isError
                  ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : isUnregistered
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
            ].join(" ")}
          >
            {isBusy ? (
              <FiLoader
                className="animate-spin"
                size={19}
                aria-hidden="true"
              />
            ) : isVerified ? (
              <FiCheckCircle
                size={19}
                aria-hidden="true"
              />
            ) : isError ||
              isUnregistered ? (
              <FiAlertCircle
                size={19}
                aria-hidden="true"
              />
            ) : (
              <FiMail
                size={19}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Recovery Email Status
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Used to verify your identity during account recovery.
                </p>
              </div>

              <StatusBadge
                status={
                  isSubmitting
                    ? "loading"
                    : status
                }
              />
            </div>

            {status ===
              "unverified" && (
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Your recovery email is registered but still needs verification.
                Send a secure verification link to complete setup.
              </p>
            )}

            {isRequested && (
              <p
                role="status"
                className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
              >
                {message}
              </p>
            )}

            {isVerified &&
              message && (
                <p
                  role="status"
                  className="mt-3 text-sm leading-6 text-emerald-700 dark:text-emerald-300"
                >
                  {message}
                </p>
              )}

            {isUnregistered &&
              message && (
                <p
                  role="status"
                  className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-300"
                >
                  {message}
                </p>
              )}
          </div>
        </div>
      </div>

      {canRequest && (
        <button
          type="button"
          onClick={
            handleRequestVerification
          }
          aria-busy={
            isSubmitting
          }
          className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-left text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <FiMail
                aria-hidden="true"
              />
            </span>

            <span className="min-w-0">
              <span className="block">
                Verify Recovery Email
              </span>

              <span className="mt-0.5 block text-xs font-medium text-indigo-100">
                Send verification link
              </span>
            </span>
          </span>

          <FiArrowRight
            className="shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      )}

      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white"
        >
          <FiLoader
            className="animate-spin"
            aria-hidden="true"
          />

          Sending verification email...
        </div>
      )}

      {isRequested && (
        <button
          type="button"
          onClick={
            handleRetry
          }
          disabled={
            isSubmitting
          }
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FiRefreshCw
            aria-hidden="true"
          />

          Check Verification Status
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <div className="flex items-start gap-2">
            <FiAlertCircle
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {error}
            </span>
          </div>
        </div>
      )}

      {isError && (
        <button
          type="button"
          onClick={
            handleRetry
          }
          disabled={
            isSubmitting
          }
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FiRefreshCw
            aria-hidden="true"
          />

          Retry Status Check
        </button>
      )}
    </div>
  );
}