import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddIncidentModal from "../components/incidents/AddIncidentModal";
import IncidentModal from "../components/incidents/IncidentModal";
import { FiEdit2, FiSearch } from "react-icons/fi";
import {
  getSeverityByViolation,
  getSanctionByViolation,
} from "../utils/configStorage";

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";
const DEPLOYMENTS_KEY = "deployments";

function safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse localStorage key: ${key}`, error);
    return [];
  }
}

function normalizeIncidentWithRules(incident) {
  const violation = incident?.violation || "";
  const configuredSeverity = getSeverityByViolation(violation);
  const configuredSanction = getSanctionByViolation(violation);

  return {
    ...incident,
    severity: configuredSeverity || incident.severity || "Minor",
    sanction: configuredSanction || incident.sanction || "Warning",
  };
}

export default function Incidents() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const location = useLocation();
  const navigate = useNavigate();

  const storedIncidents = safeParse(INCIDENTS_KEY).map(normalizeIncidentWithRules);
  const storedEmployees = safeParse(EMPLOYEES_KEY);
  const storedDeployments = safeParse(DEPLOYMENTS_KEY);

  const activeEmployees = storedEmployees.filter((emp) => !emp.archived);

  const initialFilteredIncidents = storedIncidents.filter((incident) =>
    activeEmployees.some(
      (emp) => emp.id === incident.employeeId || emp.name === incident.employee
    )
  );

  const initialIncident = location.state?.incidentId
    ? initialFilteredIncidents.find((i) => i.id === location.state.incidentId)
    : null;

  const [incidents, setIncidents] = useState(initialFilteredIncidents);
  const [employees] = useState(activeEmployees);
  const [deployments] = useState(storedDeployments);
  const [openAddModal, setOpenAddModal] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState(initialIncident);
  const [editMode, setEditMode] = useState(initialIncident ? !isSuperAdmin : false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  useEffect(() => {
    if (location.state?.incidentId) {
      navigate(location.pathname, {
        replace: true,
        state: {},
      });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const syncIncidentsFromStorage = () => {
      const latestIncidents = safeParse(INCIDENTS_KEY).map(normalizeIncidentWithRules);

      const visibleIncidents = latestIncidents.filter((incident) =>
        activeEmployees.some(
          (emp) => emp.id === incident.employeeId || emp.name === incident.employee
        )
      );

      setIncidents(visibleIncidents);
    };

    window.addEventListener("dataUpdated", syncIncidentsFromStorage);
    window.addEventListener("storage", syncIncidentsFromStorage);

    return () => {
      window.removeEventListener("dataUpdated", syncIncidentsFromStorage);
      window.removeEventListener("storage", syncIncidentsFromStorage);
    };
  }, [activeEmployees]);

  const persistIncidents = (updatedIncidents) => {
    setIncidents(updatedIncidents);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updatedIncidents));
    window.dispatchEvent(new Event("dataUpdated"));
  };

  const handleAddIncident = (newIncident) => {
    const normalizedIncident = normalizeIncidentWithRules(newIncident);
    const updated = [normalizedIncident, ...incidents];

    persistIncidents(updated);
    setOpenAddModal(false);
  };

  const handleUpdateIncident = (updatedIncident) => {
    const normalizedIncident = normalizeIncidentWithRules(updatedIncident);

    const updated = incidents.map((item) =>
      item.id === normalizedIncident.id ? normalizedIncident : item
    );

    persistIncidents(updated);
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
        String(incident.company || "").toLowerCase().includes(keyword) ||
        String(incident.sanction || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || incident.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" || incident.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  return (
    <div className="p-8 space-y-6">
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

      <div className="flex flex-col xl:flex-row gap-3 mb-4 items-start xl:items-center">
        <div className="relative w-full max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

          <input
            type="text"
            placeholder="Search incident ID, employee, violation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
        >
          <option value="ALL">All Status</option>
          <option value="Open">Open</option>
          <option value="Investigating">Investigating</option>
          <option value="Resolved">Resolved</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
        >
          <option value="ALL">All Severity</option>
          <option value="Minor">Minor</option>
          <option value="Major">Major</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

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
                <th className="px-6 py-4">Sanction</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Reported Date</th>

                {!isSuperAdmin && (
                  <th className="px-6 py-4 text-right">Action</th>
                )}
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 8 : 9}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No incident records found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-6 py-4">{incident.id}</td>
                    <td className="px-6 py-4">{incident.employee}</td>
                    <td className="px-6 py-4">{incident.company || "-"}</td>
                    <td className="px-6 py-4">{incident.violation}</td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          incident.severity === "Critical"
                            ? "bg-red-100 text-red-700"
                            : incident.severity === "Major"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {incident.severity}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {incident.sanction || "-"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          incident.status === "Resolved"
                            ? "bg-green-100 text-green-700"
                            : incident.status === "Investigating"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {incident.status}
                      </span>
                    </td>

                    <td className="px-6 py-4">{incident.date}</td>

                    {!isSuperAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedIncident(incident);
                            setEditMode(true);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <FiEdit2 />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!editMode && selectedIncident && isSuperAdmin && (
        <IncidentModal
          incident={selectedIncident}
          close={() => setSelectedIncident(null)}
        />
      )}

      {editMode && selectedIncident && !isSuperAdmin && (
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