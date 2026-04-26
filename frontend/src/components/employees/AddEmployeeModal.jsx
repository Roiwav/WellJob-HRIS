import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiFileText,
  FiInfo,
  FiUploadCloud,
  FiUser,
  FiX,
} from "react-icons/fi";

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

const MIN_DEPLOYED_DOCUMENTS = 5;

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function toProperName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createDefaultDocuments(existingDocs = []) {
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
}

function getDocumentStatus(expirationDate) {
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}


function ErrorText({ children }) {
  if (!children) return null;

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      <FiAlertTriangle />
      {children}
    </p>
  );
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    green:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    amber:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    indigo:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
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
    employmentType: "Permanent",
    contractStart: "",
    contractEnd: "",
    documents: createDefaultDocuments([]),
  }));

  const [showReview, setShowReview] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const [errors, setErrors] = useState({
    name: "",
    company: "",
    duplicateId: "",
    duplicateConfirm: "",
    contractStart: "",
    contractEnd: "",
    documents: {},
  });

  const [filteredCompanies, setFilteredCompanies] = useState(COMPANY_OPTIONS);
  const [showSuggestions, setShowSuggestions] = useState(false);

  
  useEffect(() => {
    setTimeout(() => {
      setFormData({
        name: editingEmployee ? editingEmployee.name || "" : "",
        status: editingEmployee ? editingEmployee.status || "Deployed" : "Deployed",
        company: editingEmployee ? editingEmployee.company || "" : "",
        employmentType: editingEmployee?.employmentType || "Permanent",
        contractStart: editingEmployee?.contractStart || "",
        contractEnd: editingEmployee?.contractEnd || "",
        documents: createDefaultDocuments(editingEmployee?.documents || []),
      });

      setShowReview(false);
      setShowDocuments(false);
      setDuplicateConfirmed(false);

      setErrors({
        name: "",
        company: "",
        duplicateId: "",
        duplicateConfirm: "",
        contractStart: "",
        contractEnd: "",
        documents: {},
      });

      setFilteredCompanies(COMPANY_OPTIONS);
      setShowSuggestions(false);
    }, 0);
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

const completedDocuments = useMemo(() => {
  return formData.documents.filter((doc) => {
    if (!doc.checked) return false;
    if (!doc.file) return false;
    if (doc.expirable && !doc.expirationDate) return false;
    return true;
  });
}, [formData.documents]);


  const duplicatePreview = useMemo(() => {
    const normalizedInput = normalizeName(formData.name);

    if (!normalizedInput) return null;

    return employees.find((emp) => {
      if (editingEmployee && emp.id === editingEmployee.id) return false;
      return normalizeName(emp.name) === normalizedInput;
    });
  }, [employees, editingEmployee, formData.name]);

  const completion = useMemo(() => {
  let score = 0;

  const totalDocs = DOCUMENT_OPTIONS.length;
  const docsScore =
    totalDocs > 0 ? (completedDocuments.length / totalDocs) * 40 : 0;

  if (formData.name.trim()) score += 20;
  if (formData.status) score += 10;
  if (formData.status !== "Deployed" || formData.company.trim()) score += 15;
  if (formData.employmentType) score += 15;

  if (
    formData.employmentType === "Permanent" ||
    (formData.employmentType === "Contractual" &&
      formData.contractStart &&
      formData.contractEnd)
  ) {
    score += docsScore;
  } else {
    score += docsScore;
  }

  return Math.min(Math.round(score), 100);
}, [formData, completedDocuments.length]);

const remainingDocuments = DOCUMENT_OPTIONS.length - completedDocuments.length;

const complianceReviewWarning = useMemo(() => {
  // ❌ kulang for deployed → BLOCK LEVEL (should not happen kasi validation)
  if (
    formData.status === "Deployed" &&
    selectedDocuments.length < MIN_DEPLOYED_DOCUMENTS
  ) {
    return `Only ${selectedDocuments.length}/${DOCUMENT_OPTIONS.length} documents selected. Minimum of ${MIN_DEPLOYED_DOCUMENTS} required for deployed employees.`;
  }

  // ⚠️ incomplete pero pwede
  if (selectedDocuments.length < DOCUMENT_OPTIONS.length) {
    return `Incomplete compliance documents. ${selectedDocuments.length}/${DOCUMENT_OPTIONS.length} selected only.`;
  }

  return "";
}, [formData.status, selectedDocuments.length]);

const handleChange = (e) => {
  const { name, value } = e.target;

  if (name === "status" && value !== "Deployed") {
    setFormData((prev) => ({
      ...prev,
      status: value,
      company: "",
      employmentType: "Permanent",
      contractStart: "",
      contractEnd: "",
    }));

    setErrors((prev) => ({
      ...prev,
      company: "",
      duplicateConfirm: name === "name" ? "" : prev.duplicateConfirm,
    }));

    setFilteredCompanies(COMPANY_OPTIONS);
    setShowSuggestions(false);
    return;
  }

  if (name === "employmentType" && value === "Permanent") {
    setFormData((prev) => ({
      ...prev,
      employmentType: value,
      contractStart: "",
      contractEnd: "",
    }));
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

  if (name === "name") {
    setDuplicateConfirmed(false);
  }

  setErrors((prev) => ({
    ...prev,
    [name]: "",
    duplicateConfirm: name === "name" ? "" : prev.duplicateConfirm,
  }));
};

  const handleNameBlur = () => {
    setFormData((prev) => ({
      ...prev,
      name: toProperName(prev.name),
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
              file: !doc.checked ? doc.file : null,
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
        doc.name === docName ? { ...doc, expirationDate: value } : doc
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

const handleDocumentFile = (docName, fileData) => {
  setFormData((prev) => ({
    ...prev,
    documents: prev.documents.map((doc) =>
      doc.name === docName ? { ...doc, file: fileData } : doc
    ),
  }));

  setErrors((prev) => ({
    ...prev,
    documents: {
      ...prev.documents,
      [`${docName}_file`]: "",
    },
  }));
};

const handleFileInput = (docName, file) => {
  if (!file) return;

  const validTypes = ["image/png", "image/jpeg", "application/pdf"];

  if (!validTypes.includes(file.type)) {
    alert("Only PNG, JPEG, and PDF files are allowed.");
    return;
  }

  const maxSize = 2 * 1024 * 1024;

  if (file.size > maxSize) {
    alert("File must be less than 2MB.");
    return;
  }

  const fileURL = URL.createObjectURL(file);

  handleDocumentFile(docName, {
    name: file.name,
    type: file.type,
    url: fileURL,
  });
};
  const validateForm = () => {

  const nextErrors = {
    name: "",
    company: "",
    duplicateId: "",
    duplicateConfirm: "",
    contractStart: "",   
    contractEnd: "",     
    documents: {},
  };

    const trimmedName = formData.name.trim().replace(/\s+/g, " ");
    const trimmedCompany = formData.company.trim();

    if (!trimmedName) {
      nextErrors.name = "Full name is required.";
    } else if (!/^[A-Za-zÑñ\s.'-]+$/.test(trimmedName)) {
      nextErrors.name =
        "Full name must contain letters only. Numbers and special symbols are not allowed.";
    } else if (trimmedName.split(" ").filter(Boolean).length < 2) {
      nextErrors.name = "Please enter complete first name and last name.";
    }

    if (formData.status === "Deployed" && !trimmedCompany) {
      nextErrors.company = "Company name is required for deployed employees.";
    }

    if (formData.employmentType === "Contractual") {
  if (!formData.contractStart) {
    nextErrors.contractStart = "Contract start date is required.";
  }

  if (!formData.contractEnd) {
    nextErrors.contractEnd = "Contract end date is required.";
  }

  if (
    formData.contractStart &&
    formData.contractEnd &&
    new Date(formData.contractEnd) < new Date(formData.contractStart)
  ) {
    nextErrors.contractEnd = "Contract end date cannot be earlier than start date.";
  }
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

    if (duplicatePreview && !duplicateConfirmed) {
      nextErrors.duplicateConfirm =
        "Possible duplicate name detected. Please verify using the resume/supporting documents and confirm before saving.";
    }

formData.documents.forEach((doc) => {
  if (doc.checked && doc.expirable && !doc.expirationDate) {
    nextErrors.documents[doc.name] = "Expiration date is required.";
  }

  if (doc.checked && !doc.file) {
    nextErrors.documents[`${doc.name}_file`] = "Proof upload is required.";
  }
});
// 🔥 UPDATED RULE: minimum compliance for deployed
if (
  formData.status === "Deployed" &&
  selectedDocuments.length < MIN_DEPLOYED_DOCUMENTS
) {
  nextErrors.documents.general = `At least ${MIN_DEPLOYED_DOCUMENTS} compliance documents are required for deployed employees.`;
}

    setErrors(nextErrors);

    const hasDocumentErrors = Object.values(nextErrors.documents).some(Boolean);

return !(
  nextErrors.name ||
  nextErrors.company ||
  nextErrors.duplicateId ||
  nextErrors.duplicateConfirm ||
  nextErrors.contractStart ||
  nextErrors.contractEnd ||
  nextErrors.documents.general ||
  hasDocumentErrors
);
};

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setShowReview(true);
  };

  const handleConfirmSave = () => {
  onSave({
    name: toProperName(formData.name),
    status: formData.status,
    company: formData.status === "Deployed" ? formData.company.trim() : "",
    employmentType: formData.employmentType,
    contractStart: formData.contractStart,
    contractEnd: formData.contractEnd,
    duplicateVerified: !!duplicatePreview && duplicateConfirmed,
    documents: selectedDocuments,
  });

    setShowReview(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
        <div className="flex h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-900">
          <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-gradient-to-b from-indigo-700 via-blue-700 to-slate-950 p-7 text-white lg:block">
            <div className="flex h-full flex-col">
              <div>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <FiUser size={26} />
                </div>

                <h2 className="text-2xl font-extrabold">
                  {editingEmployee ? "Update Employee" : "New Employee"}
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Register employee details, verify possible duplicate names,
                  and attach compliance proof files for HR monitoring.
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-white/75">
                  <span>Completion</span>
                  <span>{completion}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                {remainingDocuments > 0 && (
                  <p className="mt-3 text-xs text-white/70">
                    {remainingDocuments} compliance document
                    {remainingDocuments === 1 ? "" : "s"} remaining to complete.
                  </p>
                )}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">Employee ID</p>
                  <p className="mt-1 text-white/75">{generatedId || "-"}</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">Selected Documents</p>
                  <p className="mt-1 text-white/75">
                    {completedDocuments.length}/{DOCUMENT_OPTIONS.length} completed
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5 dark:border-white/10 dark:bg-slate-900">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="indigo">
                    <FiUser />
                    {editingEmployee ? "Edit Mode" : "Create Mode"}
                  </StatusPill>

                  {duplicatePreview && (
                    <StatusPill tone={duplicateConfirmed ? "amber" : "red"}>
                      <FiAlertTriangle />
                      {duplicateConfirmed
                        ? "Duplicate Verified"
                        : "Possible Duplicate"}
                    </StatusPill>
                  )}
                </div>

                <h2 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white">
                  {editingEmployee ? "Edit Employee Record" : "Add Employee Record"}
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Complete the required employee information and review before saving.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <FiX size={22} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
              <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                <main className="space-y-6">
                  <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        <FiUser />
                      </div>

                      <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white">
                          Basic Employee Information
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Employee ID remains the official unique identifier.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                          Employee ID
                        </label>

                        <input
                          type="text"
                          value={generatedId}
                          disabled
                          className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold text-gray-500 outline-none dark:bg-slate-800 dark:text-gray-400 ${
                            errors.duplicateId
                              ? "border-red-500 bg-red-50 dark:border-red-500"
                              : "border-gray-200 bg-gray-100 dark:border-white/10"
                          }`}
                        />

                        <ErrorText>{errors.duplicateId}</ErrorText>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                          Employment Status
                        </label>

                        <div className="relative">
                          <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="Deployed">Deployed</option>
                            <option value="Floating / Standby">
                              Floating / Standby
                            </option>
                          </select>

                          <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>

<div>
  <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
    Employment Type
  </label>

  <div className="relative">
    <select
      name="employmentType"
      value={formData.employmentType}
      onChange={handleChange}
      className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
    >
      <option value="Permanent">Permanent</option>
      <option value="Contractual">Contractual</option>
    </select>

    <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
  </div>
</div>

{formData.employmentType === "Contractual" && (
  <>
    <div>
      <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
        Contract Start Date
      </label>

      <input
        type="date"
        name="contractStart"
        value={formData.contractStart}
        onChange={handleChange}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
      />
      <ErrorText>{errors.contractStart}</ErrorText>
    </div>

    <div>
      <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
        Contract End Date
      </label>

      <input
        type="date"
        name="contractEnd"
        value={formData.contractEnd}
        onChange={handleChange}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
      />
      <ErrorText>{errors.contractEnd}</ErrorText>
    </div>
  </>
)}

                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                          Full Name{" "}
                        </label>

                        <input
                          type="text"
                          name="name"
                          placeholder="e.g. Juan D. Dela Cruz"
                          value={formData.name}
                          onChange={handleChange}
                          onBlur={handleNameBlur}
                          autoComplete="off"
                          className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:ring-4 dark:bg-slate-800 dark:text-white ${
                            errors.name || duplicatePreview
                              ? "border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-white/10"
                          }`}
                        />

                        <ErrorText>{errors.name}</ErrorText>
                      </div>

                      {formData.status === "Deployed" && (
                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Company Assignment
                          </label>

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
                              placeholder="Type or select company name..."
                              autoComplete="off"
                              className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:ring-4 dark:bg-slate-800 dark:text-white ${
                                errors.company
                                  ? "border-red-500 focus:ring-red-500/10"
                                  : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-white/10"
                              }`}
                            />

                            {showSuggestions && filteredCompanies.length > 0 && (
                              <div className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                                {filteredCompanies.map((company) => (
                                  <button
                                    key={company}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelectCompany(company)}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-800 transition hover:bg-indigo-50 dark:text-white dark:hover:bg-white/10"
                                  >
                                    <FiBriefcase className="text-indigo-500" />
                                    {company}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <ErrorText>{errors.company}</ErrorText>
                        </div>
                      )}

                      {duplicatePreview && (
                        <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          <div className="flex gap-3">
                            <FiAlertTriangle className="mt-0.5 shrink-0" />
                            <div>
                              <p className="font-extrabold">
                                Possible duplicate employee found.
                              </p>
                              <p className="mt-1">
                                Existing record: <b>{duplicatePreview.name}</b>{" "}
                                ({duplicatePreview.id}). Verify through resume or
                                supporting documents before saving.
                              </p>

                              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-bold">
                                <input
                                  type="checkbox"
                                  checked={duplicateConfirmed}
                                  onChange={(e) => {
                                    setDuplicateConfirmed(e.target.checked);
                                    setErrors((prev) => ({
                                      ...prev,
                                      duplicateConfirm: "",
                                    }));
                                  }}
                                  className="mt-0.5"
                                />
                                I verified the resume/supporting documents and
                                confirm this is a different employee.
                              </label>

                              <ErrorText>{errors.duplicateConfirm}</ErrorText>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                </main>

                <aside className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <FiInfo />
                      </div>

                      <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white">
                          Record Summary
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Live preview before review.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <SummaryRow label="Employee ID" value={generatedId} />
                      <SummaryRow label="Full Name" value={toProperName(formData.name) || "-"} />
                      <SummaryRow label="Status" value={formData.status} />
                      <SummaryRow
                        label="Company"
                        value={formData.status === "Deployed" ? formData.company || "-" : "Not Assigned"}
                      />
                      <SummaryRow
                        label="Documents"
                        value={`${completedDocuments.length}/${DOCUMENT_OPTIONS.length} completed`}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <div className="mb-1 flex items-center gap-2 font-extrabold">
                      <FiAlertTriangle />
                      HRIS Reminder
                    </div>
                    <p className="leading-5">
                      Verify duplicate names using supporting documents.
                    </p>
                  </div>
                </aside>
              </div>

<section className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60">                    <button
                      type="button"
                      onClick={() => setShowDocuments((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                          <FiFileText />
                        </div>

                        <div>
                          <h3 className="font-extrabold text-gray-900 dark:text-white">
                            Compliance Documents
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Click to show or hide document requirements and proof uploads.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill tone="slate">
                          {completedDocuments.length}/{DOCUMENT_OPTIONS.length} completed
                        </StatusPill>
                        {errors.documents.general && (
  <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
    {errors.documents.general}
  </p>
)}

                        <FiChevronDown
                          className={`text-gray-400 transition-transform ${
                            showDocuments ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {showDocuments && (
                      <div className="border-t border-gray-200 p-5 dark:border-white/10">
                        <div className="grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                          {formData.documents.map((doc) => {
                            const status = getDocumentStatus(doc.expirationDate);
                            const isRisky =
                              doc.checked &&
                              (status === "Expired" ||
                                status === "Expiring Soon");

                            return (
                              <div
                                key={doc.name}
                                className={`rounded-2xl border p-4 transition ${
                                  doc.checked
                                    ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                                    : "border-gray-200 bg-white hover:border-indigo-200 dark:border-white/10 dark:bg-slate-900/50 dark:hover:border-indigo-500/30"
                                }`}
                              >
                                <label className="flex cursor-pointer items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={doc.checked}
                                    onChange={() => handleDocumentCheck(doc.name)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-bold text-gray-900 dark:text-white">
                                        {doc.name}
                                      </p>

                                      {doc.expirable ? (
                                        <StatusPill tone="amber">Expirable</StatusPill>
                                      ) : (
                                        <StatusPill tone="green">Permanent</StatusPill>
                                      )}
                                    </div>

                                    {doc.checked && (
                                      <div className="mt-4 space-y-3">
                                        {doc.expirable && (
                                          <div>
                                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                              Expiration Date
                                            </label>

                                            <input
                                              type="date"
                                              value={doc.expirationDate}
                                              onChange={(e) =>
                                                handleDocumentDateChange(
                                                  doc.name,
                                                  e.target.value
                                                )
                                              }
                                              className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-4 dark:bg-slate-800 dark:text-white ${
                                                errors.documents[doc.name]
                                                  ? "border-red-500 focus:ring-red-500/10"
                                                  : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-white/10"
                                              }`}
                                            />

                                            <ErrorText>
                                              {errors.documents[doc.name]}
                                            </ErrorText>

                                            {doc.expirationDate && (
                                              <p
                                                className={`mt-1.5 text-xs font-semibold ${
                                                  isRisky
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-green-600 dark:text-green-400"
                                                }`}
                                              >
                                                Status: {status}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                            Proof Upload
                                          </label>

                                          <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm font-semibold text-gray-500 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-white/10 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-indigo-500/10">
                                            <div className="flex items-center gap-2">
                                              <FiUploadCloud />
                                              <span>
                                                {doc.file
                                                  ? "Change proof file"
                                                  : "Upload proof file"}
                                              </span>
                                            </div>

                                          <input
                                            type="file"
                                            accept="image/png, image/jpeg, application/pdf"
                                            className="hidden"
                                            onChange={(e) =>
                                              handleFileInput(doc.name, e.target.files?.[0])
                                            }
                                          />
                                          </label>

                                          <p className="mt-1 text-xs text-gray-400">
                                            PNG, JPEG, or PDF only. Max file size: 5MB.
                                          </p>
                                          <ErrorText>{errors.documents[`${doc.name}_file`]}</ErrorText>

                                          {doc.file && (
                                            <div className="mt-2 flex min-w-0 items-start gap-1.5 rounded-xl bg-green-500/10 px-3 py-2 text-xs font-bold text-green-600 dark:text-green-400">
                                              <FiCheck className="mt-0.5 shrink-0" />
                                              <span className="block min-w-0 max-w-full break-all leading-5">
                                                {doc.file.name}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
              </div>

              <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
                >
                  {editingEmployee ? "Review Update" : "Review Save"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>

            {/* REVIEW MODAL */}
      {showReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <StatusPill tone="green">
                  <FiCheck />
                  Ready for Confirmation
                </StatusPill>

                <h3 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white">
                  Review Employee Details
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Please verify all employee details before saving.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <FiX size={22} />
              </button>
            </div>

            {duplicatePreview && !duplicateConfirmed && (
              <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                <div className="flex gap-3">
                  <FiAlertTriangle className="mt-0.5 text-red-600 dark:text-red-300" />
                  <div>
                    <p className="font-bold text-red-700 dark:text-red-300">
                      Duplicate Not Verified
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-200">
                      Please confirm duplicate verification before saving.
                    </p>
                  </div>
                </div>
              </div>
            )}

              {complianceReviewWarning && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <div className="flex gap-3">
                    <FiAlertTriangle className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-extrabold">Compliance Warning</p>
                      <p className="mt-1">{complianceReviewWarning}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <ReviewBox label="Employee ID" value={generatedId} />
              <ReviewBox label="Full Name" value={toProperName(formData.name)} />
              <ReviewBox label="Status" value={formData.status} />
              <ReviewBox label="Employment Type" value={formData.employmentType} />
              {formData.employmentType === "Contractual" && (
                <>
                  <ReviewBox label="Contract Start" value={formData.contractStart || "-"} />
                  <ReviewBox label="Contract End" value={formData.contractEnd || "-"} />
                </>
              )}
              <ReviewBox
                label="Company"
                value={
                  formData.status === "Deployed"
                    ? formData.company || "-"
                    : "Not Assigned"
                }
              />
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 p-5 dark:border-white/10">
              <p className="mb-4 text-sm font-extrabold text-gray-900 dark:text-white">
                Compliance Documents
              </p>

              {selectedDocuments.length > 0 ? (
                <div className="space-y-3">
                    {selectedDocuments.map((doc) => {
                    const masterDoc = DOCUMENT_OPTIONS.find((item) => item.name === doc.name);
                    const isExpirable = masterDoc?.expirable;

                    const status = isExpirable
                      ? getDocumentStatus(doc.expirationDate)
                      : "Permanent";

                    const isValid =
                      !isExpirable || (status !== "Expired" && status !== "Expiring Soon");

                      return (
                      <div
                        key={doc.name}
                        className="flex flex-col justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-slate-800 md:flex-row md:items-center"
                      >
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {doc.name}
                          </p>
                            <p className="mt-1 max-w-full break-all text-xs text-gray-500 dark:text-gray-400">
                              File: {doc.file?.name || "No file uploaded"}
                            </p>
                           </div>
                          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                            {isExpirable ? (
                              <>
                                Expires: {doc.expirationDate || "-"} • {status}
                              </>
                            ) : (
                              "Permanent Document"
                            )}
                          </div>

                          {isValid && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-bold">
                              ✔ Document is valid
                            </span>
                          )}
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

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
              >
                Back to Edit
              </button>

              <button
                type="button"
                onClick={handleConfirmSave}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 🔥 HELPERS

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-slate-800">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

function ReviewBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}