import { FiEye } from "react-icons/fi";

export default function DeploymentTable({ deployments, openModal }) {

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/10 overflow-x-auto">

      <table className="w-full text-sm">

        <thead className="border-b border-gray-200 dark:border-white/10">
          <tr>
            <th className="px-6 py-3 text-left">Employee</th>
            <th className="px-6 py-3 text-left">Company</th>
            <th className="px-6 py-3 text-left">Location</th>
            <th className="px-6 py-3 text-left">Start Date</th>
            <th className="px-6 py-3 text-left">End Date</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody>

          {deployments.map((deployment) => (

            <tr
              key={deployment.id}
              className="border-t border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5"
            >

              <td className="px-6 py-4 font-medium">
                {deployment.employee}
              </td>

              <td className="px-6 py-4">
                {deployment.company}
              </td>

              <td className="px-6 py-4">
                {deployment.location}
              </td>

              <td className="px-6 py-4">
                {deployment.start}
              </td>

              <td className="px-6 py-4">
                {deployment.end}
              </td>

              <td className="px-6 py-4">
                <StatusBadge status={deployment.status} />
              </td>

              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => openModal(deployment)}
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

function StatusBadge({ status }) {

  const colors = {
    Active: "bg-green-100 text-green-600",
    Completed: "bg-blue-100 text-blue-600",
    Pending: "bg-amber-100 text-amber-600",
    Cancelled: "bg-red-100 text-red-600"
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}