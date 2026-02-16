import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "light" ? false : true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar toggleTheme={toggleTheme} darkMode={darkMode} />

      <div className="flex-1 flex flex-col min-h-screen text-gray-900 dark:text-white transition-colors duration-300">
        <Navbar />

        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
