import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiChevronDown } from "react-icons/fi";

export default function Navbar({ title = "Welljob Solutions & General Services" }) {
  const [openNotif, setOpenNotif] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const navigate = useNavigate();

  // 🔥 LOGOUT FUNCTION
  const handleLogout = () => {
    localStorage.removeItem("user"); // clear login data
    navigate("/login", { replace: true }); // redirect to login
  };

  const notifications = [
    "5 Pending Incident Investigations",
    "12 Expiring Documents",
    "3 Overdue Case Resolutions"
  ];

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
      {/* LEFT SIDE */}
      <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
        {title}
      </h2>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-6">

        {/* 🔔 NOTIFICATIONS */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenNotif(!openNotif);
              setOpenProfile(false);
            }}
            className="relative"
          >
            <FiBell className="text-xl text-gray-600 dark:text-gray-300" />

            <span className="
              absolute -top-1 -right-1
              bg-red-500
              text-white
              text-xs
              w-4 h-4
              flex items-center justify-center
              rounded-full
            ">
              {notifications.length}
            </span>
          </button>

          {openNotif && (
            <div className="
              absolute right-0 mt-3 w-72
              bg-white dark:bg-slate-900
              border border-gray-200 dark:border-white/10
              rounded-xl shadow-lg
              z-50
            ">
              <div className="p-4 border-b dark:border-white/10 font-medium text-sm">
                Notifications
              </div>

              <div className="max-h-60 overflow-y-auto">
                {notifications.map((item, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 👤 PROFILE */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenProfile(!openProfile);
              setOpenNotif(false);
            }}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
          >
            <div className="
              w-8 h-8
              bg-indigo-600
              text-white
              flex items-center justify-center
              rounded-full
              font-semibold
            ">
              A
            </div>
            Admin User
            <FiChevronDown className="text-xs" />
          </button>

          {openProfile && (
            <div className="
              absolute right-0 mt-3 w-48
              bg-white dark:bg-slate-900
              border border-gray-200 dark:border-white/10
              rounded-xl shadow-lg
              z-50
            ">
              <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-white/10">
                Profile Settings
              </button>

              {/* 🔥 LOGOUT BUTTON */}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-white/10 text-red-500"
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