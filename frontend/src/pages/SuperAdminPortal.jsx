import { useState } from "react";
import { ROLES } from "../constants/roles";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

const initialAccounts = [
  {
    id: "ACC-001",
    name: "Maria Cruz",
    email: "maria@example.com",
    username: "maria.manager",
    role: ROLES.HR_MANAGER,
    status: "Active",
  },
  {
    id: "ACC-002",
    name: "John Reyes",
    email: "john@example.com",
    username: "john.staff",
    role: ROLES.HR_STAFF,
    status: "Active",
  },
  {
    id: "ACC-003",
    name: "Paul Santos",
    email: "paul@example.com",
    username: "paul.it",
    role: ROLES.IT_SUPPORT,
    status: "Inactive",
  },
];

export default function SuperAdminPortal() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES.HR_STAFF);

  const handleCreateAccount = (e) => {
    e.preventDefault();

    const newAccount = {
      id: `ACC-${String(accounts.length + 1).padStart(3, "0")}`,
      name,
      email,
      username,
      role,
      status: "Active",
    };

    setAccounts((prev) => [newAccount, ...prev]);

    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRole(ROLES.HR_STAFF);

    alert("User successfully created. First login password reset is required.");
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Super Admin Portal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Create HR Manager, HR Staff, and IT Support accounts. Super Admin is
          limited to system-level account provisioning.
        </p>
      </div>

      <RoleGuard permission={PERMISSIONS.CAN_CREATE_SYSTEM_USERS}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 max-w-5xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Create New Account
          </h2>

          <form onSubmit={handleCreateAccount} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temporary Username
                </label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign Role
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value={ROLES.HR_STAFF}>HR Staff</option>
                  <option value={ROLES.HR_MANAGER}>HR Manager</option>
                  <option value={ROLES.IT_SUPPORT}>IT Support</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      </RoleGuard>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Managed Accounts
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">Account ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4">{account.id}</td>
                  <td className="px-6 py-4">{account.name}</td>
                  <td className="px-6 py-4">{account.email}</td>
                  <td className="px-6 py-4">{account.username}</td>
                  <td className="px-6 py-4">{account.role}</td>
                  <td className="px-6 py-4">{account.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}