
import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";

import Sidebar from "../components/Sidebar";

import SmartSuggestionsWidget from "../components/suggestions/SmartSuggestionsWidget";

// NEW: Floating Messenger
import FloatingMessenger from "../components/chat/FloatingMessenger";

import { ROLES } from "../constants/roles";

import { useAuth } from "../context/useAuth";

import useTheme from "../hooks/useTheme";

/*
 * ==================================================
 * WELLJOB SOLUTIONS
 * MAIN APPLICATION LAYOUT
 * ==================================================
 *
 * Existing components:
 * - Sidebar
 * - Navbar
 * - Application content
 * - Smart Suggestions
 *
 * New component:
 * - Floating Messenger
 *
 * The Messenger is not added to the Sidebar.
 *
 * It appears as a floating button above
 * the existing Smart Suggestions button.
 */

export default function MainLayout() {
  const {
    darkMode,
    toggleTheme,
  } = useTheme();

  const {
    user,
  } = useAuth();

  /*
   * Keep the existing Smart Suggestions
   * restriction for HR Coordinator.
   */

  const isHRCoordinator =
    user?.role ===
    ROLES.HR_COORDINATOR;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 dark:bg-slate-950">
      {/*
       * ==================================================
       * EXISTING SIDEBAR
       * ==================================================
       */}

      <Sidebar
        toggleTheme={
          toggleTheme
        }
        darkMode={
          darkMode
        }
      />

      {/*
       * ==================================================
       * EXISTING NAVBAR AND PAGE CONTENT
       * ==================================================
       */}

      <div className="flex min-w-0 flex-1 flex-col text-gray-900 dark:text-white">
        <Navbar />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>

      {/*
       * ==================================================
       * EXISTING SMART SUGGESTIONS
       * ==================================================
       *
       * Preserve the original role restriction
       * and existing widget behavior.
       */}

      {!isHRCoordinator && (
        <SmartSuggestionsWidget />
      )}

      {/*
       * ==================================================
       * NEW: FLOATING MESSENGER
       * ==================================================
       * Available to all authenticated users
       * who can access MainLayout.
       * Positioned above Smart Suggestions
       * without changing Sidebar navigation.
       */}

      <FloatingMessenger />
    </div>
  );
}