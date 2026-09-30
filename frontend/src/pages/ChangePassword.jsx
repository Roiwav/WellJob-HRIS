import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiKey,
  FiLoader,
  FiLock,
  FiShield,
  FiX,
} from "react-icons/fi";

import { useNavigate } from "react-router-dom";

import Dialog from "../components/ui/Dialog";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/useAuth";
import authenticatedFetch from "../utils/authenticatedFetch";

const PASSWORD_RULES = [
  {
    key: "length",
    label: "8–128 characters",
    test: (value) =>
      value.length >= 8 &&
      value.length <= 128,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    label: "At least one lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "At least one number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    key: "symbol",
    label: "At least one special character",
    test: (value) =>
      /[!@#$%^&*()_+]/.test(value),
  },
];

const INITIAL_MODAL = {
  open: false,
  type: "error",
  title: "",
  message: "",
  redirectToLogin: false,
};

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function getDisplayName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "Your account"
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const modalButtonRef = useRef(null);

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [fieldErrors, setFieldErrors] =
    useState({});

  const [modal, setModal] =
    useState(INITIAL_MODAL);

  const passwordChecks = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(newPassword),
      })),
    [newPassword]
  );

  const isStrongPassword =
    passwordChecks.every(
      (rule) => rule.passed
    );

  const passwordsMatch =
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const displayName =
    getDisplayName(user);

  const showModal = ({
    type = "error",
    title,
    message,
    redirectToLogin = false,
  }) => {
    setModal({
      open: true,
      type,
      title,
      message,
      redirectToLogin,
    });
  };

  const finishLogout = () => {
    clearStoredSession();
    setUser(null);

    navigate("/login", {
      replace: true,
    });
  };

  const closeModal = () => {
    if (loading) {
      return;
    }

    const shouldRedirect =
      modal.redirectToLogin;

    setModal(INITIAL_MODAL);

    if (shouldRedirect) {
      finishLogout();
    }
  };

  const handleBackToProfile = () => {
    if (loading) {
      return;
    }

    navigate("/profile-settings");
  };

  const validateFields = () => {
    const nextErrors = {};

    if (!currentPassword) {
      nextErrors.currentPassword =
        "Enter your current password.";
    }

    if (!newPassword) {
      nextErrors.newPassword =
        "Enter a new password.";
    } else if (!isStrongPassword) {
      nextErrors.newPassword =
        "Your new password does not meet all requirements.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword =
        "Confirm your new password.";
    } else if (
      newPassword !== confirmPassword
    ) {
      nextErrors.confirmPassword =
        "The passwords do not match.";
    }

    if (
      currentPassword &&
      newPassword &&
      currentPassword === newPassword
    ) {
      nextErrors.newPassword =
        "Use a password different from your current password.";
    }

    setFieldErrors(nextErrors);

    return (
      Object.keys(nextErrors).length === 0
    );
  };

  const updateField =
    (setter, fieldName) => (value) => {
      setter(value);

      setFieldErrors((current) => {
        if (!current[fieldName]) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[fieldName];

        return next;
      });
    };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!user) {
      clearStoredSession();

      showModal({
        title: "Session Expired",
        message:
          "Your session is no longer available. Please sign in again.",
        redirectToLogin: true,
      });

      return;
    }

    if (!validateFields()) {
      return;
    }

    try {
      setLoading(true);

      const response =
        await authenticatedFetch(
          `${API_BASE}/users/change-password`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          }
        );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredSession();

          showModal({
            title: "Session Expired",
            message:
              data.message ||
              data.error ||
              "Your authentication session is no longer valid. Please sign in again.",
            redirectToLogin: true,
          });

          return;
        }

        showModal({
          title: "Password Update Failed",
          message:
            data.message ||
            data.error ||
            (response.status >= 500
              ? "The server could not update your password. Please try again."
              : "Please check your current password and try again."),
        });

        return;
      }

      clearStoredSession();

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});

      showModal({
        type: "success",
        title:
          "Password Changed Successfully",
        message:
          data.message ||
          "Your password has been updated. For security, please sign in again using your new password.",
        redirectToLogin: true,
      });
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      showModal({
        title: "Network Error",
        message:
          "Unable to change your password. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSuccess =
    modal.type === "success";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 dark:bg-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={handleBackToProfile}
          disabled={loading}
          className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-indigo-700 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-indigo-300"
        >
          <FiArrowLeft aria-hidden="true" />
          Back to Profile Settings
        </button>

        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-700 to-violet-700 p-6 text-white sm:p-8 lg:p-10">
            <div
              className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />

            <div
              className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-300/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
                <FiShield
                  size={27}
                  aria-hidden="true"
                />
              </div>

              <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-100">
                Account Security
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Protect your WellJob account
              </h1>

              <p className="mt-4 max-w-md text-sm leading-7 text-indigo-100">
                Update your password using a combination that is strong,
                unique, and not used on another account.
              </p>

              <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <FiLock aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white">
                      {displayName}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-indigo-100">
                      After a successful password change, your current
                      session will end and you will sign in again with
                      your new password.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  "Use a password you do not use elsewhere.",
                  "Avoid names, birthdays, or easy-to-guess patterns.",
                  "Keep your password private and never share it.",
                ].map((tip) => (
                  <div
                    key={tip}
                    className="flex items-start gap-2.5 text-sm leading-6 text-indigo-50"
                  >
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
                      <FiCheck
                        size={12}
                        aria-hidden="true"
                      />
                    </span>

                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <FiKey
                  size={20}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Change Password
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Confirm your current password, then create a new secure one.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-5"
              noValidate
            >
              <PasswordField
                id="current-password"
                label="Current Password"
                value={currentPassword}
                onChange={updateField(
                  setCurrentPassword,
                  "currentPassword"
                )}
                autoComplete="current-password"
                disabled={loading}
                error={
                  fieldErrors.currentPassword
                }
              />

              <div>
                <PasswordField
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={updateField(
                    setNewPassword,
                    "newPassword"
                  )}
                  autoComplete="new-password"
                  disabled={loading}
                  error={
                    fieldErrors.newPassword
                  }
                />

                <div
                  className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60"
                  aria-live="polite"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Password requirements
                    </p>

                    {newPassword && (
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide",
                          isStrongPassword
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                        ].join(" ")}
                      >
                        {isStrongPassword
                          ? "Ready"
                          : "Incomplete"}
                      </span>
                    )}
                  </div>

                  <ul className="grid gap-2 sm:grid-cols-2">
                    {passwordChecks.map(
                      (rule) => (
                        <li
                          key={rule.key}
                          className={[
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                            rule.passed
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "text-slate-500 dark:text-slate-400",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                              rule.passed
                                ? "bg-emerald-100 dark:bg-emerald-500/15"
                                : "bg-slate-200 dark:bg-slate-800",
                            ].join(" ")}
                          >
                            {rule.passed ? (
                              <FiCheck
                                size={12}
                                aria-hidden="true"
                              />
                            ) : (
                              <FiX
                                size={11}
                                aria-hidden="true"
                              />
                            )}
                          </span>

                          {rule.label}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>

              <PasswordField
                id="confirm-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={updateField(
                  setConfirmPassword,
                  "confirmPassword"
                )}
                autoComplete="new-password"
                disabled={loading}
                error={
                  fieldErrors.confirmPassword
                }
                successMessage={
                  passwordsMatch
                    ? "Passwords match."
                    : ""
                }
              />

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                    aria-hidden="true"
                  />

                  <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                    For security, changing your password signs out this
                    session. You will be asked to sign in again after the
                    update succeeds.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <FiLoader
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Updating password...
                  </>
                ) : (
                  <>
                    <FiLock aria-hidden="true" />
                    Update Password
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToProfile}
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-300/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FiArrowLeft aria-hidden="true" />
                Cancel and Return to Profile Settings
              </button>
            </form>
          </section>
        </div>
      </div>

      <Dialog
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        description={modal.message}
        tone={
          isSuccess
            ? "success"
            : "danger"
        }
        size="md"
        closeOnOverlay
        closeOnEscape
        showCloseButton
        preventClose={loading}
        initialFocusRef={
          modalButtonRef
        }
        footer={
          <button
            ref={modalButtonRef}
            type="button"
            onClick={closeModal}
            disabled={loading}
            className={[
              "inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition focus:outline-none focus:ring-4 disabled:opacity-60",
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/30"
                : "bg-red-600 hover:bg-red-700 focus:ring-red-500/30",
            ].join(" ")}
          >
            {modal.redirectToLogin
              ? "Sign In Again"
              : "Close"}
          </button>
        }
      >
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              isSuccess
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
            ].join(" ")}
          >
            {isSuccess ? (
              <FiCheckCircle
                size={24}
                aria-hidden="true"
              />
            ) : (
              <FiAlertTriangle
                size={24}
                aria-hidden="true"
              />
            )}
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {modal.message}
          </p>
        </div>
      </Dialog>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  error,
  successMessage,
}) {
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const errorId =
    `${id}-error`;

  const successId =
    `${id}-success`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={
            showPassword
              ? "text"
              : "password"
          }
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          aria-invalid={
            Boolean(error)
          }
          aria-describedby={
            error
              ? errorId
              : successMessage
                ? successId
                : undefined
          }
          className={[
            "h-12 w-full rounded-xl border bg-white px-3.5 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
              : successMessage
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/15 dark:border-emerald-700"
                : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/15 dark:border-slate-600",
          ].join(" ")}
        />

        <button
          type="button"
          onClick={() =>
            setShowPassword(
              (current) =>
                !current
            )
          }
          disabled={disabled}
          aria-label={
            showPassword
              ? `Hide ${label}`
              : `Show ${label}`
          }
          aria-pressed={
            showPassword
          }
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {showPassword ? (
            <FiEyeOff aria-hidden="true" />
          ) : (
            <FiEye aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {!error &&
        successMessage && (
          <p
            id={successId}
            className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <FiCheckCircle aria-hidden="true" />
            {successMessage}
          </p>
        )}
    </div>
  );
}