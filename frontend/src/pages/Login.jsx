import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  HelpCircle,
  LoaderCircle,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import welljobLogo from "../assets/welljob.png";
import { useAuth } from "../context/useAuth";
import Dialog from "../components/ui/Dialog";
import useTheme from "../hooks/useTheme";
import { API_BASE } from "../config/api";

const GENERIC_RECOVERY_MESSAGE =
  "If the submitted details are eligible for recovery, a password-reset link may be sent to the account's verified recovery email.";

const RECOVERY_INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

const RECOVERY_LABEL_CLASS =
  "block text-sm font-semibold text-slate-700 dark:text-slate-200";

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

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryFullName, setRecoveryFullName] = useState("");

  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const [isRequestingRecovery, setIsRequestingRecovery] = useState(false);

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

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

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
      setRecoveryMessage(GENERIC_RECOVERY_MESSAGE);

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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#020817] dark:text-white lg:h-screen lg:overflow-hidden">
      <style>{`
        @keyframes login-grid-shift {
          from { background-position: 0 0; }
          to { background-position: 52px 52px; }
        }

        @keyframes login-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes login-orbit-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes login-pulse {
          0%, 100% {
            opacity: .45;
            transform: scale(.92);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        .login-grid {
          background-image:
            linear-gradient(rgba(56,189,248,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.05) 1px, transparent 1px);
          background-size: 52px 52px;
          animation: login-grid-shift 34s linear infinite;
        }

        .login-orbit-a {
          animation: login-orbit 14s linear infinite;
        }

        .login-orbit-b {
          animation: login-orbit-reverse 20s linear infinite;
        }

        .login-pulse {
          animation: login-pulse 2.6s ease-in-out infinite;
        }

        @media (min-width: 1024px) and (max-height: 720px) {
          .login-brand-title {
            font-size: 2rem !important;
            line-height: 1.02 !important;
          }

          .login-brand-copy {
            margin-top: .75rem !important;
            line-height: 1.35rem !important;
          }

          .login-orbit-shell {
            width: 165px !important;
            height: 165px !important;
            margin-top: .75rem !important;
          }

          .login-card-head {
            padding-top: .8rem !important;
            padding-bottom: .8rem !important;
          }

          .login-card-body {
            padding-top: .9rem !important;
            padding-bottom: .9rem !important;
          }

          .login-form {
            gap: .75rem !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-grid {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(79,70,229,0.30),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_82%_86%,rgba(124,58,237,0.22),transparent_30%)]" />
        <div className="login-grid absolute inset-0 opacity-90" />
        <div className="absolute -bottom-20 left-[-8%] h-32 w-[116%] rounded-[50%] border-t border-cyan-400/25 shadow-[0_-10px_36px_rgba(34,211,238,0.12)]" />
      </div>

      <header className="relative z-20 shrink-0 border-b border-slate-200/80 bg-white/90 px-5 py-3 backdrop-blur-xl dark:border-white/[0.07] dark:bg-slate-950 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1380px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-200 bg-white p-1.5 shadow-sm dark:border-blue-400/20 dark:bg-slate-950 dark:shadow-[0_0_24px_rgba(59,130,246,0.14)]">
              <img
                src={welljobLogo}
                alt="Welljob Solutions logo"
                className="h-full w-full object-contain"
                draggable="false"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">
                WELLJOB SOLUTIONS
              </p>

              <p className="truncate text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Human Resource Information System
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06] dark:text-slate-200 sm:flex">
            <span className="login-pulse h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(52,211,153,0.85)]" />
            Secure Access
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8 lg:py-3">
        <div className="mx-auto grid w-full max-w-[1160px] items-center gap-7 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 xl:gap-10">
          <section className="login-brand-panel hidden lg:block">
            <div className="max-w-lg">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-950 dark:text-cyan-200">
                <ShieldCheck
                  size={14}
                  aria-hidden="true"
                />
                Secure Workforce Access
              </div>

              <h1 className="login-brand-title text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 dark:text-white xl:text-4xl">
                Welcome to
                <span className="mt-1 block bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                  WELLJOB SOLUTIONS HRIS
                </span>
              </h1>

              <p className="login-brand-copy mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Sign in to continue managing workforce records, deployment activity,
                incidents, compliance, and HR operations from one centralized system.
              </p>

              <div className="login-orbit-shell relative mt-5 flex h-[200px] w-[200px] items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-3xl" />

                <div className="login-orbit-a absolute inset-0 rounded-full border border-cyan-400/25">
                  <span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
                </div>

                <div className="login-orbit-b absolute inset-7 rounded-full border border-violet-400/25">
                  <span className="absolute bottom-[17%] right-[-4px] h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
                </div>

                <div className="relative flex h-24 w-36 items-center justify-center overflow-hidden rounded-[22px] border border-blue-300/30 bg-white p-3 shadow-xl dark:bg-slate-950 dark:shadow-[0_0_38px_rgba(59,130,246,0.18)]">
                  <img
                    src={welljobLogo}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain"
                    draggable="false"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <LockKeyhole
                  size={14}
                  className="text-cyan-500 dark:text-cyan-300"
                  aria-hidden="true"
                />
                Authorized WELLJOB personnel only
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[390px]">
            <div className="login-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_26px_70px_rgba(2,8,23,0.55)]">
              <div className="login-card-head border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                      Secure Sign In
                    </p>

                    <h2 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">
                      Welcome Back
                    </h2>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Enter your WELLJOB account credentials.
                    </p>
                  </div>

                  <div className="flex h-10 w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-200 bg-slate-50 p-1.5 dark:border-blue-400/20 dark:bg-slate-950">
                    <img
                      src={welljobLogo}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-contain"
                      draggable="false"
                    />
                  </div>
                </div>
              </div>

              <div className="login-card-body px-5 py-5">
                <form
                  onSubmit={handleLogin}
                  className="login-form space-y-4"
                  noValidate
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="username"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
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
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
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
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
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
                        className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
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
                      className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-cyan-700 transition hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-300 dark:hover:text-cyan-200"
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
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
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
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
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

                <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
                  <ShieldCheck
                    size={14}
                    className="text-emerald-500"
                    aria-hidden="true"
                  />

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Secure access powered by Welljob Solutions
                  </p>
                </div>
              </div>
            </div>
          </section>
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

              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                If you receive a reset link, check your inbox and spam folder.
                Otherwise, contact Technical IT Support or an authorized system
                administrator for recovery assistance.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleRequestRecovery}
              className="space-y-4"
            >
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Enter the email, username, and full name registered to your
                WELLJOB account. Your recovery email must already be verified.
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
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-4 font-semibold text-white shadow-lg transition hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                If your recovery email is not yet registered and verified,
                contact Technical IT Support or an authorized system
                administrator for account recovery assistance.
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
          className="fixed bottom-4 right-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {darkMode ? (
            <Sun
              className="h-5 w-5 text-amber-400"
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