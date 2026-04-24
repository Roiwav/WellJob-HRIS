import { useEffect, useState } from "react";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [accounts, setAccounts] = useState([]);

  // MODALS
  const [selectedUser, setSelectedUser] = useState(null);
  const [showReset, setShowReset] = useState(false);

  const [newPassword, setNewPassword] = useState("");

  // FETCH USERS
  const fetchUsers = () => {
    fetch("http://localhost:5000/api/users")
      .then((res) => res.json())
      .then((data) => setAccounts(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // RESET PASSWORD
  const handleResetPassword = async () => {
    await fetch(`http://localhost:5000/api/users/reset/${selectedUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    alert("Password updated");
    setShowReset(false);
    setNewPassword("");
  };

  // TOGGLE STATUS
  const handleToggle = async (id) => {
    await fetch(`http://localhost:5000/api/users/toggle/${id}`, {
      method: "PUT",
    });

    fetchUsers();
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          IT Support Maintenance
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isSuperAdmin
            ? "View-only technical settings overview for Super Admin."
            : "Manage user accounts, access control, and system maintenance operations."}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            User Account Maintenance
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4">{account.id}</td>
                  <td className="px-6 py-4">{account.full_name}</td>
                  <td className="px-6 py-4">{account.username}</td>
                  <td className="px-6 py-4">{account.role}</td>

                  {/* STATUS WITH COLOR */}
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        account.status === "Active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                    >
                      {account.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">

                      <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                        <button
                          onClick={() => {
                            setSelectedUser(account);
                            setShowReset(true);
                          }}
                          className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Reset Password
                        </button>
                      </RoleGuard>

                      <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                        <button
                          onClick={() => handleToggle(account.id)}
                          className="px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
                        >
                          Toggle Status
                        </button>
                      </RoleGuard>

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESET PASSWORD MODAL */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white p-6 rounded-xl w-96 shadow-xl border dark:border-gray-700">
            <h2 className="font-bold text-lg mb-4">Reset Password</h2>

            <input
              type="password"
              placeholder="New Password"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white p-2 rounded-md mb-4"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                onClick={handleResetPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>

              <button
                onClick={() => setShowReset(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}