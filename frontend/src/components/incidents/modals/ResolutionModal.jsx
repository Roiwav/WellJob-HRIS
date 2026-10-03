import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiShield,
  FiUpload,
} from "react-icons/fi";

import Button from "../../ui/Button";

import {
  AlertBox,
  BaseModal,
  Field,
  InfoCard,
  ModalFooter,
  ProofList,
} from "../shared/ModalUI";

import {
  createEvidenceItem,
  revokeEvidenceUrl,
} from "../../../utils/incidents/evidenceFiles";

function RequirementChip({
  complete,
  label,
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
      ].join(" ")}
    >
      <FiCheckCircle
        size={12}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export default function ResolutionModal({
  incident,
  onClose,
  onSubmit,
  showNotice,
}) {
  const fileInputRef = useRef(null);
  const proofFilesRef = useRef([]);

  const [
    actionTaken,
    setActionTaken,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const [
    proofFiles,
    setProofFiles,
  ] = useState([]);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  useEffect(() => {
    proofFilesRef.current =
      proofFiles;
  }, [proofFiles]);

  useEffect(() => {
    return () => {
      proofFilesRef.current.forEach(
        revokeEvidenceUrl
      );
    };
  }, []);

  const handleClose =
    useCallback(() => {
      if (isSubmitting) {
        return;
      }

      onClose?.();
    }, [
      isSubmitting,
      onClose,
    ]);

  const handleActionTakenChange =
    useCallback(
      (event) => {
        setActionTaken(
          event.target.value
        );
      },
      []
    );

  const handleRemarksChange =
    useCallback(
      (event) => {
        setRemarks(
          event.target.value
        );
      },
      []
    );

  const handleFileChange =
    useCallback(
      (event) => {
        const selectedFiles =
          Array.from(
            event.target.files ||
              []
          );

        if (
          selectedFiles.length ===
          0
        ) {
          return;
        }

        setProofFiles(
          (currentFiles) => {
            const existingIds =
              new Set(
                currentFiles.map(
                  (item) =>
                    item.id
                )
              );

            const additions =
              selectedFiles
                .map(
                  createEvidenceItem
                )
                .filter(
                  (item) => {
                    if (
                      !existingIds.has(
                        item.id
                      )
                    ) {
                      existingIds.add(
                        item.id
                      );

                      return true;
                    }

                    revokeEvidenceUrl(
                      item
                    );

                    return false;
                  }
                );

            return [
              ...currentFiles,
              ...additions,
            ];
          }
        );

        event.target.value =
          "";
      },
      []
    );

  const handleRemoveFile =
    useCallback(
      (id) => {
        if (
          isSubmitting
        ) {
          return;
        }

        setProofFiles(
          (currentFiles) => {
            const target =
              currentFiles.find(
                (item) =>
                  item.id ===
                  id
              );

            if (target) {
              revokeEvidenceUrl(
                target
              );
            }

            return currentFiles.filter(
              (item) =>
                item.id !==
                id
            );
          }
        );
      },
      [isSubmitting]
    );

  const validateResolution =
    useCallback(() => {
      if (
        !actionTaken.trim()
      ) {
        showNotice?.(
          "error",
          "Action Taken Required",
          "Please enter the action taken before submitting this case for review."
        );

        return false;
      }

      if (
        !remarks.trim()
      ) {
        showNotice?.(
          "error",
          "Resolution Remarks Required",
          "Please enter resolution remarks to explain how the case was handled."
        );

        return false;
      }

      const validProofFiles =
        proofFiles.filter(
          (item) =>
            item?.file instanceof
              File &&
            !item?.error
        );

      if (
        validProofFiles.length ===
        0
      ) {
        showNotice?.(
          "error",
          "Proof Upload Required",
          "Please upload at least one valid proof file before submitting for review."
        );

        return false;
      }

      return true;
    }, [
      actionTaken,
      proofFiles,
      remarks,
      showNotice,
    ]);

  const handleSubmit =
    useCallback(
      async (event) => {
        event.preventDefault();

        if (
          isSubmitting ||
          !incident ||
          !validateResolution()
        ) {
          return;
        }

        const submissionFiles =
          proofFiles.map(
            (item) => {
              if (
                item.error
              ) {
                return item;
              }

              return {
                ...item,
                status:
                  "Uploading",
              };
            }
          );

        try {
          setIsSubmitting(
            true
          );

          setProofFiles(
            submissionFiles
          );

          const success =
            await onSubmit?.(
              incident,
              {
                actionTaken:
                  actionTaken.trim(),
                remarks:
                  remarks.trim(),
                proofFiles:
                  submissionFiles,
              }
            );

          if (
            success ===
            false
          ) {
            setProofFiles(
              (
                currentFiles
              ) =>
                currentFiles.map(
                  (item) => {
                    if (
                      item.error
                    ) {
                      return item;
                    }

                    return {
                      ...item,
                      status:
                        "Failed",
                      error:
                        "Upload was not accepted by the server.",
                    };
                  }
                )
            );

            return;
          }

          setProofFiles(
            (
              currentFiles
            ) =>
              currentFiles.map(
                (item) => {
                  if (
                    item.error
                  ) {
                    return item;
                  }

                  return {
                    ...item,
                    status:
                      "Uploaded",
                  };
                }
              )
          );
        } catch (error) {
          console.error(
            "Submit resolution proof error:",
            error
          );

          setProofFiles(
            (
              currentFiles
            ) =>
              currentFiles.map(
                (item) => {
                  if (
                    item.error
                  ) {
                    return item;
                  }

                  return {
                    ...item,
                    status:
                      "Failed",
                    error:
                      error?.message ||
                      "Evidence upload failed.",
                  };
                }
              )
          );

          showNotice?.(
            "error",
            "Submission Failed",
            error?.message ||
              "The resolution proof could not be submitted. Please try again."
          );
        } finally {
          setIsSubmitting(
            false
          );
        }
      },
      [
        actionTaken,
        incident,
        isSubmitting,
        onSubmit,
        proofFiles,
        remarks,
        showNotice,
        validateResolution,
      ]
    );

  if (!incident) {
    return null;
  }

  const incidentCode =
    incident.displayId ||
    incident.id ||
    "-";

  const employeeName =
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const violation =
    incident.violation ||
    incident.violationType ||
    "-";

  const severity =
    incident.severity ||
    "-";

  const status =
    incident.status ||
    "-";

  const wasReturned =
    String(
      incident?.review
        ?.decision ||
        incident?.reviewDecision ||
        ""
    )
      .trim()
      .toLowerCase() ===
    "rejected";

  const reviewComments =
    incident?.review
      ?.comments ||
    incident?.reviewComments ||
    "The case was returned for correction.";

  const validProofCount =
    proofFiles.filter(
      (item) =>
        item?.file instanceof
          File &&
        !item?.error
    ).length;

  const hasAction =
    Boolean(
      actionTaken.trim()
    );

  const hasRemarks =
    Boolean(
      remarks.trim()
    );

  const hasEvidence =
    validProofCount > 0;

  return (
    <BaseModal
      onClose={
        handleClose
      }
      title="Submit Resolution Proof"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="green"
      size="lg"
      preventClose={
        isSubmitting
      }
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        {wasReturned && (
          <AlertBox
            type="error"
            title="Returned for Correction"
            message={
              reviewComments
            }
          />
        )}

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                aria-hidden="true"
              >
                <FiShield
                  size={18}
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  Resolution Submission
                </p>

                <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                  Document the corrective action, explain the resolution, and attach supporting evidence before sending the case to authorized HR review.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <RequirementChip
                complete={
                  hasAction
                }
                label="Action"
              />

              <RequirementChip
                complete={
                  hasRemarks
                }
                label="Remarks"
              />

              <RequirementChip
                complete={
                  hasEvidence
                }
                label="Evidence"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Case
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {incidentCode}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Status
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {status}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Severity
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {severity}
            </p>
          </div>
        </div>

        <InfoCard title="Case Context">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Employee
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {employeeName}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Violation
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {violation}
              </p>
            </div>
          </div>
        </InfoCard>

        <InfoCard title="System Recommendation">
          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <FiAlertTriangle
              className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />

            <p className="text-sm font-medium leading-6 text-indigo-700 dark:text-indigo-300">
              {incident.recommendation ||
                "No recommendation generated."}
            </p>
          </div>
        </InfoCard>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
              aria-hidden="true"
            >
              <FiMessageSquare />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Resolution Details
              </h3>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Record what was done and how the case was resolved.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field
              label="Action Taken"
              required
            >
              <textarea
                rows={3}
                value={
                  actionTaken
                }
                onChange={
                  handleActionTakenChange
                }
                disabled={
                  isSubmitting
                }
                placeholder="Example: Employee was issued an NTE, suspension notice, or other corrective action."
                className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                State the actual corrective or disciplinary action completed for this case.
              </p>
            </Field>

            <Field
              label="Resolution Remarks"
              required
            >
              <textarea
                rows={4}
                value={
                  remarks
                }
                onChange={
                  handleRemarksChange
                }
                disabled={
                  isSubmitting
                }
                placeholder="Summarize the outcome, supporting details, and any follow-up completed."
                className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Provide enough context for the authorized reviewer to verify the resolution.
              </p>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                aria-hidden="true"
              >
                <FiFileText />
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Supporting Evidence
                </h3>

                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Attach proof that supports the completed action and resolution.
                </p>
              </div>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {validProofCount} valid file
              {validProofCount === 1
                ? ""
                : "s"}
            </span>
          </div>

          <label
            htmlFor="resolution-proof-files"
            className={[
              "group flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-7 text-center transition",
              isSubmitting
                ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-950/40"
                : "cursor-pointer border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/5",
            ].join(" ")}
          >
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700"
              aria-hidden="true"
            >
              <FiUpload
                size={20}
              />
            </div>

            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Choose evidence files
            </span>

            <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              PNG, JPEG, or PDF • Select one or multiple files
            </span>

            <span className="mt-2 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              At least one valid file required
            </span>

            <input
              ref={
                fileInputRef
              }
              id="resolution-proof-files"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.jfif,.jpe,.pdf,image/png,image/jpeg,application/pdf"
              onChange={
                handleFileChange
              }
              disabled={
                isSubmitting
              }
              className="hidden"
            />
          </label>

          {proofFiles.length >
            0 && (
            <ProofList
              files={
                proofFiles
              }
              onRemove={
                isSubmitting
                  ? undefined
                  : handleRemoveFile
              }
            />
          )}
        </section>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={
              isSubmitting
            }
            onClick={
              handleClose
            }
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="success"
            leftIcon={
              <FiCheckCircle
                aria-hidden="true"
              />
            }
            loading={
              isSubmitting
            }
            disabled={
              isSubmitting ||
              proofFiles.some(
                (item) =>
                  Boolean(
                    item?.error
                  )
              )
            }
          >
            {isSubmitting
              ? "Uploading Evidence..."
              : "Submit for Review"}
          </Button>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}