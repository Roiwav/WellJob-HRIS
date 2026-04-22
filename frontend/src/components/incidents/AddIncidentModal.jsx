import { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import {
  getSeverityByViolation,
  getSanctionByViolation,
  getViolationRules,
} from "../../utils/configStorage";

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
  editingIncident = null,
}) {
  const modalRef = useRef(null);

  const violationOptions = useMemo(() => {
    const rules = getViolationRules();
    return rules.map((rule) => rule.violationName);
  }, []);

  const employeeOptions = useMemo(() => {
    return employees.map((emp) => ({
      id: emp.id || emp.employeeId || emp.employee_id || emp.name,
      name: emp.name || emp.full_name || "",
      company: emp.company || "",
    }));
  }, [employees]);

  const getInitialFormData = () => {
    if (editingIncident) {
      const violation = editingIncident.violation || "";
      return {
        ...editingIncident,
        severity:
          getSeverityByViolation(violation) ||
          editingIncident.severity ||
          "Minor",
        sanction:
          getSanctionByViolation(violation) ||
          editingIncident.sanction ||
          "Warning",
      };
    }

    return {
      id: generateIncidentId(existingIncidents),
      employeeId: "",
      employee: "",
      company: "",
      violation: "",
      severity: "",
      sanction: "",
      status: "Open",
      date: new Date().toISOString().split("T")[0],
      description: "",
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [employeeSearch, setEmployeeSearch] = useState(
    editingIncident?.employee || ""
  );
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingIncident) {
      const violation = editingIncident.violation || "";

      setFormData({
        ...editingIncident,
        severity:
          getSeverityByViolation(violation) ||
          editingIncident.severity ||
          "Minor",
        sanction:
          getSanctionByViolation(violation) ||
          editingIncident.sanction ||
          "Warning",
      });
      setEmployeeSearch(editingIncident.employee || "");
      setShowEmployeeDropdown(false);
      return;
    }

    setFormData({
      id: generateIncidentId(existingIncidents),
      employeeId: "",
      employee: "",
      company: "",
      violation: "",
      severity: "",
      sanction: "",
      status: "Open",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  }, [isOpen, editingIncident, existingIncidents]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

const filteredEmployees = useMemo(() => {
  const keyword = employeeSearch.trim().toLowerCase();

  if (!keyword) return [];

  return employeeOptions
    .filter((emp) => emp.name.toLowerCase().includes(keyword))
    .slice(0, 8);
}, [employeeOptions, employeeSearch]);

  const handleSelectEmployee = (selectedEmployee) => {
    const activeDeployment = deployments.find(
      (dep) =>
        String(dep.employeeId || dep.employee_id || dep.employee) ===
          String(selectedEmployee.id) ||
        String(dep.employee) === String(selectedEmployee.name)
    );

    setFormData((prev) => ({
      ...prev,
      employeeId: selectedEmployee.id,
      employee: selectedEmployee.name,
      company:
        activeDeployment?.company ||
        activeDeployment?.clientCompany ||
        selectedEmployee.company ||
        "",
    }));

    setEmployeeSearch(selectedEmployee.name);
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeInputChange = (e) => {
    const value = e.target.value;

    setEmployeeSearch(value);
    setShowEmployeeDropdown(true);

    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employee: value,
      company: "",
    }));
  };

  const handleViolationChange = (e) => {
    const selectedViolation = e.target.value;

    setFormData((prev) => ({
      ...prev,
      violation: selectedViolation,
      severity: getSeverityByViolation(selectedViolation) || "Minor",
      sanction: getSanctionByViolation(selectedViolation) || "Warning",
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

    if (
      !formData.employeeId ||
      !formData.employee ||
      !formData.violation ||
      !formData.date
    ) {
      alert("Please complete all required fields and select an employee from the suggested list.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const finalIncident = {
      ...formData,
      severity: getSeverityByViolation(formData.violation) || "Minor",
      sanction: getSanctionByViolation(formData.violation) || "Warning",
      reportedBy: formData.reportedBy || user?.name || "Unknown",
    };

    onSave(finalIncident);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4 shrink-0">
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Incident ID
              </label>
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

          <div className="relative">
            <label className="block text-sm font-medium mb-1">
              Employee <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={employeeSearch}
                onChange={handleEmployeeInputChange}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Type employee name..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 pl-10 pr-3 py-2 bg-white dark:bg-slate-800"
              />
            </div>

            {showEmployeeDropdown && filteredEmployees.length > 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-slate-800 transition border-b last:border-b-0 border-gray-100 dark:border-slate-800"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {emp.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {emp.id}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showEmployeeDropdown && employeeSearch && filteredEmployees.length === 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No matching employee found.
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Company / Client
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Violation Type <span className="text-red-500">*</span>
              </label>
              <select
                name="violation"
                value={formData.violation}
                onChange={handleViolationChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">Select violation</option>
                {violationOptions.map((item) => (
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

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium mb-2">Severity</label>

    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 min-h-[46px] flex items-center">
      {formData.severity ? (
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            formData.severity === "Critical"
              ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              : formData.severity === "Major"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
          }`}
        >
          {formData.severity}
        </span>
      ) : (
        <span className="text-sm text-gray-400 dark:text-gray-500">
          Auto-generated based on violation type
        </span>
      )}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium mb-2">
      Default Sanction
    </label>

    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 min-h-[46px] flex items-center">
      {formData.sanction ? (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {formData.sanction}
        </span>
      ) : (
        <span className="text-sm text-gray-400 dark:text-gray-500">
          Auto-generated based on violation type
        </span>
      )}
    </div>
  </div>
</div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Incident Description
            </label>
            <textarea
              name="description"
              rows="5"
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-500 text-white"
            >
              {editingIncident ? "Update Incident" : "Save Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}