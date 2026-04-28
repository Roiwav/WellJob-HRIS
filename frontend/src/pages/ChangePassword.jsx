import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiCheckCircle, FiLock } from "react-icons/fi";
import { useAuth } from "../context/useAuth";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 FIX 1: Nilagyan natin ng redirectPath ang state
  const [modal, setModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    redirectPath: null, 
  });

  const validateStrongPassword = (password) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*()_+]/.test(password)
    );
  };

  const getRedirectPath = (role) => {
    const normalizedRole = String(role || "").toUpperCase().trim();
    
    const redirectByRole = {
      "SUPER_ADMIN": "/",
      "HR_MANAGER": "/",
      "HR_STAFF": "/employees",
      "IT_SUPPORT": "/settings",
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
    const pathToGo = modal.redirectPath;

    setModal((prev) => ({
      ...prev,
      open: false,
    }));

    if (pathToGo) {
      window.location.href = pathToGo;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      showModal({
        type: "error",
        title: "Session Expired",
        message: "Please login again to continue.",
      });

      navigate("/login", { replace: true });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showModal({
        type: "error",
        title: "Incomplete Fields",
        message: "Please complete all password fields before submitting.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showModal({
        type: "error",
        title: "Password Mismatch",
        message: "New password and confirm password do not match.",
      });
      return;
    }

    if (!validateStrongPassword(newPassword)) {
      showModal({
        type: "error",
        title: "Weak Password",
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      });
      return;
    }

    if (currentPassword === newPassword) {
      showModal({
        type: "error",
        title: "Invalid New Password",
        message: "New password must be different from your current password.",
      });
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://localhost:5000/api/users/change-password", {
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
      });

      const data = await res.json();

      if (!res.ok) {
        showModal({
          type: "error",
          title: "Password Update Failed",
          message: data.message || "Failed to change password.",
        });
        return;
      }

      const updatedUser = {
        ...user,
        mustChangePassword: false,
        must_change_password: 0,
        must_change_password_flag: false 
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      const targetPath = getRedirectPath(updatedUser.role);

      showModal({
        type: "success",
        title: "Password Changed Successfully",
        message: "Your password has been updated. You may now continue to the system.",
        redirectPath: targetPath, // Ipasa na natin ang designated path
      });

    } catch (err) {
      console.error("Change password error:", err);

      showModal({
        type: "error",
        title: "Network Error",
        message: "Unable to change password. Please check your connection and try again.",
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-xl p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-300">
          <FiLock size={26} />
        </div>

        <h1 className="text-2xl font-bold text-white text-center">
          Change Password
        </h1>

        <p className="mt-2 text-sm text-slate-400 text-center">
          You must change your temporary password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />

          <div>
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <p className="mt-1 text-xs text-slate-500">
              Minimum 8 characters with uppercase, lowercase, number, and symbol.
            </p>
          </div>

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Updating..." : "Change Password"}
          </button>
        </form>
      </div>

      {modal.open && (
        <StatusModal
          type={modal.type}
          title={modal.title}
          message={modal.message}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function PasswordField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <input
        type="password"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-800 text-white px-3 py-2 outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function StatusModal({ type, title, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div
          className={`px-6 py-5 ${
            isSuccess
              ? "bg-gradient-to-r from-emerald-600 to-green-600"
              : "bg-gradient-to-r from-red-600 to-rose-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              {isSuccess ? (
                <FiCheckCircle size={24} />
              ) : (
                <FiAlertTriangle size={24} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}