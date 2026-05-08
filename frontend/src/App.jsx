import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import MainLayout from "./layout/MainLayout";

// PAGES
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

// AUDIT PAGES
import TechnicalAuditLogs from "./pages/TechnicalAuditLogs";
import OperationalAuditLogs from "./pages/OperationalAuditLogs";

// AUTH
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ROLES } from "./constants/roles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => {
        setIsMaintenance(false);
        return response;
      },
      (error) => {
        if (error.response && error.response.status === 503) {
          setIsMaintenance(true);
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {isMaintenance && (
          <div className="fixed left-1/2 top-4 z-[9999] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 shadow-lg dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200">
            System maintenance is currently active. Some actions may be
            temporarily unavailable.
          </div>
        )}

        <Routes>
          {/* PUBLIC */}
          <Route path="/login" element={<Login />} />

          {/* ALL AUTHENTICATED USERS */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.SUPER_ADMIN,
                  ROLES.HR_MANAGER,
                  ROLES.HR_STAFF,
                  ROLES.IT_SUPPORT,
                ]}
              />
            }
          >
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* MAIN LAYOUT */}
          <Route element={<MainLayout />}>
            {/* DASHBOARD */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    ROLES.SUPER_ADMIN,
                    ROLES.HR_MANAGER,
                    ROLES.HR_STAFF,
                    ROLES.IT_SUPPORT,
                  ]}
                />
              }
            >
              <Route path="/" element={<Dashboard />} />
            </Route>

            {/* HR MODULES */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    ROLES.SUPER_ADMIN,
                    ROLES.HR_MANAGER,
                    ROLES.HR_STAFF,
                  ]}
                />
              }
            >
              <Route path="/employees" element={<Employees />} />
              <Route
                path="/employees/archive"
                element={<ArchivedEmployees />}
              />
              <Route path="/deployments" element={<Deployments />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* KPI */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER]}
                />
              }
            >
              <Route path="/kpi" element={<KPIReports />} />
            </Route>

            {/* IT SUPPORT MODULE */}
            <Route
              element={<ProtectedRoute allowedRoles={[ROLES.IT_SUPPORT]} />}
            >
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/system-maintenance"
                element={<SystemMaintenance />}
              />

              <Route
                path="/technical-audit-logs"
                element={<TechnicalAuditLogs />}
              />
            </Route>

            {/* SUPER ADMIN MODULE */}
            <Route
              element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}
            >
              <Route path="/super-admin" element={<SuperAdminPortal />} />
              <Route
                path="/system-configuration"
                element={<SystemConfiguration />}
              />

              <Route
                path="/operational-audit-logs"
                element={<OperationalAuditLogs />}
              />
            </Route>
          </Route>

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;