import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";

import RoleGuard from "../components/auth/RoleGuard";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
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
} from "../utils/incidents/incidentHelpers";
import { normalizeEvidenceFiles } from "../utils/incidents/evidenceFiles";

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;
const DEPLOYMENT_API_URL = `${API_BASE}/deployments`;
const AUDIT_API_URL = `${API_BASE}/audit-logs`;
const DATA_EVENT_SOURCE = "incidents-page";
const REQUEST_TIMEOUT_MS = 15000;
const PASSIVE_REFRESH_DEBOUNCE_MS = 150;

const INCIDENT_PAGE_DATA_DOMAINS = new Set([
  "incident",
  "incidents",
  "employee",
  "employees",
  "deployment",
  "deployments",
  "dashboard",
]);

function emitDataUpdated(action = "INCIDENTS_UPDATED") {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "incidents",
        action,
        at: Date.now(),
      },
    })
  );
}

function normalizeDataDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function shouldRefreshForDataUpdated(event) {
  const domain = normalizeDataDomain(
    event?.detail?.domain
  );

  if (!domain) {
    return true;
  }

  return INCIDENT_PAGE_DATA_DOMAINS.has(
    domain
  );
}

function formatIncidentCode(id) {
  if (!id) return "-";

  const value = String(id);

  if (value.startsWith("INC-")) return value;

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;

  return `INC-${String(numeric).padStart(4, "0")}`;
}

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (["SUPERADMIN", "SUPER_ADMIN", "ADMIN"].includes(role)) {
    return "SUPER_ADMIN";
  }

  if (["HRMANAGER", "HR_MANAGER"].includes(role)) {
    return "HR_MANAGER";
  }

  if (["HRSTAFF", "HR_STAFF"].includes(role)) {
    return "HR_STAFF";
  }

  return role;
}

function normalizeTimelineEvent(event = {}) {
  const createdAt =
    event.createdAt ||
    event.created_at ||
    event.date ||
    new Date().toISOString();

  return {
    id:
      event.id ||
      `${event.actionType || event.action_type || "event"}-${createdAt}`,

    incidentId:
      event.incidentId ||
      event.incident_id ||
      "",

    incident_id:
      event.incident_id ||
      event.incidentId ||
      "",

    actionType:
      event.actionType ||
      event.action_type ||
      "",

    action_type:
      event.action_type ||
      event.actionType ||
      "",

    title:
      event.title ||
      "Timeline Event",

    description:
      event.description ||
      "",

    createdById:
      event.createdById ||
      event.created_by_id ||
      "",

    created_by_id:
      event.created_by_id ||
      event.createdById ||
      "",

    createdByUsername:
      event.createdByUsername ||
      event.created_by_username ||
      "",

    created_by_username:
      event.created_by_username ||
      event.createdByUsername ||
      "",

    createdByName:
      event.createdByName ||
      event.created_by_name ||
      "System",

    created_by_name:
      event.created_by_name ||
      event.createdByName ||
      "System",

    createdByRole:
      event.createdByRole ||
      event.created_by_role ||
      "",

    created_by_role:
      event.created_by_role ||
      event.createdByRole ||
      "",

    createdAt,
    created_at: createdAt,
  };
}

function normalizeBackendIncident(incident = {}) {
  const incidentId = incident.id;

  const reportedBy =
    incident.reportedByName ||
    incident.reported_by_name ||
    incident.reportedBy ||
    incident.reported_by ||
    "Unknown";

  const investigationStartedAt =
    incident.investigationStartedAt ||
    incident.investigation_started_at ||
    null;

  const resolutionSubmittedAt =
    incident.resolutionSubmittedAt ||
    incident.resolution_submitted_at ||
    null;

  const reviewedAt =
    incident.reviewedAt ||
    incident.reviewed_at ||
    null;

  const timelineEvents = Array.isArray(
    incident.timelineEvents
  )
    ? incident.timelineEvents.map(
        normalizeTimelineEvent
      )
    : Array.isArray(
        incident.timeline_events
      )
    ? incident.timeline_events.map(
        normalizeTimelineEvent
      )
    : Array.isArray(
        incident.timeline
      )
    ? incident.timeline.map(
        normalizeTimelineEvent
      )
    : [];

  const investigation =
    investigationStartedAt
      ? {
          startedAt:
            investigationStartedAt,

          startedById:
            incident.investigationStartedById ||
            incident.investigation_started_by_id ||
            "",

          startedByName:
            incident.investigationStartedByName ||
            incident.investigation_started_by_name ||
            "",

          startedByUsername:
            incident.investigationStartedByUsername ||
            incident.investigation_started_by_username ||
            "",
        }
      : null;

  const resolution =
    resolutionSubmittedAt
      ? {
          submittedAt:
            resolutionSubmittedAt,

          submittedById:
            incident.resolutionSubmittedById ||
            incident.resolution_submitted_by_id ||
            "",

          submittedByName:
            incident.resolutionSubmittedByName ||
            incident.resolution_submitted_by_name ||
            "",

          submittedByUsername:
            incident.resolutionSubmittedByUsername ||
            incident.resolution_submitted_by_username ||
            "",

          actionTaken:
            incident.actionTaken ||
            incident.action_taken ||
            incident.sanction ||
            "",

          remarks:
            incident.resolutionNotes ||
            incident.resolution_notes ||
            "",

          proofFiles:
            normalizeEvidenceFiles({
              proofFiles:
                incident.proofFiles ||
                incident.proof_files ||
                incident.evidenceFiles ||
                incident.evidence_files ||
                incident.attachments,
            }),
        }
      : null;

  const review =
    reviewedAt ||
    incident.reviewDecision ||
    incident.review_decision
      ? {
          reviewedAt,

          reviewedById:
            incident.reviewedById ||
            incident.reviewed_by_id ||
            "",

          reviewedByName:
            incident.reviewedByName ||
            incident.reviewed_by_name ||
            "",

          reviewedByUsername:
            incident.reviewedByUsername ||
            incident.reviewed_by_username ||
            "",

          decision:
            incident.reviewDecision ||
            incident.review_decision ||
            "",

          comments:
            incident.reviewComments ||
            incident.review_comments ||
            "",
        }
      : null;

  return {
    ...incident,

    id: incidentId,

    displayId:
      formatIncidentCode(
        incidentId
      ),

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

    company:
      incident.company ||
      "",

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

    severity:
      incident.severity ||
      "Minor",

    status:
      normalizeStatus(
        incident.status ||
          "Open"
      ),

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

    reportedBy,
    reportedByName:
      reportedBy,

    investigation,
    resolution,
    review,

    investigationStartedAt,

    investigation_started_at:
      investigationStartedAt,

    investigationStartedByName:
      investigation?.startedByName ||
      "",

    investigation_started_by_name:
      investigation?.startedByName ||
      "",

    resolutionSubmittedAt,

    resolution_submitted_at:
      resolutionSubmittedAt,

    resolutionSubmittedByName:
      resolution?.submittedByName ||
      "",

    resolution_submitted_by_name:
      resolution?.submittedByName ||
      "",

    reviewedAt,

    reviewed_at:
      reviewedAt,

    reviewedByName:
      review?.reviewedByName ||
      "",

    reviewed_by_name:
      review?.reviewedByName ||
      "",

    reviewDecision:
      review?.decision ||
      "",

    review_decision:
      review?.decision ||
      "",

    reviewComments:
      review?.comments ||
      "",

    review_comments:
      review?.comments ||
      "",

    location:
      incident.location ||
      "",

    description:
      incident.description ||
      "",

    sanction:
      incident.sanction ||
      incident.actionTaken ||
      incident.action_taken ||
      "",

    actionTaken:
      incident.actionTaken ||
      incident.action_taken ||
      incident.sanction ||
      "",

    recommendation:
      incident.recommendation ||
      "",

    resolutionNotes:
      incident.resolutionNotes ||
      incident.resolution_notes ||
      "",

    smartAlerts:
      Array.isArray(
        incident.smartAlerts
      )
        ? incident.smartAlerts
        : [],

    timelineEvents,

    timeline_events:
      timelineEvents,

    timeline:
      timelineEvents,
  };
}

function normalizeBackendDeployment(
  deployment = {}
) {
  return {
    ...deployment,

    deploymentId:
      deployment.id ||
      deployment.deploymentId ||
      deployment.deployment_id,

    employeeId:
      deployment.employeeId ||
      deployment.employee_id ||
      deployment.empId ||
      deployment.employeeID ||
      "",

    employee:
      deployment.employee ||
      deployment.employeeName ||
      deployment.employee_name ||
      deployment.name ||
      "Unknown Employee",

    employeeName:
      deployment.employeeName ||
      deployment.employee ||
      deployment.employee_name ||
      deployment.name ||
      "Unknown Employee",

    company:
      deployment.company ||
      deployment.clientCompany ||
      deployment.client_company ||
      "-",

    location:
      deployment.location ||
      deployment.deploymentLocation ||
      deployment.deployment_location ||
      "-",

    status:
      deployment.status ||
      deployment.deploymentStatus ||
      deployment.deployment_status ||
      "Active",

    deploymentStatus:
      deployment.deploymentStatus ||
      deployment.deployment_status ||
      deployment.status ||
      "Active",

    start:
      deployment.start ||
      deployment.deploymentDate ||
      deployment.deployment_date ||
      deployment.contractStart ||
      deployment.contract_start ||
      deployment.startDate ||
      deployment.start_date ||
      "-",

    end:
      deployment.end ||
      deployment.endDate ||
      deployment.end_date ||
      deployment.deploymentEnd ||
      deployment.deployment_end ||
      deployment.contractEnd ||
      deployment.contract_end ||
      null,
  };
}

function isActiveDeploymentRecord(
  deployment
) {
  const status = String(
    deployment?.status ||
      deployment?.deploymentStatus ||
      deployment?.deployment_status ||
      ""
  )
    .trim()
    .toLowerCase();

  return [
    "active",
    "deployed",
    "active deployed",
    "ongoing",
  ].includes(status);
}

function buildIncidentList(
  rawIncidents = []
) {
  const normalized =
    rawIncidents.map(
      normalizeBackendIncident
    );

  return normalized.map(
    (incident) =>
      normalizeIncidentWithRules(
        incident,
        normalized
      )
  );
}

async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response =
      await fetch(url, {
        ...options,

        signal:
          controller.signal,

        headers: {
          Accept:
            "application/json",

          ...(options.headers ||
            {}),
        },
      });

    const data =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The server took too long to respond. Check that the backend server and database are running, then try again."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}

export default function Incidents() {
  const { user } =
    useAuth();

  const currentUser =
    getUserIdentity(user);

  const currentRole =
    normalizeRole(
      user?.role ||
        currentUser?.role
    );

  const isSuperAdmin =
    currentRole ===
    "SUPER_ADMIN";

  const isHrManager =
    currentRole ===
    "HR_MANAGER";

  const isAuthorizedReviewer =
    isSuperAdmin ||
    isHrManager;

  const actorFullName =
    user?.full_name ||
    user?.fullName ||
    user?.fullname ||
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    currentUser?.name ||
    user?.username ||
    "Unknown User";

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const isMountedRef =
    useRef(true);

  const fetchRequestIdRef =
    useRef(0);

  const activePageRequestsRef =
    useRef(0);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    incidents,
    setIncidents,
  ] = useState([]);

  const [
    deploymentRecords,
    setDeploymentRecords,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    fetchError,
    setFetchError,
  ] = useState("");

  const [
    openAddModal,
    setOpenAddModal,
  ] = useState(false);

  const [
    selectedIncident,
    setSelectedIncident,
  ] = useState(null);

  const [
    startReviewIncident,
    setStartReviewIncident,
  ] = useState(null);

  const [
    confirmStartIncident,
    setConfirmStartIncident,
  ] = useState(null);

  const [
    resolutionIncident,
    setResolutionIncident,
  ] = useState(null);

  const [
    reviewIncident,
    setReviewIncident,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    caseTab,
    setCaseTab,
  ] = useState(
    isAuthorizedReviewer
      ? "FOR_REVIEW"
      : "ACTIVE"
  );

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState("ALL");

  const [
    notice,
    setNotice,
  ] = useState(null);

  const showNotice =
    useCallback(
      (
        type,
        title,
        message
      ) => {
        if (
          !isMountedRef.current
        ) {
          return;
        }

        setNotice({
          type,
          title,
          message,
        });
      },
      []
    );

  const activeDeployments =
    useMemo(() => {
      return deploymentRecords.filter(
        isActiveDeploymentRecord
      );
    }, [
      deploymentRecords,
    ]);

  const activeEmployees =
    useMemo(() => {
      const activeDeploymentEmployeeIds =
        new Set(
          activeDeployments
            .map(
              (deployment) =>
                normalizeId(
                  deployment.employeeId
                )
            )
            .filter(Boolean)
        );

      const activeDeploymentEmployeeNames =
        new Set(
          activeDeployments
            .map(
              (deployment) =>
                normalizeName(
                  deployment.employee ||
                    deployment.employeeName
                )
            )
            .filter(Boolean)
        );

      return employees.filter(
        (emp) => {
          const employeeId =
            normalizeId(
              emp.id ||
                emp.employeeId ||
                emp.employee_id
            );

          const employeeName =
            normalizeName(
              emp.name ||
                emp.full_name ||
                emp.fullName
            );

          const isArchived =
            emp.archived ===
              true ||
            Number(
              emp.archived
            ) === 1;

          if (isArchived) {
            return false;
          }

          return (
            (!!employeeId &&
              activeDeploymentEmployeeIds.has(
                employeeId
              )) ||
            (!!employeeName &&
              activeDeploymentEmployeeNames.has(
                employeeName
              ))
          );
        }
      );
    }, [
      employees,
      activeDeployments,
    ]);

  const deployments =
    useMemo(() => {
      return activeDeployments.map(
        (deployment) => {
          const deploymentEmployeeId =
            normalizeId(
              deployment.employeeId
            );

          const deploymentEmployeeName =
            normalizeName(
              deployment.employee ||
                deployment.employeeName
            );

          const employeeRecord =
            employees.find(
              (emp) => {
                const employeeId =
                  normalizeId(
                    emp.id ||
                      emp.employeeId ||
                      emp.employee_id
                  );

                const employeeName =
                  normalizeName(
                    emp.name ||
                      emp.full_name ||
                      emp.fullName
                  );

                return (
                  (!!deploymentEmployeeId &&
                    employeeId ===
                      deploymentEmployeeId) ||
                  (!!deploymentEmployeeName &&
                    employeeName ===
                      deploymentEmployeeName)
                );
              }
            );

          const employeeName =
            employeeRecord?.name ||
            employeeRecord?.full_name ||
            employeeRecord?.fullName ||
            deployment.employee ||
            deployment.employeeName ||
            "Unknown Employee";

          return {
            ...deployment,

            id:
              deployment.deploymentId ||
              deployment.id ||
              deploymentEmployeeId,

            employeeId:
              deploymentEmployeeId ||
              normalizeId(
                employeeRecord?.id ||
                  employeeRecord?.employeeId
              ),

            employee:
              employeeName,

            employeeName,

            company:
              deployment.company ||
              deployment.clientCompany ||
              deployment.client_company ||
              employeeRecord?.company ||
              "-",

            status:
              deployment.status ||
              "Active",

            deploymentStatus:
              deployment.deploymentStatus ||
              deployment.status ||
              "Active",
          };
        }
      );
    }, [
      activeDeployments,
      employees,
    ]);

  const incidentCaseCounts =
    useMemo(() => {
      return incidents.reduce(
        (
          counts,
          incident
        ) => {
          const status =
            normalizeStatus(
              incident.status
            );

          counts.ALL += 1;

          if (
            [
              "Open",
              "Investigating",
            ].includes(status)
          ) {
            counts.ACTIVE += 1;
          }

          if (
            status ===
            "For Review"
          ) {
            counts.FOR_REVIEW +=
              1;
          }

          if (
            status ===
            "Closed"
          ) {
            counts.CLOSED += 1;
          }

          return counts;
        },
        {
          ALL: 0,
          ACTIVE: 0,
          FOR_REVIEW: 0,
          CLOSED: 0,
        }
      );
    }, [incidents]);

  const createOperationalLog =
    useCallback(
      async (
        action,
        description
      ) => {
        try {
          await fetch(
            AUDIT_API_URL,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    userId:
                      user?.userId ||
                      user?.id,

                    username:
                      user?.username,

                    fullName:
                      actorFullName,

                    role:
                      user?.role,

                    category:
                      "OPERATIONAL",

                    action,
                    description,
                  }
                ),
            }
          );
        } catch (error) {
          console.error(
            "Audit log failed:",
            error
          );
        }
      },
      [
        user,
        actorFullName,
      ]
    );

  const fetchPageData =
    useCallback(
      async ({
        silent = false,
        showError = true,
        showRefreshing = false,
        passive = false,
      } = {}) => {
        if (
          passive &&
          activePageRequestsRef.current >
            0
        ) {
          return false;
        }

        const requestId =
          fetchRequestIdRef.current +
          1;

        fetchRequestIdRef.current =
          requestId;

        activePageRequestsRef.current +=
          1;

        try {
          if (
            !silent &&
            !showRefreshing &&
            isMountedRef.current
          ) {
            setIsLoading(true);
          }

          if (
            showRefreshing &&
            isMountedRef.current
          ) {
            setIsRefreshing(
              true
            );
          }

          if (
            showError &&
            isMountedRef.current
          ) {
            setFetchError("");
          }

          const [
            employeeData,
            incidentData,
            deploymentData,
          ] = await Promise.all([
            requestJson(
              EMPLOYEE_API_URL
            ),

            requestJson(
              INCIDENT_API_URL
            ),

            requestJson(
              DEPLOYMENT_API_URL
            ),
          ]);

          if (
            !isMountedRef.current ||
            requestId !==
              fetchRequestIdRef.current
          ) {
            return false;
          }

          const backendIncidents =
            buildIncidentList(
              Array.isArray(
                incidentData
              )
                ? incidentData
                : []
            );

          const backendDeployments =
            Array.isArray(
              deploymentData
            )
              ? deploymentData.map(
                  normalizeBackendDeployment
                )
              : [];

          setEmployees(
            Array.isArray(
              employeeData
            )
              ? employeeData
              : []
          );

          setIncidents(
            backendIncidents
          );

          setDeploymentRecords(
            backendDeployments
          );

          return true;
        } catch (error) {
          console.error(
            "Fetch incident page data error:",
            error
          );

          if (
            showError &&
            isMountedRef.current &&
            requestId ===
              fetchRequestIdRef.current
          ) {
            setFetchError(
              error?.message ||
                "Unable to load employee, deployment, and incident records."
            );
          }

          return false;
        } finally {
          activePageRequestsRef.current =
            Math.max(
              0,
              activePageRequestsRef.current -
                1
            );

          if (
            isMountedRef.current &&
            requestId ===
              fetchRequestIdRef.current
          ) {
            if (!silent) {
              setIsLoading(
                false
              );
            }

            if (
              showRefreshing
            ) {
              setIsRefreshing(
                false
              );
            }
          }
        }
      },
      []
    );

  useEffect(() => {
    isMountedRef.current =
      true;

    return () => {
      isMountedRef.current =
        false;

      fetchRequestIdRef.current +=
        1;
    };
  }, []);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  useEffect(() => {
    let refreshTimer =
      null;

    const refreshSilently =
      () => {
        if (refreshTimer) {
          clearTimeout(
            refreshTimer
          );
        }

        refreshTimer =
          setTimeout(() => {
            fetchPageData({
              silent: true,
              showError:
                false,
              passive:
                true,
            });
          },
          PASSIVE_REFRESH_DEBOUNCE_MS
        );
      };

    const handleDataUpdated =
      (event) => {
        if (
          event?.detail
            ?.source ===
          DATA_EVENT_SOURCE
        ) {
          return;
        }

        if (
          !shouldRefreshForDataUpdated(
            event
          )
        ) {
          return;
        }

        refreshSilently();
      };

    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );

    return () => {
      if (refreshTimer) {
        clearTimeout(
          refreshTimer
        );
      }

      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );
    };
  }, [fetchPageData]);

  useEffect(() => {
    if (
      !location.state
        ?.incidentId ||
      incidents.length === 0
    ) {
      return;
    }

    const targetId =
      String(
        location.state
          .incidentId
      );

    const requestedAction =
      String(
        location.state.action ||
          "view"
      )
        .trim()
        .toLowerCase();

    const foundIncident =
      incidents.find(
        (incident) =>
          String(
            incident.id
          ) === targetId ||
          String(
            incident.displayId
          ) === targetId
      );

    if (!foundIncident) {
      navigate(
        location.pathname,
        {
          replace: true,
          state: {},
        }
      );

      return;
    }

    const currentStatus =
      normalizeStatus(
        foundIncident.status
      );

    setSelectedIncident(
      null
    );

    setStartReviewIncident(
      null
    );

    setConfirmStartIncident(
      null
    );

    setResolutionIncident(
      null
    );

    setReviewIncident(
      null
    );

    if (
      requestedAction ===
        "review" &&
      currentStatus ===
        "For Review" &&
      isAuthorizedReviewer
    ) {
      setCaseTab(
        "FOR_REVIEW"
      );

      setReviewIncident(
        foundIncident
      );
    } else if (
      requestedAction ===
        "submit-resolution" &&
      currentStatus ===
        "Investigating" &&
      !isSuperAdmin
    ) {
      setCaseTab(
        "ACTIVE"
      );

      setResolutionIncident(
        foundIncident
      );
    } else if (
      requestedAction ===
        "start-investigation" &&
      currentStatus ===
        "Open" &&
      !isSuperAdmin
    ) {
      setCaseTab(
        "ACTIVE"
      );

      setStartReviewIncident(
        foundIncident
      );
    } else {
      setSelectedIncident(
        foundIncident
      );
    }

    navigate(
      location.pathname,
      {
        replace: true,
        state: {},
      }
    );
  }, [
    incidents,
    isAuthorizedReviewer,
    isSuperAdmin,
    location.pathname,
    location.state,
    navigate,
  ]);

  const syncModalIncident =
    useCallback(
      (
        updatedIncident
      ) => {
        const updateIfSelected =
          (setter) => {
            setter(
              (current) => {
                if (!current) {
                  return current;
                }

                return String(
                  current.id
                ) ===
                  String(
                    updatedIncident.id
                  )
                  ? updatedIncident
                  : current;
              }
            );
          };

        updateIfSelected(
          setSelectedIncident
        );

        updateIfSelected(
          setStartReviewIncident
        );

        updateIfSelected(
          setConfirmStartIncident
        );

        updateIfSelected(
          setResolutionIncident
        );

        updateIfSelected(
          setReviewIncident
        );
      },
      []
    );

  const updateIncidentState =
    useCallback(
      (
        updatedIncident
      ) => {
        setIncidents(
          (prev) => {
            const nextRaw =
              prev.map(
                (incident) =>
                  String(
                    incident.id
                  ) ===
                  String(
                    updatedIncident.id
                  )
                    ? updatedIncident
                    : incident
              );

            return nextRaw.map(
              (incident) =>
                normalizeIncidentWithRules(
                  incident,
                  nextRaw
                )
            );
          }
        );

        syncModalIncident(
          updatedIncident
        );
      },
      [syncModalIncident]
    );

  const patchIncidentStatus =
    useCallback(
      async ({
        incident,
        updatedIncident,
        payload,
        auditAction,
        auditDescription,
        successTitle,
        successMessage,
        formData,
      }) => {
        if (
          normalizeStatus(
            incident.status
          ) === "Closed"
        ) {
          showNotice(
            "error",
            "Case Already Closed",
            "This case is already closed and can no longer be modified."
          );

          return false;
        }

        try {
          const response =
            await requestJson(
              `${INCIDENT_API_URL}/${incident.id}/status`,
              {
                method:
                  "PATCH",

                ...(formData
                  ? {
                      body:
                        formData,
                    }
                  : {
                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body:
                        JSON.stringify(
                          {
                            ...payload,

                            workflowAction:
                              payload.workflowAction,

                            userId:
                              user?.userId ||
                              user?.id,

                            username:
                              user?.username,

                            fullName:
                              actorFullName,

                            role:
                              user?.role,
                          }
                        ),
                    }),
              }
            );

          const backendUpdatedIncident =
            response?.incident
              ? normalizeIncidentWithRules(
                  normalizeBackendIncident(
                    response.incident
                  ),
                  incidents
                )
              : updatedIncident;

          updateIncidentState(
            backendUpdatedIncident
          );

          await createOperationalLog(
            auditAction,
            auditDescription
          );

          await fetchPageData({
            silent: true,
            showError: false,
          });

          emitDataUpdated(
            auditAction
          );

          showNotice(
            "success",
            successTitle,
            successMessage
          );

          return true;
        } catch (error) {
          console.error(
            "Patch incident status error:",
            error
          );

          showNotice(
            "error",
            "Update Failed",
            error.message ||
              "Unable to update this incident."
          );

          return false;
        }
      },
      [
        actorFullName,
        createOperationalLog,
        fetchPageData,
        incidents,
        showNotice,
        updateIncidentState,
        user?.id,
        user?.role,
        user?.userId,
        user?.username,
      ]
    );

  const handleAddIncident =
    async (
      newIncident
    ) => {
      if (isSuperAdmin) {
        return false;
      }

      const activeDeploymentForEmployee =
        deployments.find(
          (deployment) => {
            const deploymentEmployeeId =
              normalizeId(
                deployment.employeeId
              );

            const incidentEmployeeId =
              normalizeId(
                newIncident.employeeId
              );

            return (
              deploymentEmployeeId &&
              deploymentEmployeeId ===
                incidentEmployeeId
            );
          }
        );

      if (
        !activeDeploymentForEmployee
      ) {
        showNotice(
          "error",
          "Employee Not Deployed",
          "Incident reports can only be created for employees with an active deployment record."
        );

        return false;
      }

      const totalEmployeeCases =
        incidents.filter(
          (inc) =>
            String(
              inc.employeeId
            ) ===
            String(
              newIncident.employeeId
            )
        ).length;

      const escalatedIncident =
        {
          ...newIncident,

          company:
            activeDeploymentForEmployee.company ||
            newIncident.company ||
            "",

          severity:
            totalEmployeeCases >=
              4 &&
            newIncident.severity !==
              "Critical"
              ? "Critical"
              : newIncident.severity,

          status:
            "Open",
        };

      const normalizedIncident =
        normalizeIncidentWithRules(
          escalatedIncident,
          incidents
        );

      try {
        const response =
          await requestJson(
            INCIDENT_API_URL,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    employeeId:
                      normalizedIncident.employeeId,

                    employee:
                      normalizedIncident.employee,

                    employeeName:
                      normalizedIncident.employee,

                    company:
                      normalizedIncident.company,

                    violation:
                      normalizedIncident.violation,

                    violationType:
                      normalizedIncident.violation,

                    severity:
                      normalizedIncident.severity,

                    status:
                      "Open",

                    date:
                      normalizedIncident.date,

                    incidentDate:
                      normalizedIncident.date,

                    location:
                      normalizedIncident.location ||
                      "",

                    description:
                      normalizedIncident.description ||
                      "",

                    reportedBy:
                      actorFullName,

                    actionTaken:
                      normalizedIncident.sanction ||
                      "",

                    recommendation:
                      normalizedIncident.recommendation ||
                      "",

                    resolutionNotes:
                      "",

                    duplicateVerified:
                      Boolean(
                        normalizedIncident.duplicateVerified
                      ),

                    duplicateVerificationNote:
                      normalizedIncident.duplicateVerificationNote ||
                      "",

                    userId:
                      user?.userId ||
                      user?.id,

                    username:
                      user?.username,

                    fullName:
                      actorFullName,

                    role:
                      user?.role,
                  }
                ),
            }
          );

        await createOperationalLog(
          "CREATE_INCIDENT",
          `${actorFullName} created an incident report for employee ${normalizedIncident.employee}.`
        );

        setOpenAddModal(
          false
        );

        setCaseTab(
          "ACTIVE"
        );

        await fetchPageData({
          silent: true,
          showError: false,
        });

        emitDataUpdated(
          "CREATE_INCIDENT"
        );

        showNotice(
          "success",
          "Incident Report Saved",
          `Incident ${formatIncidentCode(
            response?.id ||
              response?.incidentId
          )} has been saved to the system.`
        );

        return true;
      } catch (error) {
        console.error(
          "Create incident error:",
          error
        );

        showNotice(
          "error",
          "Save Failed",
          error.message ||
            "Unable to save incident report."
        );

        return false;
      }
    };

  const handleConfirmStartInvestigation =
    async (incident) => {
      if (
        isSuperAdmin ||
        !incident
      ) {
        return false;
      }

      const updatedIncident =
        normalizeIncidentWithRules(
          {
            ...incident,

            status:
              "Investigating",

            investigation: {
              startedAt:
                new Date().toISOString(),

              startedById:
                currentUser.id,

              startedByName:
                actorFullName,

              startedByUsername:
                currentUser.username,

              startedByRole:
                currentUser.role,
            },
          },
          incidents
        );

      const success =
        await patchIncidentStatus(
          {
            incident,
            updatedIncident,

            payload: {
              status:
                "Investigating",

              workflowAction:
                "START_INVESTIGATION",

              resolutionNotes:
                "Investigation started.",
            },

            auditAction:
              "START_INVESTIGATION",

            auditDescription:
              `${actorFullName} started investigation for incident ${formatIncidentCode(
                incident.id
              )}.`,

            successTitle:
              "Investigation Started",

            successMessage:
              `Incident ${formatIncidentCode(
                incident.id
              )} is now marked as Investigating.`,
          }
        );

      if (success) {
        setConfirmStartIncident(
          null
        );

        setStartReviewIncident(
          null
        );
      }

      return success;
    };

  const handleSubmitResolution =
    async (
      incident,
      resolutionData
    ) => {
      if (isSuperAdmin) {
        return false;
      }

      const proofFiles =
        Array.isArray(
          resolutionData
            ?.proofFiles
        )
          ? resolutionData.proofFiles
          : [];

      const validFiles =
        proofFiles.filter(
          (item) =>
            item?.file instanceof
              File &&
            !item?.error
        );

      const formData =
        new FormData();

      formData.append(
        "status",
        "For Review"
      );

      formData.append(
        "workflowAction",
        "SUBMIT_RESOLUTION"
      );

      formData.append(
        "actionTaken",
        resolutionData.actionTaken
      );

      formData.append(
        "resolutionNotes",
        resolutionData.remarks
      );

      formData.append(
        "recommendation",
        incident.recommendation ||
          ""
      );

      formData.append(
        "userId",
        user?.userId ||
          user?.id ||
          ""
      );

      formData.append(
        "username",
        user?.username ||
          ""
      );

      formData.append(
        "fullName",
        actorFullName
      );

      formData.append(
        "role",
        user?.role ||
          ""
      );

      validFiles.forEach(
        (item) =>
          formData.append(
            "evidenceFiles",
            item.file,
            item.name
          )
      );

      const updatedIncident =
        normalizeIncidentWithRules(
          {
            ...incident,

            status:
              "For Review",

            resolution: {
              submittedAt:
                new Date().toISOString(),

              submittedById:
                currentUser.id,

              submittedByName:
                actorFullName,

              submittedByUsername:
                currentUser.username,

              submittedByRole:
                currentUser.role,

              actionTaken:
                resolutionData.actionTaken,

              remarks:
                resolutionData.remarks,

              proofFiles,
            },

            actionTaken:
              resolutionData.actionTaken,

            resolutionNotes:
              resolutionData.remarks,
          },
          incidents
        );

      const success =
        await patchIncidentStatus(
          {
            incident,
            updatedIncident,

            payload: {
              status:
                "For Review",

              workflowAction:
                "SUBMIT_RESOLUTION",

              actionTaken:
                resolutionData.actionTaken,

              resolutionNotes:
                resolutionData.remarks,

              recommendation:
                incident.recommendation ||
                "",
            },

            formData,

            auditAction:
              "SUBMIT_RESOLUTION",

            auditDescription:
              `${actorFullName} submitted proof for incident ${formatIncidentCode(
                incident.id
              )}.`,

            successTitle:
              "Submitted for Review",

            successMessage:
              `Proof for incident ${formatIncidentCode(
                incident.id
              )} has been submitted for authorized review.`,
          }
        );

      if (success) {
        setResolutionIncident(
          null
        );
      }

      return success;
    };

  const handleApproveCase =
    async (incident) => {
      if (
        !isAuthorizedReviewer ||
        !incident
      ) {
        showNotice(
          "error",
          "Review Access Required",
          "Only an HR Manager or Super Admin can approve and close submitted cases."
        );

        return false;
      }

      if (
        normalizeStatus(
          incident.status
        ) !== "For Review"
      ) {
        showNotice(
          "error",
          "Case Not Ready for Review",
          "Only cases currently marked For Review can be approved and closed."
        );

        return false;
      }

      const updatedIncident =
        normalizeIncidentWithRules(
          {
            ...incident,

            status:
              "Closed",

            review: {
              reviewedAt:
                new Date().toISOString(),

              reviewedById:
                currentUser.id,

              reviewedByName:
                actorFullName,

              reviewedByUsername:
                currentUser.username,

              reviewedByRole:
                currentUser.role,

              decision:
                "Approved",

              comments:
                "Proof reviewed and approved.",
            },
          },
          incidents
        );

      const success =
        await patchIncidentStatus(
          {
            incident,
            updatedIncident,

            payload: {
              status:
                "Closed",

              workflowAction:
                "CLOSE_INCIDENT",

              resolutionNotes:
                incident.resolutionNotes ||
                incident.resolution
                  ?.remarks ||
                "Proof reviewed and approved.",

              actionTaken:
                incident.actionTaken ||
                incident.resolution
                  ?.actionTaken ||
                incident.sanction ||
                "",

              recommendation:
                incident.recommendation ||
                "",
            },

            auditAction:
              "CLOSE_INCIDENT",

            auditDescription:
              `${actorFullName} approved and closed incident ${formatIncidentCode(
                incident.id
              )}.`,

            successTitle:
              "Case Approved",

            successMessage:
              `Incident ${formatIncidentCode(
                incident.id
              )} has been approved and closed successfully.`,
          }
        );

      if (success) {
        setReviewIncident(
          null
        );

        setCaseTab(
          "CLOSED"
        );
      }

      return success;
    };

  const handleRejectCase =
    async (
      incident,
      comments
    ) => {
      if (
        !isAuthorizedReviewer ||
        !incident
      ) {
        showNotice(
          "error",
          "Review Access Required",
          "Only an HR Manager or Super Admin can return submitted cases for correction."
        );

        return false;
      }

      if (
        normalizeStatus(
          incident.status
        ) !== "For Review"
      ) {
        showNotice(
          "error",
          "Case Not Ready for Review",
          "Only cases currently marked For Review can be returned for correction."
        );

        return false;
      }

      const updatedIncident =
        normalizeIncidentWithRules(
          {
            ...incident,

            status:
              "Investigating",

            review: {
              reviewedAt:
                new Date().toISOString(),

              reviewedById:
                currentUser.id,

              reviewedByName:
                actorFullName,

              reviewedByUsername:
                currentUser.username,

              reviewedByRole:
                currentUser.role,

              decision:
                "Rejected",

              comments,
            },
          },
          incidents
        );

      const success =
        await patchIncidentStatus(
          {
            incident,
            updatedIncident,

            payload: {
              status:
                "Investigating",

              workflowAction:
                "RETURN_INCIDENT",

              resolutionNotes:
                comments,

              actionTaken:
                incident.actionTaken ||
                incident.sanction ||
                "",

              recommendation:
                incident.recommendation ||
                "",
            },

            auditAction:
              "RETURN_INCIDENT",

            auditDescription:
              `${actorFullName} returned incident ${formatIncidentCode(
                incident.id
              )} for correction.`,

            successTitle:
              "Case Returned",

            successMessage:
              `Incident ${formatIncidentCode(
                incident.id
              )} has been returned for correction.`,
          }
        );

      if (success) {
        setReviewIncident(
          null
        );

        setCaseTab(
          "ACTIVE"
        );
      }

      return success;
    };

  const handleRefresh =
    useCallback(
      async () => {
        if (isRefreshing) {
          return;
        }

        await fetchPageData({
          silent: true,
          showError: true,
          showRefreshing: true,
        });
      },
      [
        fetchPageData,
        isRefreshing,
      ]
    );

  const handleClearIncidentFilters =
    useCallback(() => {
      setSearch("");
      setSeverityFilter(
        "ALL"
      );
      setCaseTab("ALL");
    }, []);

  const filteredIncidents =
    useMemo(() => {
      const normalizedSearch =
        normalizeName(search);

      const searchTerms =
        normalizedSearch
          ? normalizedSearch.split(
              /\s+/
            )
          : [];

      return incidents.filter(
        (incident) => {
          const status =
            normalizeStatus(
              incident.status
            );

          const matchesCaseTab =
            caseTab ===
              "ALL" ||
            (caseTab ===
              "ACTIVE" &&
              [
                "Open",
                "Investigating",
              ].includes(
                status
              )) ||
            (caseTab ===
              "FOR_REVIEW" &&
              status ===
                "For Review") ||
            (caseTab ===
              "CLOSED" &&
              status ===
                "Closed");

          const searchableText =
            normalizeName(
              [
                incident.displayId,
                incident.id,
                incident.employeeId,
                incident.employee,
                incident.employeeName,
                incident.violation,
                incident.violationType,
                incident.company,
                incident.location,
                incident.severity,
                incident.status,
                incident.sanction,
                incident.actionTaken,
                incident.recommendation,
                incident.description,
                incident.reportedBy,
                incident.reportedByName,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
            );

          const matchesSearch =
            searchTerms.length ===
              0 ||
            searchTerms.every(
              (term) =>
                searchableText.includes(
                  term
                )
            );

          const matchesSeverity =
            severityFilter ===
              "ALL" ||
            String(
              incident.severity ||
                ""
            )
              .trim()
              .toLowerCase() ===
              String(
                severityFilter
              )
                .trim()
                .toLowerCase();

          return (
            matchesCaseTab &&
            matchesSearch &&
            matchesSeverity
          );
        }
      );
    }, [
      incidents,
      search,
      caseTab,
      severityFilter,
    ]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Incident Reports
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAuthorizedReviewer
              ? "Manage incident investigations and review submitted proof when authorized."
              : "Review reported cases, start investigations, and submit proof for review."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            leftIcon={
              <FiRefreshCw
                aria-hidden="true"
                className={
                  isRefreshing
                    ? "animate-spin"
                    : ""
                }
              />
            }
            loading={
              isRefreshing
            }
            disabled={
              isLoading ||
              isRefreshing
            }
            onClick={
              handleRefresh
            }
          >
            Refresh
          </Button>

          {!isSuperAdmin && (
            <RoleGuard
              permission={
                PERMISSIONS.CAN_ADD_INCIDENT
              }
            >
              <Button
                type="button"
                variant="danger"
                leftIcon={
                  <FiPlus
                    aria-hidden="true"
                  />
                }
                disabled={
                  isLoading ||
                  isRefreshing
                }
                onClick={() =>
                  setOpenAddModal(
                    true
                  )
                }
              >
                Add Incident Report
              </Button>
            </RoleGuard>
          )}
        </div>
      </div>

      {fetchError && (
        <ErrorState
          compact
          title="Incident data error"
          message={
            fetchError
          }
          retryLabel="Reload incident records"
          onRetry={
            handleRefresh
          }
        />
      )}

      <div className="min-w-0">
        <IncidentTable
          isLoading={
            isLoading
          }
          isRefreshing={
            isRefreshing
          }
          incidents={
            filteredIncidents
          }
          totalIncidentCount={
            incidents.length
          }
          search={search}
          onSearchChange={
            setSearch
          }
          onClearSearch={() =>
            setSearch("")
          }
          onClearFilters={
            handleClearIncidentFilters
          }
          caseTab={
            caseTab
          }
          onCaseTabChange={
            setCaseTab
          }
          caseCounts={
            incidentCaseCounts
          }
          severityFilter={
            severityFilter
          }
          onSeverityFilterChange={
            setSeverityFilter
          }
          isSuperAdmin={
            isSuperAdmin
          }
          currentUser={
            currentUser
          }
          formatIncidentCode={
            formatIncidentCode
          }
          onView={
            setSelectedIncident
          }
          onStartReview={
            setStartReviewIncident
          }
          onResolve={
            setResolutionIncident
          }
          onReview={
            setReviewIncident
          }
        />
      </div>

      {selectedIncident && (
        <ViewIncidentModal
          incident={
            selectedIncident
          }
          onClose={() =>
            setSelectedIncident(
              null
            )
          }
        />
      )}

      {startReviewIncident && (
        <ViewIncidentModal
          incident={
            startReviewIncident
          }
          mode="start-review"
          onClose={() =>
            setStartReviewIncident(
              null
            )
          }
          onRequestStart={
            setConfirmStartIncident
          }
        />
      )}

      {confirmStartIncident && (
        <ConfirmStartInvestigationModal
          incident={
            confirmStartIncident
          }
          currentUser={
            currentUser
          }
          onClose={() =>
            setConfirmStartIncident(
              null
            )
          }
          onConfirm={
            handleConfirmStartInvestigation
          }
        />
      )}

      {resolutionIncident && (
        <ResolutionModal
          incident={
            resolutionIncident
          }
          onClose={() =>
            setResolutionIncident(
              null
            )
          }
          onSubmit={
            handleSubmitResolution
          }
          showNotice={
            showNotice
          }
        />
      )}

      {reviewIncident && (
        <ReviewCaseModal
          incident={
            reviewIncident
          }
          onClose={() =>
            setReviewIncident(
              null
            )
          }
          onApprove={
            handleApproveCase
          }
          onReject={
            handleRejectCase
          }
          showNotice={
            showNotice
          }
        />
      )}

      <AddIncidentModal
        isOpen={
          openAddModal
        }
        onClose={() =>
          setOpenAddModal(
            false
          )
        }
        onSave={
          handleAddIncident
        }
        employees={
          activeEmployees
        }
        deployments={
          deployments
        }
        existingIncidents={
          incidents
        }
      />

      {notice && (
        <NoticeModal
          type={
            notice.type
          }
          title={
            notice.title
          }
          message={
            notice.message
          }
          onClose={() =>
            setNotice(null)
          }
        />
      )}
    </div>
  );
}