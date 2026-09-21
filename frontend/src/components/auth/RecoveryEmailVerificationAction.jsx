import {
  useEffect,
  useState,
} from "react";

import {
  FiCheckCircle,
  FiLoader,
  FiMail,
  FiRefreshCw,
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

  /*
   * Load the actual recovery-email status whenever
   * this component mounts or the user retries.
   *
   * A verified account will immediately display
   * "Recovery Email Verified".
   */
  useEffect(() => {
    const controller = new AbortController();

    const loadRecoveryEmailStatus = async () => {
      setStatus("loading");
      setMessage("");
      setError("");

      const token = getLoginToken();

      if (!token) {
        setStatus("error");

        setError(
          "Your login session is unavailable. Please sign in again."
        );

        return;
      }

      try {
        const response = await fetch(
          STATUS_URL,
          {
            method: "GET",

            headers: {
              Accept: "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            cache: "no-store",

            signal: controller.signal,
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your login session has expired. Please sign in again."
            );
          }

          if (response.status === 403) {
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
          typeof data?.registered !== "boolean" ||
          typeof data?.verified !== "boolean"
        ) {
          throw new Error(
            "Unable to read recovery email status. Please try again."
          );
        }

        if (data.verified) {
          setStatus("verified");

          setMessage(
            "Your registered recovery email is verified."
          );

          return;
        }

        if (!data.registered) {
          setStatus("unregistered");

          setMessage(
            "No recovery email is registered for your account. Please contact your Super Admin."
          );

          return;
        }

        setStatus("unverified");
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setStatus("error");

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

  /*
   * Request a verification email only when the
   * current account has an unverified address.
   */
  const handleRequestVerification = async () => {
    if (
      isSubmitting ||
      status !== "unverified"
    ) {
      return;
    }

    setMessage("");
    setError("");

    const token = getLoginToken();

    if (!token) {
      setStatus("error");

      setError(
        "Your login session is unavailable. Please sign in again."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        REQUEST_URL,
        {
          method: "POST",

          headers: {
            Accept: "application/json",

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        if (
          response.status === 400 &&
          /no recovery email/i.test(
            String(data?.message || "")
          )
        ) {
          setStatus("unregistered");

          setMessage(
            "No recovery email is registered for your account. Please contact your Super Admin."
          );

          return;
        }

        if (response.status === 401) {
          setStatus("error");

          setError(
            "Your login session has expired. Please sign in again."
          );

          return;
        }

        if (response.status === 403) {
          setStatus("error");

          setError(
            "An active WELLJOB HRIS account is required."
          );

          return;
        }

        if (response.status === 429) {
          setError(
            "Please wait before requesting another verification email."
          );

          return;
        }

        if (response.status === 503) {
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
          String(data?.message || "")
        )
      ) {
        setStatus("verified");

        setMessage(
          "Your registered recovery email is already verified."
        );

        return;
      }

      setStatus("requested");

      setMessage(
        "Verification requested. Check your registered recovery email inbox and spam folder for the verification link."
      );
    } catch {
      setError(
        "Network error. Check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (isSubmitting) {
      return;
    }

    setStatus("loading");
    setRefreshKey((current) => current + 1);
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
    isLoading || isSubmitting;

  const buttonLabel = isSubmitting
    ? "Requesting verification..."
    : isLoading
      ? "Checking Recovery Email..."
      : isVerified
        ? "Recovery Email Verified"
        : isUnregistered
          ? "Recovery Email Not Registered"
          : isRequested
            ? "Verification Requested"
            : isError
              ? "Recovery Email Status Unavailable"
              : "Verify Recovery Email";

  return (
    <div className="border-b border-gray-100 px-3 py-3 dark:border-white/10">
      <button
        type="button"
        onClick={handleRequestVerification}
        disabled={!canRequest}
        aria-busy={isBusy}
        className={[
          "flex w-full items-center gap-2 rounded-xl px-2 py-2.5",
          "text-left text-sm font-semibold transition",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
          "disabled:cursor-not-allowed",
          isVerified
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-indigo-600 dark:text-indigo-300",
          canRequest
            ? "hover:bg-indigo-50 dark:hover:bg-white/10"
            : "",
        ].join(" ")}
      >
        {isBusy ? (
          <FiLoader
            className="shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : isVerified ? (
          <FiCheckCircle
            className="shrink-0"
            aria-hidden="true"
          />
        ) : isRequested ? (
          <FiCheckCircle
            className="shrink-0"
            aria-hidden="true"
          />
        ) : isError ? (
          <FiRefreshCw
            className="shrink-0"
            aria-hidden="true"
          />
        ) : (
          <FiMail
            className="shrink-0"
            aria-hidden="true"
          />
        )}

        <span>{buttonLabel}</span>
      </button>

      {status === "unverified" && (
        <p className="px-2 pt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
          A verification link will be sent only to
          the recovery email registered to your account.
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-2 rounded-lg bg-emerald-50 px-2 py-2 text-xs leading-5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 px-2 py-2 text-xs leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {isError && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isSubmitting}
          className="mt-2 flex items-center gap-1.5 px-2 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
        >
          <FiRefreshCw aria-hidden="true" />
          Retry status check
        </button>
      )}
    </div>
  );
}