import { useState, useEffect } from "react";
import { ROLES } from "../constants/roles";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { Eye, EyeOff } from "lucide-react";

export default function SuperAdminPortal() {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES.HR_STAFF);

  const [showPassword, setShowPassword] = useState(false);

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

  // 🔥 CREATE USER
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    // 🔥 NAME VALIDATION
    if (!/^[A-Za-z\s]+$/.test(name)) {
      alert("Name must contain letters only (no numbers or symbols)");
      return;
    }

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

      fetchUsers();

      setName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setRole(ROLES.HR_STAFF);
      setShowPassword(false);
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
          Create HR Manager, HR Staff, and IT Support accounts.
        </p>
      </div>

      <RoleGuard permission={PERMISSIONS.CAN_CREATE_SYSTEM_USERS}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 max-w-5xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Create New Account
          </h2>

          <form onSubmit={handleCreateAccount} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

              {/* FULL NAME */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  pattern="^[A-Za-z\s]+$"
                  title="Letters only"
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2 border"
                  value={name}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      setName(value);
                    }
                  }}
                />
              </div>

              {/* EMAIL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2 border"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* USERNAME */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temporary Username
                </label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2 border"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              {/* PASSWORD WITH EYE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temporary Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2 pr-10 border"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* ROLE */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign Role
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white px-3 py-2 border"
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
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      </RoleGuard>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Managed Accounts
          </h2>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/70">
            <tr>
              <th className="px-6 py-4">Account ID</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Username</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} className="border-t">
                <td className="px-6 py-4">{acc.id}</td>
                <td className="px-6 py-4">{acc.name}</td>
                <td className="px-6 py-4">{acc.email}</td>
                <td className="px-6 py-4">{acc.username}</td>
                <td className="px-6 py-4">{acc.role}</td>
                <td className="px-6 py-4">{acc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}