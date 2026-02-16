import { FiSearch, FiBell } from "react-icons/fi";

export default function Navbar() {
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
        Dashboard
      </h2>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-6">

        {/* Search */}
        <div className="
          hidden md:flex items-center gap-2
          px-3 py-2
          bg-gray-100 dark:bg-white/10
          rounded-lg
        ">
          <FiSearch className="text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="
              bg-transparent
              outline-none
              text-sm
              text-gray-800 dark:text-white
            "
          />
        </div>

        {/* Notification Icon */}
        <div className="relative cursor-pointer">
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
            3
          </span>
        </div>

        {/* User */}
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Admin User
        </div>

      </div>
    </div>
  );
}
