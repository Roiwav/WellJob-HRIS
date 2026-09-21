
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
} from "lucide-react";

import logo from "../assets/logo.png";
import { API_BASE } from "../config/api";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function isValidPassword(value) {
  return (
    typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*()_+]/.test(value)
  );
}

const INPUT_CLASS_NAME =
  "h-11 w-full rounded-xl border border-gray-300 " +
  "bg-white px-4 text-gray-900 outline-none transition " +
  "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-white";

export default function ResetPassword() {
  /*
   * Capture the token from the email link.
   * It is not stored in localStorage or sessionStorage.
   */
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    return params.get("token") || "";
  });

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  /*
   * Remove the token from the visible browser URL
   * after the page has captured it.
   *
   * Do not place the token in logs or analytics.
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
    /^[a-f0-9]{64}$/i.test(token);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || success) {
      return;
    }

    setError("");

    if (!hasValidTokenFormat) {
      setError(
        "This password-reset link is invalid. Please request a new link."
      );

      return;
    }

    if (!isValidPassword(newPassword)) {
      setError(
        "Password must be 8–128 characters long and include uppercase, lowercase, number, and a special character (!@#$%^&*()_+)."
      );

      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "The passwords do not match."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        API_BASE + "/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            token,
            newPassword,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            "Too many attempts. Please wait before trying again."
          );

          return;
        }

        if (response.status === 503) {
          setError(
            "The system is temporarily unavailable. Please try again later."
          );

          return;
        }

        setError(
          data?.message ||
            "Unable to reset your password. Please request a new link."
        );

        return;
      }

      /*
       * Successful reset:
       * discard the token and clear password fields.
       * The backend invalidates previous JWT sessions.
       */
      setToken("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccess(
        "Your password has been updated successfully. Please sign in using your new password."
      );
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
            <KeyRound
              size={21}
              aria-hidden="true"
            />

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reset Password
            </h1>
          </div>

          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            Create a new password for your WELLJOB account.
          </p>
        </div>

        {success ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            {success}
          </div>
        ) : !hasValidTokenFormat ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            This password-reset link is missing or invalid.
            Please request a new link from the Login page.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                New Password
              </label>

              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  disabled={isSubmitting}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError("");
                  }}
                  className={INPUT_CLASS_NAME + " pr-12"}
                />

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide new password"
                      : "Show new password"
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Confirm New Password
              </label>

              <div className="relative">
                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  disabled={isSubmitting}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                  className={INPUT_CLASS_NAME + " pr-12"}
                />

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setShowConfirmPassword(
                      (current) => !current
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              Use 8–128 characters with uppercase and lowercase
              letters, a number, and a special character:
              {" !@#$%^&*()_+"}
            </p>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !newPassword ||
                !confirmPassword
              }
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}

              {isSubmitting
                ? "Updating password..."
                : "Set New Password"}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}