import { useState } from "react";
import {
  getViolationRules,
  saveViolationRules,
} from "../../utils/configStorage";

const emptyForm = {
  violationName: "",
  severity: "Minor",
  sanction: "Warning",
};

export default function ViolationRulesTab() {
  const [rules, setRules] = useState(getViolationRules());
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    const violationName = formData.violationName.trim();
    const severity = formData.severity.trim();
    const sanction = formData.sanction.trim();

    if (!violationName || !severity || !sanction) {
      showMessage("Please fill in all fields.");
      return;
    }

    const duplicate = rules.find(
      (rule) =>
        rule.violationName.trim().toLowerCase() === violationName.toLowerCase() &&
        rule.id !== editingId
    );

    if (duplicate) {
      showMessage("Violation name already exists.");
      return;
    }

    let updatedRules = [];

    if (editingId) {
      updatedRules = rules.map((rule) =>
        rule.id === editingId
          ? {
              ...rule,
              violationName,
              severity,
              sanction,
            }
          : rule
      );
      showMessage("Violation rule updated successfully.");
    } else {
      updatedRules = [
        ...rules,
        {
          id: crypto.randomUUID(),
          violationName,
          severity,
          sanction,
        },
      ];
      showMessage("Violation rule added successfully.");
    }

    setRules(updatedRules);
    saveViolationRules(updatedRules);
    resetForm();
  };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      violationName: rule.violationName,
      severity: rule.severity,
      sanction: rule.sanction,
    });
  };

  const handleDelete = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this violation rule?"
    );

    if (!confirmDelete) return;

    const updatedRules = rules.filter((rule) => rule.id !== id);
    setRules(updatedRules);
    saveViolationRules(updatedRules);

    if (editingId === id) {
      resetForm();
    }

    showMessage("Violation rule deleted successfully.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Violation Rule Form
        </h2>

        {message && (
          <div className="mb-4 rounded-lg bg-green-100 text-green-700 px-4 py-2 text-sm dark:bg-green-500/10 dark:text-green-400">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Violation Name
            </label>
            <input
              type="text"
              name="violationName"
              value={formData.violationName}
              onChange={handleChange}
              placeholder="Enter violation type"
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Severity
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Default Sanction
            </label>
            <select
              name="sanction"
              value={formData.sanction}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Warning">Warning</option>
              <option value="Suspension">Suspension</option>
              <option value="Termination Review">Termination Review</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-medium transition"
          >
            {editingId ? "Update Rule" : "Add Rule"}
          </button>

          <button
            onClick={resetForm}
            className="rounded-xl border border-gray-300 dark:border-white/10 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Existing Violation Rules
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left">
                <th className="py-3 pr-4 text-gray-700 dark:text-gray-300">Violation</th>
                <th className="py-3 pr-4 text-gray-700 dark:text-gray-300">Severity</th>
                <th className="py-3 pr-4 text-gray-700 dark:text-gray-300">Sanction</th>
                <th className="py-3 pr-4 text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No violation rules found.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-gray-100 dark:border-white/5"
                  >
                    <td className="py-3 pr-4 text-gray-800 dark:text-gray-200">
                      {rule.violationName}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          rule.severity === "Minor"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                            : rule.severity === "Major"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-800 dark:text-gray-200">
                      {rule.sanction}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}