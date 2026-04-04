import { useState } from "react";
import IncidentTable from "../components/incidents/IncidentTable";
import IncidentModal from "../components/incidents/IncidentModal";

export default function Incidents() {

  const [selectedIncident, setSelectedIncident] = useState(null);

  const incidents = [
    {
      id: 1,
      employee: "Juan Dela Cruz",
      company: "ABC Security",
      violation: "Absenteeism",
      severity: "Minor",
      status: "Open",
      date: "2026-03-01",
    },
    {
      id: 2,
      employee: "Maria Santos",
      company: "XYZ Corp",
      violation: "Late Attendance",
      severity: "Major",
      status: "Investigating",
      date: "2026-03-05",
    },
    {
      id: 3,
      employee: "Pedro Reyes",
      company: "Delta Inc",
      violation: "Misconduct",
      severity: "Critical",
      status: "Resolved",
      date: "2026-02-20",
    },
  ];

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Incident & Disciplinary Management
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Track employee violations and disciplinary actions
        </p>
      </div>

      <IncidentTable
        incidents={incidents}
        openModal={setSelectedIncident}
      />

      <IncidentModal
        incident={selectedIncident}
        close={() => setSelectedIncident(null)}
      />

    </div>
  );
}