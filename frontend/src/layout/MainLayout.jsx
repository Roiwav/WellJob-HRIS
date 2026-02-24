import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function MainLayout() {
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

  // useCallback prevents unnecessary re-renders in Sidebar
  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-950">

      {/* SIDEBAR */}
      <Sidebar toggleTheme={toggleTheme} darkMode={darkMode} />

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col text-gray-900 dark:text-white">

        {/* NAVBAR */}
        <Navbar />

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 will-change-scroll">
          <Outlet />
        </main>

      </div>
    </div>
  );
}