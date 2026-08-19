import React, {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import axios from "axios";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import MainLayout from "./layout/MainLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import ArchivedEmployees from "./pages/ArchivedEmployees";
import Deployments from "./pages/Deployments";
import Incidents from "./pages/Incidents";
import KPIReports from "./pages/KPIReports";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import SuperAdminPortal from "./pages/SuperAdminPortal";
import ChangePassword from "./pages/ChangePassword";
import SystemConfiguration from "./pages/SystemConfiguration";
import SystemMaintenance from "./pages/SystemMaintenance";

// Audit pages
import TechnicalAuditLogs from "./pages/TechnicalAuditLogs";
import OperationalAuditLogs from "./pages/OperationalAuditLogs";

// Authentication
import {
  AuthProvider,
} from "./context/AuthContext";
import {
  useAuth,
} from "./context/useAuth";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ROLES } from "./constants/roles";

import {
  MAINTENANCE_MODE_DETECTED_EVENT,
} from "./utils/authenticatedFetch";

const AUTHENTICATED_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.HR_MANAGER,
  ROLES.HR_STAFF,
  ROLES.IT_SUPPORT,
];

const HR_MODULE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.HR_MANAGER,
  ROLES.HR_STAFF,
];

const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:
          30 * 1000,

        refetchOnWindowFocus:
          true,

        refetchOnReconnect:
          true,

        retry:
          1,
      },

      mutations: {
        retry:
          0,
      },
    },
  });

/*
 * Register JWT transport before React renders
 * any child component.
 *
 * This prevents child mount requests from firing
 * before Axios receives its Authorization interceptor.
 *
 * The token is read for every request so
 * login/logout/token replacement is reflected
 * without recreating the interceptor.
 */
axios.interceptors.request.use(
  (config) => {
    const token = String(
      localStorage.getItem(
        "token"
      ) || ""
    ).trim();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(error)
);

function isAxiosMaintenanceError(
  error
) {
  if (
    error?.response?.status !==
    503
  ) {
    return false;
  }

  const responseData =
    error?.response?.data;

  const message =
    typeof responseData ===
    "string"
      ? responseData
      : responseData?.error ||
        responseData?.message ||
        "";

  return String(
    message || ""
  )
    .trim()
    .toLowerCase()
    .includes(
      "maintenance"
    );
}

function MaintenanceScreen() {
  const [
    isChecking,
    setIsChecking,
  ] = useState(false);

  const handleCheckSystemStatus =
    () => {
      if (isChecking) {
        return;
      }

      setIsChecking(true);

      window.location.reload();
    };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl text-amber-300"
              aria-hidden="true"
            >
              🛠
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-300">
                Temporary Service Notice
              </p>

              <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                System Under Maintenance
              </h1>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-8">
          <div>
            <p className="text-base leading-7 text-slate-300">
              The Welljob HRIS is temporarily
              unavailable while authorized IT
              Support performs system
              maintenance.
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Normal HR operations are
              temporarily restricted to protect
              system data while technical
              maintenance, validation, or
              recovery activities are being
              completed.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="font-bold text-amber-200">
              What should I do?
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              Please wait until IT Support
              completes the maintenance
              activity. Use the button below
              to check whether normal system
              access has already been restored.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Your account and existing HR
              records are not modified by this
              maintenance notice.
            </p>

            <button
              type="button"
              disabled={
                isChecking
              }
              aria-busy={
                isChecking
              }
              onClick={
                handleCheckSystemStatus
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-70"
            >
              {isChecking
                ? "Checking System Status..."
                : "Check System Status"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ApplicationContent({
  isMaintenance,
}) {
  const { user } =
    useAuth();

  const isITSupport =
    user?.role ===
    ROLES.IT_SUPPORT;

  /*
   * Backend maintenance mode blocks normal
   * HR operations while IT Support retains
   * access for technical work.
   *
   * Once maintenance is detected, normal
   * application routes are unmounted for
   * non-IT roles so stale/zero-value screens
   * are not displayed.
   */
  if (
    isMaintenance &&
    user &&
    !isITSupport
  ) {
    return (
      <MaintenanceScreen />
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={<Login />}
      />

      {/* All authenticated users */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={
              AUTHENTICATED_ROLES
            }
          />
        }
      >
        {/*
         * Password change intentionally
         * remains outside MainLayout.
         */}
        <Route
          path="/change-password"
          element={
            <ChangePassword />
          }
        />

        {/*
         * Protected application shell.
         *
         * Navbar, Sidebar, and global
         * widgets mount only after
         * authentication succeeds.
         */}
        <Route
          element={
            <MainLayout />
          }
        >
          {/* Dashboard */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={
                  AUTHENTICATED_ROLES
                }
              />
            }
          >
            <Route
              path="/"
              element={
                <Dashboard />
              }
            />
          </Route>

          {/* HR modules */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={
                  HR_MODULE_ROLES
                }
              />
            }
          >
            <Route
              path="/employees"
              element={
                <Employees />
              }
            />

            <Route
              path="/deployments"
              element={
                <Deployments />
              }
            />

            <Route
              path="/incidents"
              element={
                <Incidents />
              }
            />

            <Route
              path="/notifications"
              element={
                <Notifications />
              }
            />
          </Route>

          {/* HR Manager-only employee archive */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.HR_MANAGER,
                ]}
              />
            }
          >
            <Route
              path="/employees/archive"
              element={
                <ArchivedEmployees />
              }
            />
          </Route>

          {/* KPI */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.SUPER_ADMIN,
                  ROLES.HR_MANAGER,
                ]}
              />
            }
          >
            <Route
              path="/kpi"
              element={
                <KPIReports />
              }
            />
          </Route>

          {/* IT Support module */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.IT_SUPPORT,
                ]}
              />
            }
          >
            <Route
              path="/settings"
              element={
                <Settings />
              }
            />

            <Route
              path="/system-maintenance"
              element={
                <SystemMaintenance />
              }
            />

            <Route
              path="/technical-audit-logs"
              element={
                <TechnicalAuditLogs />
              }
            />
          </Route>

          {/* Super Admin module */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.SUPER_ADMIN,
                ]}
              />
            }
          >
            <Route
              path="/super-admin"
              element={
                <SuperAdminPortal />
              }
            />

            <Route
              path="/system-configuration"
              element={
                <SystemConfiguration />
              }
            />

            <Route
              path="/operational-audit-logs"
              element={
                <OperationalAuditLogs />
              }
            />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  const [
    isMaintenance,
    setIsMaintenance,
  ] = useState(false);

  useEffect(() => {
    /*
     * Native fetch requests use
     * authenticatedFetch().
     *
     * authenticatedFetch dispatches this
     * event only when the backend returns
     * a maintenance-related HTTP 503.
     */
    const handleFetchMaintenance =
      () => {
        setIsMaintenance(true);
      };

    window.addEventListener(
      MAINTENANCE_MODE_DETECTED_EVENT,
      handleFetchMaintenance
    );

    /*
     * Axios remains in use by some
     * application modules.
     *
     * Only maintenance-related 503
     * responses activate the global
     * maintenance screen. Other 503
     * errors remain normal page/API
     * errors.
     */
    const responseInterceptor =
      axios.interceptors.response.use(
        (response) =>
          response,

        (error) => {
          if (
            isAxiosMaintenanceError(
              error
            )
          ) {
            setIsMaintenance(
              true
            );
          }

          return Promise.reject(
            error
          );
        }
      );

    return () => {
      window.removeEventListener(
        MAINTENANCE_MODE_DETECTED_EVENT,
        handleFetchMaintenance
      );

      axios.interceptors.response.eject(
        responseInterceptor
      );
    };
  }, []);

  return (
    <QueryClientProvider
      client={queryClient}
    >
      <AuthProvider>
        <ApplicationContent
          isMaintenance={
            isMaintenance
          }
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;