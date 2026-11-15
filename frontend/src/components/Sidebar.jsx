import { useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiClipboard,
  FiFileText,
  FiHome,
  FiMapPin,
  FiMoon,
  FiShield,
  FiSliders,
  FiSun,
  FiTool,
  FiUsers,
  FiX,
} from "react-icons/fi";

import logo from "../assets/Logo.png";
import { sidebarItems } from "../config/sidebarItems";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/useAuth";

const iconMap = {
  Dashboard: <FiHome />,
  Employees: <FiUsers />,
  Attendance: <FiClipboard />,
  Deployments: <FiMapPin />,
  Deployed: <FiMapPin />,
  "KPI Reports": <FiBarChart2 />,
  Incidents: <FiAlertTriangle />,
  Notifications: <FiBell />,
  "User Management": <FiUsers />,
  "Super Admin Portal": <FiShield />,
  "System Configuration": <FiSliders />,
  Administration: <FiSliders />,
  "Technical Audit": <FiShield />,
  "Operational Audit": <FiFileText />,
};

const sidebarDisplayLabels = {
  Deployments: "Deployed",
  "System Configuration": "Administration",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getSidebarLabel(title) {
  return sidebarDisplayLabels[title] || title;
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null
  );
}

function getNavigationItems(userRole) {
  const filteredItems = userRole
    ? sidebarItems.filter((item) =>
        item.allowedRoles.includes(userRole)
      )
    : [];

  if (userRole !== ROLES.IT_SUPPORT) {
    return filteredItems;
  }

  return [
    ...filteredItems,
    {
      title: "System Maintenance",
      path: "/system-maintenance",
      icon: <FiTool className="text-red-500" />,
    },
  ];
}

export default function Sidebar({
  toggleTheme,
  darkMode,
  mobileOpen = false,
  onMobileClose,
  mobileTriggerRef,
}) {
  const { user } = useAuth();
  const navigationItems = getNavigationItems(user?.role);

  return (
    <>
      <aside
        className="
          group/sidebar relative z-50 hidden h-screen w-16 shrink-0
          flex-col overflow-hidden border-r border-gray-200
          bg-white transition-[width] duration-200 ease-out hover:w-48
          supports-[height:100dvh]:h-dvh lg:flex
          dark:border-white/10 dark:bg-slate-950
        "
      >
        <div className="flex h-16 shrink-0 items-center justify-center px-3 transition-all duration-200 group-hover/sidebar:justify-start group-hover/sidebar:gap-3">
          <img
            src={logo}
            alt="Welljob Logo"
            draggable="false"
            className="h-8 shrink-0 select-none object-contain"
          />

          <span
            className="
              pointer-events-none absolute -translate-x-2 whitespace-nowrap
              text-lg font-semibold text-gray-900 opacity-0 transition-all
              duration-150 group-hover/sidebar:relative
              group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100
              dark:text-white
            "
          >
            HR System
          </span>
        </div>

        <nav
          className="mt-5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden"
          aria-label="Main navigation"
        >
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.path}
              to={item.path}
              icon={item.icon || iconMap[item.title] || <FiHome />}
              label={getSidebarLabel(item.title)}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-200 p-3 dark:border-white/10">
          <button
            type="button"
            onClick={toggleTheme}
            className="
              flex w-full items-center justify-center gap-0 rounded-lg p-3
              transition-colors duration-150 hover:bg-gray-200
              group-hover/sidebar:justify-start group-hover/sidebar:gap-3
              dark:hover:bg-white/10
            "
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <span
              className={`shrink-0 text-xl ${
                darkMode
                  ? "text-yellow-400"
                  : "text-slate-700 dark:text-gray-300"
              }`}
            >
              {darkMode ? <FiSun /> : <FiMoon />}
            </span>

            <span
              className="
                pointer-events-none absolute -translate-x-2 whitespace-nowrap
                text-sm font-medium text-gray-900 opacity-0 transition-all
                duration-150 group-hover/sidebar:relative
                group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100
                dark:text-white
              "
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
        </div>
      </aside>

      <MobileNavigationDrawer
        open={mobileOpen}
        onClose={onMobileClose}
        triggerRef={mobileTriggerRef}
        navigationItems={navigationItems}
        toggleTheme={toggleTheme}
        darkMode={darkMode}
      />
    </>
  );
}

function MobileNavigationDrawer({
  open,
  onClose,
  triggerRef,
  navigationItems,
  toggleTheme,
  darkMode,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const requestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const restoreFocusTarget = triggerRef?.current || null;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(panelRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement ||
          !panelRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement ||
          !panelRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      window.setTimeout(() => {
        restoreFocusTarget?.focus?.({ preventScroll: true });
      }, 0);
    };
  }, [open, requestClose, triggerRef]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] lg:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 h-full w-full bg-slate-950/60 backdrop-blur-sm"
        onClick={requestClose}
      />

      <aside
        id="mobile-navigation-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        tabIndex={-1}
        className="relative flex h-screen w-[min(20rem,88vw)] flex-col overflow-hidden border-r border-gray-200 bg-white shadow-2xl outline-none supports-[height:100dvh]:h-dvh dark:border-white/10 dark:bg-slate-950"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-4 dark:border-white/10">
          <img
            src={logo}
            alt="Welljob Logo"
            draggable="false"
            className="h-8 shrink-0 select-none object-contain"
          />
          <span
            id="mobile-navigation-title"
            className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900 dark:text-white"
          >
            HR System
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <FiX size={22} aria-hidden="true" />
          </button>
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4"
          aria-label="Mobile main navigation"
        >
          {navigationItems.map((item) => (
            <MobileSidebarItem
              key={item.path}
              to={item.path}
              icon={item.icon || iconMap[item.title] || <FiHome />}
              label={getSidebarLabel(item.title)}
              onSelect={requestClose}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-200 p-3 dark:border-white/10">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-medium text-gray-900 transition hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:text-white dark:hover:bg-white/10"
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <span
              className={`shrink-0 text-xl ${
                darkMode
                  ? "text-yellow-400"
                  : "text-slate-700 dark:text-gray-300"
              }`}
            >
              {darkMode ? <FiSun /> : <FiMoon />}
            </span>
            <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function MobileSidebarItem({ to, icon, label, onSelect }) {
  return (
    <NavLink
      to={to}
      onClick={onSelect}
      className={({ isActive }) =>
        `flex items-center gap-4 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-gray-700 hover:bg-gray-100 hover:text-black dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
        }`
      }
    >
      <span className="shrink-0 text-xl">{icon}</span>
      <span className="min-w-0 break-words">{label}</span>
    </NavLink>
  );
}

function SidebarItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `
          mx-2 flex items-center justify-center gap-0 rounded-lg p-3
          transition-colors duration-150 group-hover/sidebar:justify-start
          group-hover/sidebar:gap-4
          ${
            isActive
              ? "bg-indigo-600 text-white"
              : "text-gray-600 hover:bg-gray-200 hover:text-black dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          }
        `
      }
    >
      <span className="shrink-0 text-xl">{icon}</span>

      <span
        className="
          pointer-events-none absolute -translate-x-2 whitespace-nowrap
          text-sm font-medium opacity-0 transition-all duration-150
          group-hover/sidebar:relative group-hover/sidebar:translate-x-0
          group-hover/sidebar:opacity-100
        "
      >
        {label}
      </span>
    </NavLink>
  );
}