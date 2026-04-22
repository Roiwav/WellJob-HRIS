import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import IncidentActions from "./IncidentActions";

const INCIDENTS_KEY = "incidents";

export default function IncidentModal({ incident, close }) {
  const [currentIncident, setCurrentIncident] = useState(incident);

  useEffect(() => {
    setCurrentIncident(incident);
  }, [incident]);

  useEffect(() => {
    if (!incident?.id) return;

    const syncIncident = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(INCIDENTS_KEY) || "[]");
        const updatedIncident = stored.find((item) => item.id === incident.id);

        if (updatedIncident) {
          setCurrentIncident(updatedIncident);
        }
      } catch (error) {
        console.error("Failed to sync incident:", error);
      }
    };

    window.addEventListener("dataUpdated", syncIncident);
    window.addEventListener("storage", syncIncident);

    return () => {
      window.removeEventListener("dataUpdated", syncIncident);
      window.removeEventListener("storage", syncIncident);
    };
  }, [incident]);

  if (!currentIncident) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Incident Details
          </h2>

          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4 text-sm">
            <Info label="Employee" value={currentIncident.employee} />
            <Info label="Company" value={currentIncident.company} />
            <Info label="Violation Type" value={currentIncident.violation} />

            <div className="grid grid-cols-2 gap-4">
              <Info label="Severity" value={currentIncident.severity} />
              <Info label="Status" value={currentIncident.status} />
            </div>

            <Info label="Reported Date" value={currentIncident.date} />
          </div>

          <IncidentActions incident={currentIncident} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}