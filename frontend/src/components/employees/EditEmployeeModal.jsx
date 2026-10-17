import {
  FiAlertTriangle,
  FiInfo,
  FiUser,
  FiX,
} from "react-icons/fi";

import useEmployeeForm from "../../hooks/employees/useEmployeeForm";
import {
  getEmployeeApiError,
} from "../../utils/employees/employeeFormHelpers";

import {
  saveEmployeeWithDirectUploads,
} from "../../utils/employees/employeeDirectUpload";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";

import EmployeeFormFields from "./EmployeeFormFields";
import EmployeeDocumentsSection from "./EmployeeDocumentsSection";
import EmployeeMobileHandoffPanel from "./EmployeeMobileHandoffPanel";
import EmployeeReviewDialog from "./EmployeeReviewDialog";
import {
  StatusPill,
  SummaryRow,
} from "./EmployeeComponents";
import {
  DOCUMENT_OPTIONS,
  toProperName,
} from "./employeeConstants";

function getEmployeeId(
  employee
) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  );
}

export default function EditEmployeeModal({
  onClose,
  employeeToEdit,
  employees = [],
  onSaveSuccess,
  initialOpenCompliance = false,
  initialComplianceDocumentId = "",
  initialComplianceDocumentName = "",
}) {
  const employeeId =
    getEmployeeId(
      employeeToEdit
    );

  const hasExactComplianceTarget =
    Boolean(
      String(
        initialComplianceDocumentId ||
          ""
      ).trim() ||
      String(
        initialComplianceDocumentName ||
          ""
      ).trim()
    );

  const shouldOpenComplianceInitially =
    Boolean(
      initialOpenCompliance ||
      hasExactComplianceTarget
    );

  const {
    formData,
    errors,
    showReview,
    showDocuments,
    duplicateConfirmed,
    duplicateEmployee,

    companyOptions,
    positionOptions,
    isLoadingCompanies,
    isLoadingPositions,
    deploymentOptionsError,

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
    handleDuplicateConfirmChange,
    handleDocumentCheck,
    handleDocumentNumberChange,
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
    initialEmployee:
      employeeToEdit,

    employeeId,

    employees,

    /*
     * Compliance notification deep-links must render
     * the document section expanded from the first
     * modal render. The hook owns this initial state,
     * avoiding any effect-driven toggle race.
     */
    initialShowDocuments:
      shouldOpenComplianceInitially,
  });

  const workforceStatus =
    String(
      formData?.status ||
        "Floating / Standby"
    ).trim();

  const isPooling =
    workforceStatus ===
    "Floating / Standby";

  const isForDeployment =
    workforceStatus ===
    "For Deployment";

  const isDeployed =
    workforceStatus ===
    "Deployed";

  const workforceStatusLabel =
    isPooling
      ? "Floating / Standby"
      : workforceStatus;

  const companySummaryLabel =
    isDeployed
      ? "Client Company"
      : isForDeployment
        ? "Scheduled Client Company"
        : "Designated Client Company";

  const positionSummaryLabel =
    isDeployed
      ? "Position"
      : isForDeployment
        ? "Scheduled Position"
        : "Designated Position";

  const deploymentStartSummary =
    isDeployed
      ? (
          formData?.contractStart ||
          "-"
        )
      : isForDeployment
        ? "Pending arrival confirmation"
        : "Not yet deployed";

  const workflowReminder =
    isForDeployment
      ? "A deployment schedule is already set. Withdraw the schedule before changing the designated client company or position."
      : isDeployed
        ? "Client company and position come from the active deployment. End the current assignment before reassignment."
        : "Client company and position may be updated while the employee is Floating / Standby.";

  const handleClose = () => {
    if (
      isSaving ||
      showReview
    ) {
      return;
    }

    onClose?.();
  };

  const handleConfirmUpdate =
    async () => {
      if (
        isSaving ||
        !employeeId
      ) {
        return;
      }

      try {
        setIsSaving(
          true
        );

        setSaveError(
          ""
        );

        const employeeName =
          toProperName(
            formData.name
          );

        await saveEmployeeWithDirectUploads({
          formData,
          employeeId,
        });

        setShowReview(
          false
        );

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
          "UPDATE EMPLOYEE ERROR:",
          error
        );

        setSaveError(
          getEmployeeApiError(
            error,
            "Unable to update the employee record."
          )
        );
      } finally {
        setIsSaving(
          false
        );
      }
    };

  return (
    <>
      <Dialog
        open={
          !showReview
        }
        onClose={
          handleClose
        }
        title="Edit Employee Record"
        description="Update employee details while keeping deployment information consistent."
        size="2xl"
        height="xl"
        showHeader={false}
        showCloseButton={false}
        closeOnOverlay={
          !isSaving
        }
        closeOnEscape={
          !isSaving
        }
        preventClose={
          isSaving
        }
        scrollBody={false}
        bodyClassName="min-h-0 flex-1 p-0"
        className="border-white/10 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
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
                  Update Employee
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/75">
                  Update employee details, client company, position, and available documents.
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
                      width:
                        `${completion}%`,
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

                  <p className="mt-1 break-all text-white/75">
                    {employeeId ||
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
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-5 dark:border-white/10 dark:bg-slate-900">
              <div className="min-w-0">
                {duplicateEmployee && (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={
                        duplicateConfirmed
                          ? "amber"
                          : "red"
                      }
                    >
                      <FiAlertTriangle
                        aria-hidden="true"
                      />

                      {duplicateConfirmed
                        ? "Duplicate Confirmed"
                        : "Possible Duplicate"}
                    </StatusPill>
                  </div>
                )}

                <h2 className="mt-2 text-xl font-extrabold text-gray-900 sm:mt-3 sm:text-2xl dark:text-white">
                  Edit Employee
                </h2>

                <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500 sm:text-sm dark:text-gray-400">
                  Update the employee details below. Deployment changes are handled through the deployment process.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                aria-label="Close edit employee form"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden dark:border-white/10 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                <FiX
                  size={18}
                  aria-hidden="true"
                />
              </button>

              <div className="hidden sm:block">
                <Button
                  variant="secondary"
                  disabled={isSaving}
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            </header>

            <form
              onSubmit={
                handleSubmit
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
                <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-2 gap-2 xl:hidden">
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        Employee ID
                      </p>

                      <p className="mt-1 truncate text-sm font-extrabold text-gray-900 dark:text-white">
                        {employeeId || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        Progress
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white">
                        {completion}%
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <main className="min-w-0">
                      <EmployeeFormFields
                        mode="edit"
                        employeeId={
                          employeeId
                        }
                        formData={
                          formData
                        }
                        errors={
                          errors
                        }
                        duplicateEmployee={
                          duplicateEmployee
                        }
                        duplicateConfirmed={
                          duplicateConfirmed
                        }
                        companyOptions={
                          companyOptions
                        }
                        positionOptions={
                          positionOptions
                        }
                        isLoadingCompanies={
                          isLoadingCompanies
                        }
                        isLoadingPositions={
                          isLoadingPositions
                        }
                        deploymentOptionsError={
                          deploymentOptionsError
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
                      />
                    </main>

                    <aside className="hidden min-w-0 space-y-4 xl:block">
                      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <FiInfo
                              aria-hidden="true"
                            />
                          </div>

                          <div>
                            <h3 className="font-extrabold text-gray-900 dark:text-white">
                              Record Summary
                            </h3>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Review the information before continuing.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          <SummaryRow
                            label="Employee ID"
                            value={
                              employeeId ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label="Full Name"
                            value={
                              toProperName(
                                formData.name
                              ) ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label="Date Hired"
                            value={
                              formData.dateHired ||
                              formData.date_hired ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label="Workforce Status"
                            value={
                              workforceStatusLabel
                            }
                          />

                          <SummaryRow
                            label={
                              companySummaryLabel
                            }
                            value={
                              formData.company ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label={
                              positionSummaryLabel
                            }
                            value={
                              formData.position ||
                              "-"
                            }
                          />

                          <SummaryRow
                            label="Deployment Start"
                            value={
                              deploymentStartSummary
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
                          <FiAlertTriangle
                            aria-hidden="true"
                          />

                          Reminder
                        </div>

                        <p className="leading-5">
                          {workflowReminder}
                        </p>

                        <p className="mt-2 leading-5">
                          Existing files stay attached unless you remove or replace them.
                        </p>
                      </div>
                    </aside>
                  </div>

                  <EmployeeMobileHandoffPanel
                    employeeId={
                      employeeId
                    }
                    employeeName={
                      toProperName(
                        formData.name
                      )
                    }
                    disabled={
                      isSaving
                    }
                  />

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
                    focusDocumentId={
                      initialComplianceDocumentId
                    }
                    focusDocumentName={
                      initialComplianceDocumentName
                    }
                    onToggle={
                      handleToggleDocuments
                    }
                    onDocumentCheck={
                      handleDocumentCheck
                    }
                    onDocumentNumberChange={
                      handleDocumentNumberChange
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

              <footer className="shrink-0 border-t border-gray-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4 dark:border-white/10 dark:bg-slate-900">
                <div className="mx-auto flex w-full max-w-7xl flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <Button
                    variant="secondary"
                    disabled={isSaving}
                    onClick={handleClose}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={
                      isSaving ||
                      !employeeId
                    }
                    className="w-full sm:w-auto"
                  >
                    Review Changes
                  </Button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      </Dialog>

      <EmployeeReviewDialog
        open={
          showReview
        }
        mode="edit"
        employeeId={
          employeeId
        }
        formData={
          formData
        }
        complianceWarning={
          complianceWarning
        }
        saveError={
          saveError
        }
        isSaving={
          isSaving
        }
        onClose={
          handleCloseReview
        }
        onConfirm={
          handleConfirmUpdate
        }
      />
    </>
  );
}