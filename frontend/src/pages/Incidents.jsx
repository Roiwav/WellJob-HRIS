import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  FiAlertTriangle,
  FiDownload,
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";
import RoleGuard from "../components/auth/RoleGuard";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
import { PERMISSIONS } from "../constants/permissions";
import { useAuth } from "../context/useAuth";
import authenticatedFetch from "../utils/authenticatedFetch";
import { API_BASE } from "../config/api";
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
import {
  normalizeEvidenceFiles,
} from "../utils/incidents/evidenceFiles";

import {
  mergeIncidentDirectUploads,
  prepareIncidentWorkflowDirectUploads,
} from "../utils/incidents/incidentDirectUpload";
import {
  canUserStartInvestigation,
  canUserSubmitInvestigationProof,
} from "../utils/incidents/investigationEligibility";
import {
  exportIncidentReportPDF,
} from "../utils/incidents/incidentPdfExport";
const INCIDENT_API_URL =
  `${API_BASE}/incidents`;
const DATA_EVENT_SOURCE =
  "incidents-page";
const REQUEST_TIMEOUT_MS =
  15000;
const PASSIVE_REFRESH_DEBOUNCE_MS =
  150;
const INCIDENT_SEARCH_DEBOUNCE_MS =
  300;
const INCIDENT_PAGE_SIZE =
  25;
const EMPTY_CASE_COUNTS = {
  ALL: 0,
  ACTIVE: 0,
  FOR_REVIEW: 0,
  CLOSED: 0,
};
const DEFAULT_PAGINATION = {
  page: 1,
  pageSize:
    INCIDENT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};
const INCIDENT_PAGE_DATA_DOMAINS =
  new Set([
    "incident",
    "incidents",
    "employee",
    "employees",
    "deployment",
    "deployments",
    "dashboard",
  ]);
function emitDataUpdated(
  action = "INCIDENTS_UPDATED"
) {
  window.dispatchEvent(
    new CustomEvent(
      "dataUpdated",
      {
        detail: {
          source:
            DATA_EVENT_SOURCE,
          domain:
            "incidents",
          action,
          at:
            Date.now(),
        },
      }
    )
  );
}
function normalizeDataDomain(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}
function shouldRefreshForDataUpdated(
  event
) {
  const domain =
    normalizeDataDomain(
      event?.detail?.domain
    );
  if (!domain) {
    return true;
  }
  return (
    INCIDENT_PAGE_DATA_DOMAINS.has(
      domain
    )
  );
}
function formatIncidentCode(
  id
) {
  if (!id) {
    return "-";
  }
  const value =
    String(id);
  if (
    value.startsWith(
      "INC-"
    )
  ) {
    return value;
  }
  const numeric =
    Number(value);
  if (
    Number.isNaN(
      numeric
    )
  ) {
    return value;
  }
  return `INC-${String(
    numeric
  ).padStart(
    4,
    "0"
  )}`;
}
function normalizeIncidentLookupId(
  value
) {
  const raw =
    String(
      value || ""
    ).trim();
  if (!raw) {
    return "";
  }
  const incidentCodeMatch =
    raw.match(
      /^INC-(\d+)$/i
    );
  if (
    incidentCodeMatch
  ) {
    return String(
      Number(
        incidentCodeMatch[1]
      )
    );
  }
  return raw;
}
function normalizeRole(
  value
) {
  const role =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );
  if (
    [
      "SUPERADMIN",
      "SUPER_ADMIN",
      "ADMIN",
    ].includes(
      role
    )
  ) {
    return "SUPER_ADMIN";
  }
  if (
    [
      "HRMANAGER",
      "HR_MANAGER",
    ].includes(
      role
    )
  ) {
    return "HR_MANAGER";
  }
  if (
    [
      "HRSTAFF",
      "HR_STAFF",
    ].includes(
      role
    )
  ) {
    return "HR_STAFF";
  }
  if (
    [
      "HRCOORDINATOR",
      "HR_COORDINATOR",
    ].includes(
      role
    )
  ) {
    return "HR_COORDINATOR";
  }
  return role;
}
function normalizeTimelineEvent(
  event = {}
) {
  const createdAtTimestamp =
    event.createdAtTimestamp ??
    event.created_at_timestamp ??
    event.timestamp ??
    null;

  const createdAt =
    createdAtTimestamp ||
    event.createdAt ||
    event.created_at ||
    event.date ||
    null;

  return {
    id:
      event.id ||
      `${
        event.actionType ||
        event.action_type ||
        "event"
      }-${createdAt}`,
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
    created_at:
      createdAt,

    /*
     * Preserve the database epoch supplied by the
     * backend. CaseTimeline prefers this absolute
     * timestamp so browser/device timezone parsing
     * cannot shift the event time.
     */
    createdAtTimestamp:
      createdAtTimestamp,

    created_at_timestamp:
      createdAtTimestamp,
  };
}
function normalizeBackendIncident(
  incident = {}
) {
  const incidentId =
    incident.id;
  const rawInitialNte =
    incident.initialNte ||
    incident.initial_nte ||
    null;
  const initialNte =
    rawInitialNte
      ? normalizeEvidenceFiles({
          incidentId,
          proofFiles: [
            rawInitialNte,
          ],
        })[0] || null
      : null;
  const reportedBy =
    incident.reportedByName ||
    incident.reported_by_name ||
    incident.reportedBy ||
    incident.reported_by ||
    "Unknown";

  const createdAtTimestamp =
    incident.createdAtTimestamp ??
    incident.created_at_timestamp ??
    null;

  const investigationStartedAtTimestamp =
    incident.investigationStartedAtTimestamp ??
    incident.investigation_started_at_timestamp ??
    null;

  const resolutionSubmittedAtTimestamp =
    incident.resolutionSubmittedAtTimestamp ??
    incident.resolution_submitted_at_timestamp ??
    null;

  const reviewedAtTimestamp =
    incident.reviewedAtTimestamp ??
    incident.reviewed_at_timestamp ??
    null;

  const investigationStartedAt =
    investigationStartedAtTimestamp ||
    incident.investigationStartedAt ||
    incident.investigation_started_at ||
    null;

  const resolutionSubmittedAt =
    resolutionSubmittedAtTimestamp ||
    incident.resolutionSubmittedAt ||
    incident.resolution_submitted_at ||
    null;

  const reviewedAt =
    reviewedAtTimestamp ||
    incident.reviewedAt ||
    incident.reviewed_at ||
    null;
  const policySanction =
    incident.policySanction ||
    incident.policy_sanction ||
    incident.sanction ||
    "";
  const actionTaken =
    incident.actionTaken ||
    incident.action_taken ||
    incident.resolution
      ?.actionTaken ||
    incident.resolution
      ?.action_taken ||
    "";
  const timelineEvents =
    Array.isArray(
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
          actionTaken,
          remarks:
            incident.resolutionNotes ||
            incident.resolution_notes ||
            incident.resolution
              ?.remarks ||
            "",
          proofFiles:
            normalizeEvidenceFiles({
              incidentId,
              proofFiles:
                incident.proofFiles ||
                incident.proof_files ||
                incident.evidenceFiles ||
                incident.evidence_files ||
                incident.evidence ||
                incident.attachments ||
                incident.resolution
                  ?.proofFiles,
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
    id:
      incidentId,
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
      null,

    incidentDate:
      incident.incidentDate ||
      incident.date ||
      incident.incident_date ||
      incident.createdAt ||
      incident.created_at ||
      null,
    reportedAt:
      createdAtTimestamp ||
      incident.reportedAt ||
      incident.reported_at ||
      incident.createdAt ||
      incident.created_at ||
      incident.date ||
      null,

    createdAtTimestamp,
    created_at_timestamp:
      createdAtTimestamp,
    reportedBy,
    reportedByName:
      reportedBy,
    reportCreatorId:
      incident.reportCreatorId ||
      incident.report_creator_id ||
      null,
    report_creator_id:
      incident.report_creator_id ||
      incident.reportCreatorId ||
      null,
    reportCreatorRole:
      incident.reportCreatorRole ||
      incident.report_creator_role ||
      "",
    report_creator_role:
      incident.report_creator_role ||
      incident.reportCreatorRole ||
      "",
    reportingPath:
      incident.reportingPath ||
      incident.reporting_path ||
      "UNKNOWN",
    reporting_path:
      incident.reporting_path ||
      incident.reportingPath ||
      "UNKNOWN",
    initialNte,
    initial_nte:
      initialNte,
    investigation,
    resolution,
    review,
    investigationStartedAt,
    investigation_started_at:
      investigationStartedAt,

    investigationStartedAtTimestamp,
    investigation_started_at_timestamp:
      investigationStartedAtTimestamp,

    investigationStartedByName:
      investigation
        ?.startedByName ||
      "",
    investigation_started_by_name:
      investigation
        ?.startedByName ||
      "",
    resolutionSubmittedAt,
    resolution_submitted_at:
      resolutionSubmittedAt,

    resolutionSubmittedAtTimestamp,
    resolution_submitted_at_timestamp:
      resolutionSubmittedAtTimestamp,

    resolutionSubmittedByName:
      resolution
        ?.submittedByName ||
      "",
    resolution_submitted_by_name:
      resolution
        ?.submittedByName ||
      "",
    reviewedAt,
    reviewed_at:
      reviewedAt,

    reviewedAtTimestamp,
    reviewed_at_timestamp:
      reviewedAtTimestamp,

    reviewedByName:
      review
        ?.reviewedByName ||
      "",
    reviewed_by_name:
      review
        ?.reviewedByName ||
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
    policySanction,
    policy_sanction:
      policySanction,
    sanction:
      policySanction,
    actionTaken,
    action_taken:
      actionTaken,
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
function buildCaseCounts(
  incidents = []
) {
  return incidents.reduce(
    (
      counts,
      incident
    ) => {
      const status =
        normalizeStatus(
          incident.status
        );
      counts.ALL +=
        1;
      if (
        [
          "Open",
          "Investigating",
        ].includes(
          status
        )
      ) {
        counts.ACTIVE +=
          1;
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
        counts.CLOSED +=
          1;
      }
      return counts;
    },
    {
      ...EMPTY_CASE_COUNTS,
    }
  );
}
function normalizeCaseCounts(
  value,
  fallbackIncidents = []
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return buildCaseCounts(
      fallbackIncidents
    );
  }
  return {
    ALL:
      Number(
        value.ALL ??
        value.all ??
        0
      ) || 0,
    ACTIVE:
      Number(
        value.ACTIVE ??
        value.active ??
        0
      ) || 0,
    FOR_REVIEW:
      Number(
        value.FOR_REVIEW ??
        value.forReview ??
        value.for_review ??
        0
      ) || 0,
    CLOSED:
      Number(
        value.CLOSED ??
        value.closed ??
        0
      ) || 0,
  };
}
function normalizePagination(
  value,
  fallbackTotal = 0
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {
      ...DEFAULT_PAGINATION,
      total:
        fallbackTotal,
    };
  }
  const page =
    Math.max(
      1,
      Number(
        value.page
      ) || 1
    );
  const pageSize =
    Math.max(
      1,
      Number(
        value.pageSize ??
        value.page_size
      ) ||
        INCIDENT_PAGE_SIZE
    );
  const total =
    Math.max(
      0,
      Number(
        value.total
      ) || 0
    );
  const totalPages =
    Math.max(
      1,
      Number(
        value.totalPages ??
        value.total_pages
      ) ||
        Math.ceil(
          total /
            pageSize
        ) ||
        1
    );
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage:
      Boolean(
        value.hasPreviousPage ??
        value.has_previous_page ??
        page > 1
      ),
    hasNextPage:
      Boolean(
        value.hasNextPage ??
        value.has_next_page ??
        page < totalPages
      ),
  };
}
async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();
  const timeoutId =
    window.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS
    );
  try {
    const response =
      await authenticatedFetch(
        url,
        {
          ...options,
          signal:
            controller.signal,
          headers: {
            Accept:
              "application/json",
            ...(options.headers ||
              {}),
          },
        }
      );
    const data =
      await response
        .json()
        .catch(
          () => null
        );
    if (
      !response.ok
    ) {
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
  const {
    user,
  } = useAuth();
  const currentUser =
    getUserIdentity(
      user
    );
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
  const isHrCoordinator =
    currentRole ===
    "HR_COORDINATOR";
  const canCreateIncident =
    isHrManager ||
    isHrCoordinator;
  const canInvestigate =
    isHrManager ||
    isHrCoordinator;
  const isAuthorizedReviewer =
    isSuperAdmin ||
    isHrManager;
  const canExportIncidentReport =
    isSuperAdmin ||
    isHrManager ||
    isHrCoordinator;
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
  const modalOpenRequestIdRef =
    useRef(0);
  const hasCompletedInitialLoadRef =
    useRef(false);
  const [
    incidents,
    setIncidents,
  ] =
    useState([]);
  const [
    incidentCaseCounts,
    setIncidentCaseCounts,
  ] =
    useState({
      ...EMPTY_CASE_COUNTS,
    });
  const [
    currentPage,
    setCurrentPage,
  ] =
    useState(1);
  const [
    pagination,
    setPagination,
  ] =
    useState({
      ...DEFAULT_PAGINATION,
    });
  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);
  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);
  const [
    isExporting,
    setIsExporting,
  ] = useState(false);
  const [
    fetchError,
    setFetchError,
  ] =
    useState("");
  const [
    openAddModal,
    setOpenAddModal,
  ] =
    useState(false);
  const [
    selectedIncident,
    setSelectedIncident,
  ] =
    useState(null);
  const [
    startReviewIncident,
    setStartReviewIncident,
  ] =
    useState(null);
  const [
    confirmStartIncident,
    setConfirmStartIncident,
  ] =
    useState(null);
  const [
    resolutionIncident,
    setResolutionIncident,
  ] =
    useState(null);
  const [
    reviewIncident,
    setReviewIncident,
  ] =
    useState(null);
  const [
    search,
    setSearch,
  ] =
    useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] =
    useState("");
  const [
    caseTab,
    setCaseTab,
  ] =
    useState(
      isAuthorizedReviewer
        ? "FOR_REVIEW"
        : "ACTIVE"
    );
  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState(
      "ALL"
    );
  const [
    violationFilter,
    setViolationFilter,
  ] =
    useState(
      "ALL"
    );
  const [
    monthFilter,
    setMonthFilter,
  ] =
    useState(
      "ALL"
    );
  const [
    yearFilter,
    setYearFilter,
  ] =
    useState(
      "ALL"
    );
  const [
    availableYears,
    setAvailableYears,
  ] =
    useState([]);
  const [
    caseStatusFilter,
    setCaseStatusFilter,
  ] =
    useState(
      "ALL"
    );
  const [
    notice,
    setNotice,
  ] =
    useState(null);
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
  const closeAllIncidentModals =
    useCallback(
      () => {
        /*
         * Invalidate any Incident detail request that is still in flight.
         * This prevents a late async response from reopening a modal after
         * the user already clicked Close, pressed Escape, or dismissed it.
         */
        modalOpenRequestIdRef.current +=
          1;
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
      },
      []
    );
  const handleRequestStartConfirmation =
    useCallback(
      (
        incident
      ) => {
        /*
         * Transition from the review modal to the confirmation modal.
         * Clear the previous modal first so two Incident modals are never
         * mounted at the same time.
         */
        modalOpenRequestIdRef.current +=
          1;
        setSelectedIncident(
          null
        );
        setStartReviewIncident(
          null
        );
        setResolutionIncident(
          null
        );
        setReviewIncident(
          null
        );
        setConfirmStartIncident(
          incident || null
        );
      },
      []
    );
  const handleOpenAddIncidentModal =
    useCallback(
      () => {
        closeAllIncidentModals();
        setOpenAddModal(
          true
        );
      },
      [
        closeAllIncidentModals,
      ]
    );
  const handleCloseAddIncidentModal =
    useCallback(
      () => {
        setOpenAddModal(
          false
        );
      },
      []
    );
  const fetchPageData =
    useCallback(
      async ({
        silent = false,
        showError = true,
        showRefreshing = false,
        passive = false,
        page =
          currentPage,
        searchValue =
          debouncedSearch,
        caseTabValue =
          caseTab,
        severityValue =
          severityFilter,
        violationValue =
          violationFilter,
        monthValue =
          monthFilter,
        yearValue =
          yearFilter,
        caseStatusValue =
          caseStatusFilter,
      } = {}) => {
        if (
          passive &&
          activePageRequestsRef
            .current >
            0
        ) {
          return false;
        }
        const requestId =
          fetchRequestIdRef
            .current +
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
            setIsLoading(
              true
            );
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
            setFetchError(
              ""
            );
          }
          const params =
            new URLSearchParams();
          params.set(
            "view",
            "summary"
          );
          params.set(
            "page",
            String(
              Math.max(
                1,
                Number(page) ||
                  1
              )
            )
          );
          params.set(
            "pageSize",
            String(
              INCIDENT_PAGE_SIZE
            )
          );
          const trimmedSearch =
            String(
              searchValue ||
              ""
            ).trim();
          if (
            trimmedSearch
          ) {
            params.set(
              "search",
              trimmedSearch
            );
          }
          const normalizedCaseTab =
            String(
              caseTabValue ||
              "ALL"
            )
              .trim()
              .toUpperCase();
          if (
            normalizedCaseTab &&
            normalizedCaseTab !==
              "ALL"
          ) {
            params.set(
              "caseTab",
              normalizedCaseTab
            );
          }
          const normalizedSeverity =
            String(
              severityValue ||
              "ALL"
            ).trim();
          if (
            normalizedSeverity &&
            normalizedSeverity.toUpperCase() !==
              "ALL"
          ) {
            params.set(
              "severity",
              normalizedSeverity
            );
          }

          const normalizedViolation =
            String(
              violationValue ||
              "ALL"
            ).trim();

          if (
            normalizedViolation &&
            normalizedViolation.toUpperCase() !==
              "ALL"
          ) {
            params.set(
              "violationType",
              normalizedViolation
            );
          }

          const normalizedMonth =
            String(
              monthValue ||
              "ALL"
            ).trim();

          if (
            normalizedMonth &&
            normalizedMonth.toUpperCase() !==
              "ALL"
          ) {
            params.set(
              "month",
              normalizedMonth
            );
          }

          const normalizedYear =
            String(
              yearValue ||
              "ALL"
            ).trim();

          if (
            normalizedYear &&
            normalizedYear.toUpperCase() !==
              "ALL"
          ) {
            params.set(
              "year",
              normalizedYear
            );
          }

          const normalizedCaseStatus =
            normalizeStatus(
              caseStatusValue ||
              ""
            );

          if (
            normalizedCaseTab ===
              "ALL" &&
            String(
              caseStatusValue ||
              ""
            )
              .trim()
              .toUpperCase() !==
              "ALL" &&
            normalizedCaseStatus
          ) {
            params.set(
              "status",
              normalizedCaseStatus
            );
          }

          const incidentData =
            await requestJson(
              `${INCIDENT_API_URL}?${params.toString()}`
            );
          if (
            !isMountedRef.current ||
            requestId !==
              fetchRequestIdRef.current
          ) {
            return false;
          }
          const rawIncidents =
            Array.isArray(
              incidentData
            )
              ? incidentData
              : Array.isArray(
                  incidentData
                    ?.incidents
                )
                ? incidentData
                    .incidents
                : [];
          const backendIncidents =
            buildIncidentList(
              rawIncidents
            );
          const nextPagination =
            normalizePagination(
              Array.isArray(
                incidentData
              )
                ? null
                : incidentData
                    ?.pagination,
              backendIncidents.length
            );
          const nextCaseCounts =
            normalizeCaseCounts(
              Array.isArray(
                incidentData
              )
                ? null
                : incidentData
                    ?.caseCounts,
              backendIncidents
            );
          setIncidents(
            backendIncidents
          );
          setPagination(
            nextPagination
          );
          setIncidentCaseCounts(
            nextCaseCounts
          );

          setAvailableYears(
            Array.isArray(
              incidentData?.filterMeta
                ?.years
            )
              ? incidentData.filterMeta.years
                  .map(
                    (year) =>
                      Number(
                        year
                      )
                  )
                  .filter(
                    Number.isInteger
                  )
              : []
          );

          setCurrentPage(
            (
              previousPage
            ) =>
              previousPage ===
              nextPagination.page
                ? previousPage
                : nextPagination.page
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
              "Unable to load incident records."
            );
          }
          return false;
        } finally {
          activePageRequestsRef.current =
            Math.max(
              0,
              activePageRequestsRef
                .current -
                1
            );
          if (
            isMountedRef.current &&
            requestId ===
              fetchRequestIdRef.current
          ) {
            if (
              !silent
            ) {
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
      [
        caseStatusFilter,
        caseTab,
        currentPage,
        debouncedSearch,
        severityFilter,
        violationFilter,
        monthFilter,
        yearFilter,
      ]
    );
  const loadIncidentDetails =
    useCallback(
      async (
        incident
      ) => {
        if (
          !incident?.id
        ) {
          throw new Error(
            "Incident ID is unavailable."
          );
        }
        const incidentData =
          await requestJson(
            `${INCIDENT_API_URL}/${incident.id}`
          );
        const normalizedIncident =
          normalizeBackendIncident(
            incidentData || {}
          );
        const employeeId =
          normalizedIncident
            .employeeId;
        let historyContext =
          [
            normalizedIncident,
          ];
        if (
          employeeId
        ) {
          try {
            const employeeHistory =
              await requestJson(
                `${INCIDENT_API_URL}/employee/${encodeURIComponent(
                  employeeId
                )}`
              );
            if (
              Array.isArray(
                employeeHistory
              )
            ) {
              historyContext =
                employeeHistory.map(
                  normalizeBackendIncident
                );
            }
          } catch (
            historyError
          ) {
            console.warn(
              "Unable to load complete employee incident history for detail enrichment:",
              historyError
            );
          }
        }
        return normalizeIncidentWithRules(
          normalizedIncident,
          historyContext
        );
      },
      []
    );
  const openIncidentAction =
    useCallback(
      async (
        incident,
        requestedAction = "view"
      ) => {
        const openRequestId =
          modalOpenRequestIdRef.current +
          1;
        modalOpenRequestIdRef.current =
          openRequestId;
        try {
          const fullIncident =
            await loadIncidentDetails(
              incident
            );
          if (
            !isMountedRef.current ||
            openRequestId !==
              modalOpenRequestIdRef.current
          ) {
            return false;
          }
          const currentStatus =
            normalizeStatus(
              fullIncident.status
            );

          /*
           * Keep the Incident workflow modal stack exclusive:
           * one workflow modal at a time.
           */
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
            setCurrentPage(
              1
            );
            setReviewIncident(
              fullIncident
            );
          } else if (
            requestedAction ===
              "submit-resolution" &&
            currentStatus ===
              "Investigating" &&
            canUserSubmitInvestigationProof(
              fullIncident,
              currentUser
            )
          ) {
            setCaseTab(
              "ACTIVE"
            );
            setCurrentPage(
              1
            );
            setResolutionIncident(
              fullIncident
            );
          } else if (
            requestedAction ===
              "start-investigation" &&
            currentStatus ===
              "Open" &&
            canUserStartInvestigation(
              fullIncident,
              currentUser
            )
          ) {
            setCaseTab(
              "ACTIVE"
            );
            setCurrentPage(
              1
            );
            setStartReviewIncident(
              fullIncident
            );
          } else {
            setSelectedIncident(
              fullIncident
            );
          }
          return true;
        } catch (error) {
          if (
            openRequestId !==
              modalOpenRequestIdRef.current
          ) {
            return false;
          }
          console.error(
            "Load incident detail error:",
            error
          );
          showNotice(
            "error",
            "Unable to Open Incident",
            error?.message ||
              "The complete incident record could not be loaded."
          );
          return false;
        }
      },
      [
        currentUser,
        isAuthorizedReviewer,
        loadIncidentDetails,
        showNotice,
      ]
    );
  const handleViewIncident =
    useCallback(
      (
        incident
      ) =>
        openIncidentAction(
          incident,
          "view"
        ),
      [
        openIncidentAction,
      ]
    );
  const handleStartReviewIncident =
    useCallback(
      (
        incident
      ) =>
        openIncidentAction(
          incident,
          "start-investigation"
        ),
      [
        openIncidentAction,
      ]
    );
  const handleResolveIncident =
    useCallback(
      (
        incident
      ) =>
        openIncidentAction(
          incident,
          "submit-resolution"
        ),
      [
        openIncidentAction,
      ]
    );
  const handleReviewIncident =
    useCallback(
      (
        incident
      ) =>
        openIncidentAction(
          incident,
          "review"
        ),
      [
        openIncidentAction,
      ]
    );
  useEffect(
    () => {
      isMountedRef.current =
        true;
      return () => {
        isMountedRef.current =
          false;
        fetchRequestIdRef.current +=
          1;
      };
    },
    []
  );
  useEffect(
    () => {
      const trimmedSearch =
        String(
          search || ""
        ).trim();
      const timerId =
        window.setTimeout(
          () => {
            setDebouncedSearch(
              trimmedSearch
            );
          },
          trimmedSearch
            ? INCIDENT_SEARCH_DEBOUNCE_MS
            : 0
        );
      return () => {
        window.clearTimeout(
          timerId
        );
      };
    },
    [
      search,
    ]
  );
  useEffect(
    () => {
      let cancelled =
        false;
      const shouldBlockPage =
        !hasCompletedInitialLoadRef.current;
      void fetchPageData({
        silent:
          !shouldBlockPage,
      }).finally(() => {
        if (
          !cancelled &&
          isMountedRef.current
        ) {
          hasCompletedInitialLoadRef.current =
            true;
        }
      });
      return () => {
        cancelled =
          true;
      };
    },
    [
      fetchPageData,
    ]
  );
  useEffect(
    () => {
      let refreshTimer =
        null;
      const refreshSilently =
        () => {
          if (
            refreshTimer
          ) {
            clearTimeout(
              refreshTimer
            );
          }
          refreshTimer =
            setTimeout(
              () => {
                fetchPageData({
                  silent:
                    true,
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
        (
          event
        ) => {
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
        if (
          refreshTimer
        ) {
          clearTimeout(
            refreshTimer
          );
        }
        window.removeEventListener(
          "dataUpdated",
          handleDataUpdated
        );
      };
    },
    [
      fetchPageData,
    ]
  );
  useEffect(
    () => {
      const navigationState =
        location.state;

      if (
        !navigationState
          ?.incidentId
      ) {
        return undefined;
      }

      const targetId =
        normalizeIncidentLookupId(
          navigationState
            .incidentId
        );
      const requestedAction =
        String(
          navigationState
            .action ||
          "view"
        )
          .trim()
          .toLowerCase();

      /*
       * Consume the navigation request immediately.
       * Waiting until after the async detail request can cause the same
       * location.state action to fire more than once in development/Strict
       * Mode or during rerenders, which can reopen a modal after closing it.
       */
      navigate(
        location.pathname,
        {
          replace:
            true,
          state:
            {},
        }
      );

      if (
        !targetId
      ) {
        return undefined;
      }

      void openIncidentAction(
        {
          id:
            targetId,
          displayId:
            formatIncidentCode(
              targetId
            ),
        },
        requestedAction
      );

      return undefined;
    },
    [
      location.pathname,
      location.state,
      navigate,
      openIncidentAction,
    ]
  );
  const syncModalIncident =
    useCallback(
      (
        updatedIncident
      ) => {
        const updateIfSelected =
          (
            setter
          ) => {
            setter(
              (
                current
              ) => {
                if (
                  !current
                ) {
                  return current;
                }
                return (
                  String(
                    current.id
                  ) ===
                  String(
                    updatedIncident.id
                  )
                    ? updatedIncident
                    : current
                );
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
          (
            previous
          ) => {
            const nextRaw =
              previous.map(
                (
                  incident
                ) =>
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
              (
                incident
              ) =>
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
      [
        syncModalIncident,
      ]
    );
  const patchIncidentStatus =
    useCallback(
      async ({
        incident,
        updatedIncident,
        payload,
        auditAction,
        successTitle,
        successMessage,
        formData,
      }) => {
        const workflowAction =
          String(
            payload?.workflowAction ||
              ""
          )
            .trim()
            .toUpperCase();
        const investigatorActions =
          new Set([
            "START_INVESTIGATION",
            "SUBMIT_RESOLUTION",
            "SUBMIT_INVESTIGATION",
          ]);
        const reviewerActions =
          new Set([
            "CLOSE_INCIDENT",
            "RETURN_INCIDENT",
          ]);
        if (
          investigatorActions.has(
            workflowAction
          ) &&
          !canInvestigate
        ) {
          showNotice(
            "error",
            "Investigation Access Required",
            "Only eligible HR Manager or HR Coordinator accounts can investigate incidents or submit investigation proof."
          );
          return false;
        }
        if (
          reviewerActions.has(
            workflowAction
          ) &&
          !isAuthorizedReviewer
        ) {
          showNotice(
            "error",
            "Review Access Required",
            "Only HR Manager or Super Admin accounts can review submitted incident cases."
          );
          return false;
        }
        if (
          normalizeStatus(
            incident.status
          ) ===
          "Closed"
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
          await fetchPageData({
            silent:
              true,
            showError:
              false,
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
        canInvestigate,
        fetchPageData,
        incidents,
        isAuthorizedReviewer,
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
      if (
        isSuperAdmin
      ) {
        return false;
      }
      /*
       * Do not recompute repeat-offense severity from
       * the paginated Incident page.
       *
       * AddIncidentModal is responsible for the
       * complete employee-history preview, while the
       * backend remains the final authoritative
       * classification source.
       */
      const normalizedIncident = {
        ...newIncident,
        company:
          newIncident.company ||
          "",
        status:
          "Open",
      };
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
                JSON.stringify({
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
                  violationSection:
                    normalizedIncident.violationSection ||
                    "",
                  violationCategory:
                    normalizedIncident.violationCategory ||
                    "",
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
                  policySanction:
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
                  directUploads:
                    Array.isArray(
                      normalizedIncident.directUploads
                    )
                      ? normalizedIncident.directUploads
                      : [],
                }),
            }
          );
        /*
         * Do NOT close AddIncidentModal here.
         *
         * AddIncidentModal owns the phone-capture session lifecycle.
         * After this handler returns true, the child must first mark
         * successful phone-capture sessions as safe/consumed before it
         * closes itself.
         *
         * Closing from the parent here would unmount the child too early
         * and allow its cleanup path to cancel a photo that the saved
         * Incident already owns.
         */
        setCaseTab(
          "ACTIVE"
        );
        setCurrentPage(
          1
        );
        await fetchPageData({
          silent:
            true,
          showError:
            false,
          page:
            1,
          caseTabValue:
            "ACTIVE",
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
    async (
      incident
    ) => {
      if (
        !canUserStartInvestigation(
          incident,
          currentUser
        ) ||
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
                new Date()
                  .toISOString(),
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
        await patchIncidentStatus({
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
          successTitle:
            "Investigation Started",
          successMessage:
            `Incident ${formatIncidentCode(
              incident.id
            )} is now marked as Investigating.`,
        });
      if (
        success
      ) {
        closeAllIncidentModals();
      }
      return success;
    };
  const handleSubmitResolution =
    async (
      incident,
      resolutionData
    ) => {
      if (
        !canUserSubmitInvestigationProof(
          incident,
          currentUser
        )
      ) {
        return false;
      }

      const requestedWorkflowAction =
        String(
          resolutionData
            ?.workflowAction ||
          "SUBMIT_RESOLUTION"
        )
          .trim()
          .toUpperCase();

      const workflowAction =
        [
          "SUBMIT_RESOLUTION",
          "SUBMIT_INVESTIGATION",
        ].includes(
          requestedWorkflowAction
        )
          ? requestedWorkflowAction
          : "SUBMIT_RESOLUTION";

      const proofFiles =
        Array.isArray(
          resolutionData
            ?.proofFiles
        )
          ? resolutionData
              .proofFiles
          : [];

      const phoneDirectUploads =
        Array.isArray(
          resolutionData
            ?.phoneDirectUploads
        )
          ? resolutionData
              .phoneDirectUploads
          : [];

      try {
        /*
         * Desktop/laptop files use the same protected
         * direct-upload pipeline as phone-captured
         * evidence.
         *
         * This avoids mixing multipart binaries with
         * WELLJOB direct-upload descriptors in one
         * workflow request.
         */
        const desktopDirectUploads =
          await prepareIncidentWorkflowDirectUploads({
            incidentId:
              incident.id,

            workflowAction,

            proofFiles,
          });

        const directUploads =
          mergeIncidentDirectUploads(
            desktopDirectUploads,
            phoneDirectUploads
          );

        if (
          directUploads.length ===
          0
        ) {
          showNotice(
            "error",
            "Proof Upload Required",
            "Please upload at least one valid proof file or add a photo from your phone before submitting for review."
          );

          return false;
        }

        const updatedIncident =
          normalizeIncidentWithRules(
            {
              ...incident,

              status:
                "For Review",

              resolution: {
                submittedAt:
                  new Date()
                    .toISOString(),

                submittedById:
                  currentUser.id,

                submittedByName:
                  actorFullName,

                submittedByUsername:
                  currentUser.username,

                submittedByRole:
                  currentUser.role,

                actionTaken:
                  resolutionData
                    .actionTaken,

                remarks:
                  resolutionData
                    .remarks,

                /*
                 * The backend response remains the
                 * canonical evidence source after the
                 * successful PATCH.
                 *
                 * Local proofFiles are retained here as
                 * an optimistic fallback only.
                 */
                proofFiles,
              },

              actionTaken:
                resolutionData
                  .actionTaken,

              action_taken:
                resolutionData
                  .actionTaken,

              resolutionNotes:
                resolutionData
                  .remarks,
            },
            incidents
          );

        const success =
          await patchIncidentStatus({
            incident,

            updatedIncident,

            payload: {
              status:
                "For Review",

              workflowAction,

              actionTaken:
                resolutionData
                  .actionTaken,

              resolutionNotes:
                resolutionData
                  .remarks,

              recommendation:
                incident.recommendation ||
                "",

              directUploads,
            },

            auditAction:
              workflowAction,

            successTitle:
              "Submitted for Review",

            successMessage:
              `Proof for incident ${formatIncidentCode(
                incident.id
              )} has been submitted for authorized review.`,
          });

        /*
         * Do NOT close ResolutionModal here.
         *
         * ResolutionModal owns the phone-capture session lifecycle.
         * After this handler returns true, the child must first mark
         * the successfully attached phone sessions as safe/consumed,
         * then close itself.
         *
         * Parent-side close here would unmount the child before that
         * ownership handoff is finished and could trigger cleanup of
         * evidence already attached by the successful workflow PATCH.
         */
        return success;
      } catch (error) {
        console.error(
          "Prepare or submit Incident resolution proof error:",
          error
        );

        showNotice(
          "error",
          "Submission Failed",
          error?.message ||
            "The resolution proof could not be submitted. Please try again."
        );

        return false;
      }
    };

  const handleApproveCase =
    async (
      incident
    ) => {
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
        ) !==
        "For Review"
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
                new Date()
                  .toISOString(),
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
        await patchIncidentStatus({
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
            recommendation:
              incident.recommendation ||
              "",
          },
          auditAction:
            "CLOSE_INCIDENT",
          successTitle:
            "Case Approved",
          successMessage:
            `Incident ${formatIncidentCode(
              incident.id
            )} has been approved and closed successfully.`,
        });
      if (
        success
      ) {
        closeAllIncidentModals();
        setCaseTab(
          "CLOSED"
        );
        setCurrentPage(
          1
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
        ) !==
        "For Review"
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
                new Date()
                  .toISOString(),
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
        await patchIncidentStatus({
          incident,
          updatedIncident,
          payload: {
            status:
              "Investigating",
            workflowAction:
              "RETURN_INCIDENT",
            resolutionNotes:
              comments,
            recommendation:
              incident.recommendation ||
              "",
          },
          auditAction:
            "RETURN_INCIDENT",
          successTitle:
            "Case Returned",
          successMessage:
            `Incident ${formatIncidentCode(
              incident.id
            )} has been returned for correction.`,
        });
      if (
        success
      ) {
        closeAllIncidentModals();
        setCaseTab(
          "ACTIVE"
        );
        setCurrentPage(
          1
        );
      }
      return success;
    };
  const handleRefresh =
    useCallback(
      async () => {
        if (
          isRefreshing
        ) {
          return;
        }
        await fetchPageData({
          silent:
            true,
          showError:
            true,
          showRefreshing:
            true,
        });
      },
      [
        fetchPageData,
        isRefreshing,
      ]
    );
  const handleExportPDF =
    useCallback(
      async () => {
        if (
          !canExportIncidentReport ||
          isExporting
        ) {
          return;
        }

        setIsExporting(true);

        try {
          const params =
            new URLSearchParams();
          const trimmedSearch =
            String(
              debouncedSearch ||
              ""
            ).trim();
          const normalizedCaseTab =
            String(
              caseTab ||
              "ALL"
            )
              .trim()
              .toUpperCase();
          const normalizedSeverity =
            String(
              severityFilter ||
              "ALL"
            ).trim();

          const normalizedViolation =
            String(
              violationFilter ||
              "ALL"
            ).trim();

          const normalizedMonth =
            String(
              monthFilter ||
              "ALL"
            ).trim();

          const normalizedYear =
            String(
              yearFilter ||
              "ALL"
            ).trim();

          if (trimmedSearch) {
            params.set(
              "search",
              trimmedSearch
            );
          }

          if (
            normalizedCaseTab !==
            "ALL"
          ) {
            params.set(
              "caseTab",
              normalizedCaseTab
            );
          }

          if (
            normalizedSeverity
              .toUpperCase() !==
            "ALL"
          ) {
            params.set(
              "severity",
              normalizedSeverity
            );
          }

          if (
            normalizedViolation &&
            normalizedViolation
              .toUpperCase() !==
            "ALL"
          ) {
            params.set(
              "violationType",
              normalizedViolation
            );
          }

          if (
            normalizedMonth &&
            normalizedMonth
              .toUpperCase() !==
            "ALL"
          ) {
            params.set(
              "month",
              normalizedMonth
            );
          }

          if (
            normalizedYear &&
            normalizedYear
              .toUpperCase() !==
            "ALL"
          ) {
            params.set(
              "year",
              normalizedYear
            );
          }

          if (
            normalizedCaseTab ===
              "ALL" &&
            String(
              caseStatusFilter ||
              "ALL"
            ).toUpperCase() !==
              "ALL"
          ) {
            params.set(
              "status",
              normalizeStatus(
                caseStatusFilter
              )
            );
          }

          const query =
            params.toString();
          const reportData =
            await requestJson(
              `${INCIDENT_API_URL}/report${
                query
                  ? `?${query}`
                  : ""
              }`
            );
          const reportIncidents =
            buildIncidentList(
              reportData?.incidents ||
              []
            );

          await exportIncidentReportPDF({
            incidents:
              reportIncidents,
            user,
            scopeCompany:
              reportData?.scope
                ?.company ||
              "",
            filters: {
              search:
                trimmedSearch,
              caseTab:
                normalizedCaseTab,
              severity:
                normalizedSeverity,
              violationType:
                normalizedViolation,
              month:
                normalizedMonth,
              year:
                normalizedYear,
              status:
                caseStatusFilter,
            },
          });

          showNotice(
            "success",
            "PDF Exported",
            `${reportIncidents.length} incident record${
              reportIncidents.length === 1
                ? ""
                : "s"
            } included in the report.`
          );
        } catch (error) {
          showNotice(
            "error",
            "PDF Export Failed",
            error?.message ||
              "Unable to export the incident report."
          );
        } finally {
          if (
            isMountedRef.current
          ) {
            setIsExporting(false);
          }
        }
      },
      [
        canExportIncidentReport,
        caseStatusFilter,
        caseTab,
        debouncedSearch,
        isExporting,
        severityFilter,
        showNotice,
        user,
        violationFilter,
        monthFilter,
        yearFilter,
      ]
    );
  const handleSearchChange =
    useCallback(
      (
        value
      ) => {
        setSearch(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );
  const handleCaseTabChange =
    useCallback(
      (
        value
      ) => {
        setCaseTab(
          value
        );

        if (
          value !==
          "ALL"
        ) {
          setCaseStatusFilter(
            "ALL"
          );
        }

        setCurrentPage(
          1
        );
      },
      []
    );
  const handleSeverityFilterChange =
    useCallback(
      (
        value
      ) => {
        setSeverityFilter(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );

  const handleViolationFilterChange =
    useCallback(
      (
        value
      ) => {
        setViolationFilter(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );

  const handleCaseStatusFilterChange =
    useCallback(
      (
        value
      ) => {
        setCaseStatusFilter(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );

  const handleMonthFilterChange =
    useCallback(
      (
        value
      ) => {
        setMonthFilter(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );

  const handleYearFilterChange =
    useCallback(
      (
        value
      ) => {
        setYearFilter(
          value
        );
        setCurrentPage(
          1
        );
      },
      []
    );

  const handleClearSearch =
    useCallback(
      () => {
        setSearch(
          ""
        );
        setDebouncedSearch(
          ""
        );
        setCurrentPage(
          1
        );
      },
      []
    );
  const handleClearIncidentFilters =
    useCallback(
      () => {
        setSearch(
          ""
        );
        setDebouncedSearch(
          ""
        );
        setSeverityFilter(
          "ALL"
        );
        setViolationFilter(
          "ALL"
        );
        setMonthFilter(
          "ALL"
        );
        setYearFilter(
          "ALL"
        );
        setCaseStatusFilter(
          "ALL"
        );
        setCaseTab(
          "ALL"
        );
        setCurrentPage(
          1
        );
      },
      []
    );
  const handlePreviousPage =
    useCallback(
      () => {
        if (
          isLoading ||
          isRefreshing ||
          currentPage <= 1
        ) {
          return;
        }
        setCurrentPage(
          (
            page
          ) =>
            Math.max(
              1,
              page - 1
            )
        );
      },
      [
        currentPage,
        isLoading,
        isRefreshing,
      ]
    );
  const handleNextPage =
    useCallback(
      () => {
        if (
          isLoading ||
          isRefreshing ||
          currentPage >=
            pagination.totalPages
        ) {
          return;
        }
        setCurrentPage(
          (
            page
          ) =>
            Math.min(
              pagination
                .totalPages,
              page + 1
            )
        );
      },
      [
        currentPage,
        isLoading,
        isRefreshing,
        pagination.totalPages,
      ]
    );
  const firstVisibleRecord =
    pagination.total ===
      0
      ? 0
      : (
          pagination.page -
          1
        ) *
          pagination.pageSize +
        1;
  const lastVisibleRecord =
    pagination.total ===
      0
      ? 0
      : Math.min(
          pagination.page *
            pagination.pageSize,
          pagination.total
        );
  const pageDescription =
    isHrCoordinator
      ? "Report and monitor incidents for your assigned client company, claim eligible open investigations, and submit proof for cases you own."
      : isAuthorizedReviewer
        ? "Monitor incident cases, review submitted resolution proof, and maintain complete case history."
        : "Report incidents, manage investigations, and submit resolution proof for authorized review.";
  return (
    <main className="min-w-0 max-w-full space-y-4 overflow-x-hidden p-4 sm:p-5 lg:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FiAlertTriangle
                size={18}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Case Management
              </p>

              <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Incident Reports
              </h1>

              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                {pageDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
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
              loading={isRefreshing}
              disabled={
                isLoading ||
                isRefreshing
              }
              onClick={handleRefresh}
            >
              Refresh
            </Button>

            {canExportIncidentReport && (
              <Button
                type="button"
                variant="success"
                size="sm"
                leftIcon={
                  <FiDownload
                    aria-hidden="true"
                  />
                }
                loading={
                  isExporting
                }
                disabled={
                  isLoading ||
                  isRefreshing ||
                  isExporting
                }
                onClick={
                  handleExportPDF
                }
              >
                Export PDF
              </Button>
            )}

            {canCreateIncident && (
              <RoleGuard
                permission={
                  PERMISSIONS.CAN_ADD_INCIDENT
                }
              >
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  leftIcon={
                    <FiPlus aria-hidden="true" />
                  }
                  disabled={
                    isLoading ||
                    isRefreshing
                  }
                  onClick={
                    handleOpenAddIncidentModal
                  }
                >
                  Add Incident
                </Button>
              </RoleGuard>
            )}
          </div>
        </div>
      </section>
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
            incidents
          }
          totalIncidentCount={
            incidentCaseCounts.ALL
          }
          search={
            search
          }
          onSearchChange={
            handleSearchChange
          }
          onClearSearch={
            handleClearSearch
          }
          onClearFilters={
            handleClearIncidentFilters
          }
          caseTab={
            caseTab
          }
          onCaseTabChange={
            handleCaseTabChange
          }
          caseCounts={
            incidentCaseCounts
          }
          severityFilter={
            severityFilter
          }
          onSeverityFilterChange={
            handleSeverityFilterChange
          }
          violationFilter={
            violationFilter
          }
          onViolationFilterChange={
            handleViolationFilterChange
          }
          monthFilter={
            monthFilter
          }
          onMonthFilterChange={
            handleMonthFilterChange
          }
          yearFilter={
            yearFilter
          }
          onYearFilterChange={
            handleYearFilterChange
          }
          availableYears={
            availableYears
          }
          caseStatusFilter={
            caseStatusFilter
          }
          onCaseStatusFilterChange={
            handleCaseStatusFilterChange
          }
          isSuperAdmin={
            isSuperAdmin
          }
          isHRCoordinator={
            isHrCoordinator
          }
          currentUser={
            currentUser
          }
          formatIncidentCode={
            formatIncidentCode
          }
          onView={
            handleViewIncident
          }
          onStartReview={
            canInvestigate
              ? handleStartReviewIncident
              : undefined
          }
          onResolve={
            canInvestigate
              ? handleResolveIncident
              : undefined
          }
          onReview={
            isAuthorizedReviewer
              ? handleReviewIncident
              : undefined
          }
        />
        {pagination.totalPages > 1 && (
          <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {firstVisibleRecord}-{lastVisibleRecord}
              </span>{" "}
              of{" "}
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {pagination.total}
              </span>{" "}
              matching incident{" "}
              {pagination.total === 1 ? "record" : "records"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  isLoading ||
                  isRefreshing ||
                  !pagination.hasPreviousPage
                }
                onClick={handlePreviousPage}
              >
                Previous
              </Button>
              <span className="min-w-[110px] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  isLoading ||
                  isRefreshing ||
                  !pagination.hasNextPage
                }
                onClick={handleNextPage}
              >
                Next
              </Button>
            </div>
          </section>
        )}
      </div>
      {selectedIncident && (
        <ViewIncidentModal
          incident={
            selectedIncident
          }
          onClose={
            closeAllIncidentModals
          }
        />
      )}
      {canInvestigate && startReviewIncident && (
        <ViewIncidentModal
          incident={
            startReviewIncident
          }
          mode="start-review"
          onClose={
            closeAllIncidentModals
          }
          onRequestStart={
            handleRequestStartConfirmation
          }
        />
      )}
      {canInvestigate && confirmStartIncident && (
        <ConfirmStartInvestigationModal
          incident={
            confirmStartIncident
          }
          currentUser={
            currentUser
          }
          onClose={
            closeAllIncidentModals
          }
          onConfirm={
            handleConfirmStartInvestigation
          }
        />
      )}
      {canInvestigate && resolutionIncident && (
        <ResolutionModal
          incident={
            resolutionIncident
          }
          onClose={
            closeAllIncidentModals
          }
          onSubmit={
            handleSubmitResolution
          }
          showNotice={
            showNotice
          }
        />
      )}
      {isAuthorizedReviewer && reviewIncident && (
        <ReviewCaseModal
          incident={
            reviewIncident
          }
          onClose={
            closeAllIncidentModals
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
        onClose={
          handleCloseAddIncidentModal
        }
        onSave={
          handleAddIncident
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
            setNotice(
              null
            )
          }
        />
      )}
    </main>
  );
}