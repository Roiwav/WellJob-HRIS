import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiLogOut,
  FiX,
} from "react-icons/fi";

import Dialog from "../components/ui/Dialog";
import { useAuth } from "../context/useAuth";

const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
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
    test: (value) => /[!@#$%^&*()_+]/.test(value),
  },
];

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const modalButtonRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [modal, setModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    redirectPath: null,
  });

  const passwordChecks = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(newPassword),
      })),
    [newPassword]
  );

  const isStrongPassword = passwordChecks.every((rule) => rule.passed);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const getRedirectPath = (role) => {
    const normalizedRole = String(role || "").toUpperCase().trim();
    const redirectByRole = {
      SUPER_ADMIN: "/",
      HR_MANAGER: "/",
      HR_STAFF: "/employees",
      IT_SUPPORT: "/settings",
    };

    return redirectByRole[normalizedRole] || "/";
  };

  const showModal = ({ type = "error", title, message, redirectPath = null }) => {
    setModal({
      open: true,
      type,
      title,
      message,
      redirectPath,
    });
  };

  const closeModal = () => {
    if (loading) return;

    const pathToGo = modal.redirectPath;
    setModal((current) => ({ ...current, open: false }));

    if (pathToGo) {
      navigate(pathToGo, { replace: true });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login", { replace: true });
  };

  const validateFields = () => {
    const nextErrors = {};

    if (!currentPassword) {
      nextErrors.currentPassword = "Enter your current password.";
    }

    if (!newPassword) {
      nextErrors.newPassword = "Enter a new password.";
    } else if (!isStrongPassword) {
      nextErrors.newPassword = "Your new password does not meet all requirements.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your new password.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "The passwords do not match.";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = "Use a password different from your current password.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateField = (setter, fieldName) => (value) => {
    setter(value);
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    if (!user) {
      showModal({
        type: "error",
        title: "Session Expired",
        message: "Your session is no longer available. Please sign in again.",
        redirectPath: "/login",
      });
      return;
    }

    if (!validateFields()) return;

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/users/change-password",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user?.userId || user?.user_id || user?.id,
            username: user?.username,
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
        showModal({
          type: "error",
          title: "Password Update Failed",
          message:
            data.message ||
            (response.status >= 500
              ? "The server could not update your password. Please try again."
              : "Please check your current password and try again."),
        });
        return;
      }

      const updatedUser = {
        ...user,
        mustChangePassword: false,
        must_change_password: 0,
        must_change_password_flag: false,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});

      showModal({
        type: "success",
        title: "Password Changed Successfully",
        message: "Your password has been updated. You may now continue to the system.",
        redirectPath: getRedirectPath(updatedUser.role),
      });
    } catch (passwordError) {
      console.error("Change password error:", passwordError);
      showModal({
        type: "error",
        title: "Network Error",
        message: "Unable to change your password. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = modal.type === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-300">
          <FiLock size={26} aria-hidden="true" />
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
          Change Password
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
          Change your temporary password before continuing to the system.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <PasswordField
            id="current-password"
            label="Current Password"
            value={currentPassword}
            onChange={updateField(setCurrentPassword, "currentPassword")}
            autoComplete="current-password"
            disabled={loading}
            error={fieldErrors.currentPassword}
          />

          <div>
            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={updateField(setNewPassword, "newPassword")}
              autoComplete="new-password"
              disabled={loading}
              error={fieldErrors.newPassword}
            />

            <div
              className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-slate-950/60"
              aria-live="polite"
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Password requirements
              </p>
              <ul className="grid gap-1.5">
                {passwordChecks.map((rule) => (
                  <li
                    key={rule.key}
                    className={`flex items-center gap-2 text-xs font-medium ${
                      rule.passed
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {rule.passed ? <FiCheck /> : <FiX />}
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <PasswordField
            id="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={updateField(setConfirmPassword, "confirmPassword")}
            autoComplete="new-password"
            disabled={loading}
            error={fieldErrors.confirmPassword}
            successMessage={passwordsMatch ? "Passwords match." : ""}
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <FiLoader className="animate-spin" aria-hidden="true" />}
            {loading ? "Updating password..." : "Change Password"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-300/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-white/5"
          >
            <FiLogOut aria-hidden="true" />
            Return to Login
          </button>
        </form>
      </section>

      <Dialog
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        description={modal.message}
        tone={isSuccess ? "success" : "danger"}
        size="md"
        closeOnOverlay
        closeOnEscape
        showCloseButton
        preventClose={loading}
        initialFocusRef={modalButtonRef}
        footer={
          <button
            ref={modalButtonRef}
            type="button"
            onClick={closeModal}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition focus:outline-none focus:ring-4 disabled:opacity-60 ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/30"
                : "bg-red-600 hover:bg-red-700 focus:ring-red-500/30"
            }`}
          >
            {modal.redirectPath ? "Continue" : "Close"}
          </button>
        }
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isSuccess
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {isSuccess ? (
              <FiCheckCircle size={24} aria-hidden="true" />
            ) : (
              <FiAlertTriangle size={24} aria-hidden="true" />
            )}
          </div>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
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
  const [showPassword, setShowPassword] = useState(false);
  const errorId = `${id}-error`;
  const successId = `${id}-success`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-300"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : successMessage ? successId : undefined
          }
          className={`h-11 w-full rounded-xl border bg-white px-3 pr-12 text-gray-900 outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/15 dark:border-slate-600"
          }`}
        />

        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          disabled={disabled}
          aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={showPassword}
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {showPassword ? <FiEyeOff /> : <FiEye />}
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      {!error && successMessage && (
        <p id={successId} className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </p>
      )}
    </div>
  );
}
