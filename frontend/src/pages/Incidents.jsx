import { useEffect, useMemo, useState } from "react";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddIncidentModal from "../components/incidents/AddIncidentModal";
import IncidentModal from "../components/incidents/IncidentModal";
import { FiEye, FiEdit2 } from "react-icons/fi"; // 🔥 NEW

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";
const DEPLOYMENTS_KEY = "deployments";

export default function Incidents() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [incidents, setIncidents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [openAddModal, setOpenAddModal] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState(null); // 🔥 NEW
  const [editMode, setEditMode] = useState(false); // 🔥 NEW

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  useEffect(() => {
    const storedIncidents = JSON.parse(localStorage.getItem(INCIDENTS_KEY) || "[]");
    const storedEmployees = JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || "[]");
    const storedDeployments = JSON.parse(localStorage.getItem(DEPLOYMENTS_KEY) || "[]");

    setIncidents(storedIncidents);
    setEmployees(storedEmployees);
    setDeployments(storedDeployments);
  }, []);

  const handleAddIncident = (newIncident) => {
    const updated = [newIncident, ...incidents];
    setIncidents(updated);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

// 🔥 REAL-TIME TRIGGER
window.dispatchEvent(new Event("dataUpdated"));
    setOpenAddModal(false);
  };

  // 🔥 EDIT SAVE
  const handleUpdateIncident = (updatedIncident) => {
    const updated = incidents.map((item) =>
      item.id === updatedIncident.id ? updatedIncident : item
    );

    setIncidents(updated);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

    setEditMode(false);
    setSelectedIncident(null);
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        String(incident.id || "").toLowerCase().includes(keyword) ||
        String(incident.employee || "").toLowerCase().includes(keyword) ||
        String(incident.violation || "").toLowerCase().includes(keyword) ||
        String(incident.company || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || incident.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" || incident.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  return (
    <div className="p-8 space-y-6">

      {/* 🔥 HEADER (UNCHANGED) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Incident Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "View-only access for Super Admin."
              : "Monitor incidents and manage disciplinary actions."}
          </p>
        </div>

        <RoleGuard permission={PERMISSIONS.CAN_ADD_INCIDENT}>
          <button
            type="button"
            onClick={() => setOpenAddModal(true)}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            + Add Incident Report
          </button>
        </RoleGuard>
      </div>

      {/* 🔥 FILTER (UNCHANGED) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search incident ID, employee, violation, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="Open">Open</option>
            <option value="Investigating">Investigating</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm outline-none"
          >
            <option value="ALL">All Severity</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* 🔥 TABLE (ONLY CHANGE = ACTION COLUMN) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Violation Type</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Reported Date</th>
                <th className="px-6 py-4 text-right">Action</th> {/* 🔥 NEW */}
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {filteredIncidents.map((incident) => (
                <tr key={incident.id} className="border-t border-gray-200 dark:border-gray-700">

                  <td className="px-6 py-4">{incident.id}</td>
                  <td className="px-6 py-4">{incident.employee}</td>
                  <td className="px-6 py-4">{incident.company || "-"}</td>
                  <td className="px-6 py-4">{incident.violation}</td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      incident.severity === "Critical"
                        ? "bg-red-100 text-red-700"
                        : incident.severity === "Major"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {incident.severity}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      incident.status === "Resolved"
                        ? "bg-green-100 text-green-700"
                        : incident.status === "Investigating"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {incident.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">{incident.date}</td>

                  {/* 🔥 ICON ACTIONS */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">

                      <button
                        onClick={() => {
                          setSelectedIncident(incident);
                          setEditMode(false);
                        }}
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        <FiEye />
                      </button>

                      {!isSuperAdmin && (
                        <button
                          onClick={() => {
                            setSelectedIncident(incident);
                            setEditMode(true);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <FiEdit2 />
                        </button>
                      )}

                    </div>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* VIEW */}
      {!editMode && selectedIncident && (
        <IncidentModal
          incident={selectedIncident}
          close={() => setSelectedIncident(null)}
        />
      )}

      {/* EDIT */}
      {editMode && selectedIncident && (
        <AddIncidentModal
          isOpen={true}
          editingIncident={selectedIncident}
          onClose={() => {
            setEditMode(false);
            setSelectedIncident(null);
          }}
          onSave={handleUpdateIncident}
          employees={employees}
          deployments={deployments}
          existingIncidents={incidents}
        />
      )}

      {/* ADD */}
      <AddIncidentModal
        isOpen={openAddModal}
        onClose={() => setOpenAddModal(false)}
        onSave={handleAddIncident}
        employees={employees}
        deployments={deployments}
        existingIncidents={incidents}
      />
    </div>
  );
}