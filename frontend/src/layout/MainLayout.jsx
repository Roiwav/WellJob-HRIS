
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [mobileNavigationOpen, setMobileNavigationOpen] =
    useState(false);
  const mobileNavigationButtonRef = useRef(null);
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

  const closeMobileNavigation = useCallback(() => {
    setMobileNavigationOpen(false);
  }, []);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleDesktopChange = (event) => {
      if (event.matches) {
        closeMobileNavigation();
      }
    };

    desktopMediaQuery.addEventListener("change", handleDesktopChange);

    return () => {
      desktopMediaQuery.removeEventListener("change", handleDesktopChange);
    };
  }, [closeMobileNavigation]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 supports-[height:100dvh]:h-dvh dark:bg-slate-950">
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
        mobileOpen={
          mobileNavigationOpen
        }
        onMobileClose={
          closeMobileNavigation
        }
        mobileTriggerRef={
          mobileNavigationButtonRef
        }
      />

      {/*
       * ==================================================
       * EXISTING NAVBAR AND PAGE CONTENT
       * ==================================================
       */}

      <div className="flex min-w-0 flex-1 flex-col text-gray-900 dark:text-white">
        <Navbar
          onOpenMobileNavigation={() =>
            setMobileNavigationOpen(true)
          }
          mobileNavigationOpen={
            mobileNavigationOpen
          }
          mobileNavigationButtonRef={
            mobileNavigationButtonRef
          }
          onLogout={
            closeMobileNavigation
          }
        />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-0 sm:p-2 lg:p-6">
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