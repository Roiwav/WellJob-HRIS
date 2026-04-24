import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCopy,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
} from "react-icons/fi";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const API_BASE = "http://localhost:5000/api";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  IT_SUPPORT: "IT Support",
};

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copyText, setCopyText] = useState("Copy");

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch users error:", err);
      setAccounts([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return accounts;

    return accounts.filter((account) =>
      [
        account.id,
        account.user_id,
        account.full_name,
        account.username,
        account.role,
        account.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [accounts, search]);

  const handleOpenReset = (account) => {
    setSelectedUser(account);
    setTemporaryPassword("");
    setCopyText("Copy");
    setShowResetConfirm(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.id) return;

    try {
      setResetting(true);

      const res = await fetch(`${API_BASE}/users/reset/${selectedUser.id}`, {
        method: "PUT",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to reset password.");
        return;
      }

      const generatedPassword =
        data.temporaryPassword || data.password || data.newPassword || "";

      setTemporaryPassword(generatedPassword);
      setShowResetConfirm(false);
      setShowResetSuccess(true);

      await fetchUsers();
    } catch (err) {
      console.error("Reset password error:", err);
      alert("Error resetting password.");
    } finally {
      setResetting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyText("Copied");
      window.setTimeout(() => setCopyText("Copy"), 1500);
    } catch {
      setCopyText("Copy failed");
      window.setTimeout(() => setCopyText("Copy"), 1500);
    }
  };

  const handleToggle = async (account) => {
    if (!account?.id) return;

    const confirmToggle = window.confirm(
      `Are you sure you want to toggle the status of ${account.full_name || account.username}?`
    );

    if (!confirmToggle) return;

    try {
      const res = await fetch(`${API_BASE}/users/toggle/${account.id}`, {
        method: "PUT",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to toggle status.");
        return;
      }

      await fetchUsers();
    } catch (err) {
      console.error("Toggle status error:", err);
      alert("Error toggling status.");
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            IT Support Maintenance
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isSuperAdmin
              ? "View-only technical settings overview for Super Admin."
              : "Manage user accounts, access control, and maintenance operations."}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loadingUsers}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          <FiRefreshCw className={loadingUsers ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Accounts" value={accounts.length} />
        <SummaryCard
          label="Active Users"
          value={accounts.filter((account) => account.status === "Active").length}
        />
        <SummaryCard
          label="Inactive Users"
          value={accounts.filter((account) => account.status !== "Active").length}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">
              User Account Maintenance
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Reset temporary passwords and manage account status.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, role, or status..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-950 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 text-gray-700 dark:divide-white/10 dark:text-gray-200">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="transition hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {account.user_id || account.id}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {getInitials(account.full_name || account.username)}
                        </div>
                        <span>{account.full_name || "-"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">{account.username || "-"}</td>

                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {ROLE_LABELS[account.role] || account.role || "-"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={account.status} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                          <button
                            type="button"
                            onClick={() => handleOpenReset(account)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <FiShield />
                            Reset Password
                          </button>
                        </RoleGuard>

                        <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                          <button
                            type="button"
                            onClick={() => handleToggle(account)}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                          >
                            <FiUserCheck />
                            Toggle Status
                          </button>
                        </RoleGuard>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {loadingUsers ? "Loading accounts..." : "No accounts found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showResetConfirm && selectedUser && (
        <ConfirmResetModal
          user={selectedUser}
          resetting={resetting}
          onClose={() => {
            if (!resetting) {
              setShowResetConfirm(false);
              setSelectedUser(null);
            }
          }}
          onConfirm={handleResetPassword}
        />
      )}

      {showResetSuccess && selectedUser && (
        <ResetSuccessModal
          user={selectedUser}
          temporaryPassword={temporaryPassword}
          copyText={copyText}
          onCopy={handleCopyPassword}
          onClose={() => {
            setShowResetSuccess(false);
            setSelectedUser(null);
            setTemporaryPassword("");
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const isActive = status === "Active";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        isActive
          ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function ConfirmResetModal({ user, resetting, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              <FiShield size={24} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">
                Reset Password
              </h3>
              <p className="mt-1 text-sm text-white/85">
                A new temporary password will be generated automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Selected Account
            </p>
            <p className="mt-2 font-bold text-gray-900 dark:text-white">
              {user.full_name || user.username}
            </p>
            <p className="text-sm text-gray-500">
              {user.username} • {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex gap-3">
              <FiAlertTriangle className="mt-0.5 shrink-0" />
              <p>
                The user will be required to change this temporary password on
                their next login.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={resetting}
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={resetting}
              onClick={onConfirm}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {resetting ? "Generating..." : "Generate Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetSuccessModal({
  user,
  temporaryPassword,
  copyText,
  onCopy,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              <FiCheckCircle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">
                Password Reset Successful
              </h3>
              <p className="mt-1 text-sm text-white/85">
                Temporary password generated for {user.full_name || user.username}.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Temporary Password
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={temporaryPassword}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm font-bold text-gray-900 outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />

              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
              >
                <FiCopy />
                {copyText}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            Give this temporary password to the user. They will be required to
            change it on next login.
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(value) {
  return String(value || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}