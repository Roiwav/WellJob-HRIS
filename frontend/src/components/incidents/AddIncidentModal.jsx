import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

const VIOLATION_OPTIONS = [
  "Late Attendance",
  "Absence Without Leave",
  "Policy Violation",
  "Insubordination",
  "Misconduct",
  "Tardiness",
  "Unauthorized Leave",
];

const SEVERITY_OPTIONS = ["Minor", "Major", "Critical"];
const STATUS_OPTIONS = ["Open", "Investigating", "Resolved"];

function generateIncidentId(existingIncidents = []) {
  const maxNumber = existingIncidents.reduce((max, item) => {
    const match = String(item.id || "").match(/INC-(\d+)/);
    const num = match ? Number(match[1]) : 0;
    return num > max ? num : max;
  }, 1000);

  return `INC-${maxNumber + 1}`;
}

export default function AddIncidentModal({
  isOpen,
  onClose,
  onSave,
  employees = [],
  deployments = [],
  existingIncidents = [],
  editingIncident = null, // 🔥 NEW
}) {
  const [formData, setFormData] = useState({
    id: "",
    employeeId: "",
    employee: "",
    company: "",
    violation: "",
    severity: "Minor",
    status: "Open",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    // 🔥 EDIT MODE
    if (editingIncident) {
      setFormData(editingIncident);
      return;
    }

    // 🔥 ADD MODE
    setFormData({
      id: generateIncidentId(existingIncidents),
      employeeId: "",
      employee: "",
      company: "",
      violation: "",
      severity: "Minor",
      status: "Open",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });

  }, [isOpen, editingIncident, existingIncidents]);

  const employeeOptions = useMemo(() => {
    return employees.map((emp) => ({
      id: emp.id || emp.employeeId || emp.employee_id || emp.name,
      name: emp.name || emp.full_name || "",
      company: emp.company || "",
    }));
  }, [employees]);

  const handleEmployeeChange = (e) => {
    const selectedId = e.target.value;
    const selectedEmployee = employeeOptions.find(
      (emp) => String(emp.id) === String(selectedId)
    );

    const activeDeployment = deployments.find(
      (dep) =>
        String(dep.employeeId || dep.employee_id || dep.employee) === String(selectedId)
    );

    setFormData((prev) => ({
      ...prev,
      employeeId: selectedId,
      employee: selectedEmployee?.name || "",
      company:
        activeDeployment?.company ||
        activeDeployment?.clientCompany ||
        selectedEmployee?.company ||
        "",
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.employee || !formData.violation || !formData.date) {
      alert("Please complete all required fields.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user"));

    const newIncident = {
      ...formData,
      reportedBy: formData.reportedBy || user?.name || "Unknown",
    };

    onSave(newIncident);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl">

        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingIncident ? "Edit Incident Report" : "Add Incident Report"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* UI UNCHANGED */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Incident ID</label>
              <input
                type="text"
                value={formData.id}
                disabled
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-gray-100 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Reported Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              name="employeeId"
              value={formData.employeeId}
              onChange={handleEmployeeChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
            >
              <option value="">Select employee</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company / Client</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Violation Type <span className="text-red-500">*</span>
              </label>
              <select
                name="violation"
                value={formData.violation}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">Select violation</option>
                {VIOLATION_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                name="severity"
                value={formData.severity}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                {SEVERITY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Incident Description</label>
            <textarea
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">
              Cancel
            </button>

            <button type="submit" className="px-4 py-2 rounded-lg bg-red-500 text-white">
              {editingIncident ? "Update Incident" : "Save Incident"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}