import { useMemo, useState } from "react";
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
import axios from "axios";
import {
  COMPANY_OPTIONS,
  DOCUMENT_OPTIONS,
  MIN_DEPLOYED_DOCUMENTS,
  normalizeName,
  toProperName,
  createDefaultDocuments,
  getDocumentStatus,
} from "./employeeConstants";
import {
  ErrorText,
  StatusPill,
  SummaryRow,
  ReviewBox,
} from "./EmployeeComponents";

const EMPLOYEE_API_URL = "http://localhost:5000/api/employees";

function getApiError(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function validateUploadFile(file) {
  const validTypes = ["image/png", "image/jpeg", "application/pdf"];
  const maxSize = 5 * 1024 * 1024;

  if (!file) return "";
  if (!validTypes.includes(file.type)) {
    return "Only PNG, JPEG, and PDF files are allowed.";
  }
  if (file.size > maxSize) {
    return "File must be less than 5MB.";
  }
  return "";
}

export default function AddEmployeeModal({
  onClose,
  generatedId,
  employees = [],
  onSaveSuccess,
}) {
  const [formData, setFormData] = useState(() => ({
    name: "",
    status: "Deployed",
    company: "",
    contractStart: "",
    documents: createDefaultDocuments([]),
  }));

  const [showReview, setShowReview] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [errors, setErrors] = useState({
    name: "",
    company: "",
    duplicateId: "",
    duplicateConfirm: "",
    contractStart: "",
    documents: {},
  });

  const [filteredCompanies, setFilteredCompanies] = useState(COMPANY_OPTIONS);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
      if (!doc.file && !doc.filePath) return false;
      if (doc.expirable && !doc.expirationDate) return false;
      return true;
    });
  }, [formData.documents]);

  const duplicatePreview = useMemo(() => {
    const normalizedInput = normalizeName(formData.name);
    if (!normalizedInput) return null;

    return employees.find((emp) => normalizeName(emp?.name) === normalizedInput);
  }, [employees, formData.name]);

  const completion = useMemo(() => {
    let score = 0;
    const totalDocs = DOCUMENT_OPTIONS.length;
    const docsScore = totalDocs > 0 ? (completedDocuments.length / totalDocs) * 40 : 0;

    if (formData.name.trim()) score += 30;
    if (formData.status) score += 10;
    if (formData.status !== "Deployed" || formData.company.trim()) score += 20;

    score += docsScore;
    return Math.min(Math.round(score), 100);
  }, [formData, completedDocuments.length]);

  const remainingDocuments = DOCUMENT_OPTIONS.length - completedDocuments.length;

  const complianceReviewWarning = useMemo(() => {
    if (
      formData.status === "Deployed" &&
      selectedDocuments.length < MIN_DEPLOYED_DOCUMENTS
    ) {
      return `Only ${selectedDocuments.length}/${DOCUMENT_OPTIONS.length} documents selected. Minimum of ${MIN_DEPLOYED_DOCUMENTS} required for deployed employees.`;
    }

    if (selectedDocuments.length < DOCUMENT_OPTIONS.length) {
      return `Incomplete compliance documents. ${selectedDocuments.length}/${DOCUMENT_OPTIONS.length} selected only.`;
    }

    return "";
  }, [formData.status, selectedDocuments.length]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "status" && value !== "Deployed") {
      setFormData((prev) => ({
        ...prev,
        status: value,
        company: "",
        contractStart: "",
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

    if (name === "company") {
      const filtered = COMPANY_OPTIONS.filter((company) =>
        company.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCompanies(filtered);
      setShowSuggestions(true);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "name") {
      setDuplicateConfirmed(false);
    }

    setErrors((prev) => ({
      ...prev,
      [name]: "",
      duplicateConfirm: name === "name" ? "" : prev.duplicateConfirm,
    }));
    setSaveError("");
  };

  const handleNameBlur = () => {
    setFormData((prev) => ({ ...prev, name: toProperName(prev.name) }));
  };

  const handleSelectCompany = (company) => {
    setFormData((prev) => ({ ...prev, company }));
    setErrors((prev) => ({ ...prev, company: "" }));
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
        [`${docName}_file`]: "",
      },
    }));
    setSaveError("");
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
      documents: { ...prev.documents, [docName]: "" },
    }));
    setSaveError("");
  };

  const handleFileInput = (docName, file) => {
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      setErrors((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [`${docName}_file`]: validationError,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) =>
        doc.name === docName ? { ...doc, file } : doc
      ),
    }));

    setErrors((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [`${docName}_file`]: "",
      },
    }));
    setSaveError("");
  };

  const validateForm = () => {
    const nextErrors = {
      name: "",
      company: "",
      duplicateId: "",
      duplicateConfirm: "",
      contractStart: "",
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

    if (!formData.contractStart) {
      nextErrors.contractStart = "Start date is required.";
    }

    const duplicateId = employees.some((emp) => {
      return (
        String(emp?.id || "").trim().toLowerCase() ===
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
      if (!doc.checked) return;

      if (!doc.file) {
        nextErrors.documents[`${doc.name}_file`] = "File is required";
      }

      if (doc.expirable && !doc.expirationDate) {
        nextErrors.documents[doc.name] = "Expiration date is required";
      }
    });

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
      nextErrors.documents.general ||
      hasDocumentErrors
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaveError("");

    if (!validateForm()) return;
    setShowReview(true);
  };

  const handleConfirmSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      setSaveError("");

      const formDataToSend = new FormData();
      formDataToSend.append("name", toProperName(formData.name));
      formDataToSend.append("company", formData.status === "Deployed" ? formData.company : "");
      formDataToSend.append("status", formData.status);
      formDataToSend.append("contractStart", formData.contractStart);

      const selectedDocs = formData.documents.filter((doc) => doc.checked);
      selectedDocs.forEach((doc, index) => {
        formDataToSend.append(`documents[${index}][name]`, doc.name);
        formDataToSend.append(
          `documents[${index}][expirationDate]`,
          doc.expirationDate || ""
        );

        if (doc.file instanceof File) {
          formDataToSend.append(`documents[${index}]`, doc.file);
        }
      });

      await axios.post(EMPLOYEE_API_URL, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowReview(false);

      if (typeof onSaveSuccess === "function") {
        onSaveSuccess(toProperName(formData.name));
      }

      onClose?.();
    } catch (error) {
      console.error("SAVE EMPLOYEE ERROR:", error);
      setSaveError(getApiError(error, "Error saving employee record."));
    } finally {
      setIsSaving(false);
    }
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
                <h2 className="text-2xl font-extrabold">New Employee</h2>
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
                    {remainingDocuments === 1 ? "" : "s"} remaining to
                    complete.
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
                    <FiUser /> Create Mode
                  </StatusPill>
                  {duplicatePreview && (
                    <StatusPill tone={duplicateConfirmed ? "amber" : "red"}>
                      <FiAlertTriangle />{" "}
                      {duplicateConfirmed ? "Duplicate Verified" : "Possible Duplicate"}
                    </StatusPill>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white">
                  Add Employee Record
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

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6"
            >
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
                            value={generatedId || ""}
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

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Start Date
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

                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Full Name
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
                                      onMouseDown={(event) => event.preventDefault()}
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
                                  Existing record: <b>{duplicatePreview.name}</b> (
                                  {duplicatePreview.id}). Verify through resume or
                                  supporting documents before saving.
                                </p>
                                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-bold">
                                  <input
                                    type="checkbox"
                                    checked={duplicateConfirmed}
                                    onChange={(event) => {
                                      setDuplicateConfirmed(event.target.checked);
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
                        <SummaryRow
                          label="Full Name"
                          value={toProperName(formData.name) || "-"}
                        />
                        <SummaryRow label="Status" value={formData.status} />
                        <SummaryRow
                          label="Company"
                          value={
                            formData.status === "Deployed"
                              ? formData.company || "-"
                              : "Not Assigned"
                          }
                        />
                        <SummaryRow
                          label="Documents"
                          value={`${completedDocuments.length}/${DOCUMENT_OPTIONS.length} completed`}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <div className="mb-1 flex items-center gap-2 font-extrabold">
                        <FiAlertTriangle /> HRIS Reminder
                      </div>
                      <p className="leading-5">
                        Verify duplicate names using supporting documents.
                      </p>
                    </div>
                  </aside>
                </div>

                <section className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                  <button
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
                            (status === "Expired" || status === "Expiring Soon");

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
                                            onChange={(event) =>
                                              handleDocumentDateChange(
                                                doc.name,
                                                event.target.value
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
                                            onChange={(event) =>
                                              handleFileInput(
                                                doc.name,
                                                event.target.files?.[0]
                                              )
                                            }
                                          />
                                        </label>
                                        <p className="mt-1 text-xs text-gray-400">
                                          PNG, JPEG, or PDF only. Max file size: 5MB.
                                        </p>
                                        <ErrorText>
                                          {errors.documents[`${doc.name}_file`]}
                                        </ErrorText>
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
                  Review Save
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>

      {showReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <StatusPill tone="green">
                  <FiCheck /> Ready for Confirmation
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
              <ReviewBox
                label="Start Date"
                value={formData.contractStart || "-"}
              />
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
                    const masterDoc = DOCUMENT_OPTIONS.find(
                      (item) => item.name === doc.name
                    );
                    const isExpirable = masterDoc?.expirable;
                    const status = isExpirable
                      ? getDocumentStatus(doc.expirationDate)
                      : "Permanent";
                    const isValid =
                      !isExpirable ||
                      (status !== "Expired" && status !== "Expiring Soon");

                    return (
                      <div
                        key={doc.name}
                        className="flex flex-col justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-slate-800 md:flex-row md:items-center"
                      >
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {doc.name}
                          </p>
                          {doc.file ? (
                            doc.file.type?.includes("image") ? (
                              <img
                                src={URL.createObjectURL(doc.file)}
                                alt={doc.file.name}
                                className="mt-2 max-h-40 rounded border"
                              />
                            ) : doc.file.type === "application/pdf" ? (
                              <iframe
                                src={URL.createObjectURL(doc.file)}
                                title={doc.file.name}
                                className="mt-2 h-40 w-full rounded border"
                              />
                            ) : (
                              <p className="mt-1 text-xs text-gray-500">
                                File: {doc.file.name}
                              </p>
                            )
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">
                              No file uploaded
                            </p>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          {isExpirable
                            ? `Expires: ${doc.expirationDate || "-"} • ${status}`
                            : "Permanent Document"}
                        </div>
                        {isValid && (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">
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

            {saveError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {saveError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                disabled={isSaving}
                className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Confirm Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
