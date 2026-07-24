import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import SmartSuggestionsWidget from "../components/suggestions/SmartSuggestionsWidget";
import useTheme from "../hooks/useTheme";

export default function MainLayout() {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 dark:bg-slate-950">
      <Sidebar toggleTheme={toggleTheme} darkMode={darkMode} />

      <div className="flex min-w-0 flex-1 flex-col text-gray-900 dark:text-white">
        <Navbar />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>

      <SmartSuggestionsWidget />
    </div>
  );
}
