import { Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import KPIs from "./pages/KPIs";
import Employees from "./pages/Employees";

// Create empty placeholder pages for now
function Deployment() {
  return <div className="text-xl">Deployment Page</div>;
}

function Incidents() {
  return <div className="text-xl">Incidents Page</div>;
}

function Disciplinary() {
  return <div className="text-xl">Disciplinary Page</div>;
}

function Notifications() {
  return <div className="text-xl">Notifications Page</div>;
}

function UserManagement() {
  return <div className="text-xl">User Management Page</div>;
}

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/deployment" element={<Deployment />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/KPIs" element={<KPIs />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/users" element={<UserManagement />} />
      </Route>
    </Routes>
  );
}

export default App;
