import { useEffect, useState } from "react";
import { FiUpload, FiX } from "react-icons/fi";

const INCIDENTS_KEY = "incidents";

function generateActionId(actions = []) {
  const maxNumber = actions.reduce((max, item) => {
    const match = String(item.id || "").match(/ACT-(\d+)/);
    const num = match ? Number(match[1]) : 0;
    return num > max ? num : max;
  }, 0);

  return `ACT-${String(maxNumber + 1).padStart(3, "0")}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

export default function AddActionModal({ isOpen, onClose, incident }) {
  const [formData, setFormData] = useState({
    actionTaken: "",
    actionDate: new Date().toISOString().split("T")[0],
    remarks: "",
    proofName: "",
    proofFile: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      actionTaken: "",
      actionDate: new Date().toISOString().split("T")[0],
      remarks: "",
      proofName: "",
      proofFile: "",
    });
  }, [isOpen]);

  if (!isOpen || !incident) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProofChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);

      setFormData((prev) => ({
        ...prev,
        proofName: file.name,
        proofFile: base64,
      }));
    } catch (error) {
      console.error("Failed to read file:", error);
      alert("Failed to upload proof file.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.actionTaken.trim() || !formData.actionDate) {
      alert("Please complete the required action fields.");
      return;
    }

    setIsSaving(true);

    try {
      const storedIncidents = JSON.parse(
        localStorage.getItem(INCIDENTS_KEY) || "[]"
      );
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      const currentActions = Array.isArray(incident.actions)
        ? incident.actions
        : [];

      const newAction = {
        id: generateActionId(currentActions),
        actionTaken: formData.actionTaken.trim(),
        actionDate: formData.actionDate,
        remarks: formData.remarks.trim(),
        proofName: formData.proofName || "",
        proofFile: formData.proofFile || "",
        createdBy: user?.name || "Unknown",
        createdAt: new Date().toISOString(),
      };

      const updatedIncidents = storedIncidents.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              actions: [
                ...(Array.isArray(item.actions) ? item.actions : []),
                newAction,
              ],
              status: item.status === "Resolved" ? "Investigating" : item.status,
            }
          : item
      );

      localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updatedIncidents));
      window.dispatchEvent(new Event("dataUpdated"));
      onClose();
    } catch (error) {
      console.error("Failed to save action:", error);
      alert("Failed to save action.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Action
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
          <div>
            <label className="block text-sm font-medium mb-1">
              Action Taken <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="actionTaken"
              value={formData.actionTaken}
              onChange={handleChange}
              placeholder="Enter action taken"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Action Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="actionDate"
              value={formData.actionDate}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              name="remarks"
              rows="4"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Enter remarks or notes"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Proof Upload
            </label>

            <label className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-slate-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition">
              <FiUpload className="text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formData.proofName ? formData.proofName : "Upload proof file"}
              </span>

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleProofChange}
                className="hidden"
              />
            </label>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Accepted files: image or PDF
            </p>

            {formData.proofName && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                Selected file: {formData.proofName}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}