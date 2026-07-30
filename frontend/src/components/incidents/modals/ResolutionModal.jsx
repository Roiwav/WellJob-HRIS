import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FiCheckCircle,
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

export default function ResolutionModal({
  incident,
  onClose,
  onSubmit,
  showNotice,
}) {
  const fileInputRef = useRef(null);
  const proofFilesRef = useRef([]);

  const [actionTaken, setActionTaken] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [proofFiles, setProofFiles] =
    useState([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    proofFilesRef.current = proofFiles;
  }, [proofFiles]);

  useEffect(() => {
    return () => {
      proofFilesRef.current.forEach(
        revokeEvidenceUrl
      );
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    onClose?.();
  }, [isSubmitting, onClose]);

  const handleActionTakenChange =
    useCallback((event) => {
      setActionTaken(event.target.value);
    }, []);

  const handleRemarksChange =
    useCallback((event) => {
      setRemarks(event.target.value);
    }, []);

  const handleFileChange = useCallback(
    (event) => {
      const selectedFiles = Array.from(
        event.target.files || []
      );

      if (selectedFiles.length === 0) {
        return;
      }

      setProofFiles((currentFiles) => {
        const existingIds = new Set(
          currentFiles.map(
            (item) => item.id
          )
        );

        const additions = selectedFiles
          .map(createEvidenceItem)
          .filter((item) => {
            if (
              !existingIds.has(item.id)
            ) {
              existingIds.add(item.id);
              return true;
            }

            revokeEvidenceUrl(item);
            return false;
          });

        return [
          ...currentFiles,
          ...additions,
        ];
      });

      event.target.value = "";
    },
    []
  );

  const handleRemoveFile = useCallback(
    (id) => {
      if (isSubmitting) {
        return;
      }

      setProofFiles((currentFiles) => {
        const target =
          currentFiles.find(
            (item) => item.id === id
          );

        if (target) {
          revokeEvidenceUrl(target);
        }

        return currentFiles.filter(
          (item) => item.id !== id
        );
      });
    },
    [isSubmitting]
  );

  const validateResolution =
    useCallback(() => {
      if (!actionTaken.trim()) {
        showNotice?.(
          "error",
          "Action Taken Required",
          "Please enter the action taken before submitting this case for review."
        );

        return false;
      }

      if (!remarks.trim()) {
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
            item?.file instanceof File &&
            !item?.error
        );

      if (
        validProofFiles.length === 0
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

  const handleSubmit = useCallback(
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
        proofFiles.map((item) => {
          if (item.error) {
            return item;
          }

          return {
            ...item,
            status: "Uploading",
          };
        });

      try {
        setIsSubmitting(true);
        setProofFiles(submissionFiles);

        const success =
          await onSubmit?.(incident, {
            actionTaken:
              actionTaken.trim(),

            remarks:
              remarks.trim(),

            proofFiles:
              submissionFiles,
          });

        if (success === false) {
          setProofFiles(
            (currentFiles) =>
              currentFiles.map(
                (item) => {
                  if (item.error) {
                    return item;
                  }

                  return {
                    ...item,
                    status: "Failed",
                    error:
                      "Upload was not accepted by the server.",
                  };
                }
              )
          );

          return;
        }

        setProofFiles(
          (currentFiles) =>
            currentFiles.map(
              (item) => {
                if (item.error) {
                  return item;
                }

                return {
                  ...item,
                  status: "Uploaded",
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
          (currentFiles) =>
            currentFiles.map(
              (item) => {
                if (item.error) {
                  return item;
                }

                return {
                  ...item,
                  status: "Failed",
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
        setIsSubmitting(false);
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

  const wasReturned =
    String(
      incident?.review?.decision ||
        incident?.reviewDecision ||
        ""
    )
      .trim()
      .toLowerCase() === "rejected";

  const reviewComments =
    incident?.review?.comments ||
    incident?.reviewComments ||
    "The case was returned for correction.";

  return (
    <BaseModal
      onClose={handleClose}
      title="Submit Resolution Proof"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="green"
      size="lg"
      preventClose={isSubmitting}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {wasReturned && (
          <AlertBox
            type="error"
            title="Returned by Super Admin"
            message={reviewComments}
          />
        )}

        <InfoCard title="System Recommendation">
          <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {incident.recommendation ||
              "No recommendation generated."}
          </p>
        </InfoCard>

        <Field
          label="Action Taken"
          required
        >
          <textarea
            rows={3}
            value={actionTaken}
            onChange={
              handleActionTakenChange
            }
            disabled={isSubmitting}
            placeholder="Example: Employee was issued NTE, suspension notice, or corrective action."
            className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>

        <Field
          label="Resolution Remarks"
          required
        >
          <textarea
            rows={4}
            value={remarks}
            onChange={
              handleRemarksChange
            }
            disabled={isSubmitting}
            placeholder="Write details confirming how the case was handled."
            className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>

        <Field
          label="Upload Proof"
          required
        >
          <label
            htmlFor="resolution-proof-files"
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-7 text-center transition dark:border-white/10 dark:bg-slate-950 ${
              isSubmitting
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
            }`}
          >
            <FiUpload
              className="mb-2 text-gray-500"
              size={24}
              aria-hidden="true"
            />

            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Click to upload proof files
            </span>

            <span className="mt-1 text-xs text-gray-500">
              PNG, JPEG, or PDF files
              are accepted
            </span>

            <span className="mt-1 text-xs font-medium text-red-500">
              At least one valid file is
              required
            </span>

            <input
              ref={fileInputRef}
              id="resolution-proof-files"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />
          </label>

          {proofFiles.length > 0 && (
            <ProofList
              files={proofFiles}
              onRemove={
                isSubmitting
                  ? undefined
                  : handleRemoveFile
              }
            />
          )}
        </Field>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={handleClose}
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
            loading={isSubmitting}
            disabled={
              isSubmitting ||
              proofFiles.some(
                (item) =>
                  Boolean(item?.error)
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