import { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";

export default function DeploymentModal({
  deployment,
  close,
  mode,
  onUpdate
}) {

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (deployment) setForm(deployment);
  }, [deployment]);

  if (!deployment || !form) return null;

  const isEdit = mode === "edit";

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // 🔥 SAVE EDIT (no status editing)
  const handleSave = () => {
    onUpdate(form);
    close();
  };

  // 🔥 MARK COMPLETED
  const handleComplete = () => {
    onUpdate({
      ...form,
      status: "Completed",
      end: new Date().toLocaleDateString()
    });
    close();
  };

  // 🔥 CANCEL DEPLOYMENT
  const handleCancelDeployment = () => {
    onUpdate({
      ...form,
      status: "Cancelled",
      end: new Date().toLocaleDateString()
    });
    close();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-50">

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">

          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Deployment" : "Deployment Details"}
          </h2>

          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <FiX />
          </button>

        </div>

        {/* BODY */}
        <div className="space-y-4 text-sm">

          <Info label="Employee" value={form.employee} />
          <Info label="Company" value={form.company} />

          {/* LOCATION */}
          {isEdit ? (
            <Input
              label="Location"
              name="location"
              value={form.location}
              onChange={handleChange}
            />
          ) : (
            <Info label="Location" value={form.location} />
          )}

          {/* START DATE */}
          {isEdit ? (
            <DateInput
              label="Start Date"
              name="start"
              value={form.start}
              onChange={handleChange}
            />
          ) : (
            <Info label="Start Date" value={form.start} />
          )}

          {/* END DATE */}
          {isEdit ? (
            <DateInput
              label="End Date"
              name="end"
              value={form.end === "—" ? "" : form.end}
              onChange={handleChange}
            />
          ) : (
            <Info label="End Date" value={form.end} />
          )}

          {/* 🔥 STATUS (VIEW ONLY ALWAYS) */}
          <Info label="Status" value={form.status} />

        </div>

        {/* FOOTER BUTTONS */}
        <div className="mt-6 flex justify-end gap-3">

          {!isEdit ? (
            <>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Mark Completed
              </button>

              <button
                onClick={handleCancelDeployment}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Cancel Deployment
              </button>
            </>
          ) : (
            <>
              <button
                onClick={close}
                className="px-4 py-2 bg-gray-300 rounded text-black"
              >
                Close
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Save Changes
              </button>
            </>
          )}

        </div>

      </div>

    </div>
  );
}

/* COMPONENTS */

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function Input({ label, name, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full mt-1 rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      />
    </div>
  );
}

function DateInput({ label, name, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full mt-1 rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      />
    </div>
  );
}