import { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useAuth } from "../../context/useAuth";

export default function DeploymentModal({
  deployment,
  close,
  mode,
  onUpdate
}) {

  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (deployment) setForm(deployment);
  }, [deployment]);

  if (!deployment || !form) return null;

  // SUPER ADMIN = ALWAYS VIEW MODE
  const isEdit = mode === "edit" && !isSuperAdmin;

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = () => {
    if (isSuperAdmin) return; // extra protection
    onUpdate(form);
    close();
  };

  const handleComplete = () => {
    if (isSuperAdmin) return;

    onUpdate({
      ...form,
      status: "Completed",
      end: new Date().toLocaleDateString()
    });
    close();
  };

  const handleCancelDeployment = () => {
    if (isSuperAdmin) return;

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

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Deployment" : "Deployment Details"}
          </h2>

          <button onClick={close}>
            <FiX />
          </button>

        </div>

        <div className="space-y-4 text-sm">

          <Info label="Employee" value={form.employee} />
          <Info label="Company" value={form.company} />

          {isEdit ? (
            <Input label="Location" name="location" value={form.location} onChange={handleChange} />
          ) : (
            <Info label="Location" value={form.location} />
          )}

          {isEdit ? (
            <DateInput label="Start Date" name="start" value={form.start} onChange={handleChange} />
          ) : (
            <Info label="Start Date" value={form.start} />
          )}

          {isEdit ? (
            <DateInput label="End Date" name="end" value={form.end === "—" ? "" : form.end} onChange={handleChange} />
          ) : (
            <Info label="End Date" value={form.end} />
          )}

          <Info label="Status" value={form.status} />

        </div>

        <div className="mt-6 flex justify-end gap-3">

          {!isEdit ? (
            <>
              {!isSuperAdmin && (
                <>
                  <button onClick={handleComplete} className="px-4 py-2 bg-green-600 text-white rounded">
                    Mark Completed
                  </button>

                  <button onClick={handleCancelDeployment} className="px-4 py-2 bg-red-500 text-white rounded">
                    Cancel Deployment
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={close} className="px-4 py-2 bg-gray-300 rounded text-black">
                Close
              </button>

              {!isSuperAdmin && (
                <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded">
                  Save Changes
                </button>
              )}
            </>
          )}

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

function Input({ label, name, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full mt-1 rounded border px-3 py-2"
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
        className="w-full mt-1 rounded border px-3 py-2"
      />
    </div>
  );
}