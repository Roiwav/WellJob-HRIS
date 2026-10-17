import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiCornerDownRight,
  FiSearch,
} from "react-icons/fi";
import useViolationPolicyOptions from "../../../hooks/useViolationPolicyOptions";
import FilterSelect from "./IncidentFilters";
import ActionButtons from "./IncidentActionButtons";
import Button from "../../ui/Button";
import EmptyState from "../../ui/EmptyState";
import LoadingSkeleton from "../../ui/LoadingSkeleton";
import SearchInput from "../../ui/SearchInput";
import {
  CaseAgeBadge,
  SeverityBadge,
  SmartAlertBadge,
  StatusBadge,
} from "../badges/IncidentBadges";

const CASE_TABS = [
  {
    key: "ACTIVE",
    label: "Active Cases",
    description: "Open and Investigating",
  },
  {
    key: "FOR_REVIEW",
    label: "For Review",
    description: "Submitted for review",
  },
  {
    key: "CLOSED",
    label: "Closed Cases",
    description: "Approved and completed",
  },
  {
    key: "ALL",
    label: "All Records",
    description: "Complete case history",
  },
];

const DEFAULT_CASE_COUNTS = {
  ALL: 0,
  ACTIVE: 0,
  FOR_REVIEW: 0,
  CLOSED: 0,
};

const CASE_STATUS_OPTIONS = [
  "ALL",
  "Open",
  "Investigating",
  "For Review",
  "Closed",
];

const INCIDENT_TIME_ZONE = "Asia/Manila";

const MONTH_OPTIONS = [
  "ALL",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const MONTH_LABELS = {
  ALL: "All Months",
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const role = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (role === "HRCOORDINATOR" ||
    role === "HR_COORDINATOR") {
    return "HR_COORDINATOR";
  }
  return role;
}

function getIncidentEmployeeName(incident) {
  return (incident?.employee ||
    incident?.employeeName ||
    incident?.employee_name ||
    "Unknown Employee");
}

function getIncidentEmployeeId(incident) {
  return (incident?.employeeId ||
    incident?.employee_id ||
    "");
}

function getIncidentViolation(incident) {
  return (incident?.violation ||
    incident?.violationType ||
    incident?.violation_type ||
    "No violation type");
}

function getIncidentCompany(incident) {
  return (incident?.company ||
    incident?.clientCompany ||
    incident?.client_company ||
    "Unassigned");
}

function normalizeIncidentDateTimestamp(value) {
  if (value === undefined ||
    value === null ||
    value === "") {
    return 0;
  }
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) &&
    numericValue > 0) {
    return numericValue <
      100000000000
      ? numericValue *
        1000
      : numericValue;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return 0;
  }
  /*
  * incident_date is a Philippine business calendar
  * date, not a UTC workflow timestamp.
  *
  * Attach the Manila offset explicitly so a browser
  * configured to another timezone cannot render the
  * previous/next calendar date.
  */
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00+08:00`).getTime();
    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }
  const mysqlDateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)$/);
  if (mysqlDateTimeMatch) {
    const parsed = new Date(`${mysqlDateTimeMatch[1]}T${mysqlDateTimeMatch[2]}+08:00`).getTime();
    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }
  const parsed = new Date(normalized).getTime();
  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function getIncidentTimestamp(incident) {
  /*
  * Keep the incident business/report date as the
  * authoritative sort key. Workflow creation time is
  * only a fallback for legacy/incomplete records.
  */
  const value = incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.createdAtTimestamp ||
    incident?.created_at_timestamp ||
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.createdAt ||
    incident?.created_at ||
    null;
  return normalizeIncidentDateTimestamp(value);
}

function formatIncidentDate(incident) {
  const timestamp = getIncidentTimestamp(incident);
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: INCIDENT_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function buildIncidentGroupKey(incident) {
  const employeeIdentifier = normalizeValue(getIncidentEmployeeId(incident)).toLowerCase() ||
    normalizeValue(getIncidentEmployeeName(incident)).toLowerCase() ||
    "unknown-employee";
  const violationIdentifier = normalizeValue(getIncidentViolation(incident)).toLowerCase() ||
    "unknown-violation";
  return `${employeeIdentifier}::${violationIdentifier}`;
}

function getIncidentRecordKey(incident, fallbackIndex = 0) {
  return (incident?.id ||
    incident?.displayId ||
    `${buildIncidentGroupKey(incident)}-${getIncidentTimestamp(incident)}-${fallbackIndex}`);
}

function getTabStyle(isActive, tabKey) {
  if (!isActive) {
    return "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-slate-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";
  }
  if (tabKey === "ACTIVE") {
    return "border-amber-300 bg-amber-50 text-amber-800 shadow-sm focus-visible:ring-amber-500/25 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }
  if (tabKey === "FOR_REVIEW") {
    return "border-violet-300 bg-violet-50 text-violet-800 shadow-sm focus-visible:ring-violet-500/25 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }
  if (tabKey === "CLOSED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm focus-visible:ring-emerald-500/25 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  return "border-slate-300 bg-slate-100 text-slate-800 shadow-sm focus-visible:ring-slate-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
}

function getEmptyStateContent({ totalIncidentCount, search, caseTab, severityFilter, violationFilter, monthFilter, yearFilter, caseStatusFilter, }) {
  const hasSearch = Boolean(String(search || "").trim());
  const hasSeverityFilter = severityFilter !== "ALL";
  const hasViolationFilter = violationFilter !== "ALL";
  const hasCaseStatusFilter = caseTab === "ALL" &&
    caseStatusFilter !== "ALL";
  const hasDateFilter = monthFilter !== "ALL" ||
    yearFilter !== "ALL";
  const hasCaseFilter = caseTab !== "ALL";
  if (totalIncidentCount === 0) {
    return {
      icon: "records",
      title: "No incident records yet",
      description: "Incident records will appear here after a case is reported.",
    };
  }
  if (hasSearch) {
    return {
      icon: "search",
      title: "No search results",
      description: "No incident matched the current search. Try another incident ID, employee, company, or violation.",
    };
  }
  if (hasViolationFilter) {
    return {
      icon: "filter",
      title: "No matching violation records",
      description: "Incident records exist, but none match the selected violation type.",
    };
  }
  if (hasSeverityFilter) {
    return {
      icon: "filter",
      title: "No matching severity records",
      description: "Incident records exist, but none match the selected severity level.",
    };
  }
  if (hasDateFilter) {
    return {
      icon: "filter",
      title: "No incidents in this period",
      description: "Incident records exist, but none match the selected incident month or year.",
    };
  }
  if (hasCaseStatusFilter) {
    return {
      icon: "filter",
      title: "No matching case status",
      description: "Incident records exist, but none match the selected case status.",
    };
  }
  if (hasCaseFilter) {
    const tabLabel = CASE_TABS.find((tab) => tab.key ===
      caseTab)?.label ||
      "selected case category";
    return {
      icon: "records",
      title: `No ${tabLabel.toLowerCase()}`,
      description: "There are no incident records in this case category.",
    };
  }
  return {
    icon: "records",
    title: "No incident records found",
    description: "There are no incident records available.",
  };
}

function SearchableViolationFilter({ value, onChange, options = [], labels = {}, disabled = false, }) {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen,] = useState(false);
  const [searchValue, setSearchValue,] = useState("");
  const selectedValue = normalizeValue(value || "ALL") || "ALL";
  const selectedLabel = labels[selectedValue] ||
    selectedValue;
  const filteredOptions = useMemo(() => {
    const query = normalizeValue(searchValue).toLowerCase();
    const safeOptions = Array.isArray(options)
      ? options
      : [];
    if (!query) {
      return safeOptions;
    }
    return safeOptions.filter((option) => {
      const label = String(labels[option] ||
        option ||
        "").toLowerCase();
      return label.includes(query);
    });
  }, [
    labels,
    options,
    searchValue,
  ]);
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event) => {
      if (containerRef.current &&
        !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key ===
        "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isOpen,
  ]);
  const handleSelect = (option) => {
    onChange?.(option);
    setSearchValue("");
    setIsOpen(false);
  };
  return (<div ref={containerRef} className="relative">
   <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} disabled={disabled} onClick={() => setIsOpen((current) => !current)} className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:disabled:bg-slate-950/50 dark:disabled:text-slate-600">
    <span className="min-w-0 flex-1 truncate" title={selectedLabel}>
     {selectedLabel}
    </span>
    <FiChevronDown size={16} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${isOpen
      ? "rotate-180"
      : ""}`}/>
   </button>
   {isOpen && !disabled && (<div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
     <div className="border-b border-slate-100 p-2 dark:border-slate-800">
      <div className="relative">
       <FiSearch size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
       <input type="search" value={searchValue} autoFocus onChange={(event) => setSearchValue(event.target.value)} placeholder="Search violation..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900"/>
      </div>
     </div>
     <div role="listbox" aria-label="Violation Type" className="max-h-64 overflow-y-auto p-1.5">
      {filteredOptions.length >
        0 ? (filteredOptions.map((option) => {
        const isSelected = option ===
          selectedValue;
        return (<button key={option} type="button" role="option" aria-selected={isSelected} onClick={() => handleSelect(option)} className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${isSelected
            ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
           <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            {isSelected && (<FiCheck size={14} aria-hidden="true"/>)}
           </span>
           <span className="min-w-0 break-words leading-5">
            {labels[option] ||
            option}
           </span>
          </button>);
      })) : (<p className="px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
        No matching violation found.
       </p>)}
     </div>
    </div>)}
  </div>);
}

export default function IncidentTable({ isLoading = false, isRefreshing = false, incidents = [], totalIncidentCount = 0, search = "", onSearchChange, onClearSearch, onClearFilters, caseTab = "ACTIVE", onCaseTabChange, caseCounts = DEFAULT_CASE_COUNTS, severityFilter = "ALL", onSeverityFilterChange, violationFilter = "ALL", onViolationFilterChange, monthFilter = "ALL", onMonthFilterChange, yearFilter = "ALL", onYearFilterChange, availableYears = [], caseStatusFilter = "ALL", onCaseStatusFilterChange, isSuperAdmin = false, isHRCoordinator = false, currentUser, formatIncidentCode, onView, onStartReview, onResolve, onReview, }) {
  const [expandedGroups, setExpandedGroups,] = useState({});
  /*
  * Use the exact same live violation-policy source as
  * AddIncidentModal. This keeps Incident creation,
  * filtering, and report export aligned whenever the
  * configured violation policy changes.
  */
  const { violationOptions, violationPolicyError, isLoadingViolationPolicy, } = useViolationPolicyOptions(true);
  const violationFilterOptions = useMemo(() => {
    const uniqueViolations = new Set();
    const options = [
      "ALL",
    ];
    (Array.isArray(violationOptions)
      ? violationOptions
      : []).forEach((item) => {
      const violation = normalizeValue(item?.violation);
      if (!violation ||
        uniqueViolations.has(violation)) {
        return;
      }
      uniqueViolations.add(violation);
      options.push(violation);
    });
    /*
    * Preserve a currently selected historical value
    * if the policy changed while the page is open.
    * New selections still come from the current
    * violation policy.
    */
    const selectedViolation = normalizeValue(violationFilter);
    if (selectedViolation &&
      selectedViolation !==
        "ALL" &&
      !uniqueViolations.has(selectedViolation)) {
      options.push(selectedViolation);
    }
    return options;
  }, [
    violationFilter,
    violationOptions,
  ]);
  const violationFilterLabels = useMemo(() => {
    const labels = {
      ALL: "All Violations",
    };
    (Array.isArray(violationOptions)
      ? violationOptions
      : []).forEach((item) => {
      const violation = normalizeValue(item?.violation);
      if (!violation ||
        labels[violation]) {
        return;
      }
      const section = normalizeValue(item?.section);
      /*
      * Same policy identity as Add Incident:
      * section + violation. The submitted filter
      * value remains the exact violation string
      * expected by the Incident backend.
      */
      labels[violation] =
        section
          ? `${section} — ${violation}`
          : violation;
    });
    const selectedViolation = normalizeValue(violationFilter);
    if (selectedViolation &&
      selectedViolation !==
        "ALL" &&
      !labels[selectedViolation]) {
      labels[selectedViolation] =
        selectedViolation;
    }
    return labels;
  }, [
    violationFilter,
    violationOptions,
  ]);
  const yearFilterOptions = useMemo(() => {
    const years = Array.from(new Set((Array.isArray(availableYears)
      ? availableYears
      : [])
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year))))
      .sort((firstYear, secondYear) => secondYear -
      firstYear)
      .map(String);
    const selectedYear = normalizeValue(yearFilter);
    if (selectedYear &&
      selectedYear !==
        "ALL" &&
      !years.includes(selectedYear)) {
      years.unshift(selectedYear);
    }
    return [
      "ALL",
      ...years,
    ];
  }, [
    availableYears,
    yearFilter,
  ]);
  const yearFilterLabels = useMemo(() => ({
    ALL: "All Years",
    ...Object.fromEntries(yearFilterOptions
      .filter((year) => year !==
      "ALL")
      .map((year) => [
      year,
      year,
    ])),
  }), [
    yearFilterOptions,
  ]);
  /*
  * ==================================================
  * OPTION A — HISTORICAL LIST ONLY
  * ==================================================
  *
  * Historical incidents may remain visible to an
  * HR Coordinator from the incident's original
  * company, but must not offer full-detail access
  * after the employee transfers to another company.
  *
  * This table checks BOTH:
  *
  * - isHistorical === true
  * - canViewDetails === false
  *
  * The backend remains the source of truth for
  * incident-detail and evidence authorization.
  */
  const isHrCoordinator = isHRCoordinator ||
    normalizeRole(currentUser?.role) ===
      "HR_COORDINATOR";
  const isRestrictedHistoricalIncident = useCallback((incident) => {
    return (isHrCoordinator &&
      (incident?.isHistorical ===
        true ||
        incident?.canViewDetails ===
          false));
  }, [
    isHrCoordinator,
  ]);
  /*
  * A row can open details only when the record is
  * not a restricted historical incident.
  *
  * The same check is used for mouse, keyboard,
  * expanded history rows, and ActionButtons.
  */
  const canOpenIncidentDetails = useCallback((incident) => {
    return (Boolean(incident?.id) &&
      typeof onView ===
        "function" &&
      !isRestrictedHistoricalIncident(incident));
  }, [
    isRestrictedHistoricalIncident,
    onView,
  ]);
  const safeIncidents = useMemo(() => Array.isArray(incidents)
    ? incidents.filter(Boolean)
    : [], [
    incidents,
  ]);
  const safeTotalIncidentCount = Number.isFinite(Number(totalIncidentCount))
    ? Number(totalIncidentCount)
    : safeIncidents.length;
  const hasSearch = Boolean(String(search || "").trim());
  const controlsDisabled = isLoading ||
    isRefreshing;
  const violationFilterDisabled = controlsDisabled ||
    isLoadingViolationPolicy ||
    Boolean(violationPolicyError) ||
    violationFilterOptions.length <=
      1;
  const hasActiveFilters = hasSearch ||
    severityFilter !==
      "ALL" ||
    violationFilter !==
      "ALL" ||
    monthFilter !==
      "ALL" ||
    yearFilter !==
      "ALL" ||
    (caseTab ===
      "ALL" &&
      caseStatusFilter !==
        "ALL") ||
    caseTab !==
      "ALL";
  const getIncidentDisplayId = useCallback((incident) => {
    if (incident?.displayId) {
      return incident.displayId;
    }
    if (typeof formatIncidentCode ===
      "function") {
      return formatIncidentCode(incident?.id);
    }
    if (!incident?.id) {
      return "-";
    }
    const numericId = Number(incident.id);
    if (Number.isFinite(numericId)) {
      return `INC-${String(numericId).padStart(4, "0")}`;
    }
    return String(incident.id);
  }, [
    formatIncidentCode,
  ]);
  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups((currentGroups) => ({
      ...currentGroups,
      [groupKey]: !currentGroups[groupKey],
    }));
  }, []);
  /*
  * Defense in depth for frontend interaction.
  *
  * Even if another child component calls this
  * handler, historical coordinator records must
  * not trigger a detail request.
  */
  const openIncidentDetails = useCallback((incident) => {
    if (!canOpenIncidentDetails(incident)) {
      return;
    }
    onView(incident);
  }, [
    canOpenIncidentDetails,
    onView,
  ]);
  const handleIncidentRowKeyDown = useCallback((event, incident) => {
    if (event.key !==
      "Enter" &&
      event.key !==
        " ") {
      return;
    }
    if (!canOpenIncidentDetails(incident)) {
      return;
    }
    /*
    * If focus is on a nested control,
    * let that control handle its own key.
    */
    if (event.target !==
      event.currentTarget) {
      return;
    }
    event.preventDefault();
    openIncidentDetails(incident);
  }, [
    canOpenIncidentDetails,
    openIncidentDetails,
  ]);
  const stopRowInteraction = useCallback((event) => {
    event.stopPropagation();
  }, []);
  const groupedIncidents = useMemo(() => {
    const groups = new Map();
    safeIncidents.forEach((incident) => {
      const groupKey = buildIncidentGroupKey(incident);
      const currentGroup = groups.get(groupKey) ||
        [];
      currentGroup.push(incident);
      groups.set(groupKey, currentGroup);
    });
    return Array.from(groups.entries())
      .map(([groupKey, groupRecords,]) => {
      const sortedRecords = [
        ...groupRecords,
      ].sort((firstRecord, secondRecord) => getIncidentTimestamp(secondRecord) -
        getIncidentTimestamp(firstRecord));
      return {
        key: groupKey,
        latest: sortedRecords[0],
        history: sortedRecords.slice(1),
      };
    })
      .sort((firstGroup, secondGroup) => getIncidentTimestamp(secondGroup.latest) -
      getIncidentTimestamp(firstGroup.latest));
  }, [
    safeIncidents,
  ]);
  const emptyStateContent = getEmptyStateContent({
    totalIncidentCount: safeTotalIncidentCount,
    search,
    caseTab,
    severityFilter,
    violationFilter,
    monthFilter,
    yearFilter,
    caseStatusFilter,
  });
  return (<section className="min-w-0 space-y-4" aria-label="Incident records">
   <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div role="tablist" aria-label="Incident case filters" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
     {CASE_TABS.map((tab) => {
      const isActive = caseTab ===
        tab.key;
      const count = Number(caseCounts?.[tab.key] ||
        0);
      return (<button key={tab.key} type="button" role="tab" aria-selected={isActive} aria-controls="incident-records-table" disabled={controlsDisabled} onClick={() => onCaseTabChange?.(tab.key)} className={`rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${getTabStyle(isActive, tab.key)}`}>
         <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
           <p className="truncate text-sm font-bold">
            {tab.label}
           </p>
           <p className="mt-0.5 truncate text-[11px] font-medium opacity-70">
            {tab.description}
           </p>
          </div>
          <span className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 px-2 py-1 text-xs font-bold tabular-nums dark:bg-white/10">
           {count}
          </span>
         </div>
        </button>);
    })}
    </div>
   </section>
   <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
     <div className="min-w-0 xl:col-span-3">
      <SearchInput label="Search Incident Records" placeholder="Incident ID, employee, client company, or violation..." value={search} disabled={controlsDisabled} onChange={(event) => onSearchChange?.(event.target
      .value)} onClear={typeof onClearSearch ===
      "function"
      ? onClearSearch
      : () => onSearchChange?.("")}/>
     </div>
     <div className="min-w-0 xl:col-span-2">
      <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
       Severity
      </p>
      <FilterSelect value={severityFilter} onChange={onSeverityFilterChange} options={[
      "ALL",
      "Minor",
      "Major",
      "Critical",
    ]} labels={{
      ALL: "All Severity",
    }} disabled={controlsDisabled}/>
     </div>
     <div className="min-w-0 xl:col-span-3">
      <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
       Violation Type
      </p>
      <SearchableViolationFilter key={violationFilterDisabled
      ? "disabled"
      : "enabled"} value={violationFilter} onChange={onViolationFilterChange} options={violationFilterOptions} labels={violationFilterLabels} disabled={violationFilterDisabled}/>
      {isLoadingViolationPolicy && (<p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
        Loading violation policy...
       </p>)}
      {!isLoadingViolationPolicy &&
      violationPolicyError && (<p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
         Violation filter is temporarily unavailable.
        </p>)}
     </div>
     <div className="min-w-0 xl:col-span-2">
      <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
       Month
      </p>
      <FilterSelect value={monthFilter} onChange={onMonthFilterChange} options={MONTH_OPTIONS} labels={MONTH_LABELS} disabled={controlsDisabled}/>
     </div>
     <div className="min-w-0 xl:col-span-2">
      <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
       Year
      </p>
      <FilterSelect value={yearFilter} onChange={onYearFilterChange} options={yearFilterOptions} labels={yearFilterLabels} disabled={controlsDisabled}/>
     </div>
     {caseTab ===
      "ALL" && (<div className="min-w-0 xl:col-span-2">
       <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        Status
       </p>
       <FilterSelect value={caseStatusFilter} onChange={onCaseStatusFilterChange} options={CASE_STATUS_OPTIONS} labels={{
        ALL: "All Statuses",
      }} disabled={controlsDisabled}/>
      </div>)}
    </div>
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
     <p className="text-xs text-slate-500 dark:text-slate-400">
      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
       {safeIncidents.length}
      </span>{" "}
      incident{" "}
      {safeIncidents.length ===
      1
      ? "record"
      : "records"}{" "}
      in this view
     </p>
     <Button variant="ghost" size="sm" disabled={!hasActiveFilters ||
      controlsDisabled} onClick={onClearFilters}>
      Clear Filters
     </Button>
    </div>
   </section>
   {isLoading ? (<LoadingSkeleton rows={6} columns={7} showHeader/>) : groupedIncidents.length ===
      0 ? (<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
     <EmptyState icon={emptyStateContent.icon} title={emptyStateContent.title} description={emptyStateContent.description} secondaryActionLabel={hasActiveFilters
        ? "Clear filters"
        : ""} onSecondaryAction={hasActiveFilters
        ? onClearFilters
        : undefined}/>
    </section>) : (<div id="incident-records-table" role="tabpanel" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
     <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
       Incident Records
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
       Related incidents are grouped when the same employee has multiple cases for the same violation. Expand a row to view earlier related cases.
      </p>
     </div>
     <div className="max-h-[520px] w-full overflow-auto">
      <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
       <thead className="sticky top-0 z-20 bg-slate-50/95 text-slate-600 shadow-[0_1px_0_0_rgba(226,232,240,1)] backdrop-blur dark:bg-slate-800/95 dark:text-slate-300 dark:shadow-[0_1px_0_0_rgba(51,65,85,1)]">
        <tr>
         <th scope="col" className="w-[13%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Incident ID
         </th>
         <th scope="col" className="w-[22%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Employee
         </th>
         <th scope="col" className="w-[27%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Violation
         </th>
         <th scope="col" className="w-[12%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Status
         </th>
         <th scope="col" className="w-[10%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Days Open
         </th>
         <th scope="col" className="w-[8%] bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Case Alerts
         </th>
         <th scope="col" className="w-[15%] bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-slate-800/95">
          Actions
         </th>
        </tr>
       </thead>
       <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
        {groupedIncidents.map((group) => {
        const isExpanded = Boolean(expandedGroups[group.key]);
        const hasHistory = group.history
          .length >
          0;
        const employeeName = getIncidentEmployeeName(group.latest);
        const company = getIncidentCompany(group.latest);
        const violation = getIncidentViolation(group.latest);
        const latestDisplayId = getIncidentDisplayId(group.latest);
        /*
        * Each incident gets its OWN permission
        * check. A group's latest incident and
        * its history records may have different
        * access permissions.
        */
        const canViewLatest = canOpenIncidentDetails(group.latest);
        const latestIsHistorical = isRestrictedHistoricalIncident(group.latest);
        return (<Fragment key={group.key}>
            <tr tabIndex={canViewLatest
            ? 0
            : undefined} aria-label={canViewLatest
            ? `View details for incident ${latestDisplayId}`
            : undefined} title={canViewLatest
            ? `View ${latestDisplayId} case details`
            : latestIsHistorical
              ? "Historical record — details are unavailable after the employee transferred to another client company."
              : undefined} onClick={canViewLatest
            ? () => openIncidentDetails(group.latest)
            : undefined} onKeyDown={canViewLatest
            ? (event) => handleIncidentRowKeyDown(event, group.latest)
            : undefined} className={`transition ${canViewLatest
            ? "cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:hover:bg-slate-800/45 dark:focus-visible:bg-slate-800/60"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/45"}`}>
             <td className="px-4 py-2.5 align-middle">
              <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
               {latestDisplayId}
              </span>
              {hasHistory && (<p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {group
              .history
              .length +
              1}{" "}
                related cases
               </p>)}
             </td>
             <td className="px-4 py-2.5 align-middle">
              <div className="min-w-0">
               <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={employeeName}>
                {employeeName}
               </p>
               <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={company}>
                {company}
               </p>
              </div>
             </td>
             <td className="px-4 py-2.5 align-middle">
              <div className="min-w-0 space-y-2">
               <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100" title={violation}>
                {violation}
               </p>
               <SeverityBadge level={group
            .latest
            .severity}/>
              </div>
             </td>
             <td className="px-4 py-2.5 align-middle">
              <StatusBadge status={group
            .latest
            .status}/>
             </td>
             <td className="px-4 py-2.5 align-middle">
              <CaseAgeBadge incident={group.latest}/>
             </td>
             <td className="px-4 py-2.5 align-middle">
              <SmartAlertBadge alerts={Array.isArray(group
            .latest
            .smartAlerts)
            ? group
              .latest
              .smartAlerts
            : []}/>
             </td>
             <td className="px-4 py-2.5 text-right align-middle">
              <div className="flex items-center justify-end gap-2" onClick={stopRowInteraction} onKeyDown={stopRowInteraction}>
               {hasHistory && (<button type="button" aria-label={isExpanded
              ? `Hide related cases for ${employeeName}`
              : `Show related cases for ${employeeName}`} aria-expanded={isExpanded} onClick={(event) => {
              event.stopPropagation();
              toggleGroup(group.key);
            }} title={isExpanded
              ? "Hide related cases"
              : "Show related cases"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                 {isExpanded ? (<FiChevronUp size={18} aria-hidden="true"/>) : (<FiChevronDown size={18} aria-hidden="true"/>)}
                </button>)}
               <ActionButtons incident={group.latest} isSuperAdmin={isSuperAdmin} currentUser={currentUser} onView={openIncidentDetails} onStartReview={onStartReview} onResolve={onResolve} onReview={onReview}/>
              </div>
             </td>
            </tr>
            {isExpanded &&
            group.history.map((historyItem, historyIndex) => {
              const historyDisplayId = getIncidentDisplayId(historyItem);
              const canViewHistory = canOpenIncidentDetails(historyItem);
              const historyIsRestricted = isRestrictedHistoricalIncident(historyItem);
              return (<tr key={getIncidentRecordKey(historyItem, historyIndex)} tabIndex={canViewHistory
                  ? 0
                  : undefined} aria-label={canViewHistory
                  ? `View details for incident ${historyDisplayId}`
                  : undefined} title={canViewHistory
                  ? `View ${historyDisplayId} case details`
                  : historyIsRestricted
                    ? "Historical record — details are unavailable after the employee transferred to another client company."
                    : undefined} onClick={canViewHistory
                  ? () => openIncidentDetails(historyItem)
                  : undefined} onKeyDown={canViewHistory
                  ? (event) => handleIncidentRowKeyDown(event, historyItem)
                  : undefined} className={`bg-slate-50/50 transition dark:bg-slate-950/30 ${canViewHistory
                  ? "cursor-pointer hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                 <td className="px-4 py-2.5 align-top pl-8">
                  <div className="flex items-center gap-2">
                   <FiCornerDownRight className="shrink-0 text-slate-400" aria-hidden="true"/>
                   <p className="truncate font-semibold text-slate-700 dark:text-slate-300">
                    {historyDisplayId}
                   </p>
                  </div>
                 </td>
                 <td className="px-4 py-2.5 align-top">
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                   {formatIncidentDate(historyItem)}
                  </p>
                 </td>
                 <td className="px-4 py-2.5 align-top">
                  <SeverityBadge level={historyItem.severity}/>
                 </td>
                 <td className="px-4 py-2.5 align-top">
                  <StatusBadge status={historyItem.status}/>
                 </td>
                 <td className="px-4 py-2.5 align-top">
                  <CaseAgeBadge incident={historyItem}/>
                 </td>
                 <td className="px-4 py-2.5 align-top">
                  <SmartAlertBadge alerts={Array.isArray(historyItem.smartAlerts)
                  ? historyItem.smartAlerts
                  : []}/>
                 </td>
                 <td className="px-4 py-2.5 text-right align-top">
                  <div className="flex justify-end" onClick={stopRowInteraction} onKeyDown={stopRowInteraction}>
                   <ActionButtons incident={historyItem} isSuperAdmin={isSuperAdmin} currentUser={currentUser} onView={openIncidentDetails} onStartReview={onStartReview} onResolve={onResolve} onReview={onReview}/>
                  </div>
                 </td>
                </tr>);
            })}
           </Fragment>);
      })}
       </tbody>
      </table>
     </div>
    </div>)}
  </section>);
}