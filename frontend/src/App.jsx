import { Routes, Route, Navigate } from "react-router-dom";

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

// AUDIT PAGES
import TechnicalAuditLogs from "./pages/TechnicalAuditLogs";
import OperationalAuditLogs from "./pages/OperationalAuditLogs";

// AUTH
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ROLES } from "./constants/roles";

function App() {
  return (
    <AuthProvider>
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