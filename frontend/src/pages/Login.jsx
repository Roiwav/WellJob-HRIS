import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  useEffect(() => {
    const root = document.documentElement;

    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // 🔥 SAVE USER
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);

      // 🔥 ROLE-BASED REDIRECT
      if (data.user.role === "SUPER_ADMIN") navigate("/super-admin");
      else if (data.user.role === "HR_MANAGER") navigate("/");
      else if (data.user.role === "HR_STAFF") navigate("/employees");
      else if (data.user.role === "IT_SUPPORT") navigate("/settings");

    } catch (err) {
      console.error(err);
      setError("Server error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-900">

      {/* TOP BAR */}
      <div className="px-6 py-4 border-b border-gray-200 backdrop-blur-sm bg-white/80 dark:border-slate-800/50 dark:bg-slate-950/80">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2 dark:text-white">
            <img src="/Logo.svg" alt="Welljob Logo" className="w-8 h-8" />
            Welljob Solutions & General Services
          </h1>
          <div className="text-xs text-gray-500 dark:text-gray-500">HR Management System</div>
        </div>
      </div>

      {/* LOGIN CARD */}
      <div className="flex flex-1 items-center justify-center p-4 relative">
        <div className="w-full max-w-md">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-indigo-100/50 rounded-3xl blur-3xl dark:from-blue-600/20 dark:to-indigo-600/20"></div>
          
          {/* Main card */}
          <div className="relative bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl p-8 space-y-6 dark:bg-slate-900/90 dark:border-slate-700/50">
            
            {/* Header section */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg p-2 dark:from-blue-600 dark:to-indigo-700">
                <img src="/Logo.svg" alt="Welljob Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome Back
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Enter your credentials to access the HR System
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* USERNAME */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 dark:text-gray-200">
                  <span>Username</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 dark:text-gray-200">
                  <span>Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-gray-400"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors duration-200 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 dark:bg-red-500/20 dark:border-red-500/40">
                  <p className="text-red-600 text-sm text-center dark:text-red-300">{error}</p>
                </div>
              )}

              {/* BUTTON */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-800 dark:hover:to-indigo-800"
              >
                Sign In
              </button>

            </form>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-gray-200 dark:border-slate-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Secure login powered by Welljob Solutions
              </p>
            </div>

          </div>
        </div>

        {/* THEME TOGGLE BUTTON */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-6 right-6 w-12 h-12 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 group dark:bg-slate-700 dark:border-slate-600"
          aria-label="Toggle theme"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-yellow-500 group-hover:text-yellow-400 transition-colors" />
          ) : (
            <Moon className="w-5 h-5 text-blue-600 group-hover:text-blue-500 transition-colors" />
          )}
        </button>
      </div>
    </div>
  );
}