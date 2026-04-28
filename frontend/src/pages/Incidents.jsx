import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiSearch,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import AddIncidentModal from "../components/incidents/modals/AddIncidentModal";
import FilterSelect from "../components/incidents/table/IncidentFilters";
import ActionButtons from "../components/incidents/table/IncidentActionButtons";
import {
  SeverityBadge,
  StatusBadge,
  CaseAgeBadge,
  SmartAlertBadge,
} from "../components/incidents/badges/incidentBadges";
import {
  safeParse,
  getUserIdentity,
  normalizeStatus,
  normalizeIncidentWithRules,
  getVisibleIncidents,
  createTimelineItem,
  updateEmployeeKpiAfterIncident,
} from "../utils/incidents/incidentHelpers";
import {
  BaseModal,
  NoticeModal,
  InfoCard,
  Detail,
  Field,
  ModalFooter,
  ProofReview,
  CaseTimeline,
} from "../components/incidents/shared/ModalUI";
import ViewIncidentModal from "../components/incidents/modals/ViewIncidentModal";
import ConfirmStartInvestigationModal from "../components/incidents/modals/ConfirmStartInvestigationModal";
import ResolutionModal from "../components/incidents/modals/ResolutionModal";
import ReviewCaseModal from "../components/incidents/modals/ReviewCaseModal";

const INCIDENTS_KEY = "incidents";
const EMPLOYEES_KEY = "employees";
const AUDIT_API_URL = "http://localhost:5000/api/audit-logs";

export default function Incidents() {
  const { user } = useAuth();
  const currentUser = getUserIdentity(user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const location = useLocation();
  const navigate = useNavigate();

  const storedEmployees = useMemo(() => safeParse(EMPLOYEES_KEY), []);

  const storedDeployments = useMemo(() => {
    return storedEmployees
      .filter((emp) => emp.status === "Deployed" && !emp.archived)
      .map((emp) => ({
        id: emp.id,
        employeeId: emp.id,
        employee: emp.name,
        company: emp.company || "-",
        status: emp.deployment?.status || "Active",
        deploymentStatus: emp.deployment?.status || "Active",
      }));
  }, [storedEmployees]);

  const activeEmployees = useMemo(
    () =>
      storedEmployees.filter((emp) => {
        const status = String(emp.status || "").trim().toLowerCase();

        return (
          !emp.archived &&
          (status === "deployed" || status === "active deployed")
        );
      }),
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

      const updatedRaw = baseIncidents.map((incident) => {
        if (incident.id !== incidentId) return incident;

        if (incident.status === "Closed") {
          showNotice(
            "error",
            "Case Already Closed",
            "This case is already closed and can no longer be modified."
          );
          return incident;
        }

        return updater(incident);
      });

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
      showNotice,
    ]
  );

  const handleAddIncident = async (newIncident) => {
    if (isSuperAdmin) return;

    const currentRaw = safeParse(INCIDENTS_KEY);

    const hasActiveSameCase = currentRaw.some(
      (inc) =>
        String(inc.employeeId) === String(newIncident.employeeId) &&
        String(inc.violation) === String(newIncident.violation) &&
        ["Open", "Investigating", "For Review"].includes(
          normalizeStatus(inc.status)
        )
    );

    if (hasActiveSameCase) {
      showNotice(
        "error",
        "Active Case Exists",
        "This employee already has an active case with the same violation. Resolve or close it first before creating another one."
      );
      return;
    }

    const sameDayCase = currentRaw.some((inc) => {
      const sameEmployee =
        String(inc.employeeId) === String(newIncident.employeeId);
      const sameViolation =
        String(inc.violation) === String(newIncident.violation);

      const oldDate = new Date(inc.reportedAt || inc.date).toDateString();
      const newDate = new Date(
        newIncident.reportedAt || newIncident.date
      ).toDateString();

      return sameEmployee && sameViolation && oldDate === newDate;
    });

    if (sameDayCase) {
      showNotice(
        "error",
        "Duplicate Incident",
        "The same employee already has the same violation reported today."
      );
      return;
    }

    const totalEmployeeCases = currentRaw.filter(
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
      currentRaw
    );

    const updatedIncidents = persistIncidents([
      normalizedIncident,
      ...currentRaw,
    ]);

    updateEmployeeKpiAfterIncident(
      normalizedIncident.employeeId,
      normalizedIncident,
      updatedIncidents
    );

    await createOperationalLog(
      "CREATE_INCIDENT",
      `${currentUser.name} created an incident report (ID: ${normalizedIncident.id}) for employee ${normalizedIncident.employee}.`
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
      `${currentUser.name} started investigation for incident ${incident.id}.`
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
      `${currentUser.name} submitted proof for incident ${incident.id}.`
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
      `${currentUser.name} approved and closed incident ${incident.id}.`
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
      `${currentUser.name} returned incident ${incident.id} for correction.`
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
                  <td
                    colSpan={8}
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

