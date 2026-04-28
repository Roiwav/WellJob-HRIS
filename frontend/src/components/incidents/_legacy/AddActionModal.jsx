import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiFileText,
  FiImage,
  FiSave,
  FiUpload,
  FiX,
} from "react-icons/fi";


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

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function AddActionModal({ isOpen, onClose, incident }) {
  const [formData, setFormData] = useState({
    actionTaken: "",
    actionDate: getToday(),
    remarks: "",
    proofName: "",
    proofFile: "",
    proofType: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      actionTaken: "",
      actionDate: getToday(),
      remarks: "",
      proofName: "",
      proofFile: "",
      proofType: "",
    });
  }, [isOpen]);

  if (!isOpen || !incident) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProofChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isValidType =
      file.type.startsWith("image/") || file.type === "application/pdf";

    if (!isValidType) {
      alert("Only image or PDF files are allowed.");
      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("File is too large. Maximum file size is 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const base64 = await fileToBase64(file);

      setFormData((prev) => ({
        ...prev,
        proofName: file.name,
        proofFile: base64,
        proofType: file.type,
      }));
    } catch (error) {
      console.error("Failed to read file:", error);
      alert("Failed to upload proof file.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.actionTaken.trim()) {
      alert("Please enter the action taken.");
      return;
    }

    if (!formData.actionDate) {
      alert("Please select the action date.");
      return;
    }

    if (!formData.proofFile || !formData.proofName) {
      alert("Proof upload is required before saving this action.");
      return;
    }

    setIsSaving(true);

    try {
      const storedIncidents = JSON.parse(
        localStorage.getItem(INCIDENTS_KEY) || "[]"
      );
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userName = user?.name || user?.username || "Unknown";

      const targetIncident =
        storedIncidents.find((item) => item.id === incident.id) || incident;

      const currentActions = Array.isArray(targetIncident.actions)
        ? targetIncident.actions
        : [];

      const newAction = {
        id: generateActionId(currentActions),
        actionTaken: formData.actionTaken.trim(),
        actionDate: formData.actionDate,
        remarks: formData.remarks.trim(),
        proofName: formData.proofName,
        proofFile: formData.proofFile,
        proofType: formData.proofType,
        createdBy: userName,
        createdAt: new Date().toISOString(),
      };

      const updatedIncidents = storedIncidents.map((item) =>
        item.id === incident.id
          ? {
              ...item,
              status: item.status === "Resolved" ? "Investigating" : item.status,
              actions: [...(Array.isArray(item.actions) ? item.actions : []), newAction],
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

  const isImagePreview =
    typeof formData.proofFile === "string" &&
    formData.proofFile.startsWith("data:image");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiFileText size={22} />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Add Proof Action
                </h2>
                <p className="mt-1 text-sm text-indigo-100">
                  Record the action taken and attach proof before resolving the case.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex gap-3">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">
                Proof upload is required. The case cannot be marked as Resolved
                without at least one proof action.
              </p>
            </div>
          </div>

          <Field label="Action Taken" required icon={<FiFileText />}>
            <input
              type="text"
              name="actionTaken"
              value={formData.actionTaken}
              onChange={handleChange}
              placeholder="Example: Issued written warning / Conducted investigation"
              className="input-field"
            />
          </Field>

          <Field label="Action Date" required icon={<FiCalendar />}>
            <input
              type="date"
              name="actionDate"
              value={formData.actionDate}
              onChange={handleChange}
              className="input-field"
            />
          </Field>

          <Field label="Remarks / Notes">
            <textarea
              name="remarks"
              rows="4"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Add remarks, action details, or follow-up notes..."
              className="input-field resize-none"
            />
          </Field>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <FiUpload />
              Proof Upload <span className="text-red-500">*</span>
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition hover:bg-gray-100 dark:border-white/10 dark:bg-slate-950/60 dark:hover:bg-slate-800">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                {isImagePreview ? <FiImage size={22} /> : <FiUpload size={22} />}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {formData.proofName || "Upload image or PDF proof"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Accepted files: JPG, PNG, WEBP, or PDF. Maximum size: 5MB.
                </p>
              </div>

              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleProofChange}
                className="hidden"
              />
            </label>

            {formData.proofName && (
              <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-500/10 dark:text-green-300">
                Selected file: <span className="font-semibold">{formData.proofName}</span>
              </div>
            )}

            {isImagePreview && (
              <div className="mt-3 max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900">
                <img
                  src={formData.proofFile}
                  alt={formData.proofName || "Proof preview"}
                  className="h-44 w-full rounded-xl object-cover"
                />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSave />
              {isSaving ? "Saving..." : "Save Proof Action"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(209 213 219);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input-field:focus {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 3px rgb(224 231 255);
        }

        .dark .input-field {
          border-color: rgba(255, 255, 255, 0.1);
          background: rgb(15 23 42);
          color: white;
        }

        .dark .input-field::placeholder {
          color: rgb(148 163 184);
        }
      `}</style>
    </div>
  );
}

function Field({ label, required = false, icon = null, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {icon}
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}