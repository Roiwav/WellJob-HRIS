import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiAlertTriangle,
  FiInfo,
  FiUser,
} from "react-icons/fi";
import axios from "axios";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";

import EmployeeFormFields from "./EmployeeFormFields";
import EmployeeDocumentsSection from "./EmployeeDocumentsSection";
import EmployeeReviewDialog from "./EmployeeReviewDialog";

import {
  StatusPill,
  SummaryRow,
} from "./EmployeeComponents";

import {
  COMPANY_OPTIONS,
  DOCUMENT_OPTIONS,
  toProperName,
} from "./employeeConstants";

import {
  EMPLOYEE_API_URL,
  INITIAL_EMPLOYEE_FORM_ERRORS,
  buildEmployeeFormData,
  calculateEmployeeFormCompletion,
  createInitialEmployeeFormData,
  findDuplicateEmployee,
  getCompletedDocuments,
  getComplianceReviewWarning,
  getEmployeeApiError,
  validateEmployeeDocumentFile,
  validateEmployeeForm,
} from "../../utils/employees/employeeFormHelpers";

export default function EditEmployeeModal({
  onClose,
  employeeToEdit,
  employees = [],
  onSaveSuccess,
}) {
  const employeeId = String(
    employeeToEdit?.id ||
      employeeToEdit?.employeeId ||
      employeeToEdit?.employee_id ||
      ""
  );

  const [formData, setFormData] = useState(() =>
    createInitialEmployeeFormData(employeeToEdit)
  );

  const [errors, setErrors] = useState(() => ({
    ...INITIAL_EMPLOYEE_FORM_ERRORS,
    documents: {},
  }));

  const [showReview, setShowReview] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const [filteredCompanies, setFilteredCompanies] =
    useState(COMPANY_OPTIONS);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragTargetDocument, setDragTargetDocument] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setFormData(createInitialEmployeeFormData(employeeToEdit));

    setErrors({
      ...INITIAL_EMPLOYEE_FORM_ERRORS,
      documents: {},
    });

    setShowReview(false);
    setShowDocuments(false);
    setDuplicateConfirmed(false);
    setFilteredCompanies(COMPANY_OPTIONS);
    setShowSuggestions(false);
    setDragTargetDocument("");
    setIsSaving(false);
    setSaveError("");
  }, [employeeToEdit]);

  const duplicateEmployee = useMemo(
    () =>
      findDuplicateEmployee({
        employees,
        employeeName: formData.name,
        excludedEmployeeId: employeeId,
      }),
    [employeeId, employees, formData.name]
  );

  const completedDocuments = useMemo(
    () => getCompletedDocuments(formData.documents),
    [formData.documents]
  );

  const completion = useMemo(
    () => calculateEmployeeFormCompletion(formData),
    [formData]
  );

  const complianceWarning = useMemo(
    () => getComplianceReviewWarning(formData),
    [formData]
  );

  const remainingDocuments = Math.max(
    DOCUMENT_OPTIONS.length - completedDocuments.length,
    0
  );

  const clearFieldError = useCallback((fieldName) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
    }));
  }, []);

  const clearDocumentError = useCallback((documentName) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      documents: {
        ...currentErrors.documents,
        [documentName]: "",
        [`${documentName}_file`]: "",
        general: "",
      },
    }));
  }, []);

  const handleChange = useCallback(
    (event) => {
      const { name, value } = event.target;

      setSaveError("");

      if (name === "status") {
        const nextStatusIsDeployed = value === "Deployed";

        setFormData((currentData) => ({
          ...currentData,
          status: value,
          company: nextStatusIsDeployed
            ? currentData.company
            : "",
          contractStart: nextStatusIsDeployed
            ? currentData.contractStart
            : "",
        }));

        setErrors((currentErrors) => ({
          ...currentErrors,
          company: "",
          contractStart: "",
        }));

        setFilteredCompanies(COMPANY_OPTIONS);
        setShowSuggestions(false);
        return;
      }

      setFormData((currentData) => ({
        ...currentData,
        [name]: value,
      }));

      if (name === "name") {
        setDuplicateConfirmed(false);

        setErrors((currentErrors) => ({
          ...currentErrors,
          name: "",
          duplicateConfirm: "",
        }));

        return;
      }

      if (name === "company") {
        const normalizedValue = value.toLowerCase();

        setFilteredCompanies(
          COMPANY_OPTIONS.filter((company) =>
            company.toLowerCase().includes(normalizedValue)
          )
        );

        setShowSuggestions(true);
      }

      clearFieldError(name);
    },
    [clearFieldError]
  );

  const handleNameBlur = useCallback(() => {
    setFormData((currentData) => ({
      ...currentData,
      name: toProperName(currentData.name),
    }));
  }, []);

  const handleCompanyFocus = useCallback(() => {
    const normalizedCompany = String(
      formData.company || ""
    ).toLowerCase();

    setFilteredCompanies(
      COMPANY_OPTIONS.filter((company) =>
        company.toLowerCase().includes(normalizedCompany)
      )
    );

    setShowSuggestions(true);
  }, [formData.company]);

  const handleCompanyBlur = useCallback(() => {
    window.setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }, []);

  const handleCompanySelect = useCallback((company) => {
    setFormData((currentData) => ({
      ...currentData,
      company,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      company: "",
    }));

    setFilteredCompanies(
      COMPANY_OPTIONS.filter((option) =>
        option.toLowerCase().includes(company.toLowerCase())
      )
    );

    setShowSuggestions(false);
    setSaveError("");
  }, []);

  const handleDuplicateConfirmChange = useCallback((checked) => {
    setDuplicateConfirmed(checked);

    setErrors((currentErrors) => ({
      ...currentErrors,
      duplicateConfirm: "",
    }));
  }, []);

  const handleDocumentCheck = useCallback(
    (documentName) => {
      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) => {
          if (document.name !== documentName) {
            return document;
          }

          const nextChecked = !document.checked;

          return {
            ...document,
            checked: nextChecked,
            expirationDate: nextChecked
              ? document.expirationDate
              : "",
            file: nextChecked ? document.file : null,
            filePath: nextChecked ? document.filePath : "",
          };
        }),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleExpirationChange = useCallback(
    (documentName, expirationDate) => {
      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) =>
          document.name === documentName
            ? {
                ...document,
                expirationDate,
              }
            : document
        ),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleFileSelect = useCallback(
    (documentName, file) => {
      if (!file) {
        return;
      }

      const validationError =
        validateEmployeeDocumentFile(file);

      if (validationError) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          documents: {
            ...currentErrors.documents,
            [`${documentName}_file`]: validationError,
          },
        }));

        return;
      }

      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) =>
          document.name === documentName
            ? {
                ...document,
                checked: true,
                file,
                filePath: "",
              }
            : document
        ),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleDragEnter = useCallback((event, documentName) => {
    event.preventDefault();
    event.stopPropagation();

    setDragTargetDocument(documentName);
  }, []);

  const handleDragOver = useCallback((event, documentName) => {
    event.preventDefault();
    event.stopPropagation();

    setDragTargetDocument(documentName);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget;

    if (
      !relatedTarget ||
      !currentTarget.contains(relatedTarget)
    ) {
      setDragTargetDocument("");
    }
  }, []);

  const handleFileDrop = useCallback(
    (event, documentName) => {
      event.preventDefault();
      event.stopPropagation();

      setDragTargetDocument("");

      const file = event.dataTransfer?.files?.[0];

      if (!file) {
        return;
      }

      handleFileSelect(documentName, file);
    },
    [handleFileSelect]
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      setSaveError("");

      const validationResult = validateEmployeeForm({
        formData,
        employees,
        employeeId,
        excludedEmployeeId: employeeId,
        duplicateEmployee,
        duplicateConfirmed,
      });

      setErrors(validationResult.errors);

      if (!validationResult.isValid) {
        if (
          Object.keys(validationResult.errors.documents).length > 0
        ) {
          setShowDocuments(true);
        }

        return;
      }

      setShowReview(true);
    },
    [
      duplicateConfirmed,
      duplicateEmployee,
      employeeId,
      employees,
      formData,
    ]
  );

  const handleConfirmUpdate = useCallback(async () => {
    if (isSaving || !employeeId) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      const requestData = buildEmployeeFormData(formData);
      const employeeName = toProperName(formData.name);

      await axios.put(
        `${EMPLOYEE_API_URL}/${encodeURIComponent(employeeId)}`,
        requestData
      );

      setShowReview(false);

      if (typeof onSaveSuccess === "function") {
        await onSaveSuccess(employeeName);
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error("UPDATE EMPLOYEE ERROR:", error);

      setSaveError(
        getEmployeeApiError(
          error,
          "Unable to update the employee record."
        )
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    employeeId,
    formData,
    isSaving,
    onClose,
    onSaveSuccess,
  ]);

  const handleClose = useCallback(() => {
    if (isSaving || showReview) {
      return;
    }

    onClose?.();
  }, [isSaving, onClose, showReview]);

  const handleCloseReview = useCallback(() => {
    if (isSaving) {
      return;
    }

    setShowReview(false);
  }, [isSaving]);

  return (
    <>
      <Dialog
        open={!showReview}
        onClose={handleClose}
        title="Edit Employee Record"
        description="Review all changes before updating the employee record."
        size="2xl"
        height="xl"
        showHeader={false}
        showCloseButton={false}
        closeOnOverlay={!isSaving}
        closeOnEscape={!isSaving}
        preventClose={isSaving}
        scrollBody={false}
        bodyClassName="min-h-0 flex-1 p-0"
        className="border-white/10"
      >
        <div className="flex h-full min-h-0 w-full overflow-hidden">
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-white/10 bg-gradient-to-b from-indigo-700 via-blue-700 to-slate-950 p-7 text-white lg:block">
            <div className="flex min-h-full flex-col">
              <div>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <FiUser size={26} aria-hidden="true" />
                </div>

                <h2 className="text-2xl font-extrabold">
                  Update Employee
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Update employee information, deployment details, and
                  compliance documents.
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
                    {remainingDocuments === 1 ? "" : "s"} remaining.
                  </p>
                )}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">Employee ID</p>

                  <p className="mt-1 break-all text-white/75">
                    {employeeId || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">Complete Documents</p>

                  <p className="mt-1 text-white/75">
                    {completedDocuments.length}/{DOCUMENT_OPTIONS.length}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-5 sm:px-6 dark:border-white/10 dark:bg-slate-900">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="indigo">
                    <FiUser aria-hidden="true" />
                    Edit Mode
                  </StatusPill>

                  {duplicateEmployee && (
                    <StatusPill
                      tone={duplicateConfirmed ? "amber" : "red"}
                    >
                      <FiAlertTriangle aria-hidden="true" />

                      {duplicateConfirmed
                        ? "Duplicate Verified"
                        : "Possible Duplicate"}
                    </StatusPill>
                  )}
                </div>

                <h2 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white">
                  Edit Employee Record
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Review all changes before updating the employee record.
                </p>
              </div>

              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={handleClose}
              >
                Close
              </Button>
            </header>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-6">
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <main className="min-w-0">
                      <EmployeeFormFields
                        mode="edit"
                        employeeId={employeeId}
                        formData={formData}
                        errors={errors}
                        duplicateEmployee={duplicateEmployee}
                        duplicateConfirmed={duplicateConfirmed}
                        filteredCompanies={filteredCompanies}
                        showSuggestions={showSuggestions}
                        disabled={isSaving}
                        onChange={handleChange}
                        onNameBlur={handleNameBlur}
                        onDuplicateConfirmChange={
                          handleDuplicateConfirmChange
                        }
                        onCompanyFocus={handleCompanyFocus}
                        onCompanyBlur={handleCompanyBlur}
                        onCompanySelect={handleCompanySelect}
                      />
                    </main>

                    <aside className="min-w-0 space-y-4">
                      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <FiInfo aria-hidden="true" />
                          </div>

                          <div>
                            <h3 className="font-extrabold text-gray-900 dark:text-white">
                              Record Summary
                            </h3>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Live preview before confirmation.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          <SummaryRow
                            label="Employee ID"
                            value={employeeId || "-"}
                          />

                          <SummaryRow
                            label="Full Name"
                            value={toProperName(formData.name) || "-"}
                          />

                          <SummaryRow
                            label="Status"
                            value={formData.status}
                          />

                          <SummaryRow
                            label="Company"
                            value={
                              formData.status === "Deployed"
                                ? formData.company || "-"
                                : "Not Assigned"
                            }
                          />

                          <SummaryRow
                            label="Start Date"
                            value={
                              formData.status === "Deployed"
                                ? formData.contractStart || "-"
                                : "Not Applicable"
                            }
                          />

                          <SummaryRow
                            label="Documents"
                            value={`${completedDocuments.length}/${DOCUMENT_OPTIONS.length}`}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <div className="mb-1 flex items-center gap-2 font-extrabold">
                          <FiAlertTriangle aria-hidden="true" />
                          HRIS Reminder
                        </div>

                        <p className="leading-5">
                          Existing files remain attached unless their
                          document requirement is unchecked or replaced.
                        </p>
                      </div>
                    </aside>
                  </div>

                  <EmployeeDocumentsSection
                    documents={formData.documents}
                    errors={errors.documents}
                    expanded={showDocuments}
                    disabled={isSaving}
                    dragTargetDocument={dragTargetDocument}
                    onToggle={() =>
                      setShowDocuments((currentValue) => !currentValue)
                    }
                    onDocumentCheck={handleDocumentCheck}
                    onExpirationChange={handleExpirationChange}
                    onFileSelect={handleFileSelect}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onFileDrop={handleFileDrop}
                  />
                </div>
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-white/10 dark:bg-slate-900">
                <Button
                  variant="secondary"
                  disabled={isSaving}
                  onClick={handleClose}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving || !employeeId}
                >
                  Review Update
                </Button>
              </footer>
            </form>
          </section>
        </div>
      </Dialog>

      <EmployeeReviewDialog
        open={showReview}
        mode="edit"
        employeeId={employeeId}
        formData={formData}
        complianceWarning={complianceWarning}
        saveError={saveError}
        isSaving={isSaving}
        onClose={handleCloseReview}
        onConfirm={handleConfirmUpdate}
      />
    </>
  );
}