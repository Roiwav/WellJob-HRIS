import { FiEye } from "react-icons/fi";

export default function IncidentTable({ incidents, openModal }) {
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

              <td className="px-6 py-4 font-medium">{incident.employee}</td>

              <td className="px-6 py-4">{incident.company}</td>

              <td className="px-6 py-4">{incident.violation}</td>

              <td className="px-6 py-4">
                <SeverityBadge level={incident.severity} />
              </td>

              <td className="px-6 py-4">
                <StatusBadge status={incident.status} />
              </td>

              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => openModal(incident)}
                  className="text-indigo-500 hover:text-indigo-700"
                >
                  <FiEye />
                </button>
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
    Minor: "bg-blue-100 text-blue-600",
    Major: "bg-amber-100 text-amber-600",
    Critical: "bg-red-100 text-red-600",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[level]}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {

  const colors = {
    Open: "bg-red-100 text-red-600",
    Investigating: "bg-amber-100 text-amber-600",
    Resolved: "bg-green-100 text-green-600",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}