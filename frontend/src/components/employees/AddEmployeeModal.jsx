import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

const COMPANY_OPTIONS = [
  "SM Supermalls",
  "Robinsons Retail Holdings",
  "Ayala Land Inc.",
  "Jollibee Foods Corporation",
  "San Miguel Corporation",
  "PLDT Inc.",
  "Globe Telecom",
  "BDO Unibank",
  "Metrobank",
  "Puregold Price Club",
  "Wilcon Depot",
  "DMCI Holdings",
  "Megaworld Corporation",
  "Unilab Inc.",
  "Nestlé Philippines",
  "Coca-Cola Philippines",
  "Pepsi-Cola Products Philippines",
  "Toyota Philippines",
  "Honda Philippines",
  "Accenture Philippines",
  "IBM Philippines",
  "Teleperformance Philippines",
  "Concentrix Philippines",
  "Sitel Philippines",
];

const DOCUMENT_OPTIONS = [
  { name: "Resume", expirable: false },
  { name: "NSO/PSA", expirable: false },
  { name: "SSS (ID or E1 form)", expirable: false },
  { name: "Pag-IBIG (ID or MDRF Form)", expirable: false },
  { name: "PhilHealth (ID or MDF Form)", expirable: false },
  { name: "Diploma", expirable: false },
  { name: "Cedula", expirable: false },
  { name: "Barangay Clearance", expirable: true },
  { name: "NBI/Police Clearance", expirable: true },
];

const createDefaultDocuments = (existingDocs = []) => {
  return DOCUMENT_OPTIONS.map((doc) => {
    const matched =
      existingDocs.find((item) =>
        typeof item === "object" ? item.name === doc.name : item === doc.name
      ) || null;

    return {
      name: doc.name,
      expirable: doc.expirable,
      checked: !!matched,
      expirationDate:
        matched && typeof matched === "object"
          ? matched.expirationDate || ""
          : "",
      file: matched?.file || null,
    };
  });
};

const formatDate = (dateValue) => {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getDocumentStatus = (expirationDate) => {
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
};

function ErrorText({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

export default function AddEmployeeModal({
  onClose,
  onSave,
  generatedId,
  editingEmployee,
  employees = [],
}) {
  const [formData, setFormData] = useState(() => ({
    name: "",
    status: "Deployed",
    company: "",
    documents: createDefaultDocuments([]),
  }));

  const [showReview, setShowReview] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    company: "",
    duplicateName: "",
    duplicateId: "",
    documents: {},
  });

  const [filteredCompanies, setFilteredCompanies] = useState(COMPANY_OPTIONS);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const resetForm = () => {
      setFormData({
        name: editingEmployee ? editingEmployee.name : "",
        status: editingEmployee ? editingEmployee.status : "Deployed",
        company: editingEmployee ? editingEmployee.company : "",
        documents: createDefaultDocuments(editingEmployee?.documents || []),
      });

      setShowReview(false);
      setErrors({
        name: "",
        company: "",
        duplicateName: "",
        duplicateId: "",
        documents: {},
      });

      setFilteredCompanies(COMPANY_OPTIONS);
      setShowSuggestions(false);
    };

    resetForm();
  }, [editingEmployee, generatedId]);

  const selectedDocuments = useMemo(() => {
  return formData.documents
    .filter((doc) => doc.checked)
    .map((doc) => ({
      name: doc.name,
      expirationDate: doc.expirationDate,
      file: doc.file || null,
    }));
}, [formData.documents]);

  const riskyDocuments = useMemo(() => {
    return selectedDocuments
      .map((doc) => ({
        ...doc,
        status: getDocumentStatus(doc.expirationDate),
      }))
      .filter(
        (doc) => doc.status === "Expired" || doc.status === "Expiring Soon"
      );
  }, [selectedDocuments]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "status" && value !== "Deployed") {
      setFormData((prev) => ({
        ...prev,
        status: value,
        company: "",
      }));

      setErrors((prev) => ({
        ...prev,
        company: "",
      }));

      setFilteredCompanies(COMPANY_OPTIONS);
      setShowSuggestions(false);
      return;
    }

    if (name === "company") {
      const filtered = COMPANY_OPTIONS.filter((company) =>
        company.toLowerCase().includes(value.toLowerCase())
      );

      setFilteredCompanies(filtered);
      setShowSuggestions(true);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
      duplicateName: name === "name" ? "" : prev.duplicateName,
    }));
  };

  const handleSelectCompany = (company) => {
    setFormData((prev) => ({
      ...prev,
      company,
    }));

    setErrors((prev) => ({
      ...prev,
      company: "",
    }));

    setFilteredCompanies(
      COMPANY_OPTIONS.filter((item) =>
        item.toLowerCase().includes(company.toLowerCase())
      )
    );
    setShowSuggestions(false);
  };

  const handleDocumentCheck = (docName) => {
  setFormData((prev) => ({
    ...prev,
    documents: prev.documents.map((doc) =>
      doc.name === docName
        ? {
            ...doc,
            checked: !doc.checked,
            expirationDate: !doc.checked ? doc.expirationDate : "",
            file: !doc.checked ? doc.file : null, // 🔥 ADD THIS LINE
          }
        : doc
    ),
  }));

  setErrors((prev) => ({
    ...prev,
    documents: {
      ...prev.documents,
      [docName]: "",
    },
  }));
};

  const handleDocumentDateChange = (docName, value) => {
  setFormData((prev) => ({
    ...prev,
    documents: prev.documents.map((doc) =>
      doc.name === docName
        ? { ...doc, expirationDate: value }
        : doc
    ),
  }));
};

  const handleDocumentFile = (docName, fileData) => {
  setFormData((prev) => ({
    ...prev,
    documents: prev.documents.map((doc) =>
      doc.name === docName
        ? { ...doc, file: fileData }
        : doc
    ),
  }));
};

  const validateForm = () => {
    const nextErrors = {
      name: "",
      company: "",
      duplicateName: "",
      duplicateId: "",
      documents: {},
    };

    const trimmedName = formData.name.trim();
    const trimmedCompany = formData.company.trim();

    if (!trimmedName) {
      nextErrors.name = "Full name is required.";
    }

    if (formData.status === "Deployed" && !trimmedCompany) {
      nextErrors.company = "Company name is required for deployed employees.";
    }

    const duplicateName = employees.some((emp) => {
      if (editingEmployee && emp.id === editingEmployee.id) return false;
      return (
        String(emp.name || "").trim().toLowerCase() ===
        trimmedName.toLowerCase()
      );
    });

    if (trimmedName && duplicateName) {
      nextErrors.duplicateName =
        "An employee with the same full name already exists.";
    }

    const duplicateId = employees.some((emp) => {
      if (editingEmployee && emp.id === editingEmployee.id) return false;
      return (
        String(emp.id || "").trim().toLowerCase() ===
        String(generatedId || "").trim().toLowerCase()
      );
    });

    if (generatedId && duplicateId) {
      nextErrors.duplicateId = "This employee ID already exists.";
    }

        formData.documents.forEach((doc) => {
      if (doc.checked && doc.expirable && !doc.expirationDate) {
        nextErrors.documents[doc.name] = "Required field";
      }// 🔥 always allow review
    });
    

    setErrors(nextErrors);

    const hasDocumentErrors = Object.values(nextErrors.documents).some(Boolean);

    return !(
      nextErrors.name ||
      nextErrors.company ||
      nextErrors.duplicateName ||
      nextErrors.duplicateId ||
      hasDocumentErrors
    );
  };

  const handleSubmit = (e) => {
  e.preventDefault();

  const isValid = validateForm();

  console.log("VALID:", isValid);

  if (!isValid) {
    console.log("ERRORS:", errors);
    return;
  }

  setShowReview(true);
};

  const handleConfirmSave = () => {
    onSave({
      name: formData.name.trim(),
      status: formData.status,
      company: formData.status === "Deployed" ? formData.company.trim() : "",
      documents: selectedDocuments,
    });

    setShowReview(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            {editingEmployee ? "Edit Employee" : "Add Employee"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Employee ID</label>
              <input
                type="text"
                value={generatedId}
                disabled
                className={`w-full rounded-lg border px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ${
                  errors.duplicateId
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
              <ErrorText>{errors.duplicateId}</ErrorText>
            </div>

            <div>
              <label className="block text-sm mb-1">
                Full Name{" "}
                <span className="text-gray-400">(Firstname MI. Lastname)</span>
              </label>
              <input
                type="text"
                name="name"
                placeholder="e.g. Juan D. Dela Cruz"
                value={formData.name}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                  errors.name || errors.duplicateName
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
              <ErrorText>{errors.name || errors.duplicateName}</ErrorText>
            </div>

            <div>
              <label className="block text-sm mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="Deployed">Deployed</option>
                <option value="Floating / Standby">Floating / Standby</option>
              </select>
            </div>

            {formData.status === "Deployed" && (
              <div>
                <label className="block text-sm mb-1">Company Name</label>

                <div className="relative">
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    onFocus={() => {
                      setFilteredCompanies(
                        COMPANY_OPTIONS.filter((company) =>
                          company
                            .toLowerCase()
                            .includes(formData.company.toLowerCase())
                        )
                      );
                      setShowSuggestions(true);
                    }}
                    onBlur={() =>
                      setTimeout(() => setShowSuggestions(false), 150)
                    }
                    placeholder="Type company name..."
                    autoComplete="off"
                    className={`w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                      errors.company
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  />

                  {showSuggestions && filteredCompanies.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-lg">
                      {filteredCompanies.map((company) => (
                        <button
                          key={company}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectCompany(company)}
                          className="w-full text-left px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800 text-sm text-gray-900 dark:text-white"
                        >
                          {company}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <ErrorText>{errors.company}</ErrorText>
              </div>
            )}

            <div>
              <label className="block text-sm mb-3 font-medium text-gray-900 dark:text-white">
                Compliance Documents
              </label>

              <div className="flex gap-4">

  {/* LEFT COLUMN */}
  <div className="flex-1 space-y-4">
    {formData.documents
      .filter((_, i) => i % 2 === 0)
      .map((doc) => (
        <div key={doc.name} className="rounded-lg border p-3">

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={doc.checked}
              onChange={() => handleDocumentCheck(doc.name)}
            />
            {doc.name}
          </label>

          {doc.checked && (
            <div className="mt-3 space-y-2">

              {doc.expirable && (
                <input
                  type="date"
                  value={doc.expirationDate}
                  onChange={(e) =>
                    handleDocumentDateChange(doc.name, e.target.value)
                  }
                  className="w-full border px-3 py-2 rounded 
                  bg-white text-black 
                  dark:bg-slate-800 dark:text-white 
                  dark:border-gray-600"
                />
              )}

              <div>
  <label className="block text-sm mb-1 text-gray-400">
    Proof Upload
  </label>

  <label className="flex items-center justify-center w-full cursor-pointer rounded-xl border border-dashed border-gray-500 px-4 py-4 text-gray-300 hover:bg-gray-700/40 transition">

    <div className="flex items-center gap-2">
      <span>⬆</span>
      <span>
        {doc.file ? "Change file" : "Upload proof file"}
      </span>
    </div>

    <input
      type="file"
      accept="image/png, image/jpeg"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files[0];

        if (!file) return;

        // 🔥 VALIDATE TYPE
        const validTypes = ["image/png", "image/jpeg"];
        if (!validTypes.includes(file.type)) {
          alert("Only PNG and JPEG images are allowed.");
          return;
        }

        // 🔥 VALIDATE SIZE (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          alert("File must be less than 5MB.");
          return;
        }

        const reader = new FileReader();

        reader.onloadend = () => {
          handleDocumentFile(doc.name, {
            name: file.name,
            data: reader.result,
          });
        };

        reader.readAsDataURL(file);
      }}
    />
  </label>

  <p className="text-xs text-gray-400 mt-1">
    Accepted files: PNG or JPEG (Max 5MB)
  </p>

  {doc.file && (
    <p className="text-sm text-green-400 mt-1">
      Selected file: {doc.file.name}
    </p>
  )}
</div>

            </div>
          )}

        </div>
      ))}
  </div>

  {/* RIGHT COLUMN */}
  <div className="flex-1 space-y-4">
    {formData.documents
      .filter((_, i) => i % 2 === 1)
      .map((doc) => (
        <div key={doc.name} className="rounded-lg border p-3">

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={doc.checked}
              onChange={() => handleDocumentCheck(doc.name)}
            />
            {doc.name}
          </label>

          {doc.checked && (
            <div className="mt-3 space-y-2">

              {doc.expirable && (
                <input
                  type="date"
                  value={doc.expirationDate}
                  onChange={(e) =>
                    handleDocumentDateChange(doc.name, e.target.value)
                  }
                  className="w-full border px-3 py-2 rounded required
                  bg-white text-black 
                  dark:bg-slate-800 dark:text-white 
                  dark:border-gray-600"
                />
              )}

              <div>
  <label className="block text-sm mb-1 text-gray-400">
    Proof Upload
  </label>

  <label className="flex items-center justify-center w-full cursor-pointer rounded-xl border border-dashed border-gray-500 px-4 py-4 text-gray-300 hover:bg-gray-700/40 transition">

    <div className="flex items-center gap-2">
      <span>⬆</span>
      <span>
        {doc.file ? "Change file" : "Upload proof file"}
      </span>
    </div>

    <input
      type="file"
      accept="image/*,application/pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onloadend = () => {
          handleDocumentFile(doc.name, {
            name: file.name,
            data: reader.result,
          });
        };

        if (file) reader.readAsDataURL(file);
      }}
    />
  </label>

  <p className="text-xs text-gray-400 mt-1">
    Accepted files: PNG or JPEG (Max 5MB)
  </p>

  {doc.file && (
    <p className="text-sm text-green-400 mt-1">
      Selected file: {doc.file.name}
    </p>
  )}
</div>

            </div>
          )}

        </div>
      ))}
  </div>

</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 rounded-lg text-black"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {editingEmployee ? "Review Update" : "Review Save"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
              Review Employee Details
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Please review all details before final{" "}
              {editingEmployee ? "update" : "save"}.
            </p>

            {selectedDocuments.length === 0 && (
              <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-500/10 dark:border-yellow-500/30">
                <div className="flex gap-3">
                  <FiAlertTriangle className="mt-0.5 text-yellow-600 dark:text-yellow-300" />
                  <div>
                    <p className="font-semibold text-yellow-700 dark:text-yellow-300">
                      Review Reminder
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200">
                      No compliance documents were selected for this employee.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {riskyDocuments.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 dark:bg-red-500/10 dark:border-red-500/30">
                <div className="flex gap-3">
                  <FiAlertTriangle className="mt-0.5 text-red-600 dark:text-red-300" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      Risky Compliance Dates Detected
                    </p>
                    <div className="mt-1 space-y-1 text-sm text-red-700 dark:text-red-200">
                      {riskyDocuments.map((doc) => (
                        <p key={doc.name}>
                          {doc.name}: {doc.status}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Employee ID
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {generatedId}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Full Name
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formData.name || "-"}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Status
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formData.status}
                  </p>
                </div>

                <div
                  className={`rounded-lg border p-4 ${
                    formData.status === "Deployed" && !formData.company.trim()
                      ? "border-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Company
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formData.status === "Deployed"
                      ? formData.company || "-"
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Compliance Documents
                </p>

                {selectedDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDocuments.map((doc) => {
                      const status = getDocumentStatus(doc.expirationDate);

                      return (
                        <div
                          key={doc.name}
                          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg px-4 py-3 ${
                            status === "Expired"
                              ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
                              : status === "Expiring Soon"
                              ? "bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20"
                              : "bg-gray-50 dark:bg-slate-800"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {doc.name}
                            </p>
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            Expires on: {formatDate(doc.expirationDate)} • {status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No compliance documents selected.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-6">
              <button
                onClick={() => setShowReview(false)}
                className="px-4 py-2 bg-gray-300 rounded-lg text-black"
              >
                Back to Edit
              </button>

              <button
                onClick={handleConfirmSave}
                className={`px-4 py-2 text-white rounded-lg ${
                  editingEmployee
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {editingEmployee ? "Confirm Update" : "Confirm Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}