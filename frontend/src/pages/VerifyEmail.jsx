
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  LoaderCircle,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

import logo from "../assets/logo.png";
import { API_BASE } from "../config/api";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export default function VerifyEmail() {
  /*
   * Capture the verification token from the email link.
   *
   * Do not save it in localStorage or sessionStorage.
   * Do not automatically submit it when the page loads:
   * automated email-link scanners may open the URL.
   */
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    return params.get("token") || "";
  });

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isVerified, setIsVerified] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * Remove the token from the browser's visible URL
   * after capturing it.
   */
  useEffect(() => {
    if (!window.location.search) {
      return;
    }

    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname +
        window.location.hash
    );
  }, []);

  const hasValidTokenFormat =
    TOKEN_PATTERN.test(token);

  const handleVerifyEmail = async () => {
    if (
      isSubmitting ||
      isVerified ||
      !hasValidTokenFormat
    ) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE}/auth/verify-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            "Too many verification attempts. Please wait before trying again."
          );

          return;
        }

        if (response.status === 503) {
          setError(
            "Email verification is temporarily unavailable. Please try again later."
          );

          return;
        }

        if (response.status === 400) {
          setToken("");

          setError(
            "This verification link is invalid, expired, or has already been used. Please sign in and request a new verification email."
          );

          return;
        }

        setError(
          data?.message ||
            "Unable to verify your email. Please try again."
        );

        return;
      }

      /*
       * A successful backend response confirms that
       * the verification token was accepted.
       */
      setIsVerified(true);
      setToken("");
    } catch {
      setError(
        "Network error. Check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <img
            src={logo}
            alt="Welljob Solutions logo"
            className="mx-auto mb-4 h-16 w-16 object-contain"
          />

          <div className="mb-3 flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-300">
            {isVerified ? (
              <BadgeCheck
                size={24}
                aria-hidden="true"
              />
            ) : (
              <MailCheck
                size={24}
                aria-hidden="true"
              />
            )}

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isVerified
                ? "Email Verified"
                : "Verify Your Email"}
            </h1>
          </div>

          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {isVerified
              ? "Your registered recovery email has been verified successfully."
              : "Confirm that you have access to the recovery email registered to your WELLJOB account."}
          </p>
        </div>

        {isVerified ? (
          <div
            role="status"
            className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck
                size={20}
                aria-hidden="true"
              />

              Verification successful
            </div>

            <p>
              Your recovery email is now verified.
              You may use it to request a password-reset
              link while your WELLJOB HRIS account is active.
            </p>
          </div>
        ) : !hasValidTokenFormat ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            This email-verification link is missing or
            invalid. Please sign in and request a new
            verification email.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              Click the button below to confirm that
              you received this verification link
              in your registered email inbox.
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyEmail}
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}

              {isSubmitting
                ? "Verifying your email..."
                : "Verify My Email"}
            </button>
          </div>
        )}

        {error && !hasValidTokenFormat && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus:outline-none focus:underline dark:text-indigo-300"
        >
          Back to Login
        </Link>

        <p className="mt-4 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
          If you did not request this verification,
          please contact your system administrator.
        </p>
      </section>
    </main>
  );
}
