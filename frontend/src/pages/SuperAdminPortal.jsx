import { useState, useEffect, useMemo } from "react";
import { ROLES } from "../constants/roles";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

const ROLE_CONFIG = {
  [ROLES.HR_STAFF]: {
    label: "HR Staff",
    prefix: "HR",
    usernamePrefix: "hr",
  },
  [ROLES.HR_MANAGER]: {
    label: "HR Manager",
    prefix: "HM",
    usernamePrefix: "hm",
  },
  [ROLES.IT_SUPPORT]: {
    label: "IT Support",
    prefix: "IT",
    usernamePrefix: "it",
  },
};


function extractNumberFromUserId(userId, prefix) {
  if (!userId || !userId.startsWith(prefix)) return 0;
  const numericPart = userId.replace(prefix, "");
  const parsed = parseInt(numericPart, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function Modal({ isOpen, title, children, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function SuperAdminPortal() {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES.HR_STAFF);
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // MODAL STATES
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [createdAccount, setCreatedAccount] = useState({
    userId: "",
    username: "",
    temporaryPassword: "",
    name: "",
    roleLabel: "",
  });

  const selectedRoleConfig = ROLE_CONFIG[role];

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/users");
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const nextGeneratedAccount = useMemo(() => {
    const prefix = selectedRoleConfig.prefix;
    const usernamePrefix = selectedRoleConfig.usernamePrefix;

    const sameRoleAccounts = accounts.filter((acc) => acc.role === role);

    const maxNumber = sameRoleAccounts.reduce((max, acc) => {
      const sourceId = acc.user_id || acc.userId || "";
      const currentNumber = extractNumberFromUserId(sourceId, prefix);
      return currentNumber > max ? currentNumber : max;
    }, 0);

    const nextNumber = maxNumber + 1;
    const padded = String(nextNumber).padStart(2, "0");

    return {
      userId: `${prefix}${padded}`,
      username: `${usernamePrefix}${padded}`,
    };
  }, [accounts, role, selectedRoleConfig]);

  useEffect(() => {
    setUserId(nextGeneratedAccount.userId);
    setUsername(nextGeneratedAccount.username);
  }, [nextGeneratedAccount]);

  const filteredAccounts = useMemo(() => {
    if (userRoleFilter === "ALL") return accounts;
    return accounts.filter((acc) => acc.role === userRoleFilter);
  }, [accounts, userRoleFilter]);

  const getRoleLabel = (roleValue) => {
    return ROLE_CONFIG[roleValue]?.label || roleValue;
  };

  const validateForm = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      alert("Full name is required.");
      return false;
    }

    if (!/^[A-Za-z\s.'-]+$/.test(trimmedName)) {
      alert("Full name must contain letters only.");
      return false;
    }

    if (!role || !ROLE_CONFIG[role]) {
      alert("Please select a valid role.");
      return false;
    }

    if (!userId || !username) {
      alert("Generated account details are incomplete.");
      return false;
    }

    return true;
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsConfirmModalOpen(true);
  };

  const confirmCreateAccount = async () => {
    const trimmedName = name.trim();

    try {
      setIsSubmitting(true);

      const res = await fetch("http://localhost:5000/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to create account.");
        return;
      }

        setCreatedAccount({
          userId: data.account?.userId || "",
          username: data.account?.username || "",
          temporaryPassword: data.temporaryPassword || "",
          name: trimmedName,
          roleLabel: getRoleLabel(role),
        });

      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);

      setName("");
      setRole(ROLES.HR_STAFF);

      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert("Error creating user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
          Super Admin Portal
        </h1>
        <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-400">
          Create and manage internal user accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <RoleGuard permission={PERMISSIONS.CAN_CREATE_SYSTEM_USERS}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-gray-700 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-5">
              Create New Account
            </h2>

            <form onSubmit={handleCreateAccount} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* FULL NAME */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2.5 border"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {/* ASSIGN ROLE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Assign Role
                    </label>
                    <select
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2.5 border"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value={ROLES.HR_STAFF}>HR Staff</option>
                      <option value={ROLES.HR_MANAGER}>HR Manager</option>
                      <option value={ROLES.IT_SUPPORT}>IT Support</option>
                    </select>
                  </div>

                </div>

                {/* SECOND ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* USER ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      System User ID
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700/60 dark:text-white px-3 py-2.5 border cursor-not-allowed"
                      value={userId}
                    />
                  </div>

                  {/* USERNAME */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700/60 dark:text-white px-3 py-2.5 border cursor-not-allowed"
                      value={username}
                    />
                  </div>

                </div>
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-slate-900/40 p-4">
                <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  <span className="font-semibold">Preview:</span> This account
                  will be created as{" "}
                  <span className="font-semibold">
                    {selectedRoleConfig.label}
                  </span>{" "}
                  with User ID <span className="font-semibold">{userId}</span> and
                  username <span className="font-semibold">{username}</span>.
                </p>
              </div>

              <div className="flex justify-end pt-5 border-t dark:border-gray-700">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </RoleGuard>

<div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden h-[450px] flex flex-col">          <div className="px-5 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Created Accounts
            </h2>

            <div className="w-full sm:w-56">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Filter by Role
              </label>
              <select
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2.5 border text-sm"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value={ROLES.HR_STAFF}>HR Staff</option>
                <option value={ROLES.HR_MANAGER}>HR Manager</option>
                <option value={ROLES.IT_SUPPORT}>IT Support</option>
              </select>
            </div>
          </div>

<div className="flex-1 overflow-y-auto overflow-x-auto">            
  <table className="w-full text-sm">
<thead className="bg-gray-100 dark:bg-slate-900 sticky top-0 z-20">
                <tr>
                  <th className="px-5 md:px-6 py-4 text-left text-gray-700 dark:text-gray-200 font-semibold">
                    System User ID
                  </th>
                  <th className="px-5 md:px-6 py-4 text-left text-gray-700 dark:text-gray-200 font-semibold">
                    Full Name
                  </th>
                  <th className="px-5 md:px-6 py-4 text-left text-gray-700 dark:text-gray-200 font-semibold">
                    Username
                  </th>
                  <th className="px-5 md:px-6 py-4 text-left text-gray-700 dark:text-gray-200 font-semibold">
                    Role
                  </th>
                  <th className="px-5 md:px-6 py-4 text-left text-gray-700 dark:text-gray-200 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="px-5 md:px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {acc.user_id || "-"}
                      </td>
                      <td className="px-5 md:px-6 py-4 text-gray-700 dark:text-gray-200">
                        {acc.full_name || acc.name}
                      </td>
                      <td className="px-5 md:px-6 py-4 text-gray-700 dark:text-gray-200">
                        {acc.username}
                      </td>
                      <td className="px-5 md:px-6 py-4 text-gray-700 dark:text-gray-200">
                        {getRoleLabel(acc.role)}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            acc.status === "Active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {acc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No accounts found for the selected role.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <Modal
        isOpen={isConfirmModalOpen}
        title="Confirm Account Creation"
        onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Are you sure you want to create this account?
          </p>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/40 p-4 space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Full Name:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {name.trim()}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Role:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {getRoleLabel(role)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                User ID:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {userId}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Username:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {username}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmCreateAccount}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal
        isOpen={isSuccessModalOpen}
        title="Account Created Successfully"
        onClose={() => setIsSuccessModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            The account has been created successfully.
          </p>

          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-4 space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Full Name:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {createdAccount.name}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Role:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {createdAccount.roleLabel}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                User ID:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {createdAccount.userId}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Username:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                {createdAccount.username}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Temporary Password:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right break-all">
                {createdAccount.temporaryPassword}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsSuccessModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}