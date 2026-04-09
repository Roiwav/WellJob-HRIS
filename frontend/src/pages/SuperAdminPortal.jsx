import { useState, useEffect } from "react";
import { ROLES } from "../constants/roles";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

export default function SuperAdminPortal() {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES.HR_STAFF);

  // 🔥 FETCH USERS FROM DATABASE
  const fetchUsers = () => {
    fetch("http://localhost:5000/api/users")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data);
      })
      .catch((err) => console.error("Fetch error:", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 🔥 CREATE USER (SAVE TO DATABASE)
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          username,
          password,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      alert("User successfully created!");

      // 🔥 refresh table
      fetchUsers();

      setName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setRole(ROLES.HR_STAFF);
    } catch (err) {
      console.error(err);
      alert("Error creating user");
    }
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

      {/* 🔥 TABLE (UNCHANGED UI, DATABASE DATA NA) */}
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