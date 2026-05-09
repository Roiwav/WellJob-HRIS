import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiBarChart2,
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import ExecutiveActionItems from "../components/dashboard/insights/ExecutiveActionItems";
import WorkforceHealthBanner from "../components/dashboard/insights/WorkforceHealthBanner";
import ExecutiveInsightTabs from "../components/dashboard/insights/ExecutiveInsightTabs";
import DashboardDrilldownModal from "../components/dashboard/modals/DashboardDrilldownModal";
import EditEmployeeModal from "../components/employees/EditEmployeeModal";

import { buildExecutiveActionItems } from "../utils/dashboard/prescriptiveAnalytics";
import { buildDashboardInsights } from "../utils/dashboard/dashboardInsights";

import RoleGuard from "../components/auth/RoleGuard";
import { PERMISSIONS } from "../constants/permissions";

import KPICards from "../components/dashboard/cards/KPICards";
import DeploymentTrendChart from "../components/dashboard/charts/DeploymentTrendChart";
import IncidentTrendChart from "../components/dashboard/charts/IncidentTrendChart";
import SeverityPieChart from "../components/dashboard/charts/SeverityPieChart";
import CaseAgingChart from "../components/dashboard/charts/CaseAgingChart";

const API_BASE = "http://localhost:5000/api";
const EMPLOYEE_API_URL = `${API_BASE}/employees`;
const INCIDENT_API_URL = `${API_BASE}/incidents`;
const DEPLOYMENT_API_URL = `${API_BASE}/deployments`;
const DATA_EVENT_SOURCE = "dashboard-page";

const monthList = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function emitDataUpdated(action = "DASHBOARD_UPDATED") {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "dashboard",
        action,
        at: Date.now(),
      },
    })
  );
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  const value = normalizeText(status);

  if (value === "resolved") return "For Review";
  if (value === "for_review") return "For Review";
  if (value === "for review") return "For Review";
  if (value === "closed") return "Closed";
  if (value === "investigating") return "Investigating";
  if (value === "open") return "Open";

  return status || "Open";
}

function isArchivedEmployee(employee) {
  return employee?.archived === true || Number(employee?.archived) === 1;
}

function isEmployeeDeployed(employee) {
  const status = normalizeText(employee?.status);
  return status === "deployed" || status === "active deployed";
}

function normalizeBackendEmployee(employee) {
  return {
    ...employee,
    id: employee.id || employee.employeeId || employee.employee_id,
    employeeId: employee.id || employee.employeeId || employee.employee_id,
    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",
    company: employee.company || employee.clientCompany || "Unassigned",
    status: employee.status || "Unknown",
    employmentType: employee.employmentType || employee.employment_type || "",
    contractStart: employee.contractStart || employee.contract_start || null,
    contractEnd: employee.contractEnd || employee.contract_end || null,
    createdAt: employee.createdAt || employee.created_at || null,
    archived: isArchivedEmployee(employee),
    documents: Array.isArray(employee.documents) ? employee.documents : [],
  };
}

function normalizeBackendIncident(incident) {
  const date =
    incident.reportedAt ||
    incident.reported_at ||
    incident.date ||
    incident.incidentDate ||
    incident.incident_date ||
    incident.createdAt ||
    incident.created_at ||
    new Date().toISOString();

  return {
    ...incident,
    id: incident.id,
    employeeId:
      incident.employeeId ||
      incident.employee_id ||
      incident.empId ||
      incident.employeeID ||
      "",
    employee:
      incident.employee ||
      incident.employeeName ||
      incident.employee_name ||
      "Unknown Employee",
    company: incident.company || "",
    violation:
      incident.violation ||
      incident.violationType ||
      incident.violation_type ||
      "No violation type",
    severity: incident.severity || "Minor",
    status: normalizeStatus(incident.status || "Open"),
    date,
    reportedAt: incident.reportedAt || incident.reported_at || date,
    createdAt: incident.createdAt || incident.created_at || date,
  };
}

function normalizeBackendDeployment(deployment) {
  const date =
    deployment.deploymentDate ||
    deployment.deployment_date ||
    deployment.startDate ||
    deployment.start_date ||
    deployment.contractStart ||
    deployment.contract_start ||
    deployment.createdAt ||
    deployment.created_at ||
    deployment.date ||
    "";

  return {
    ...deployment,
    id: deployment.id,
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
      "Unknown Employee",
    company:
      deployment.company ||
      deployment.clientCompany ||
      deployment.client_company ||
      "Unassigned",
    status: deployment.status || deployment.deployment_status || "Active",
    date,
    deploymentDate: date,
    createdAt: deployment.createdAt || deployment.created_at || date,
  };
}

async function requestJson(url) {
  const response = await fetch(url);
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

async function safeRequestJson(url, fallback = []) {
  try {
    return await requestJson(url);
  } catch (error) {
    console.warn(`Optional dashboard request failed: ${url}`, error.message);
    return fallback;
  }
}

function normalizeDateValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRecordDate(record) {
  return (
    record?.reportedAt ||
    record?.createdAt ||
    record?.incidentDate ||
    record?.incident_date ||
    record?.date ||
    ""
  );
}

function getDeploymentTrendDate(employee) {
  return (
    employee?.contractStart ||
    employee?.contract_start ||
    employee?.createdAt ||
    employee?.created_at ||
    employee?.date ||
    ""
  );
}

function getDeploymentRecordDate(record) {
  return (
    record?.deploymentDate ||
    record?.deployment_date ||
    record?.startDate ||
    record?.start_date ||
    record?.contractStart ||
    record?.contract_start ||
    record?.createdAt ||
    record?.created_at ||
    record?.date ||
    ""
  );
}

function countRecordsByYear(records = [], getDate, year) {
  return records.filter((record) => {
    const dateValue = normalizeDateValue(getDate(record));
    return dateValue && dateValue.slice(0, 4) === String(year);
  }).length;
}

function buildYearComparison({ current, previous, goodWhenUp = true }) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  const diff = currentValue - previousValue;

  let percent = 0;

  if (previousValue > 0) {
    percent = Math.round((Math.abs(diff) / previousValue) * 100);
  }

  const isUp = diff > 0;
  const isDown = diff < 0;

  let label = "No change vs last year";

  if (previousValue === 0 && currentValue > 0) {
    label = "New records this year";
  } else if (isUp) {
    label = `↑ ${percent}% vs last year`;
  } else if (isDown) {
    label = `↓ ${percent}% vs last year`;
  }

  let tone = "neutral";

  if (isUp) {
    tone = goodWhenUp ? "good" : "bad";
  } else if (isDown) {
    tone = goodWhenUp ? "bad" : "good";
  }

  return {
    current: currentValue,
    previous: previousValue,
    diff,
    percent,
    label,
    direction: isUp ? "up" : isDown ? "down" : "flat",
    tone,
  };
}

function formatDiff(value) {
  const number = Number(value) || 0;

  if (number > 0) return `+${number}`;
  return String(number);
}

function isInSelectedDashboardRange(value, selectedYear, selectedMonth) {
  const dateValue = normalizeDateValue(value);

  if (!dateValue) return false;

  const recordYear = dateValue.slice(0, 4);
  const recordMonth = dateValue.slice(5, 7);

  if (recordYear !== String(selectedYear)) return false;

  if (Number(selectedMonth) > 0) {
    return recordMonth === String(selectedMonth).padStart(2, "0");
  }

  return true;
}

function aggregateByMonth(dataset = [], key, year, isCurrentYear) {
  const currentMonthIndex = new Date().getMonth();

  return monthList
    .map((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");

      const total = dataset.reduce((sum, item) => {
        const itemDate = normalizeDateValue(item?.date);

        if (
          !itemDate ||
          !itemDate.startsWith(year) ||
          itemDate.slice(5, 7) !== monthNumber
        ) {
          return sum;
        }

        return sum + (Number(item?.[key]) || 0);
      }, 0);

      return {
        label: month,
        value: total,
        index,
      };
    })
    .filter((item) => !isCurrentYear || item.index <= currentMonthIndex);
}

function buildMultiYearMonthlyTrend({
  source = [],
  valueKey,
  years = [],
  selectedYear,
  currentYear,
  currentMonth,
}) {
  const selectedIsCurrentYear = String(selectedYear) === String(currentYear);

  const visibleMonthLimit = selectedIsCurrentYear
    ? Math.max(1, Number(currentMonth) || 1)
    : 12;

  return monthList.slice(0, visibleMonthLimit).map((month, index) => {
    const monthNumber = String(index + 1).padStart(2, "0");

    const row = {
      label: month,
    };

    years.forEach((year) => {
      row[String(year)] = source.reduce((sum, item) => {
        const itemDate = normalizeDateValue(item?.date);

        if (
          itemDate &&
          itemDate.slice(0, 4) === String(year) &&
          itemDate.slice(5, 7) === monthNumber
        ) {
          return sum + (Number(item?.[valueKey]) || 0);
        }

        return sum;
      }, 0);
    });

    return row;
  });
}

function formatLastUpdated(date = new Date()) {
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCaseAgeInDays(dateString) {
  if (!dateString) return null;

  const incidentDate = new Date(dateString);
  if (Number.isNaN(incidentDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  incidentDate.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - incidentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isActiveIncident(status) {
  return ["Open", "Investigating", "For Review"].includes(
    normalizeStatus(status)
  );
}

function getExpiringDocumentsCount(employees) {
  return employees.reduce((count, emp) => {
    const docs = Array.isArray(emp.documents) ? emp.documents : [];

    const expiringDocs = docs.filter((doc) => {
      const expirationDate =
        doc?.expirationDate ||
        doc?.expiration_date ||
        doc?.expiryDate ||
        doc?.expiresAt ||
        doc?.date;

      if (!expirationDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const exp = new Date(expirationDate);
      if (Number.isNaN(exp.getTime())) return false;
      exp.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diffDays >= 0 && diffDays <= 30;
    });

    return count + expiringDocs.length;
  }, 0);
}

function buildSeverityDistribution(incidents = []) {
  const severityMap = {
    Minor: 0,
    Major: 0,
    Critical: 0,
  };

  incidents.forEach((incident) => {
    const severity = incident.severity || "Minor";

    if (severityMap[severity] !== undefined) {
      severityMap[severity] += 1;
    }
  });

  return Object.entries(severityMap).map(([name, value]) => ({
    name,
    value,
  }));
}

function buildCaseAgingDistribution(incidents = []) {
  const agingBuckets = {
    "0-7 Days": 0,
    "8-30 Days": 0,
    "30+ Days": 0,
  };

  incidents.forEach((incident) => {
    if (!isActiveIncident(incident.status)) return;

    const age = getCaseAgeInDays(getRecordDate(incident));
    if (age === null) return;

    if (age <= 7) agingBuckets["0-7 Days"] += 1;
    else if (age <= 30) agingBuckets["8-30 Days"] += 1;
    else agingBuckets["30+ Days"] += 1;
  });

  return Object.entries(agingBuckets).map(([name, value]) => ({
    name,
    value,
  }));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [fetchError, setFetchError] = useState("");

  const [activeDrilldown, setActiveDrilldown] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [data, setData] = useState({
    kpis: {
      total: 0,
      deployed: 0,
      available: 0,
      activeIncidents: 0,
      expiringDocs: 0,
    },
    workforce: [],
    incidents: [],
    rawEmployees: [],
    rawIncidents: [],
    rawDeployments: [],
  });

  const loadData = useCallback(
    async ({ silent = false, showError = true } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        setFetchError("");

        const [employeeData, incidentData, deploymentData] = await Promise.all([
          requestJson(EMPLOYEE_API_URL),
          requestJson(INCIDENT_API_URL),
          safeRequestJson(DEPLOYMENT_API_URL, []),
        ]);

        const employeesRaw = Array.isArray(employeeData)
          ? employeeData.map(normalizeBackendEmployee)
          : [];

        const incidentsRaw = Array.isArray(incidentData)
          ? incidentData.map(normalizeBackendIncident)
          : [];

        const deploymentsRaw = Array.isArray(deploymentData)
          ? deploymentData.map(normalizeBackendDeployment)
          : [];

        const activeEmployees = employeesRaw.filter((emp) => !emp.archived);
        const deployedEmployees = activeEmployees.filter(isEmployeeDeployed);

        const workforceSource =
          deploymentsRaw.length > 0
            ? deploymentsRaw
            : deployedEmployees.map((employee) => ({
                ...employee,
                date: getDeploymentTrendDate(employee),
              }));

        const workforce = workforceSource
          .map((record) => ({
            date: normalizeDateValue(getDeploymentRecordDate(record)),
            employees: 1,
          }))
          .filter((item) => item.date);

        const incidents = incidentsRaw
          .map((incident) => ({
            date: normalizeDateValue(getRecordDate(incident)),
            incidents: 1,
          }))
          .filter((item) => item.date);

        setData({
          kpis: {
            total: activeEmployees.length,
            deployed: deployedEmployees.length,
            available: Math.max(
              activeEmployees.length - deployedEmployees.length,
              0
            ),
            activeIncidents: incidentsRaw.filter((incident) =>
              isActiveIncident(incident.status)
            ).length,
            expiringDocs: getExpiringDocumentsCount(activeEmployees),
          },
          workforce,
          incidents,
          rawEmployees: activeEmployees,
          rawIncidents: incidentsRaw,
          rawDeployments: deploymentsRaw,
        });

        setLastUpdated(formatLastUpdated());
      } catch (error) {
        console.error("Dashboard backend fetch error:", error);

        if (showError) {
          setFetchError(error.message || "Unable to load dashboard data.");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let refreshTimer = null;

    const refreshSilently = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        loadData({ silent: true, showError: false });
      }, 150);
    };

    const handleDataUpdated = (event) => {
      if (event?.detail?.source === DATA_EVENT_SOURCE) return;
      refreshSilently();
    };

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", refreshSilently);

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", refreshSilently);
    };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ silent: true });
    setRefreshing(false);
  }, [loadData]);

  const isCurrentYear = selectedYear === currentYear;

  useEffect(() => {
    if (isCurrentYear && Number(selectedMonth) > currentMonth) {
      setSelectedMonth(0);
    }
  }, [isCurrentYear, selectedMonth, currentMonth]);

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);

    data.workforce.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    data.incidents.forEach((item) => {
      if (item?.date) years.add(item.date.slice(0, 4));
    });

    data.rawDeployments.forEach((item) => {
      const date = normalizeDateValue(getDeploymentRecordDate(item));
      if (date) years.add(date.slice(0, 4));
    });

    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [data.workforce, data.incidents, data.rawDeployments, currentYear]);

  const availableMonths = useMemo(() => {
    return monthList.map((month, index) => {
      const monthNumber = index + 1;
      const isFutureMonth =
        selectedYear === currentYear && monthNumber > currentMonth;

      return {
        name: month,
        value: monthNumber,
        available: !isFutureMonth,
      };
    });
  }, [selectedYear, currentYear, currentMonth]);

  const handleYearChange = (event) => {
    const nextYear = event.target.value;

    setSelectedYear(nextYear);

    if (nextYear === currentYear && Number(selectedMonth) > currentMonth) {
      setSelectedMonth(0);
    }
  };

  const handleMonthChange = (event) => {
    const nextMonth = Number(event.target.value);

    if (selectedYear === currentYear && nextMonth > currentMonth) {
      setSelectedMonth(0);
      return;
    }

    setSelectedMonth(nextMonth);
  };

  const workforceTrend = useMemo(
    () =>
      aggregateByMonth(
        data.workforce,
        "employees",
        selectedYear,
        isCurrentYear
      ),
    [data.workforce, selectedYear, isCurrentYear]
  );

  const incidentTrend = useMemo(
    () =>
      aggregateByMonth(
        data.incidents,
        "incidents",
        selectedYear,
        isCurrentYear
      ),
    [data.incidents, selectedYear, isCurrentYear]
  );

  const comparisonYears = useMemo(() => {
    const selected = Number(selectedYear);
    const availableYearSet = new Set(availableYears.map(Number));

    return [selected - 1, selected].filter(
      (year) => year >= 2024 && availableYearSet.has(year)
    );
  }, [selectedYear, availableYears]);

  const deploymentComparisonTrend = useMemo(() => {
    return buildMultiYearMonthlyTrend({
      source: data.workforce,
      valueKey: "employees",
      years: comparisonYears,
      selectedYear,
      currentYear,
      currentMonth,
    });
  }, [data.workforce, comparisonYears, selectedYear, currentYear, currentMonth]);

  const incidentComparisonTrend = useMemo(() => {
    return buildMultiYearMonthlyTrend({
      source: data.incidents,
      valueKey: "incidents",
      years: comparisonYears,
      selectedYear,
      currentYear,
      currentMonth,
    });
  }, [data.incidents, comparisonYears, selectedYear, currentYear, currentMonth]);

  const reportScope = useMemo(() => {
    const scopedIncidents = data.rawIncidents.filter((incident) =>
      isInSelectedDashboardRange(
        getRecordDate(incident),
        selectedYear,
        selectedMonth
      )
    );

    return {
      incidents: scopedIncidents,
    };
  }, [data.rawIncidents, selectedYear, selectedMonth]);

  const currentKPIS = data.kpis;

  const utilizationRate = useMemo(() => {
    const total = Number(currentKPIS.total) || 0;
    const deployed = Number(currentKPIS.deployed) || 0;

    if (!total) return 0;

    return Number(((deployed / total) * 100).toFixed(1));
  }, [currentKPIS]);

  const filteredSeverity = useMemo(() => {
    return buildSeverityDistribution(reportScope.incidents);
  }, [reportScope.incidents]);

  const filteredAging = useMemo(() => {
    return buildCaseAgingDistribution(reportScope.incidents);
  }, [reportScope.incidents]);

  const selectedPeriodLabel =
    Number(selectedMonth) === 0
      ? selectedYear
      : `${monthList[selectedMonth - 1]} ${selectedYear}`;

  const executiveActions = useMemo(() => {
    return buildExecutiveActionItems({
      employees: data.rawEmployees,
      incidents: reportScope.incidents,
      kpis: currentKPIS,
      utilizationRate,
    });
  }, [data.rawEmployees, reportScope.incidents, currentKPIS, utilizationRate]);

  const dashboardInsights = useMemo(() => {
    return buildDashboardInsights({
      employees: data.rawEmployees,
      incidents: data.rawIncidents,
      selectedYear,
      selectedMonth,
      kpis: currentKPIS,
      utilizationRate,
    });
  }, [
    data.rawEmployees,
    data.rawIncidents,
    selectedYear,
    selectedMonth,
    currentKPIS,
    utilizationRate,
  ]);

  const yearlyComparison = useMemo(() => {
    const currentSelectedYear = Number(selectedYear);
    const previousYear = currentSelectedYear - 1;

    const deploymentSource =
      data.rawDeployments.length > 0 ? data.rawDeployments : data.workforce;

    const currentDeploymentRecords = countRecordsByYear(
      deploymentSource,
      getDeploymentRecordDate,
      currentSelectedYear
    );

    const previousDeploymentRecords = countRecordsByYear(
      deploymentSource,
      getDeploymentRecordDate,
      previousYear
    );

    const currentIncidentRecords = countRecordsByYear(
      data.rawIncidents,
      getRecordDate,
      currentSelectedYear
    );

    const previousIncidentRecords = countRecordsByYear(
      data.rawIncidents,
      getRecordDate,
      previousYear
    );

    return {
      selectedYear: currentSelectedYear,
      previousYear,
      deployment: buildYearComparison({
        current: currentDeploymentRecords,
        previous: previousDeploymentRecords,
        goodWhenUp: true,
      }),
      incident: buildYearComparison({
        current: currentIncidentRecords,
        previous: previousIncidentRecords,
        goodWhenUp: false,
      }),
    };
  }, [data.rawDeployments, data.workforce, data.rawIncidents, selectedYear]);

  const kpiTrendData = useMemo(
    () => ({
      total: {
        label: "Current snapshot",
        direction: "flat",
        tone: "neutral",
      },
      deployed: {
        label: yearlyComparison.deployment.label,
        direction: yearlyComparison.deployment.direction,
        tone: yearlyComparison.deployment.tone,
      },
      available: {
        label: "Current available",
        direction: "flat",
        tone: "neutral",
      },
      utilizationRate: {
        label: `${utilizationRate}% current`,
        direction: "flat",
        tone:
          utilizationRate >= 80
            ? "good"
            : utilizationRate < 60
            ? "bad"
            : "neutral",
      },
      activeIncidents: {
        label: yearlyComparison.incident.label,
        direction: yearlyComparison.incident.direction,
        tone: yearlyComparison.incident.tone,
      },
      expiringDocs: {
        label: `${currentKPIS.expiringDocs} due soon`,
        direction: currentKPIS.expiringDocs > 0 ? "up" : "flat",
        tone: currentKPIS.expiringDocs > 0 ? "bad" : "good",
      },
    }),
    [currentKPIS, utilizationRate, yearlyComparison]
  );

  const handleOpenDrilldown = useCallback(
    (key) => {
      const disabledKeys = ["total", "deployed", "available"];
      if (disabledKeys.includes(key)) return;

      if (key === "activeIncidents") {
        navigate("/incidents");
        return;
      }

      const detail = dashboardInsights?.drilldowns?.[key];

      if (detail) {
        setActiveDrilldown(detail);
      }
    },
    [dashboardInsights, navigate]
  );

  const handleRowClick = useCallback(
    (row) => {
      if (!row.employeeId) return;

      const targetEmployee = data.rawEmployees.find(
        (emp) =>
          String(emp.id) === String(row.employeeId) ||
          String(emp.employeeId) === String(row.employeeId)
      );

      if (targetEmployee) {
        setEditingEmployee(targetEmployee);
        setActiveDrilldown(null);
      }
    },
    [data.rawEmployees]
  );

  const totalIncidentsForYear = useMemo(
    () => incidentTrend.reduce((sum, item) => sum + item.value, 0),
    [incidentTrend]
  );

  const totalIncidentsForPeriod = reportScope.incidents.length;

  const peakDeploymentMonth = useMemo(() => {
    if (!workforceTrend.length) return "N/A";

    const highest = [...workforceTrend].sort((a, b) => b.value - a.value)[0];

    return highest?.value ? `${highest.label} (${highest.value})` : "N/A";
  }, [workforceTrend]);

  const highestIncidentMonth = useMemo(() => {
    if (!incidentTrend.length) return "N/A";

    const highest = [...incidentTrend].sort((a, b) => b.value - a.value)[0];

    return highest?.value ? `${highest.label} (${highest.value})` : "N/A";
  }, [incidentTrend]);

  const topSeverity = useMemo(() => {
    if (!filteredSeverity.length) return "N/A";

    const highest = [...filteredSeverity].sort((a, b) => b.value - a.value)[0];

    return highest?.value ? highest.name : "N/A";
  }, [filteredSeverity]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Welljob Solutions & General Services Inc.", 14, 18);

    doc.setFontSize(12);
    doc.text("Executive Workforce Dashboard Report", 14, 26);
    doc.text(`Report Scope: ${selectedPeriodLabel}`, 14, 34);
    doc.text(`Generated: ${lastUpdated}`, 14, 42);

    autoTable(doc, {
      startY: 52,
      head: [["Metric", "Value"]],
      body: [
        ["Total Employees", currentKPIS.total],
        ["Deployed Employees", currentKPIS.deployed],
        ["Available Workers", currentKPIS.available],
        ["Utilization Rate", `${utilizationRate}%`],
        ["Current Active Incidents", currentKPIS.activeIncidents],
        ["Expiring Documents", currentKPIS.expiringDocs],
        ["Incidents in Report Scope", totalIncidentsForPeriod],
        ["Total Year Incidents", totalIncidentsForYear],
        ["Peak Deployment Month", peakDeploymentMonth],
        ["Highest Incident Month", highestIncidentMonth],
        ["Top Severity in Scope", topSeverity],
        [
          `Deployment Records ${yearlyComparison.previousYear}`,
          yearlyComparison.deployment.previous,
        ],
        [
          `Deployment Records ${yearlyComparison.selectedYear}`,
          yearlyComparison.deployment.current,
        ],
        ["Deployment Change", formatDiff(yearlyComparison.deployment.diff)],
        [
          `Incident Records ${yearlyComparison.previousYear}`,
          yearlyComparison.incident.previous,
        ],
        [
          `Incident Records ${yearlyComparison.selectedYear}`,
          yearlyComparison.incident.current,
        ],
        ["Incident Change", formatDiff(yearlyComparison.incident.diff)],
      ],
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Priority", "Type", "Recommendation", "Basis"]],
      body: executiveActions.map((action) => [
        action.priority,
        action.type,
        action.recommendation,
        action.basis || "-",
      ]),
      theme: "grid",
      headStyles: { fillColor: [22, 163, 74] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 28 },
        2: { cellWidth: 78 },
        3: { cellWidth: 52 },
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Month", "Deployment", "Incidents"]],
      body: monthList.map((month) => {
        const deployment = workforceTrend.find((item) => item.label === month);
        const incident = incidentTrend.find((item) => item.label === month);

        return [month, deployment?.value ?? 0, incident?.value ?? 0];
      }),
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Welljob_Dashboard_Report_${selectedPeriodLabel}.pdf`);
  }, [
    selectedPeriodLabel,
    lastUpdated,
    currentKPIS,
    utilizationRate,
    totalIncidentsForPeriod,
    totalIncidentsForYear,
    peakDeploymentMonth,
    highestIncidentMonth,
    topSeverity,
    workforceTrend,
    incidentTrend,
    executiveActions,
    yearlyComparison,
  ]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {fetchError}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/90">
                <FiBarChart2 />
                Executive Overview
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Workforce Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Real-time summary of employee deployment, workforce availability,
                incident monitoring, document compliance, and case aging.
              </p>

              <p className="mt-3 text-xs text-white/70">
                Last Updated: {lastUpdated}
              </p>

              <p className="mt-1 text-xs font-semibold text-white/70">
                Report Scope: {selectedPeriodLabel}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedMonth}
                onChange={handleMonthChange}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50"
              >
                <option className="text-slate-900" value={0}>
                  All Months
                </option>

                {availableMonths.map((month) => (
                  <option
                    className="text-slate-900"
                    key={month.name}
                    value={month.value}
                    disabled={!month.available}
                  >
                    {month.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={handleYearChange}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none backdrop-blur focus:border-white/50"
              >
                {availableYears.map((year) => (
                  <option className="text-slate-900" key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-60"
              >
                <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <RoleGuard permission={PERMISSIONS.CAN_EXPORT_PDF}>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
                >
                  <FiDownload />
                  Export PDF
                </button>
              </RoleGuard>
            </div>
          </div>
        </div>
      </section>

      <KPICards
        kpis={currentKPIS}
        utilizationRate={utilizationRate}
        trendData={kpiTrendData}
        onCardClick={handleOpenDrilldown}
      />

      <WorkforceHealthBanner health={dashboardInsights.health} />

      <ExecutiveActionItems actions={executiveActions} />

      <ExecutiveInsightTabs
        insights={dashboardInsights}
        onOpenDrilldown={handleOpenDrilldown}
      />

      <PredictiveInsightsPanel predictions={dashboardInsights.predictions} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Peak Deployment Month"
          value={peakDeploymentMonth}
          tone="indigo"
        />

        <InsightCard
          title="Highest Incident Month"
          value={highestIncidentMonth}
          tone="red"
        />

        <InsightCard
          title={`Top Severity (${selectedPeriodLabel})`}
          value={topSeverity}
          tone="amber"
        />

        <InsightCard
          title={`Total Incidents (${selectedPeriodLabel})`}
          value={totalIncidentsForPeriod}
          tone="emerald"
        />
      </section>

      <DeploymentTrendChart
        data={workforceTrend}
        comparisonData={deploymentComparisonTrend}
        years={comparisonYears}
        selectedYear={selectedYear}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <IncidentTrendChart
          data={incidentTrend}
          comparisonData={incidentComparisonTrend}
          years={comparisonYears}
          selectedYear={selectedYear}
        />

        <SeverityPieChart data={filteredSeverity} />

        <CaseAgingChart data={filteredAging} />
      </div>

      <DashboardDrilldownModal
        detail={activeDrilldown}
        onClose={() => setActiveDrilldown(null)}
        onRowClick={handleRowClick}
      />

      {editingEmployee && (
        <EditEmployeeModal
          employeeToEdit={editingEmployee}
          employees={data.rawEmployees}
          onClose={() => setEditingEmployee(null)}
          onSaveSuccess={async () => {
            setEditingEmployee(null);
            await loadData({ silent: true, showError: false });
            emitDataUpdated("DASHBOARD_EMPLOYEE_EDIT");
          }}
        />
      )}
    </div>
  );
}

function InsightCard({ title, value, tone = "indigo" }) {
  const tones = {
    indigo:
      "from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900",
    red: "from-red-50 to-white dark:from-red-950/30 dark:to-slate-900",
    amber:
      "from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900",
    emerald:
      "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900",
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm dark:border-white/10 ${
        tones[tone] || tones.indigo
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <h3 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
        {value}
      </h3>
    </div>
  );
}

function PredictiveInsightsPanel({
  predictions = { weekly: [], monthly: [], yearly: [] },
}) {
  const [forecastRange, setForecastRange] = useState("weekly");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  const CATEGORIES = [
    "All Categories",
    "I. ABSENCES AND TARDINESS",
    "II. DISORDERLY CONDUCT AND MISBEHAVIOR",
    "III. INSUBORDINATION / DISOBEDIENCE",
    "IV. NEGLECT OF DUTY",
    "V. BETRAYAL OF TRUST / DISHONESTY",
    "VI. HEALTH, SAFETY, SECURITY, AND SANITATION",
    "VII. SEXUAL HARASSMENT",
    "VIII. HABITUAL VIOLATIONS",
  ];

  const basePredictions = predictions[forecastRange] || [];
  const activePredictions = basePredictions.filter(
    (prediction) =>
      selectedCategory === "All Categories" ||
      prediction.category === selectedCategory
  );

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 to-white p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/20 dark:to-slate-900">
      <div className="mb-6 flex flex-col items-start justify-between gap-5 xl:flex-row xl:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-none">
            <FiTrendingUp size={24} />
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              System Forecasting & Next Steps
            </h2>

            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Run-rate predictive analysis based on current workforce data.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="h-10 cursor-pointer rounded-xl border border-indigo-200 bg-white px-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <div className="flex shrink-0 rounded-xl bg-indigo-100/60 p-1 dark:bg-slate-800/80">
            {["weekly", "monthly", "yearly"].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setForecastRange(range)}
                className={`rounded-lg px-5 py-2 text-xs font-bold transition-all ${
                  forecastRange === range
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white"
                    : "text-slate-600 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activePredictions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 py-12 text-center dark:border-white/10 dark:bg-slate-950/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <FiBarChart2 className="text-slate-400" size={20} />
          </div>

          <p className="text-base font-bold text-slate-700 dark:text-slate-300">
            No operational trend detected.
          </p>

          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            The system has not reached the percentage threshold to trigger a
            forecast for this category and period.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activePredictions.map((prediction) => {
            const isForecast = String(prediction.action || "").includes(
              "Forecast:"
            );

            const actionText = String(prediction.action || "").replace(
              "Forecast: ",
              ""
            );

            return (
              <div
                key={prediction.id}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-800/80 dark:hover:border-indigo-500/50"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-4xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                        {prediction.percentage}
                      </span>

                      <span className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Affected Workforce
                      </span>
                    </div>

                    <span className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {prediction.count} Cases
                    </span>
                  </div>

                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                    {prediction.category}
                  </h4>

                  <h3 className="mt-2 text-base font-extrabold leading-tight text-slate-900 dark:text-white">
                    {prediction.title}
                  </h3>
                </div>

                <div className="mt-5">
                  <div className="mb-4 h-px w-full bg-slate-100 dark:bg-slate-700/50" />

                  <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                    {isForecast && (
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        Forecast:{" "}
                      </span>
                    )}
                    {actionText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}