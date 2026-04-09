import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Deployments from "./pages/Deployments";
import Incidents from "./pages/Incidents";
import KPIReports from "./pages/KPIReports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import SuperAdminPortal from "./pages/SuperAdminPortal";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ROLES } from "./constants/roles";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<MainLayout />}>
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

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_STAFF]}
              />
            }
          >
            <Route path="/employees" element={<Employees />} />
          </Route>

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
            <Route path="/deployments" element={<Deployments />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HR_MANAGER]}
              />
            }
          >
            <Route path="/kpi" element={<KPIReports />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.IT_SUPPORT]} />
            }
          >
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route
            element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}
          >
            <Route path="/super-admin" element={<SuperAdminPortal />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;