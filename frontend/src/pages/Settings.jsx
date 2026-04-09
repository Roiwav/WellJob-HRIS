import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

const userAccounts = [
  {
    id: "USR-001",
    name: "Maria HR Manager",
    username: "maria.manager",
    role: "HR_MANAGER",
    status: "Active",
  },
  {
    id: "USR-002",
    name: "John HR Staff",
    username: "john.staff",
    role: "HR_STAFF",
    status: "Active",
  },
  {
    id: "USR-003",
    name: "Paul IT Support",
    username: "paul.it",
    role: "IT_SUPPORT",
    status: "Inactive",
  },
];

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isSuperAdmin
            ? "View-only technical settings overview for Super Admin."
            : "Maintain user accounts and technical access settings."}
          Maintain user accounts and technical access settings.
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
              {userAccounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4">{account.id}</td>
                  <td className="px-6 py-4">{account.name}</td>
                  <td className="px-6 py-4">{account.username}</td>
                  <td className="px-6 py-4">{account.role}</td>
                  <td className="px-6 py-4">{account.status}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600">
                        View
                      </button>

                      <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                        <button className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                          Reset Password
                        </button>
                      </RoleGuard>

                      <RoleGuard permission={PERMISSIONS.CAN_MAINTAIN_IT_USERS}>
                        <button className="px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600">
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
    </div>
  );
}