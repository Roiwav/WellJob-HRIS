import { Routes, Route } from "react-router-dom";

import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Deployments from "./pages/Deployments";
import Incidents from "./pages/Incidents";
import KPIReports from "./pages/KPIReports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>

        <Route path="/" element={<Dashboard />} />

        <Route path="/employees" element={<Employees />} />

        <Route path="/deployments" element={<Deployments />} />

        <Route path="/incidents" element={<Incidents />} />

        <Route path="/kpi" element={<KPIReports />} />

        <Route path="/notifications" element={<Notifications />} />

        <Route path="/settings" element={<Settings />} />

      </Route>
    </Routes>
  );
}

export default App;