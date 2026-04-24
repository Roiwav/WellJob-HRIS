import { FiEye, FiPlay, FiCheckCircle } from "react-icons/fi";

export default function IncidentTable({
  incidents,
  openModal,
  onStartInvestigation,
  onOpenResolutionModal,
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/10 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 dark:border-white/10">
          <tr>
            <th className="px-6 py-3 text-left">Employee</th>
            <th className="px-6 py-3 text-left">Company</th>
            <th className="px-6 py-3 text-left">Violation</th>
            <th className="px-6 py-3 text-left">Severity</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {incidents.map((incident) => (
            <tr
              key={incident.id}
              className="border-t border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <td className="px-6 py-4 font-medium">
                {incident.employee}
              </td>

              <td className="px-6 py-4">{incident.company}</td>

              <td className="px-6 py-4">{incident.violation}</td>

              <td className="px-6 py-4">
                <SeverityBadge level={incident.severity} />
              </td>

              <td className="px-6 py-4">
                <StatusBadge status={incident.status} />
              </td>

              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">

                  {/* 🔥 OPEN → START INVESTIGATION */}
                  {incident.status === "Open" && (
                    <button
                      onClick={() => onStartInvestigation(incident)}
                      className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      <FiPlay size={14} />
                      Start
                    </button>
                  )}

                  {/* 🔥 INVESTIGATING → RESOLVE */}
                  {incident.status === "Investigating" && (
                    <button
                      onClick={() => onOpenResolutionModal(incident)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      <FiCheckCircle size={14} />
                      Resolve
                    </button>
                  )}

                  {/* 🔥 RESOLVED / CLOSED → VIEW */}
                  {(incident.status === "Resolved" ||
                    incident.status === "Closed") && (
                    <button
                      onClick={() => openModal(incident)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                    >
                      <FiEye size={14} />
                      View
                    </button>
                  )}

                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeverityBadge({ level }) {
  const colors = {
    Minor: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
    Major: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
    Critical: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[level]}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Open: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
    Investigating:
      "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
    Resolved:
      "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
    Closed:
      "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}