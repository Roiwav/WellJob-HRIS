import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  HelpCircle,
  LoaderCircle,
  Moon,
  Sun,
} from "lucide-react";

import logo from "../assets/logo.png";
import { useAuth } from "../context/useAuth";
import Dialog from "../components/ui/Dialog";
import useTheme from "../hooks/useTheme";
import { API_BASE } from "../config/api";

const GENERIC_RECOVERY_MESSAGE =
  "If the submitted details are eligible for recovery, a password-reset link may be sent to the account's verified recovery email.";

const RECOVERY_INPUT_CLASS =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-white";

const RECOVERY_LABEL_CLASS =
  "block text-sm font-semibold text-gray-700 dark:text-gray-200";

function normalizeIdentityInput(value) {
  return value.trim().replace(/\s+/g, " ");
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [forgotPasswordOpen, setForgotPasswordOpen] =
    useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryUsername, setRecoveryUsername] =
    useState("");
  const [recoveryFullName, setRecoveryFullName] =
    useState("");

  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryMessage, setRecoveryMessage] =
    useState("");

  const [isRequestingRecovery, setIsRequestingRecovery] =
    useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(
          data.message ||
            (response.status >= 500
              ? "The server is currently unavailable. Please try again."
              : "Invalid username or password.")
        );

        return;
      }

      const token = String(data.token || "").trim();

      if (!token) {
        console.error(
          "Login response did not contain an authentication token."
        );

        setError(
          "Login succeeded, but the authentication session could not be created. Please try again."
        );

        return;
      }

      if (!data.user || typeof data.user !== "object") {
        console.error(
          "Login response did not contain a valid user object."
        );

        setError(
          "Login succeeded, but the user session could not be initialized. Please try again."
        );

        return;
      }

      const normalizedUser = {
        ...data.user,
        mustChangePassword:
          data.user?.mustChangePassword === true ||
          data.user?.mustChangePassword === 1 ||
          data.user?.mustChangePassword === "1" ||
          data.user?.must_change_password === true ||
          data.user?.must_change_password === 1 ||
          data.user?.must_change_password === "1",
      };

      // Preserve the existing session storage behavior.
      localStorage.setItem("token", token);

      localStorage.setItem(
        "user",
        JSON.stringify(normalizedUser)
      );

      setUser(normalizedUser);

      if (normalizedUser.mustChangePassword) {
        navigate("/change-password", {
          replace: true,
        });

        return;
      }

      const redirectByRole = {
        SUPER_ADMIN: "/",
        HR_MANAGER: "/",
        HR_STAFF: "/employees",
        HR_COORDINATOR: "/employees",
        IT_SUPPORT: "/settings",
      };

      navigate(
        redirectByRole[normalizedUser.role] || "/",
        {
          replace: true,
        }
      );
    } catch (loginError) {
      console.error("Login error:", loginError);

      setError(
        "Network error. Check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  const clearRecoveryForm = () => {
    setRecoveryEmail("");
    setRecoveryUsername("");
    setRecoveryFullName("");
    setRecoveryError("");
    setRecoveryMessage("");
  };

  const openForgotPassword = () => {
    if (isSubmitting) {
      return;
    }

    clearRecoveryForm();
    setForgotPasswordOpen(true);
  };

  const closeForgotPassword = () => {
    if (isRequestingRecovery) {
      return;
    }

    setForgotPasswordOpen(false);
    clearRecoveryForm();
  };

  const handleRequestRecovery = async (event) => {
    event.preventDefault();

    if (isRequestingRecovery || recoveryMessage) {
      return;
    }

    const email = recoveryEmail.trim();

    const recoveryAccountUsername =
      normalizeIdentityInput(recoveryUsername);

    const fullName =
      normalizeIdentityInput(recoveryFullName);

    if (!email) {
      setRecoveryError(
        "Enter your registered recovery email address."
      );

      return;
    }

    if (email.length > 254) {
      setRecoveryError(
        "Recovery email must not exceed 254 characters."
      );

      return;
    }

    if (!recoveryAccountUsername) {
      setRecoveryError(
        "Enter the username of your WELLJOB account."
      );

      return;
    }

    if (recoveryAccountUsername.length > 150) {
      setRecoveryError(
        "Username must not exceed 150 characters."
      );

      return;
    }

    if (!fullName) {
      setRecoveryError(
        "Enter the full name registered to your WELLJOB account."
      );

      return;
    }

    if (fullName.length > 150) {
      setRecoveryError(
        "Full name must not exceed 150 characters."
      );

      return;
    }

    setRecoveryError("");
    setIsRequestingRecovery(true);

    try {
      const response = await fetch(
        `${API_BASE}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email,
            username: recoveryAccountUsername,
            fullName,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          setRecoveryError(
            "Too many recovery requests. Please wait and try again later."
          );

          return;
        }

        if (response.status === 503) {
          setRecoveryError(
            "Password recovery is temporarily unavailable. Please try again later."
          );

          return;
        }

        setRecoveryError(
          data?.message ||
            "Unable to process your request right now. Please try again later."
        );

        return;
      }

      /*
       * Do not reveal whether the submitted identity
       * details matched an existing account.
       *
       * The backend will be updated separately to
       * require all three fields before creating
       * a pending approval request.
       */
      setRecoveryMessage(
        GENERIC_RECOVERY_MESSAGE
      );

      setRecoveryEmail("");
      setRecoveryUsername("");
      setRecoveryFullName("");
    } catch {
      setRecoveryError(
        "Network error. Check your connection and try again."
      );
    } finally {
      setIsRequestingRecovery(false);
    }
  };

  const recoveryFormIncomplete =
    !recoveryEmail.trim() ||
    !recoveryUsername.trim() ||
    !recoveryFullName.trim();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-900">
      <header className="border-b border-gray-200 bg-white/80 px-6 py-4 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Welljob Solutions logo"
              className="h-9 w-9 shrink-0 object-contain"
            />

            <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg dark:text-white">
              Welljob Solutions &amp; General Services
            </h1>
          </div>

          <span className="hidden text-xs font-medium text-gray-500 sm:block dark:text-gray-400">
            HR Management System
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-[34rem] w-[34rem] rounded-full bg-gradient-to-r from-blue-200/50 to-indigo-200/50 blur-3xl dark:from-blue-600/20 dark:to-indigo-600/20"
        />

        <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 dark:border-slate-700/60 dark:bg-slate-900/95">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-2 shadow-lg dark:from-blue-600 dark:to-indigo-700">
              <img
                src={logo}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain"
              />
            </div>

            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome Back
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Enter your credentials to access the HR system.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="mt-6 space-y-5"
            noValidate
          >
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={isSubmitting}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  clearError();
                }}
                placeholder="Enter your username"
                className="h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearError();
                  }}
                  onKeyUp={(event) =>
                    setCapsLockOn(
                      event.getModifierState("CapsLock")
                    )
                  }
                  onKeyDown={(event) =>
                    setCapsLockOn(
                      event.getModifierState("CapsLock")
                    )
                  }
                  onBlur={() => setCapsLockOn(false)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-gray-300 bg-white px-4 pr-12 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  disabled={isSubmitting}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>

              {capsLockOn && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Caps Lock is on.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={openForgotPassword}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                <HelpCircle
                  size={16}
                  aria-hidden="true"
                />

                Forgot password?
              </button>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !username.trim() ||
                !password
              }
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && (
                <LoaderCircle
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              )}

              {isSubmitting
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center dark:border-slate-700/60">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Secure login powered by Welljob Solutions
            </p>
          </div>
        </div>

        <Dialog
          open={forgotPasswordOpen}
          onClose={closeForgotPassword}
          title="Forgot Password"
          description="Enter your registered account details to request password recovery."
          tone="default"
          size="md"
          closeOnOverlay={!isRequestingRecovery}
          closeOnEscape={!isRequestingRecovery}
          footer={
            <button
              type="button"
              onClick={closeForgotPassword}
              disabled={isRequestingRecovery}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          }
        >
          {recoveryMessage ? (
            <div className="space-y-4">
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                {recoveryMessage}
              </div>

              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                If you receive a reset link, check your inbox
                and spam folder. Otherwise, contact Technical
                IT Support or an authorized system
                administrator for recovery assistance.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleRequestRecovery}
              className="space-y-4"
            >
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                Enter the email, username, and full name
                registered to your WELLJOB account. Your
                recovery email must already be verified.
              </p>

              <div className="space-y-2">
                <label
                  htmlFor="recovery-email"
                  className={RECOVERY_LABEL_CLASS}
                >
                  Registered Recovery Email
                </label>

                <input
                  id="recovery-email"
                  name="recoveryEmail"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={recoveryEmail}
                  disabled={isRequestingRecovery}
                  onChange={(event) => {
                    setRecoveryEmail(event.target.value);
                    setRecoveryError("");
                  }}
                  placeholder="Enter your registered email"
                  className={RECOVERY_INPUT_CLASS}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recovery-username"
                  className={RECOVERY_LABEL_CLASS}
                >
                  Username
                </label>

                <input
                  id="recovery-username"
                  name="recoveryUsername"
                  type="text"
                  autoComplete="off"
                  maxLength={150}
                  required
                  value={recoveryUsername}
                  disabled={isRequestingRecovery}
                  onChange={(event) => {
                    setRecoveryUsername(event.target.value);
                    setRecoveryError("");
                  }}
                  placeholder="Enter your account username"
                  className={RECOVERY_INPUT_CLASS}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recovery-full-name"
                  className={RECOVERY_LABEL_CLASS}
                >
                  Full Name
                </label>

                <input
                  id="recovery-full-name"
                  name="recoveryFullName"
                  type="text"
                  autoComplete="name"
                  maxLength={150}
                  required
                  value={recoveryFullName}
                  disabled={isRequestingRecovery}
                  onChange={(event) => {
                    setRecoveryFullName(event.target.value);
                    setRecoveryError("");
                  }}
                  placeholder="Enter your registered full name"
                  className={RECOVERY_INPUT_CLASS}
                />
              </div>

              {recoveryError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                >
                  {recoveryError}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isRequestingRecovery ||
                  recoveryFormIncomplete
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRequestingRecovery && (
                  <LoaderCircle
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                )}

                {isRequestingRecovery
                  ? "Submitting request..."
                  : "Request Password Reset"}
              </button>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                If your recovery email is not yet registered
                and verified, contact Technical IT Support
                or an authorized system administrator for
                account recovery assistance.
              </div>
            </form>
          )}
        </Dialog>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            darkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          className="fixed bottom-6 right-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          {darkMode ? (
            <Sun
              className="h-5 w-5 text-yellow-500"
              aria-hidden="true"
            />
          ) : (
            <Moon
              className="h-5 w-5 text-blue-600"
              aria-hidden="true"
            />
          )}
        </button>
      </main>
    </div>
  );
}