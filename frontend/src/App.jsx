import React, { useState, useEffect } from 'react'; // --- NEW: In-import ang useState at useEffect ---
import { Routes, Route, Navigate } from "react-router-dom";
import axios from 'axios';

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

function App() {
  // --- NEW: State para kontrolin ang paglabas ng Maintenance Banner ---
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    // --- NEW: Inilipat natin ang Interceptor sa loob para magamit ang state ---
    const interceptor = axios.interceptors.response.use(
      (response) => {
        // Kung okay na ang system, itago ang banner
        setIsMaintenance(false);
        return response;
      },
      (error) => {
        if (error.response && error.response.status === 503) {
          // Imbes na mag-redirect, i-ON lang natin ang banner!
          setIsMaintenance(true);
        }
        return Promise.reject(error);
      }
    );

    // Cleanup function
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthProvider>
      
      

      <Routes>

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />
        {/* Tinanggal na natin ang /maintenance route dahil hindi na kailangan */}

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

          {/* DASHBOARD (ALL ROLES) */}
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
            <Route path="/employees/archive" element={<ArchivedEmployees />} />
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
            <Route path="/system-maintenance" element={<SystemMaintenance />} />

            {/* TECHNICAL AUDIT */}
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

            {/* OPERATIONAL AUDIT */}
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
  );
}

export default App;