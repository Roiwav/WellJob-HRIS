import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";

import AddIncidentModal from "../components/incidents/modals/AddIncidentModal";
import ViewIncidentModal from "../components/incidents/modals/ViewIncidentModal";
import ConfirmStartInvestigationModal from "../components/incidents/modals/ConfirmStartInvestigationModal";
import ResolutionModal from "../components/incidents/modals/ResolutionModal";
import ReviewCaseModal from "../components/incidents/modals/ReviewCaseModal";
import IncidentTable from "../components/incidents/table/IncidentTable";
import { NoticeModal } from "../components/incidents/shared/ModalUI";

import {
  getUserIdentity,
  normalizeStatus,
  normalizeIncidentWithRules,
  createTimelineItem,
} from "../utils/incidents/incidentHelpers";

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;
const AUDIT_API_URL = `${API_BASE}/audit-logs`;

function formatIncidentCode(id) {
  if (!id) return "-";

  const value = String(id);

  if (value.startsWith("INC-")) return value;

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;

  return `INC-${String(numeric).padStart(4, "0")}`;
}

function normalizeBackendIncident(incident) {
  const incidentId = incident.id;

  return {
    ...incident,

    id: incidentId,
    displayId: formatIncidentCode(incidentId),

    employeeId:
      incident.employeeId ||
      incident.employee_id ||
      incident.employee_id_fk ||
      "",

    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown Employee",

    employeeName:
      incident.employeeName ||
      incident.employee ||
      incident.employee_name ||
      "Unknown Employee",

    company: incident.company || "",

    violation:
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "No violation type",

    violationType:
      incident.violationType ||
      incident.violation ||
      incident.violation_type ||
      "No violation type",

    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),

    date:
      incident.date ||
      incident.incidentDate ||
      incident.incident_date ||
      incident.createdAt ||
      incident.created_at ||
      new Date().toISOString(),

    incidentDate:
      incident.incidentDate ||
      incident.date ||
      incident.incident_date ||
      incident.createdAt ||
      incident.created_at ||
      new Date().toISOString(),

    reportedAt:
      incident.reportedAt ||
      incident.reported_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.date ||
      new Date().toISOString(),

    reportedBy: incident.reportedBy || incident.reported_by || "Unknown",

    location: incident.location || "",
    description: incident.description || "",

    sanction:
      incident.sanction || incident.actionTaken || incident.action_taken || "",

    actionTaken:
      incident.actionTaken || incident.action_taken || incident.sanction || "",

    recommendation: incident.recommendation || "",

    resolutionNotes:
      incident.resolutionNotes || incident.resolution_notes || "",

    smartAlerts: Array.isArray(incident.smartAlerts)
      ? incident.smartAlerts
      : [],

    timeline: Array.isArray(incident.timeline) ? incident.timeline : [],
  };
}

function buildIncidentList(rawIncidents = []) {
  const normalized = rawIncidents.map(normalizeBackendIncident);

  return normalized.map((incident) =>
    normalizeIncidentWithRules(incident, normalized)
  );
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

export default function Incidents() {
  const { user } = useAuth();
  const currentUser = getUserIdentity(user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const actorFullName =
    currentUser?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Unknown User";

  const location = useLocation();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [openAddModal, setOpenAddModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
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

  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const status = String(emp.status || "").trim().toLowerCase();
      const isArchived = emp.archived === true || Number(emp.archived) === 1;

      return (
        !isArchived &&
        (status === "deployed" || status === "active deployed")
      );
    });
  }, [employees]);

  const deployments = useMemo(() => {
    return activeEmployees.map((emp) => ({
      id: emp.id,
      employeeId: emp.id,
      employee: emp.name,
      company: emp.company || "-",
      status: "Active",
      deploymentStatus: "Active",
    }));
  }, [activeEmployees]);

  const createOperationalLog = useCallback(
    async (action, description) => {
      try {
        await fetch(AUDIT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.userId || user?.id,
            username: user?.username,
            fullName: actorFullName,
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
    [user, actorFullName]
  );

  const fetchPageData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [employeeData, incidentData] = await Promise.all([
        requestJson(EMPLOYEE_API_URL),
        requestJson(INCIDENT_API_URL),
      ]);

      const backendIncidents = buildIncidentList(
        Array.isArray(incidentData) ? incidentData : []
      );

      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setIncidents(backendIncidents);
    } catch (error) {
      console.error("Fetch incident page data error:", error);

      showNotice(
        "error",
        "Backend Fetch Failed",
        error.message || "Unable to load employee and incident records."
      );
    } finally {
      setIsLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  useEffect(() => {
    if (!location.state?.incidentId || incidents.length === 0) return;

    const targetId = String(location.state.incidentId);

    const foundIncident = incidents.find(
      (incident) =>
        String(incident.id) === targetId ||
        String(incident.displayId) === targetId
    );

    if (foundIncident) {
      setSelectedIncident(foundIncident);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, incidents]);

  const syncModalIncident = useCallback((updatedIncident) => {
    const updateIfSelected = (setter) => {
      setter((current) => {
        if (!current) return current;

        return String(current.id) === String(updatedIncident.id)
          ? updatedIncident
          : current;
      });
    };

    updateIfSelected(setSelectedIncident);
    updateIfSelected(setStartReviewIncident);
    updateIfSelected(setConfirmStartIncident);
    updateIfSelected(setResolutionIncident);
    updateIfSelected(setReviewIncident);
  }, []);

  const updateIncidentState = useCallback(
    (updatedIncident) => {
      setIncidents((prev) => {
        const nextRaw = prev.map((incident) =>
          String(incident.id) === String(updatedIncident.id)
            ? updatedIncident
            : incident
        );

        return nextRaw.map((incident) =>
          normalizeIncidentWithRules(incident, nextRaw)
        );
      });

      syncModalIncident(updatedIncident);
    },
    [syncModalIncident]
  );

  const patchIncidentStatus = useCallback(
    async ({
      incident,
      updatedIncident,
      payload,
      auditAction,
      auditDescription,
      successTitle,
      successMessage,
    }) => {
      if (incident.status === "Closed") {
        showNotice(
          "error",
          "Case Already Closed",
          "This case is already closed and can no longer be modified."
        );
        return false;
      }

      try {
        await requestJson(`${INCIDENT_API_URL}/${incident.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            userId: user?.userId || user?.id,
            username: user?.username,
            fullName: actorFullName,
            role: user?.role,
          }),
        });

        updateIncidentState(updatedIncident);

        await createOperationalLog(auditAction, auditDescription);

        showNotice("success", successTitle, successMessage);

        return true;
      } catch (error) {
        console.error("Patch incident status error:", error);

        showNotice(
          "error",
          "Update Failed",
          error.message || "Unable to update this incident."
        );

        return false;
      }
    },
    [
      actorFullName,
      createOperationalLog,
      showNotice,
      updateIncidentState,
      user?.id,
      user?.role,
      user?.userId,
      user?.username,
    ]
  );

  const handleAddIncident = async (newIncident) => {
    if (isSuperAdmin) return false;

    const totalEmployeeCases = incidents.filter(
      (inc) => String(inc.employeeId) === String(newIncident.employeeId)
    ).length;

    const escalatedIncident = {
      ...newIncident,
      severity:
        totalEmployeeCases >= 4 && newIncident.severity !== "Critical"
          ? "Critical"
          : newIncident.severity,
      status: "Open",
    };

    const normalizedIncident = normalizeIncidentWithRules(
      escalatedIncident,
      incidents
    );

    try {
      const response = await requestJson(INCIDENT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: normalizedIncident.employeeId,
          employee: normalizedIncident.employee,
          employeeName: normalizedIncident.employee,
          company: normalizedIncident.company,

          violation: normalizedIncident.violation,
          violationType: normalizedIncident.violation,
          severity: normalizedIncident.severity,
          status: "Open",

          date: normalizedIncident.date,
          incidentDate: normalizedIncident.date,

          location: normalizedIncident.location || "",
          description: normalizedIncident.description || "",

          reportedBy: actorFullName,
          actionTaken: normalizedIncident.sanction || "",
          recommendation: normalizedIncident.recommendation || "",
          resolutionNotes: "",

          duplicateVerified: Boolean(normalizedIncident.duplicateVerified),
          duplicateVerificationNote:
            normalizedIncident.duplicateVerificationNote || "",

          userId: user?.userId || user?.id,
          username: user?.username,
          fullName: actorFullName,
          role: user?.role,
        }),
      });

      await fetchPageData();

      await createOperationalLog(
        "CREATE_INCIDENT",
        `${actorFullName} created an incident report for employee ${normalizedIncident.employee}.`
      );

      setOpenAddModal(false);

      showNotice(
        "success",
        "Incident Report Saved",
        `Incident ${formatIncidentCode(
          response?.id
        )} has been saved to the system.`
      );

      return true;
    } catch (error) {
      console.error("Create incident error:", error);

      showNotice(
        "error",
        "Save Failed",
        error.message || "Unable to save incident report."
      );

      return false;
    }
  };

  const handleConfirmStartInvestigation = async (incident) => {
    if (isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Investigation Started",
      description: `${actorFullName} started the investigation.`,
      createdBy: actorFullName,
      status: "Investigating",
    });

    const updatedIncident = normalizeIncidentWithRules(
      {
        ...incident,
        status: "Investigating",
        investigation: {
          startedAt: new Date().toISOString(),
          startedById: currentUser.id,
          startedByName: actorFullName,
          startedByUsername: currentUser.username,
          startedByRole: currentUser.role,
        },
        timeline: [...(incident.timeline || []), timelineItem],
      },
      incidents
    );

    const success = await patchIncidentStatus({
      incident,
      updatedIncident,
      payload: {
        status: "Investigating",
        resolutionNotes: "Investigation started.",
      },
      auditAction: "START_INVESTIGATION",
      auditDescription: `${actorFullName} started investigation for incident ${formatIncidentCode(
        incident.id
      )}.`,
      successTitle: "Investigation Started",
      successMessage: `Incident ${formatIncidentCode(
        incident.id
      )} is now marked as Investigating.`,
    });

    if (success) {
      setConfirmStartIncident(null);
      setStartReviewIncident(null);
    }
  };

  const handleSubmitResolution = async (incident, resolutionData) => {
    if (isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Resolution Proof Submitted",
      description: `${actorFullName} submitted proof for Super Admin review.`,
      createdBy: actorFullName,
      status: "For Review",
    });

    const updatedIncident = normalizeIncidentWithRules(
      {
        ...incident,
        status: "For Review",
        resolution: {
          submittedAt: new Date().toISOString(),
          submittedById: currentUser.id,
          submittedByName: actorFullName,
          submittedByUsername: currentUser.username,
          submittedByRole: currentUser.role,
          actionTaken: resolutionData.actionTaken,
          remarks: resolutionData.remarks,
          proofFiles: resolutionData.proofFiles,
        },
        actionTaken: resolutionData.actionTaken,
        resolutionNotes: resolutionData.remarks,
        timeline: [...(incident.timeline || []), timelineItem],
      },
      incidents
    );

    const success = await patchIncidentStatus({
      incident,
      updatedIncident,
      payload: {
        status: "For Review",
        actionTaken: resolutionData.actionTaken,
        resolutionNotes: resolutionData.remarks,
        recommendation: incident.recommendation || "",
      },
      auditAction: "SUBMIT_RESOLUTION",
      auditDescription: `${actorFullName} submitted proof for incident ${formatIncidentCode(
        incident.id
      )}.`,
      successTitle: "Submitted for Review",
      successMessage: `Proof for incident ${formatIncidentCode(
        incident.id
      )} has been submitted to Super Admin.`,
    });

    if (success) {
      setResolutionIncident(null);
    }
  };

  const handleApproveCase = async (incident) => {
    if (!isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Case Approved and Closed",
      description: `${actorFullName} approved and closed the case.`,
      createdBy: actorFullName,
      status: "Closed",
    });

    const updatedIncident = normalizeIncidentWithRules(
      {
        ...incident,
        status: "Closed",
        review: {
          reviewedAt: new Date().toISOString(),
          reviewedById: currentUser.id,
          reviewedByName: actorFullName,
          reviewedByUsername: currentUser.username,
          reviewedByRole: currentUser.role,
          decision: "Approved",
          comments: "Proof reviewed and approved.",
        },
        timeline: [...(incident.timeline || []), timelineItem],
      },
      incidents
    );

    const success = await patchIncidentStatus({
      incident,
      updatedIncident,
      payload: {
        status: "Closed",
        resolutionNotes:
          incident.resolutionNotes ||
          incident.resolution?.remarks ||
          "Proof reviewed and approved.",
        actionTaken:
          incident.actionTaken ||
          incident.resolution?.actionTaken ||
          incident.sanction ||
          "",
        recommendation: incident.recommendation || "",
      },
      auditAction: "CLOSE_INCIDENT",
      auditDescription: `${actorFullName} approved and closed incident ${formatIncidentCode(
        incident.id
      )}.`,
      successTitle: "Case Approved",
      successMessage: `Incident ${formatIncidentCode(
        incident.id
      )} has been approved and closed successfully.`,
    });

    if (success) {
      setReviewIncident(null);
    }
  };

  const handleRejectCase = async (incident, comments) => {
    if (!isSuperAdmin) return;

    const timelineItem = createTimelineItem({
      title: "Case Returned",
      description: comments,
      createdBy: actorFullName,
      status: "Investigating",
    });

    const updatedIncident = normalizeIncidentWithRules(
      {
        ...incident,
        status: "Investigating",
        review: {
          reviewedAt: new Date().toISOString(),
          reviewedById: currentUser.id,
          reviewedByName: actorFullName,
          reviewedByUsername: currentUser.username,
          reviewedByRole: currentUser.role,
          decision: "Rejected",
          comments,
        },
        timeline: [...(incident.timeline || []), timelineItem],
      },
      incidents
    );

    const success = await patchIncidentStatus({
      incident,
      updatedIncident,
      payload: {
        status: "Investigating",
        resolutionNotes: comments,
        actionTaken: incident.actionTaken || incident.sanction || "",
        recommendation: incident.recommendation || "",
      },
      auditAction: "RETURN_INCIDENT",
      auditDescription: `${actorFullName} returned incident ${formatIncidentCode(
        incident.id
      )} for correction.`,
      successTitle: "Case Returned",
      successMessage: `Incident ${formatIncidentCode(
        incident.id
      )} has been returned for correction.`,
    });

    if (success) {
      setReviewIncident(null);
    }
  };

  const filteredIncidents = useMemo(() => {
    const cleanSearch = search
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const rawSearch = search.toLowerCase().trim();
    const searchTerms = cleanSearch ? cleanSearch.split(/\s+/) : [];

    return incidents.filter((incident) => {
      const cleanEmployeeName = String(
        incident.employee || incident.employeeName || ""
      )
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "");

      const matchName =
        searchTerms.length === 0 ||
        searchTerms.every((term) => cleanEmployeeName.includes(term));

      const fallbackString = [
        incident.displayId,
        incident.id,
        incident.employeeId,
        incident.violation,
        incident.company,
        incident.severity,
        incident.status,
        incident.sanction,
        incident.recommendation,
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch =
        !rawSearch || matchName || fallbackString.includes(rawSearch);

      const matchesStatus =
        statusFilter === "ALL" || incident.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" || incident.severity === severityFilter;

      return matchSearch && matchesStatus && matchesSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
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
              className="rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
            >
              + Add Incident Report
            </button>
          </RoleGuard>
        )}
      </div>

      <div className="min-w-0">
        <IncidentTable
          isLoading={isLoading}
          incidents={filteredIncidents}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          isSuperAdmin={isSuperAdmin}
          formatIncidentCode={formatIncidentCode}
          onView={setSelectedIncident}
          onStartReview={setStartReviewIncident}
          onResolve={setResolutionIncident}
          onReview={setReviewIncident}
        />
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
        employees={activeEmployees}
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
