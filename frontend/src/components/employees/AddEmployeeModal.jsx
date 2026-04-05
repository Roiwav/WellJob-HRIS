import { useEffect, useState } from "react";

const DOCUMENT_OPTIONS = ["NBI", "Police Clearance", "Health Card"];

export default function AddEmployeeModal({
  onClose,
  onSave,
  generatedId,
  editingEmployee
}) {
  const [formData, setFormData] = useState({
    name: "",
    status: "Deployed",
    documents: []
  });

  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        name: editingEmployee.name || "",
        status: editingEmployee.status || "Deployed",
        documents: editingEmployee.documents || []
      });
    } else {
      setFormData({
        name: "",
        status: "Deployed",
        documents: []
      });
    }
  }, [editingEmployee]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleDocumentToggle = (doc) => {
    setFormData((prev) => {
      const alreadySelected = prev.documents.includes(doc);

      return {
        ...prev,
        documents: alreadySelected
          ? prev.documents.filter((item) => item !== doc)
          : [...prev.documents, doc]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please fill in the employee name.");
      return;
    }

    onSave({
      name: formData.name.trim(),
      status: formData.status,
      documents: formData.documents
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">

        <h2 className="text-xl font-bold mb-4">
          {editingEmployee ? "Edit Employee" : "Add Employee"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm mb-1">Employee ID</label>
            <input
              type="text"
              value={generatedId}
              disabled
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter employee name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="Deployed">Deployed</option>
              <option value="Floating / Standby">Floating / Standby</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Compliance Documents
            </label>

            <div className="flex flex-col gap-2">
              {DOCUMENT_OPTIONS.map((doc) => (
                <label key={doc} className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={formData.documents.includes(doc)}
                    onChange={() => handleDocumentToggle(doc)}
                  />
                  <span>{doc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              {editingEmployee ? "Update" : "Save"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}