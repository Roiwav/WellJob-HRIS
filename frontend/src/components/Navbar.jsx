import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";
import { useAuth } from "../context/useAuth";

export default function Navbar({ title = "Welljob Solutions & General Services" }) {
  const [openProfile, setOpenProfile] = useState(false);

  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const getRoleConfig = (role) => {
    switch (role) {
      case "HR_MANAGER":
        return { label: "HM", color: "bg-blue-600" };
      case "HR_STAFF":
        return { label: "HS", color: "bg-amber-500" };
      case "IT_SUPPORT":
        return { label: "IT", color: "bg-green-600" };
      case "SUPER_ADMIN":
        return { label: "SA", color: "bg-red-600" };
      default:
        return { label: "US", color: "bg-gray-500" };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login", { replace: true });
  };

  const roleConfig = getRoleConfig(user?.role);

  return (
    <div
      className="
        flex justify-between items-center
        px-6 py-4
        bg-white dark:bg-slate-950
        border-b border-gray-200 dark:border-white/10
        transition-colors duration-300
      "
    >
      <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
        {title}
      </h2>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenProfile((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
          >
            <div
              className={`
                w-9 h-9
                ${roleConfig.color}
                text-white
                flex items-center justify-center
                rounded-full
                font-semibold
                text-xs
              `}
            >
              {roleConfig.label}
            </div>

            <span>{user?.name || "User"}</span>
            <FiChevronDown className="text-xs" />
          </button>

          {openProfile && (
            <div
              className="
                absolute right-0 mt-3 w-48
                bg-white dark:bg-slate-900
                border border-gray-200 dark:border-white/10
                rounded-xl shadow-lg
                z-50
              "
            >
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-white/10"
              >
                Profile Settings
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}