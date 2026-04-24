import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiPlay,
  FiSearch,
  FiUpload,
  FiUser,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddIncidentModal from "../components/incidents/AddIncidentModal";

import {
  getSeverityByViolation,
  getSanctionByViolation,
} from "../utils/configStorage";

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";
const DEPLOYMENTS_KEY = "deployments";
const AUDIT_API_URL = "http://localhost:5000/api/audit-logs";

function safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getUserIdentity(user) {
  return {
    id: user?.userId || user?.id || user?.employeeId || "N/A",
    username: user?.username || "Unknown",
    name: user?.name || user?.fullName || user?.username || "Unknown",
    role: user?.role || "Unknown",
  };
}

function formatDateTime(isoDate) {
  if (!isoDate) return "-";

  return new Date(isoDate).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeStatus(status) {
  if (!status) return "Open";
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "FOR_REVIEW") return "For Review";
  if (status === "CLOSED") return "Closed";
  return status;
}

function normalizeIncidentWithRules(incident) {
  const violation = incident?.violation || "";
  const configuredSeverity = getSeverityByViolation(violation);
  const configuredSanction = getSanctionByViolation(violation);

  return {
    ...incident,
    status: normalizeStatus(incident.status),
    severity: configuredSeverity || incident.severity || "Minor",
    sanction: incident.sanction || configuredSanction || "Warning",
    investigation: incident.investigation || null,
    resolution: incident.resolution || null,
    review: incident.review || null,
  };
}

export default function Incidents() {
  const { user } = useAuth();
  const currentUser = getUserIdentity(user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const location = useLocation();
  const navigate = useNavigate();

  const storedIncidents = useMemo(
    () => safeParse(INCIDENTS_KEY).map(normalizeIncidentWithRules),
    []
  );

  const storedEmployees = useMemo(() => safeParse(EMPLOYEES_KEY), []);
  const storedDeployments = useMemo(() => safeParse(DEPLOYMENTS_KEY), []);

  const activeEmployees = useMemo(
    () => storedEmployees.filter((emp) => !emp.archived),
    [storedEmployees]
  );

  const initialFilteredIncidents = useMemo(() => {
    return storedIncidents.filter((incident) =>
      activeEmployees.some(
        (emp) => emp.id === incident.employeeId || emp.name === incident.employee
      )
    );
  }, [storedIncidents, activeEmployees]);

  const initialIncident = location.state?.incidentId
    ? initialFilteredIncidents.find(
        (item) => item.id === location.state.incidentId
      )
    : null;

  const [incidents, setIncidents] = useState(initialFilteredIncidents);
  const [employees] = useState(activeEmployees);
  const [deployments] = useState(storedDeployments);

  const [openAddModal, setOpenAddModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(initialIncident);
  const [startReviewIncident, setStartReviewIncident] = useState(null);
  const [confirmStartIncident, setConfirmStartIncident] = useState(null);
  const [resolutionIncident, setResolutionIncident] = useState(null);
  const [reviewIncident, setReviewIncident] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  const createOperationalLog = useCallback(
    async (action, description) => {
      try {
        await fetch(AUDIT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.userId || user?.id,
            username: user?.username,
            role: user?.role,
            category: "OPERATIONAL",
            action,
            description,
          }),
        });
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [user]
  );

  useEffect(() => {
    if (location.state?.incidentId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const syncIncidentsFromStorage = () => {
      const latestIncidents = safeParse(INCIDENTS_KEY).map(
        normalizeIncidentWithRules
      );

      const latestEmployees = safeParse(EMPLOYEES_KEY).filter(
        (emp) => !emp.archived
      );

      const visibleIncidents = latestIncidents.filter((incident) =>
        latestEmployees.some(
          (emp) => emp.id === incident.employeeId || emp.name === incident.employee
        )
      );

      setIncidents(visibleIncidents);
    };

    window.addEventListener("dataUpdated", syncIncidentsFromStorage);
    window.addEventListener("storage", syncIncidentsFromStorage);

    return () => {
      window.removeEventListener("dataUpdated", syncIncidentsFromStorage);
      window.removeEventListener("storage", syncIncidentsFromStorage);
    };
  }, []);

  const persistIncidents = (updatedIncidents) => {
    const normalized = updatedIncidents.map(normalizeIncidentWithRules);
    setIncidents(normalized);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("dataUpdated"));
  };

  const updateIncidentById = (incidentId, updater) => {
    const updated = incidents.map((incident) =>
      incident.id === incidentId
        ? normalizeIncidentWithRules(updater(incident))
        : incident
    );

    persistIncidents(updated);

    const updatedIncident = updated.find((incident) => incident.id === incidentId);

    if (selectedIncident?.id === incidentId) setSelectedIncident(updatedIncident);
    if (startReviewIncident?.id === incidentId)
      setStartReviewIncident(updatedIncident);
    if (confirmStartIncident?.id === incidentId)
      setConfirmStartIncident(updatedIncident);
    if (resolutionIncident?.id === incidentId)
      setResolutionIncident(updatedIncident);
    if (reviewIncident?.id === incidentId) setReviewIncident(updatedIncident);

    return updatedIncident;
  };

  const handleAddIncident = async (newIncident) => {
    if (isSuperAdmin) return;

    const normalizedIncident = normalizeIncidentWithRules({
      ...newIncident,
      status: "Open",
    });

    persistIncidents([normalizedIncident, ...incidents]);

    await createOperationalLog(
      "CREATE_INCIDENT",
      `${currentUser.username} created incident report ${normalizedIncident.id}.`
    );

    setOpenAddModal(false);
  };

  const handleConfirmStartInvestigation = async (incident) => {
    if (isSuperAdmin) return;

    updateIncidentById(incident.id, (item) => ({
      ...item,
      status: "Investigating",
      investigation: {
        startedAt: new Date().toISOString(),
        startedById: currentUser.id,
        startedByName: currentUser.name,
        startedByUsername: currentUser.username,
        startedByRole: currentUser.role,
      },
    }));

    await createOperationalLog(
      "START_INVESTIGATION",
      `${currentUser.username} started investigation for incident ${incident.id}.`
    );

    setConfirmStartIncident(null);
    setStartReviewIncident(null);
  };

  const handleSubmitResolution = async (incident, resolutionData) => {
    if (isSuperAdmin) return;

    updateIncidentById(incident.id, (item) => ({
      ...item,
      status: "For Review",
      resolution: {
        submittedAt: new Date().toISOString(),
        submittedById: currentUser.id,
        submittedByName: currentUser.name,
        submittedByUsername: currentUser.username,
        submittedByRole: currentUser.role,
        actionTaken: resolutionData.actionTaken,
        remarks: resolutionData.remarks,
        proofFiles: resolutionData.proofFiles,
      },
    }));

    await createOperationalLog(
      "SUBMIT_RESOLUTION",
      `${currentUser.username} submitted proof for incident ${incident.id}.`
    );

    setResolutionIncident(null);
  };

  const handleApproveCase = async (incident) => {
    if (!isSuperAdmin) return;

    updateIncidentById(incident.id, (item) => ({
      ...item,
      status: "Closed",
      review: {
        reviewedAt: new Date().toISOString(),
        reviewedById: currentUser.id,
        reviewedByName: currentUser.name,
        reviewedByUsername: currentUser.username,
        reviewedByRole: currentUser.role,
        decision: "Approved",
        comments: "Proof reviewed and approved.",
      },
    }));

    await createOperationalLog(
      "CLOSE_INCIDENT",
      `${currentUser.username} approved and closed incident ${incident.id}.`
    );

    setReviewIncident(null);
  };

  const handleRejectCase = async (incident, comments) => {
    if (!isSuperAdmin) return;

    updateIncidentById(incident.id, (item) => ({
      ...item,
      status: "Investigating",
      review: {
        reviewedAt: new Date().toISOString(),
        reviewedById: currentUser.id,
        reviewedByName: currentUser.name,
        reviewedByUsername: currentUser.username,
        reviewedByRole: currentUser.role,
        decision: "Rejected",
        comments,
      },
    }));

    await createOperationalLog(
      "RETURN_INCIDENT",
      `${currentUser.username} returned incident ${incident.id} for correction.`
    );

    setReviewIncident(null);
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        String(incident.id || "").toLowerCase().includes(keyword) ||
        String(incident.employee || "").toLowerCase().includes(keyword) ||
        String(incident.violation || "").toLowerCase().includes(keyword) ||
        String(incident.company || "").toLowerCase().includes(keyword) ||
        String(incident.sanction || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" || incident.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" || incident.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Incident Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isSuperAdmin
              ? "Review submitted proof and close verified cases."
              : "Review reported cases, start investigations, and submit proof for review."}
          </p>
        </div>

        {!isSuperAdmin && (
          <RoleGuard permission={PERMISSIONS.CAN_ADD_INCIDENT}>
            <button
              type="button"
              onClick={() => setOpenAddModal(true)}
              className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
            >
              + Add Incident Report
            </button>
          </RoleGuard>
        )}
      </div>

      <div className="flex flex-col items-start gap-3 xl:flex-row xl:items-center">
        <div className="relative w-full max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search incident ID, employee, violation..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="ALL">All Status</option>
          <option value="Open">Open</option>
          <option value="Investigating">Investigating</option>
          <option value="For Review">For Review</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="ALL">All Severity</option>
          <option value="Minor">Minor</option>
          <option value="Major">Major</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow dark:border-gray-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-gray-300">
              <tr>
                <th className="px-6 py-4">Incident ID</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Violation Type</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Sanction</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Reported Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No incident records found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-6 py-4">{incident.id}</td>
                    <td className="px-6 py-4">{incident.employee}</td>
                    <td className="px-6 py-4">{incident.company || "-"}</td>
                    <td className="px-6 py-4">{incident.violation}</td>
                    <td className="px-6 py-4">
                      <SeverityBadge level={incident.severity} />
                    </td>
                    <td className="px-6 py-4">{incident.sanction || "-"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={incident.status} />
                    </td>
                    <td className="px-6 py-4">{incident.date}</td>
                    <td className="px-6 py-4 text-right">
                      <ActionButtons
                        incident={incident}
                        isSuperAdmin={isSuperAdmin}
                        onView={setSelectedIncident}
                        onStartReview={setStartReviewIncident}
                        onResolve={setResolutionIncident}
                        onReview={setReviewIncident}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedIncident && (
        <ViewIncidentModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {startReviewIncident && (
        <ViewIncidentModal
          incident={startReviewIncident}
          mode="start-review"
          onClose={() => setStartReviewIncident(null)}
          onRequestStart={(incident) => setConfirmStartIncident(incident)}
        />
      )}

      {confirmStartIncident && (
        <ConfirmStartInvestigationModal
          incident={confirmStartIncident}
          currentUser={currentUser}
          onClose={() => setConfirmStartIncident(null)}
          onConfirm={handleConfirmStartInvestigation}
        />
      )}

      {resolutionIncident && (
        <ResolutionModal
          incident={resolutionIncident}
          onClose={() => setResolutionIncident(null)}
          onSubmit={handleSubmitResolution}
        />
      )}

      {reviewIncident && (
        <ReviewCaseModal
          incident={reviewIncident}
          onClose={() => setReviewIncident(null)}
          onApprove={handleApproveCase}
          onReject={handleRejectCase}
        />
      )}

      <AddIncidentModal
        isOpen={openAddModal}
        onClose={() => setOpenAddModal(false)}
        onSave={handleAddIncident}
        employees={employees}
        deployments={deployments}
        existingIncidents={incidents}
      />
    </div>
  );
}

function ActionButtons({
  incident,
  isSuperAdmin,
  onView,
  onStartReview,
  onResolve,
  onReview,
}) {
  if (isSuperAdmin && incident.status === "For Review") {
    return (
      <button
        type="button"
        onClick={() => onReview(incident)}
        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <FiAlertCircle size={14} />
        Review
      </button>
    );
  }

  if (!isSuperAdmin && incident.status === "Open") {
    return (
      <button
        type="button"
        onClick={() => onStartReview(incident)}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
      >
        <FiEye size={14} />
        Review Case
      </button>
    );
  }

  if (!isSuperAdmin && incident.status === "Investigating") {
    return (
      <button
        type="button"
        onClick={() => onResolve(incident)}
        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
      >
        <FiUpload size={14} />
        Submit Proof
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onView(incident)}
      className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
    >
      <FiEye size={14} />
      View
    </button>
  );
}

function ViewIncidentModal({
  incident,
  onClose,
  mode = "view",
  onRequestStart,
}) {
  const isStartReview = mode === "start-review";

  return (
    <BaseModal
      onClose={onClose}
      title={isStartReview ? "Review Reported Incident" : "Incident Case Details"}
      subtitle={`${incident.id} • ${incident.employee}`}
      color={isStartReview ? "amber" : "red"}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {isStartReview && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-bold">Review before starting investigation</p>
              <p className="mt-1">
                Please verify the reporter, employee, violation type, and case
                details before proceeding.
              </p>
            </div>
          )}

          <InfoCard title="Report Information">
            <Detail label="Incident ID" value={incident.id} />
            <Detail label="Reported By" value={incident.reportedBy || "-"} />
            <Detail label="Reported Date" value={formatDateTime(incident.reportedAt || incident.date)} />
            <Detail label="Status" value={incident.status} />
          </InfoCard>

          <InfoCard title="Employee and Violation">
            <Detail label="Employee" value={incident.employee} />
            <Detail label="Employee ID" value={incident.employeeId || "-"} />
            <Detail label="Company" value={incident.company || "-"} />
            <Detail label="Violation" value={incident.violation} />
            <Detail label="Severity" value={incident.severity} />
            <Detail label="Sanction" value={incident.sanction} />
          </InfoCard>

          <InfoCard title="Incident Description">
            <p className="whitespace-pre-line leading-6">
              {incident.description || "No description provided."}
            </p>
          </InfoCard>

          {incident.review?.decision === "Rejected" && (
            <InfoCard title="Super Admin Return Comment">
              <p className="rounded-xl bg-red-50 p-3 text-red-700">
                {incident.review.comments}
              </p>
            </InfoCard>
          )}

          {incident.resolution && <ProofReview resolution={incident.resolution} />}

          {isStartReview && (
            <ModalFooter>
              <button type="button" onClick={onClose} className="btn-light">
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onRequestStart(incident)}
                className="btn-amber"
              >
                <FiPlay />
                Start Investigation
              </button>
            </ModalFooter>
          )}
        </div>

        <CaseTimeline incident={incident} />
      </div>
    </BaseModal>
  );
}

function ConfirmStartInvestigationModal({
  incident,
  currentUser,
  onClose,
  onConfirm,
}) {
  return (
    <BaseModal
      onClose={onClose}
      title="Confirm Investigation Start"
      subtitle="This action will be recorded in the case timeline."
      color="amber"
      size="sm"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="rounded-full bg-amber-100 p-3 text-amber-700">
            <FiAlertCircle size={22} />
          </div>

          <div>
            <h3 className="text-lg font-extrabold">
              Are you sure you want to start investigation?
            </h3>
            <p className="mt-1 text-sm leading-6">
              This will move the case to <strong>Investigating</strong> status
              and log your name, username, user ID, role, date, and time.
            </p>
          </div>
        </div>

        <InfoCard title="Case to Investigate">
          <Detail label="Incident ID" value={incident.id} />
          <Detail label="Employee" value={incident.employee} />
          <Detail label="Violation Type" value={incident.violation} />
          <Detail label="Severity" value={incident.severity} />
        </InfoCard>

        <InfoCard title="Investigation Started By">
          <Detail label="Name" value={currentUser.name} />
          <Detail label="Username" value={currentUser.username} />
          <Detail label="User ID" value={currentUser.id} />
          <Detail label="Role" value={currentUser.role} />
          <Detail label="Date and Time" value={formatDateTime(new Date().toISOString())} />
        </InfoCard>

        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-light">
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(incident)}
            className="btn-amber"
          >
            <FiPlay />
            Yes, Start Investigation
          </button>
        </ModalFooter>
      </div>
    </BaseModal>
  );
}

function ResolutionModal({ incident, onClose, onSubmit }) {
  const [actionTaken, setActionTaken] = useState("");
  const [remarks, setRemarks] = useState("");
  const [proofFiles, setProofFiles] = useState([]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!actionTaken.trim()) {
      alert("Please enter the action taken.");
      return;
    }

    if (!remarks.trim()) {
      alert("Please enter resolution remarks.");
      return;
    }

    if (proofFiles.length === 0) {
      alert("Proof upload is required before submitting for review.");
      return;
    }

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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-bold">Returned by Super Admin</p>
            <p className="mt-1">{incident.review.comments}</p>
          </div>
        )}

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

function ReviewCaseModal({ incident, onClose, onApprove, onReject }) {
  const [rejectComment, setRejectComment] = useState("");

  const handleReject = () => {
    if (!rejectComment.trim()) {
      alert("Please enter a comment before returning the case.");
      return;
    }

    onReject(incident, rejectComment.trim());
  };

  return (
    <BaseModal
      onClose={onClose}
      title="Super Admin Case Review"
      subtitle={`${incident.id} • ${incident.employee}`}
      color="indigo"
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <InfoCard title="Incident Summary">
            <Detail label="Violation" value={incident.violation} />
            <Detail label="Severity" value={incident.severity} />
            <Detail label="Sanction" value={incident.sanction} />
            <Detail label="Status" value={incident.status} />
          </InfoCard>

          <InfoCard title="Investigation Information">
            <Detail
              label="Started By"
              value={incident.investigation?.startedByName || "-"}
            />
            <Detail
              label="Username"
              value={incident.investigation?.startedByUsername || "-"}
            />
            <Detail
              label="User ID"
              value={incident.investigation?.startedById || "-"}
            />
            <Detail
              label="Date Started"
              value={formatDateTime(incident.investigation?.startedAt)}
            />
          </InfoCard>

          {incident.resolution && <ProofReview resolution={incident.resolution} />}

          <Field label="Return Comment if Proof is Not Enough">
            <textarea
              rows="3"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Example: Proof is incomplete. Please upload signed memo or acknowledged document."
              className="input-field resize-none"
            />
          </Field>

          <ModalFooter>
            <button type="button" onClick={handleReject} className="btn-red">
              <FiXCircle />
              Return Case
            </button>
            <button
              type="button"
              onClick={() => onApprove(incident)}
              className="btn-green"
            >
              <FiCheckCircle />
              Approve & Close
            </button>
          </ModalFooter>
        </div>

        <CaseTimeline incident={incident} />
      </div>
    </BaseModal>
  );
}

function BaseModal({
  children,
  onClose,
  title,
  subtitle,
  color = "red",
  size = "lg",
}) {
  const colors = {
    red: "from-red-600 to-rose-600",
    green: "from-green-600 to-emerald-600",
    indigo: "from-indigo-600 to-blue-600",
    amber: "from-amber-500 to-orange-500",
  };

  const sizes = {
    sm: "max-w-2xl",
    lg: "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`mx-auto my-8 w-full ${
          sizes[size] || sizes.lg
        } overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900`}
      >
        <div className={`bg-gradient-to-r ${colors[color]} px-6 py-5 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">{title}</h2>
              <p className="mt-1 text-sm text-white/80">{subtitle}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="p-6">{children}</div>
        <ModalStyle />
      </div>
    </div>
  );
}

function CaseTimeline({ incident }) {
  const steps = [
    {
      title: "Reported",
      description: incident.reportedBy
        ? `Reported by ${incident.reportedBy}`
        : "Incident report created",
      date: incident.reportedAt || incident.date,
      icon: <FiFileText />,
      active: true,
    },
    {
      title: "Investigation Started",
      description: incident.investigation
        ? `By ${incident.investigation.startedByName}`
        : "Waiting for HR action",
      date: incident.investigation?.startedAt,
      icon: <FiPlay />,
      active: Boolean(incident.investigation),
    },
    {
      title: "Proof Submitted",
      description: incident.resolution
        ? `By ${incident.resolution.submittedByName}`
        : "Waiting for resolution proof",
      date: incident.resolution?.submittedAt,
      icon: <FiUpload />,
      active: Boolean(incident.resolution),
    },
    {
      title: incident.review?.decision === "Rejected" ? "Returned" : "Closed",
      description: incident.review
        ? `${incident.review.decision} by ${incident.review.reviewedByName}`
        : "Waiting for Super Admin review",
      date: incident.review?.reviewedAt,
      icon:
        incident.review?.decision === "Rejected" ? (
          <FiXCircle />
        ) : (
          <FiCheckCircle />
        ),
      active: Boolean(incident.review),
      rejected: incident.review?.decision === "Rejected",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <p className="mb-5 text-xs font-bold uppercase tracking-wide text-gray-500">
        Case Timeline
      </p>

      <div className="space-y-5">
        {steps.map((step, index) => (
          <div key={step.title} className="relative flex gap-3">
            {index !== steps.length - 1 && (
              <span className="absolute left-[15px] top-8 h-full w-px bg-gray-200 dark:bg-white/10" />
            )}

            <div
              className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                step.rejected
                  ? "border-red-300 bg-red-100 text-red-700"
                  : step.active
                  ? "border-green-300 bg-green-100 text-green-700"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              {step.icon}
            </div>

            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {step.description}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <FiClock />
                {formatDateTime(step.date)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofReview({ resolution }) {
  return (
    <InfoCard title="Resolution Proof Review">
      <Detail label="Submitted By" value={resolution.submittedByName || "-"} />
      <Detail
        label="Submitted Date"
        value={formatDateTime(resolution.submittedAt)}
      />

      <div className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Action Taken
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-6">
          {resolution.actionTaken || "-"}
        </p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Remarks
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-6">
          {resolution.remarks || "-"}
        </p>
      </div>

      <ProofList files={resolution.proofFiles || []} />
    </InfoCard>
  );
}

function ProofList({ files = [] }) {
  if (!files.length) {
    return <p className="mt-3 text-sm text-gray-500">No proof uploaded.</p>;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {files.map((file) => (
        <div
          key={file.id || file.name}
          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
              <FiFileText />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {file.type || "Uploaded file"}
              </p>
              <p className="text-xs text-gray-400">
                {file.uploadedAt ? formatDateTime(file.uploadedAt) : "-"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <span className="font-semibold text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ModalFooter({ children }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5 dark:border-white/10">
      {children}
    </div>
  );
}

function SeverityBadge({ level }) {
  const colors = {
    Minor: "bg-blue-100 text-blue-700",
    Major: "bg-amber-100 text-amber-700",
    Critical: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        colors[level] || "bg-gray-100 text-gray-700"
      }`}
    >
      {level || "Minor"}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Open: "bg-red-100 text-red-700",
    Investigating: "bg-amber-100 text-amber-700",
    "For Review": "bg-indigo-100 text-indigo-700",
    Closed: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        colors[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status || "Open"}
    </span>
  );
}

function ModalStyle() {
  return (
    <style>{`
      .input-field {
        width: 100%;
        border-radius: 0.875rem;
        border: 1px solid rgb(209 213 219);
        background: white;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        outline: none;
      }

      .input-field:focus {
        border-color: rgb(99 102 241);
        box-shadow: 0 0 0 3px rgb(224 231 255);
      }

      .dark .input-field {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgb(15 23 42);
        color: white;
      }

      .dark .input-field::placeholder {
        color: rgb(148 163 184);
      }

      .btn-light {
        border-radius: 0.75rem;
        border: 1px solid rgb(229 231 235);
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: rgb(55 65 81);
      }

      .btn-green,
      .btn-red,
      .btn-amber {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.75rem;
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: white;
      }

      .btn-green {
        background: rgb(22 163 74);
      }

      .btn-green:hover {
        background: rgb(21 128 61);
      }

      .btn-red {
        background: rgb(220 38 38);
      }

      .btn-red:hover {
        background: rgb(185 28 28);
      }

      .btn-amber {
        background: rgb(245 158 11);
      }

      .btn-amber:hover {
        background: rgb(217 119 6);
      }
    `}</style>
  );
}