import { useState } from "react";
import { FiUpload } from "react-icons/fi";
import {
  BaseModal,
  AlertBox,
  InfoCard,
  Field,
  ModalFooter,
  ProofList,
} from "../shared/ModalUI";

export default function ResolutionModal({
  incident,
  onClose,
  onSubmit,
  showNotice,
}) {
  const [actionTaken, setActionTaken] = useState("");
  const [remarks, setRemarks] = useState("");
  const [proofFiles, setProofFiles] = useState([]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    const maxSize = 5 * 1024 * 1024;

    const invalidFile = files.find(
      (file) => !allowedTypes.includes(file.type) || file.size > maxSize
    );

    if (invalidFile) {
      showNotice(
        "error",
        "Invalid Proof File",
        "Only JPG, PNG, WEBP, or PDF files up to 5MB are allowed."
      );
      event.target.value = "";
      return;
    }

    setProofFiles(
      files.map((file) => ({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      }))
    );
  };

  const validateResolution = () => {
    const validations = [
      {
        valid: actionTaken.trim(),
        title: "Action Taken Required",
        message:
          "Please enter the action taken before submitting this case for review.",
      },
      {
        valid: remarks.trim(),
        title: "Resolution Remarks Required",
        message:
          "Please enter resolution remarks to explain how the case was handled.",
      },
      {
        valid: proofFiles.length > 0,
        title: "Proof Upload Required",
        message:
          "Please upload at least one proof file before submitting for review.",
      },
    ];

    const failed = validations.find((item) => !item.valid);

    if (failed) {
      showNotice("error", failed.title, failed.message);
      return false;
    }

    return true;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateResolution()) return;

    onSubmit(incident, {
      actionTaken: actionTaken.trim(),
      remarks: remarks.trim(),
      proofFiles,
    });
  };

  return (
    <BaseModal
      onClose={onClose}
      title="Submit Resolution Proof"
      subtitle={`${incident.id} • ${incident.employee}`}
      color="green"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {incident.review?.decision === "Rejected" && (
          <AlertBox
            type="error"
            title="Returned by Super Admin"
            message={incident.review.comments}
          />
        )}

        <InfoCard title="System Recommendation">
          <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {incident.recommendation || "No recommendation generated."}
          </p>
        </InfoCard>

        <Field label="Action Taken" required>
          <textarea
            rows="3"
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
            placeholder="Example: Employee was issued NTE / suspension notice / corrective action..."
            className="input-field resize-none"
          />
        </Field>

        <Field label="Resolution Remarks" required>
          <textarea
            rows="4"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Write details confirming that the case was acted upon..."
            className="input-field resize-none"
          />
        </Field>

        <Field label="Upload Proof" required>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-7 text-center hover:bg-gray-100 dark:border-white/10 dark:bg-slate-950 dark:hover:bg-slate-800">
            <FiUpload className="mb-2 text-gray-500" size={24} />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Click to upload proof files
            </span>
            <span className="mt-1 text-xs text-gray-500">
              Required before submitting for review
            </span>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {proofFiles.length > 0 && <ProofList files={proofFiles} />}
        </Field>

        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-light">
            Cancel
          </button>

          <button type="submit" className="btn-green">
            Submit for Review
          </button>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}