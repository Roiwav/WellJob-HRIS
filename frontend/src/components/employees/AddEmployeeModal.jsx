import axios from "axios";
import {
  FiAlertTriangle,
  FiInfo,
  FiUser,
} from "react-icons/fi";

import useEmployeeForm from "../../hooks/employees/useEmployeeForm";
import {
  EMPLOYEE_API_URL,
  buildEmployeeFormData,
  getEmployeeApiError,
} from "../../utils/employees/employeeFormHelpers";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";

import EmployeeDocumentsSection from "./EmployeeDocumentsSection";
import EmployeeFormFields from "./EmployeeFormFields";
import EmployeeReviewDialog from "./EmployeeReviewDialog";
import {
  StatusPill,
  SummaryRow,
} from "./EmployeeComponents";
import {
  DOCUMENT_OPTIONS,
  toProperName,
} from "./employeeConstants";

export default function AddEmployeeModal({
  onClose,
  generatedId = "",
  employees = [],
  onSaveSuccess,
}) {
  const {
    formData,
    errors,
    showReview,
    showDocuments,
    duplicateConfirmed,
    duplicateEmployee,
    filteredCompanies,
    showSuggestions,
    dragTargetDocument,
    completedDocuments,
    completion,
    complianceWarning,
    remainingDocuments,
    isSaving,
    saveError,

    setIsSaving,
    setSaveError,
    setShowReview,

    handleChange,
    handleNameBlur,
    handleCompanyFocus,
    handleCompanyBlur,
    handleCompanySelect,
    handleDuplicateConfirmChange,
    handleDocumentCheck,
    handleExpirationChange,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileDrop,
    handleToggleDocuments,
    handleSubmit,
    handleCloseReview,
  } = useEmployeeForm({
    employeeId: generatedId,
    employees,
  });

  const handleClose = () => {
    if (isSaving || showReview) {
      return;
    }

    onClose?.();
  };

  const handleConfirmSave = async () => {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      const requestData =
        buildEmployeeFormData(formData);

      const employeeName =
        toProperName(formData.name);

      await axios.post(
        EMPLOYEE_API_URL,
        requestData
      );

      setShowReview(false);

      if (
        typeof onSaveSuccess ===
        "function"
      ) {
        await onSaveSuccess(
          employeeName
        );
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error(
        "SAVE EMPLOYEE ERROR:",
        error
      );

      setSaveError(
        getEmployeeApiError(
          error,
          "Unable to save the employee record."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={!showReview}
        onClose={handleClose}
        title="Add Employee Record"
        description="Complete the employee information and review it before saving."
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
                  <FiUser
                    size={26}
                    aria-hidden="true"
                  />
                </div>

                <h2 className="text-2xl font-extrabold">
                  New Employee
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Register employee
                  information, verify
                  duplicate names, and
                  attach compliance
                  documents.
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-white/75">
                  <span>
                    Completion
                  </span>

                  <span>
                    {completion}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{
                      width: `${completion}%`,
                    }}
                  />
                </div>

                {remainingDocuments >
                  0 && (
                  <p className="mt-3 text-xs text-white/70">
                    {
                      remainingDocuments
                    }{" "}
                    compliance document
                    {remainingDocuments ===
                    1
                      ? ""
                      : "s"}{" "}
                    remaining.
                  </p>
                )}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">
                    Employee ID
                  </p>

                  <p className="mt-1 text-white/75">
                    {generatedId ||
                      "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="font-bold">
                    Complete Documents
                  </p>

                  <p className="mt-1 text-white/75">
                    {
                      completedDocuments.length
                    }
                    /
                    {
                      DOCUMENT_OPTIONS.length
                    }
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
                    Create Mode
                  </StatusPill>

                  {duplicateEmployee && (
                    <StatusPill
                      tone={
                        duplicateConfirmed
                          ? "amber"
                          : "red"
                      }
                    >
                      <FiAlertTriangle aria-hidden="true" />

                      {duplicateConfirmed
                        ? "Duplicate Verified"
                        : "Possible Duplicate"}
                    </StatusPill>
                  )}
                </div>

                <h2 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-white">
                  Add Employee Record
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Complete the employee
                  information and review
                  it before saving.
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
                        mode="add"
                        employeeId={
                          generatedId
                        }
                        formData={
                          formData
                        }
                        errors={errors}
                        duplicateEmployee={
                          duplicateEmployee
                        }
                        duplicateConfirmed={
                          duplicateConfirmed
                        }
                        filteredCompanies={
                          filteredCompanies
                        }
                        showSuggestions={
                          showSuggestions
                        }
                        disabled={
                          isSaving
                        }
                        onChange={
                          handleChange
                        }
                        onNameBlur={
                          handleNameBlur
                        }
                        onDuplicateConfirmChange={
                          handleDuplicateConfirmChange
                        }
                        onCompanyFocus={
                          handleCompanyFocus
                        }
                        onCompanyBlur={
                          handleCompanyBlur
                        }
                        onCompanySelect={
                          handleCompanySelect
                        }
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
                              Live preview
                              before review.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          <SummaryRow
                            label="Employee ID"
                            value={
                              generatedId ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label="Full Name"
                            value={
                              toProperName(
                                formData.name
                              ) || "-"
                            }
                          />

                          <SummaryRow
                            label="Status"
                            value={
                              formData.status
                            }
                          />

                          <SummaryRow
                            label="Company"
                            value={
                              formData.status ===
                              "Deployed"
                                ? formData.company ||
                                  "-"
                                : "Not Assigned"
                            }
                          />

                          <SummaryRow
                            label="Start Date"
                            value={
                              formData.status ===
                              "Deployed"
                                ? formData.contractStart ||
                                  "-"
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
                          Verify possible
                          duplicate names
                          through supporting
                          documents before
                          saving.
                        </p>
                      </div>
                    </aside>
                  </div>

                  <EmployeeDocumentsSection
                    documents={
                      formData.documents
                    }
                    errors={
                      errors.documents
                    }
                    expanded={
                      showDocuments
                    }
                    disabled={
                      isSaving
                    }
                    dragTargetDocument={
                      dragTargetDocument
                    }
                    onToggle={
                      handleToggleDocuments
                    }
                    onDocumentCheck={
                      handleDocumentCheck
                    }
                    onExpirationChange={
                      handleExpirationChange
                    }
                    onFileSelect={
                      handleFileSelect
                    }
                    onDragEnter={
                      handleDragEnter
                    }
                    onDragOver={
                      handleDragOver
                    }
                    onDragLeave={
                      handleDragLeave
                    }
                    onFileDrop={
                      handleFileDrop
                    }
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
                  disabled={isSaving}
                >
                  Review Employee
                </Button>
              </footer>
            </form>
          </section>
        </div>
      </Dialog>

      <EmployeeReviewDialog
        open={showReview}
        mode="add"
        employeeId={generatedId}
        formData={formData}
        complianceWarning={
          complianceWarning
        }
        saveError={saveError}
        isSaving={isSaving}
        onClose={
          handleCloseReview
        }
        onConfirm={
          handleConfirmSave
        }
      />
    </>
  );
}