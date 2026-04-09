import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // 🔥 MOCK USERS (for now)
  const users = [
    { username: "admin", password: "123456", role: "SUPER_ADMIN", name: "Super Admin" },
    { username: "manager1", password: "123456", role: "HR_MANAGER", name: "HR Manager" },
    { username: "staff1", password: "123456", role: "HR_STAFF", name: "HR Staff" },
    { username: "it1", password: "123456", role: "IT_SUPPORT", name: "IT Support" },
  ];

  const handleLogin = (e) => {
    e.preventDefault();

    const user = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      setError("Invalid username or password");
      return;
    }

    // 🔥 SAVE USER
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user); // 🔥 IMPORTANT (fix ng system mo)

    // 🔥 ROLE-BASED REDIRECT
    if (user.role === "SUPER_ADMIN") return navigate("/super-admin");
    if (user.role === "HR_MANAGER") return navigate("/");
    if (user.role === "HR_STAFF") return navigate("/employees");
    if (user.role === "IT_SUPPORT") return navigate("/settings");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617]">

      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-white">
          Welljob Solutions & General Services
        </h1>
      </div>

      {/* LOGIN CARD */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-8">

          <h2 className="text-2xl font-bold text-white text-center">
            HR System Login
          </h2>

          <p className="text-sm text-gray-400 text-center mt-1">
            Sign in to your account
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-5">

            {/* USERNAME */}
            <div>
              <label className="text-sm text-gray-300">Username</label>
              <input
                type="text"
                required
                className="mt-1 w-full px-3 py-2 rounded-md border border-slate-600 bg-slate-700 text-white focus:ring-indigo-500 focus:border-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="text-sm text-gray-300">Password</label>

              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-3 py-2 pr-10 rounded-md border border-slate-600 bg-slate-700 text-white focus:ring-indigo-500 focus:border-indigo-500"
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

            {/* ERROR */}
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
            >
              Sign In
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}