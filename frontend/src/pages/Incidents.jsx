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
  FiX,
  FiXCircle,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddIncidentModal from "../components/incidents/AddIncidentModal";
import { enrichIncidentIntelligence } from "../utils/incidentIntelligence";

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";
const DEPLOYMENTS_KEY = "deployments";
const AUDIT_API_URL = "http://localhost:5000/api/audit-logs";

function safeParse(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
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
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeStatus(status) {
  const map = {
    OPEN: "Open",
    INVESTIGATING: "Investigating",
    FOR_REVIEW: "For Review",
    CLOSED: "Closed",
    RESOLVED: "For Review",
  };

  return map[status] || status || "Open";
}

function normalizeIncidentWithRules(incident, allIncidents = []) {
  return enrichIncidentIntelligence(
    {
      ...incident,
      status: normalizeStatus(incident.status),
      investigation: incident.investigation || null,
      resolution: incident.resolution || null,
      review: incident.review || null,
      timeline: Array.isArray(incident.timeline) ? incident.timeline : [],
    },
    allIncidents
  );
}

function getVisibleIncidents(rawIncidents = [], rawEmployees = []) {
  const activeEmployees = rawEmployees.filter((emp) => !emp.archived);
  const enriched = rawIncidents.map((item) =>
    normalizeIncidentWithRules(item, rawIncidents)
  );

  return enriched.filter((incident) =>
    activeEmployees.some(
      (emp) =>
        String(emp.id || emp.employeeId || emp.name) ===
          String(incident.employeeId || incident.employee) ||
        String(emp.name) === String(incident.employee)
    )
  );
}

function createTimelineItem({ title, description, createdBy, status }) {
  return {
    id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    createdAt: new Date().toISOString(),
    createdBy,
    status,
  };
}

export default function Incidents() {
  const { user } = useAuth();
  const currentUser = getUserIdentity(user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const location = useLocation();
  const navigate = useNavigate();

  const storedEmployees = useMemo(() => safeParse(EMPLOYEES_KEY), []);
  const storedDeployments = useMemo(() => safeParse(DEPLOYMENTS_KEY), []);
  const activeEmployees = useMemo(
    () => storedEmployees.filter((emp) => !emp.archived),
    [storedEmployees]
  );

  const initialIncidents = useMemo(
    () => getVisibleIncidents(safeParse(INCIDENTS_KEY), storedEmployees),
    [storedEmployees]
  );

  const initialIncident = location.state?.incidentId
    ? initialIncidents.find((item) => item.id === location.state.incidentId)
    : null;

  const [incidents, setIncidents] = useState(initialIncidents);
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

  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((type, title, message) => {
    setNotice({ type, title, message });
  }, []);

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
      setIncidents(
        getVisibleIncidents(safeParse(INCIDENTS_KEY), safeParse(EMPLOYEES_KEY))
      );
    };

    window.addEventListener("dataUpdated", syncIncidentsFromStorage);
    window.addEventListener("storage", syncIncidentsFromStorage);

    return () => {
      window.removeEventListener("dataUpdated", syncIncidentsFromStorage);
      window.removeEventListener("storage", syncIncidentsFromStorage);
    };
  }, []);

  const persistIncidents = useCallback((updatedIncidents) => {
    const enriched = updatedIncidents.map((item) =>
      normalizeIncidentWithRules(item, updatedIncidents)
    );

    setIncidents(enriched);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(enriched));
    window.dispatchEvent(new Event("dataUpdated"));

    return enriched;
  }, []);

  const updateIncidentById = useCallback(
    (incidentId, updater) => {
      const rawIncidents = safeParse(INCIDENTS_KEY);
      const baseIncidents = rawIncidents.length > 0 ? rawIncidents : incidents;

      const updatedRaw = baseIncidents.map((incident) =>
        incident.id === incidentId ? updater(incident) : incident
      );

      const enriched = persistIncidents(updatedRaw);
      const updatedIncident = enriched.find((item) => item.id === incidentId);

      const syncSelected = (setter, current) => {
        if (current?.id === incidentId) setter(updatedIncident);
      };

      syncSelected(setSelectedIncident, selectedIncident);
      syncSelected(setStartReviewIncident, startReviewIncident);
      syncSelected(setConfirmStartIncident, confirmStartIncident);
      syncSelected(setResolutionIncident, resolutionIncident);
      syncSelected(setReviewIncident, reviewIncident);

      return updatedIncident;
    },
    [
      incidents,
      persistIncidents,
      selectedIncident,
      startReviewIncident,
      confirmStartIncident,
      resolutionIncident,
      reviewIncident,
    ]
  );

  const handleAddIncident = async (newIncident) => {
    if (isSuperAdmin) return;

    const currentRaw = safeParse(INCIDENTS_KEY);
    const normalizedIncident = normalizeIncidentWithRules(
      { ...newIncident, status: "Open" },
      currentRaw
    );

    persistIncidents([normalizedIncident, ...currentRaw]);

    await createOperationalLog(
      "CREATE_INCIDENT",
      `${currentUser.username} created incident report ${normalizedIncident.id}.`
    );

    setOpenAddModal(false);
    showNotice(
      "success",
      "Incident Report Saved",
      `Incident ${normalizedIncident.id} has been successfully added to the report list.`
    );
  };

  const handleConfirmStartInvestigation = async (incident) => {
    if (isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Investigation Started",
      description: `${currentUser.name} started the investigation.`,
      createdBy: currentUser.name,
      status: "Investigating",
    });

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
      timeline: [...(item.timeline || []), timelineItem],
    }));

    await createOperationalLog(
      "START_INVESTIGATION",
      `${currentUser.username} started investigation for incident ${incident.id}.`
    );

    setConfirmStartIncident(null);
    setStartReviewIncident(null);

    showNotice(
      "success",
      "Investigation Started",
      `Incident ${incident.id} is now marked as Investigating.`
    );
  };

  const handleSubmitResolution = async (incident, resolutionData) => {
    if (isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Resolution Proof Submitted",
      description: `${currentUser.name} submitted proof for Super Admin review.`,
      createdBy: currentUser.name,
      status: "For Review",
    });

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
      timeline: [...(item.timeline || []), timelineItem],
    }));

    await createOperationalLog(
      "SUBMIT_RESOLUTION",
      `${currentUser.username} submitted proof for incident ${incident.id}.`
    );

    setResolutionIncident(null);

    showNotice(
      "success",
      "Submitted for Review",
      `Proof for incident ${incident.id} has been submitted to Super Admin.`
    );
  };

  const handleApproveCase = async (incident) => {
    if (!isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Case Approved and Closed",
      description: `${currentUser.name} approved and closed the case.`,
      createdBy: currentUser.name,
      status: "Closed",
    });

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
      timeline: [...(item.timeline || []), timelineItem],
    }));

    await createOperationalLog(
      "CLOSE_INCIDENT",
      `${currentUser.username} approved and closed incident ${incident.id}.`
    );

    setReviewIncident(null);

    showNotice(
      "success",
      "Case Approved",
      `Incident ${incident.id} has been approved and closed successfully.`
    );
  };

  const handleRejectCase = async (incident, comments) => {
    if (!isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Case Returned",
      description: comments,
      createdBy: currentUser.name,
      status: "Investigating",
    });

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
      timeline: [...(item.timeline || []), timelineItem],
    }));

    await createOperationalLog(
      "RETURN_INCIDENT",
      `${currentUser.username} returned incident ${incident.id} for correction.`
    );

    setReviewIncident(null);

    showNotice(
      "success",
      "Case Returned",
      `Incident ${incident.id} has been returned for correction.`
    );
  };

  const filteredIncidents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesSearch = [
        incident.id,
        incident.employee,
        incident.employeeId,
        incident.violation,
        incident.company,
        incident.sanction,
        incident.recommendation,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);

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

        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={["ALL", "Open", "Investigating", "For Review", "Closed"]}
          labels={{ ALL: "All Status" }}
        />

        <FilterSelect
          value={severityFilter}
          onChange={setSeverityFilter}
          options={["ALL", "Minor", "Major", "Critical"]}
          labels={{ ALL: "All Severity" }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow dark:border-gray-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 dark:bg-slate-900/70 dark:text-gray-300">
              <tr>
                {[
                  "Incident ID",
                  "Employee",
                  "Violation",
                  "Severity",
                  "Status",
                  "Case Age",
                  "Alerts",
                  "Action",
                ].map((head) => (
                  <th
                    key={head}
                    className={`px-6 py-4 ${
                      head === "Action" ? "text-right" : ""
                    }`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="text-gray-700 dark:text-gray-200">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No incident records found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-6 py-4 font-semibold">{incident.id}</td>
                    <td className="px-6 py-4">{incident.employee}</td>
                    <td className="px-6 py-4">{incident.violation}</td>
                    <td className="px-6 py-4">
                      <SeverityBadge level={incident.severity} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={incident.status} />
                    </td>
                    <td className="px-6 py-4">
                      <CaseAgeBadge incident={incident} />
                    </td>
                    <td className="px-6 py-4">
                      <SmartAlertBadge alerts={incident.smartAlerts || []} />
                    </td>
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
          onRequestStart={setConfirmStartIncident}
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
          showNotice={showNotice}
        />
      )}

      {reviewIncident && (
        <ReviewCaseModal
          incident={reviewIncident}
          onClose={() => setReviewIncident(null)}
          onApprove={handleApproveCase}
          onReject={handleRejectCase}
          showNotice={showNotice}
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

      {notice && (
        <NoticeModal
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, labels = {} }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels[option] || option}
        </option>
      ))}
    </select>
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
  const baseClass =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150";

  if (isSuperAdmin && incident.status === "For Review") {
    return (
      <ActionButton
        icon={<FiAlertCircle size={14} />}
        label="Review"
        color="bg-indigo-600 hover:bg-indigo-700"
        onClick={() => onReview(incident)}
        baseClass={baseClass}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Open") {
    return (
      <ActionButton
        icon={<FiPlay size={14} />}
        label="Start"
        color="bg-amber-500 hover:bg-amber-600"
        onClick={() => onStartReview(incident)}
        baseClass={baseClass}
      />
    );
  }

  if (!isSuperAdmin && incident.status === "Investigating") {
    return (
      <ActionButton
        icon={<FiUpload size={14} />}
        label="Submit"
        color="bg-green-600 hover:bg-green-700"
        onClick={() => onResolve(incident)}
        baseClass={baseClass}
      />
    );
  }

  return (
    <ActionButton
      icon={<FiEye size={14} />}
      label="View"
      color="bg-slate-600 hover:bg-slate-700"
      onClick={() => onView(incident)}
      baseClass={baseClass}
    />
  );
}

function ActionButton({ icon, label, color, onClick, baseClass }) {
  return (
    <button type="button" onClick={onClick} className={`${baseClass} ${color}`}>
      {icon}
      {label}
    </button>
  );
}

function CaseAgeBadge({ incident }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        incident.isOverdue
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200"
      }`}
    >
      {incident.caseAgeDays || 0}d
    </span>
  );
}

function SmartAlertBadge({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <FiCheckCircle size={12} />
        Clear
      </span>
    );
  }

  const hasCritical = alerts.some((alert) => alert.level === "critical");
  const hasWarning = alerts.some((alert) => alert.level === "warning");

  const badgeClass = hasCritical
    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : hasWarning
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <span
      title={alerts.map((alert) => `${alert.title}: ${alert.message}`).join("\n")}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}
    >
      <FiAlertCircle size={12} />
      {alerts.length} alert{alerts.length > 1 ? "s" : ""}
    </span>
  );
}

function ViewIncidentModal({ incident, onClose, mode = "view", onRequestStart }) {
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
            <AlertBox
              type="warning"
              title="Review before starting investigation"
              message="Please verify the reporter, employee, violation type, case age, alerts, and case details before proceeding."
            />
          )}

          <InfoCard title="Report Information">
            <Detail label="Incident ID" value={incident.id} />
            <Detail label="Reported By" value={incident.reportedBy || "-"} />
            <Detail
              label="Reported Date"
              value={formatDateTime(incident.reportedAt || incident.date)}
            />
            <Detail label="Company" value={incident.company || "-"} />
            <Detail label="Sanction" value={incident.sanction || "-"} />
            <Detail label="Status" value={incident.status} />
            <Detail label="Case Age" value={`${incident.caseAgeDays || 0} day(s)`} />
            <Detail label="SLA Target" value={`${incident.slaDays || "-"} day(s)`} />
            <Detail label="Overdue" value={incident.isOverdue ? "Yes" : "No"} />
          </InfoCard>

          <InfoCard title="Employee and Violation">
            <Detail label="Employee" value={incident.employee} />
            <Detail label="Employee ID" value={incident.employeeId || "-"} />
            <Detail label="Company" value={incident.company || "-"} />
            <Detail label="Violation" value={incident.violation} />
            <Detail label="Severity" value={incident.severity} />
            <Detail label="Offense Count" value={incident.offenseCount || 1} />
            <Detail label="Sanction" value={incident.sanction || "-"} />
          </InfoCard>

          <InfoCard title="System Recommendation">
            <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {incident.recommendation || "No recommendation generated."}
            </p>
          </InfoCard>

          {incident.smartAlerts?.length > 0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {incident.smartAlerts.map((alert) => (
                  <SmartAlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Incident Description">
            <p className="whitespace-pre-line leading-6">
              {incident.description || "No description provided."}
            </p>
          </InfoCard>

          {incident.review?.decision === "Rejected" && (
            <InfoCard title="Super Admin Return Comment">
              <p className="rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-950/30 dark:text-red-300">
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
        <AlertBox
          type="warning"
          title="Are you sure you want to start investigation?"
          message="This will move the case to Investigating status and log your name, username, user ID, role, date, and time."
        />

        <InfoCard title="Case to Investigate">
          <Detail label="Incident ID" value={incident.id} />
          <Detail label="Employee" value={incident.employee} />
          <Detail label="Violation Type" value={incident.violation} />
          <Detail label="Severity" value={incident.severity} />
          <Detail label="Case Age" value={`${incident.caseAgeDays || 0} day(s)`} />
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

function ResolutionModal({ incident, onClose, onSubmit, showNotice }) {
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

  const validateResolution = () => {
    const validations = [
      {
        valid: actionTaken.trim(),
        title: "Action Taken Required",
        message: "Please enter the action taken before submitting this case for review.",
      },
      {
        valid: remarks.trim(),
        title: "Resolution Remarks Required",
        message: "Please enter resolution remarks to explain how the case was handled.",
      },
      {
        valid: proofFiles.length > 0,
        title: "Proof Upload Required",
        message: "Please upload at least one proof file before submitting for review.",
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
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
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

function ReviewCaseModal({ incident, onClose, onApprove, onReject, showNotice }) {
  const [rejectComment, setRejectComment] = useState("");

  const handleReject = () => {
    if (!rejectComment.trim()) {
      showNotice(
        "error",
        "Return Comment Required",
        "Please enter a return comment before sending this case back for correction."
      );
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
            <Detail label="Case Age" value={`${incident.caseAgeDays || 0} day(s)`} />
          </InfoCard>

          {incident.smartAlerts?.length > 0 && (
            <InfoCard title="Smart Alerts">
              <div className="space-y-2">
                {incident.smartAlerts.map((alert) => (
                  <SmartAlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </InfoCard>
          )}

          <InfoCard title="Investigation Information">
            <Detail label="Started By" value={incident.investigation?.startedByName || "-"} />
            <Detail label="Username" value={incident.investigation?.startedByUsername || "-"} />
            <Detail label="User ID" value={incident.investigation?.startedById || "-"} />
            <Detail label="Date Started" value={formatDateTime(incident.investigation?.startedAt)} />
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

            <button type="button" onClick={() => onApprove(incident)} className="btn-green">
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

function BaseModal({ children, onClose, title, subtitle, color = "red", size = "lg" }) {
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
              aria-label="Close"
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

function NoticeModal({ type = "success", title, message, onClose }) {
  const isSuccess = type === "success";
  const color = isSuccess
    ? "from-emerald-600 to-green-600"
    : "from-red-600 to-rose-600";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className={`bg-gradient-to-r ${color} px-6 py-5 text-white`}>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3">
              {isSuccess ? <FiCheckCircle size={24} /> : <FiAlertCircle size={24} />}
            </div>

            <div>
              <h3 className="text-lg font-extrabold">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-5">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white ${
              isSuccess ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertBox({ type = "warning", title, message }) {
  const style =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${style}`}>
      <div className="rounded-full bg-white/50 p-3">
        <FiAlertCircle size={22} />
      </div>

      <div>
        <h3 className="text-lg font-extrabold">{title}</h3>
        <p className="mt-1 text-sm leading-6">{message}</p>
      </div>
    </div>
  );
}

function SmartAlertCard({ alert }) {
  const style =
    alert.level === "critical"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : alert.level === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
      : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";

  return (
    <div className={`rounded-xl border p-3 text-sm ${style}`}>
      <p className="font-bold">{alert.title}</p>
      <p className="mt-1 leading-6">{alert.message}</p>
    </div>
  );
}

function CaseTimeline({ incident }) {
  const fallbackSteps = [
    {
      id: "reported",
      title: "Reported",
      description: incident.reportedBy
        ? `Reported by ${incident.reportedBy}`
        : "Incident report created",
      createdAt: incident.reportedAt || incident.date,
      status: "Open",
    },
    {
      id: "investigation",
      title: "Investigation Started",
      description: incident.investigation
        ? `By ${incident.investigation.startedByName}`
        : "Waiting for HR action",
      createdAt: incident.investigation?.startedAt,
      status: "Investigating",
    },
    {
      id: "proof",
      title: "Proof Submitted",
      description: incident.resolution
        ? `By ${incident.resolution.submittedByName}`
        : "Waiting for resolution proof",
      createdAt: incident.resolution?.submittedAt,
      status: "For Review",
    },
    {
      id: "review",
      title: incident.review?.decision === "Rejected" ? "Returned" : "Closed",
      description: incident.review
        ? `${incident.review.decision} by ${incident.review.reviewedByName}`
        : "Waiting for Super Admin review",
      createdAt: incident.review?.reviewedAt,
      status: incident.review?.decision === "Rejected" ? "Investigating" : "Closed",
    },
  ];

  const timelineItems =
    Array.isArray(incident.timeline) && incident.timeline.length > 0
      ? incident.timeline
      : fallbackSteps;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <p className="mb-5 text-xs font-bold uppercase tracking-wide text-gray-500">
        Case Timeline
      </p>

      <div className="space-y-5">
        {timelineItems.map((item, index) => {
          const isRejected =
            item.status === "Rejected" ||
            item.status === "Returned" ||
            item.title?.toLowerCase().includes("returned");

          return (
            <div key={item.id || `${item.title}-${index}`} className="relative flex gap-3">
              {index !== timelineItems.length - 1 && (
                <span className="absolute left-[15px] top-8 h-full w-px bg-gray-200 dark:bg-white/10" />
              )}

              <div
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                  isRejected
                    ? "border-red-300 bg-red-100 text-red-700"
                    : "border-green-300 bg-green-100 text-green-700"
                }`}
              >
                {isRejected ? <FiXCircle /> : <FiCheckCircle />}
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <FiClock />
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProofReview({ resolution }) {
  return (
    <InfoCard title="Resolution Proof Review">
      <Detail label="Submitted By" value={resolution.submittedByName || "-"} />
      <Detail label="Submitted Date" value={formatDateTime(resolution.submittedAt)} />

      <TextDetail label="Action Taken" value={resolution.actionTaken || "-"} />
      <TextDetail label="Remarks" value={resolution.remarks || "-"} />

      <ProofList files={resolution.proofFiles || []} />
    </InfoCard>
  );
}

function TextDetail({ label, value }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6">{value}</p>
    </div>
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
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
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
    Minor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    Major: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    Critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        colors[level] ||
        "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200"
      }`}
    >
      {level || "Minor"}
    </span>
  );
}

function StatusBadge({ status }) {
  const config = {
    Open: {
      class:
        "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300",
      icon: "●",
    },
    Investigating: {
      class:
        "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
      icon: "⏳",
    },
    "For Review": {
      class:
        "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
      icon: "👁",
    },
    Closed: {
      class:
        "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
      icon: "✔",
    },
  };

  const current = config[status] || config.Open;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${current.class}`}
    >
      <span className="text-[10px]">{current.icon}</span>
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

      .dark .btn-light {
        border-color: rgba(255, 255, 255, 0.1);
        color: rgb(209 213 219);
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