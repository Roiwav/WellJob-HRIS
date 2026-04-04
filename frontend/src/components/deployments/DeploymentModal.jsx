import { FiX } from "react-icons/fi";

export default function DeploymentModal({ deployment, close }) {

  if (!deployment) return null;

  return (

    <div className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-50">

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl p-6">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-lg font-semibold">
            Deployment Details
          </h2>

          <button onClick={close} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <FiX />
          </button>

        </div>

        <div className="space-y-4 text-sm">

          <Info label="Employee" value={deployment.employee} />
          <Info label="Company" value={deployment.company} />
          <Info label="Location" value={deployment.location} />
          <Info label="Start Date" value={deployment.start} />
          <Info label="End Date" value={deployment.end} />
          <Info label="Status" value={deployment.status} />

        </div>

        <div className="mt-6 flex justify-end gap-3">

          <button className="px-4 py-2 bg-green-600 text-white rounded">
            Mark Completed
          </button>

          <button className="px-4 py-2 bg-red-500 text-white rounded">
            Cancel Deployment
          </button>

        </div>

      </div>

    </div>

  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}