// Deployments.jsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiRefreshCw, FiSearch } from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../context/useAuth";

import DeploymentTable from "../components/deployments/table/DeploymentTable";
import DeploymentModal from "../components/deployments/modals/DeploymentModal";
import DeploymentToast from "../components/deployments/shared/DeploymentToast";

import {
  getMonthOptions,
  getYearOptions,
} from "../utils/deployments/deploymentHelpers";

const API_BASE = "http://localhost:5000/api";
const DEPLOYMENT_API_URL = `${API_BASE}/deployments`;
const EMPLOYEES_API_URL = `${API_BASE}/employees`;
const DATA_EVENT_SOURCE = "deployments-page";

function emitDataUpdated(action = "DEPLOYMENTS_UPDATED") {
  window.dispatchEvent(
    new CustomEvent("dataUpdated", {
      detail: {
        source: DATA_EVENT_SOURCE,
        domain: "deployments",
        action,
        at: Date.now(),
      },
    })
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

function normalizeDeployment(item) {
  const employeeId =
    item.employeeId ||
    item.employee_id ||
    item.empId ||
    item.employeeID ||
    "";

  const deploymentId = item.deploymentId || item.deployment_id || item.id || "";

  const start =
    item.start ||
    item.deploymentDate ||
    item.deployment_date ||
    item.contractStart ||
    item.contract_start ||
    item.startDate ||
    item.start_date ||
    "-";

  const contractEnd =
    item.contractEnd ||
    item.contract_end ||
    item.endDate ||
    item.end_date ||
    item.deploymentEnd ||
    item.deployment_end ||
    "-";

  return {
    ...item,
    id: employeeId || deploymentId,
    deploymentId,
    employeeId,
    employee:
      item.employee ||
      item.employeeName ||
      item.employee_name ||
      item.name ||
      "Unknown Employee",
    company: item.company || item.clientCompany || item.client_company || "-",
    location:
      item.location ||
      item.deploymentLocation ||
      item.deployment_location ||
      item.company ||
      "-",
    start,
    status:
      item.status ||
      item.deploymentStatus ||
      item.deployment_status ||
      "Active",
    employmentType: item.employmentType || item.employment_type || "Permanent",
    contractStart:
      item.contractStart ||
      item.contract_start ||
      item.deploymentDate ||
      item.deployment_date ||
      start,
    contractEnd,
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: item.updatedAt || item.updated_at || null,
  };
}

export default function Deployments() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [deployments, setDeployments] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(deployments), [deployments]);

  const showSuccessToast = useCallback((message) => {
    setShowToast(false);

    setTimeout(() => {
      setToastMessage(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2200);
    }, 50);
  }, []);

  const fetchDeployments = useCallback(async () => {
    try {
      setFetchError("");

      const data = await requestJson(DEPLOYMENT_API_URL);

      const normalized = Array.isArray(data)
        ? data.map(normalizeDeployment)
        : [];

      setDeployments(normalized);
    } catch (error) {
      console.error("Fetch deployments error:", error);
      setFetchError(error.message || "Unable to load deployments.");
      setDeployments([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    const handleDataUpdated = (event) => {
      if (event?.detail?.source === DATA_EVENT_SOURCE) return;
      fetchDeployments();
    };

    const handleWindowFocus = () => {
      fetchDeployments();
    };

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchDeployments]);

  const openView = (deployment) => {
    setModalMode("view");
    setSelectedDeployment(deployment);
  };

  const updateDeployment = async (updatedDeployment) => {
    try {
      const targetStatus = updatedDeployment.status;

      if (!["Completed", "Cancelled"].includes(targetStatus)) {
        showSuccessToast("No backend update needed.");
        return;
      }

      await requestJson(
        `${DEPLOYMENT_API_URL}/${
          updatedDeployment.employeeId || updatedDeployment.id
        }/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: targetStatus,
          }),
        }
      );

      await fetchDeployments();
      emitDataUpdated(`DEPLOYMENT_${targetStatus.toUpperCase()}`);

      showSuccessToast(
        targetStatus === "Cancelled"
          ? "Deployment cancelled successfully!"
          : "Deployment marked as completed successfully!"
      );
    } catch (error) {
      console.error("Update deployment error:", error);
      setFetchError(error.message || "Unable to update deployment.");
    }
  };

  const handleInlineUpdateRow = async (updatedDeployment) => {
  try {
    await axios.put(
      `${EMPLOYEES_API_URL}/${
        updatedDeployment.employeeId || updatedDeployment.id
      }/contract-end`,
      {
        contractEnd: updatedDeployment.contractEnd,
        endReason: updatedDeployment.endReason,
        endRemarks: updatedDeployment.endRemarks,
        userId: user?.userId || user?.id || null,
        username: user?.username || null,
        fullName: user?.full_name || user?.fullName || user?.username || null,
        role: user?.role || null,
      }
    );

    await fetchDeployments();
    emitDataUpdated("DEPLOYMENT_CONTRACT_ENDED");

    showSuccessToast("Deployment contract ended successfully!");
  } catch (error) {
    console.error("Error ending deployment contract:", error);
    setFetchError(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to end deployment contract. Please check your backend."
    );
  }
};

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDeployments();
  };

  const filteredDeployments = useMemo(() => {
    const cleanSearch = search
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const searchTerms = cleanSearch ? cleanSearch.split(/\s+/) : [];
    const rawSearch = search.toLowerCase().trim();

    return deployments.filter((deployment) => {
      const cleanEmployeeName = String(deployment.employee || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "");

      const matchName =
        searchTerms.length === 0 ||
        searchTerms.every((term) => cleanEmployeeName.includes(term));

      const matchSearch =
        !rawSearch ||
        matchName ||
        String(deployment.id || "").toLowerCase().includes(rawSearch) ||
        String(deployment.employeeId || "").toLowerCase().includes(rawSearch) ||
        String(deployment.company || "").toLowerCase().includes(rawSearch) ||
        String(deployment.location || "").toLowerCase().includes(rawSearch) ||
        String(deployment.status || "").toLowerCase().includes(rawSearch) ||
        String(deployment.employmentType || "")
          .toLowerCase()
          .includes(rawSearch);

      if (!deployment.start || deployment.start === "-") {
        return matchSearch && !selectedMonth && !selectedYear;
      }

      const startDate = new Date(deployment.start);
      if (Number.isNaN(startDate.getTime())) return false;

      const matchMonth =
        selectedMonth === "" || startDate.getMonth() === Number(selectedMonth);

      const matchYear =
        selectedYear === "" || String(startDate.getFullYear()) === selectedYear;

      return matchSearch && matchMonth && matchYear;
    });
  }, [deployments, search, selectedMonth, selectedYear]);

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Deployment Tracking
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor employee assignments, client locations, and contract
              duration.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            <FiRefreshCw className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {fetchError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {fetchError}
          </div>
        )}

        <ClientDeploymentSummary deployments={deployments} />

        <div className="flex flex-col items-start gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full max-w-xs">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

            <input
              type="text"
              placeholder="Search ID, employee, company, location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="relative">
            <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {monthOptions.map((month) => (
                <option key={month.label} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {yearOptions.map((year) => (
              <option key={year.label} value={year.value}>
                {year.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-gray-200 bg-white px-6 py-14 text-center text-sm font-semibold text-gray-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
            Loading deployment records...
          </div>
        ) : (
          <DeploymentTable
            deployments={filteredDeployments}
            openView={openView}
            onUpdateRow={handleInlineUpdateRow}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        <DeploymentModal
          deployment={selectedDeployment}
          mode={modalMode}
          onUpdate={updateDeployment}
          close={() => setSelectedDeployment(null)}
        />
      </div>

      <DeploymentToast show={showToast} message={toastMessage} />
    </>
  );
}

function ClientDeploymentSummary({ deployments = [] }) {
  const [showAllCompanies, setShowAllCompanies] = useState(false);

  const summaryData = useMemo(() => {
    const companyMap = new Map();

    deployments.forEach((deployment) => {
      const company = deployment.company || "Unassigned Company";
      const status = String(deployment.status || "Active").toLowerCase();

      if (!companyMap.has(company)) {
        companyMap.set(company, {
          company,
          total: 0,
          completed: 0,
          cancelled: 0,
        });
      }

      const current = companyMap.get(company);
      current.total += 1;

      if (status === "completed") {
        current.completed += 1;
      }

      if (status === "cancelled" || status === "canceled") {
        current.cancelled += 1;
      }
    });

    const companies = Array.from(companyMap.values()).sort(
      (a, b) => b.total - a.total || a.company.localeCompare(b.company)
    );

    const totalDeployments = deployments.length;
    const totalCompanies = companies.length;
    const completedDeployments = companies.reduce(
      (sum, company) => sum + company.completed,
      0
    );
    const cancelledDeployments = companies.reduce(
      (sum, company) => sum + company.cancelled,
      0
    );

    const topCompany = companies[0] || null;

    return {
      companies,
      totalDeployments,
      totalCompanies,
      completedDeployments,
      cancelledDeployments,
      topCompany,
    };
  }, [deployments]);

  const visibleCompanies = showAllCompanies
    ? summaryData.companies
    : summaryData.companies.slice(0, 6);

  if (deployments.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-center">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            No deployment summary available
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Client deployment distribution will appear once records are
            available.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-slate-950/40">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Client Deployment Summary
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Compact overview of assigned employees per client company.
            </p>
          </div>

          {summaryData.topCompany && (
            <div className="rounded-xl border border-indigo-100 bg-white px-4 py-2 dark:border-indigo-500/20 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Highest Deployment
              </p>

              <p className="mt-0.5 max-w-xs truncate text-xs font-extrabold text-slate-900 dark:text-white">
                {summaryData.topCompany.company}
              </p>

              <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                {summaryData.topCompany.total} employee(s)
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryStatCard
            label="Total"
            value={summaryData.totalDeployments}
            helper="Assigned employees"
          />

          <SummaryStatCard
            label="Companies"
            value={summaryData.totalCompanies}
            helper="Client companies"
          />

          <SummaryStatCard
            label="Done"
            value={summaryData.completedDeployments}
            helper="Completed"
            tone="blue"
          />

          <SummaryStatCard
            label="Cancelled"
            value={summaryData.cancelledDeployments}
            helper="Stopped"
            tone="rose"
          />
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Distribution by Client
            </h3>

            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Showing {visibleCompanies.length} of{" "}
              {summaryData.companies.length} companies.
            </p>
          </div>

          {summaryData.companies.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllCompanies((prev) => !prev)}
              className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
            >
              {showAllCompanies
                ? "Show less"
                : `Show all ${summaryData.companies.length}`}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {visibleCompanies.map((item, index) => (
            <ClientCompanyRow
              key={item.company}
              item={item}
              rank={index + 1}
              totalDeployments={summaryData.totalDeployments}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryStatCard({ label, value, helper, tone = "slate" }) {
  const toneStyles = {
    slate:
      "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white",
    blue: "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    rose: "border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        toneStyles[tone] || toneStyles.slate
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">
        {label}
      </p>

      <p className="mt-1 text-xl font-black leading-none">{value}</p>

      <p className="mt-1 text-[11px] font-semibold opacity-60">{helper}</p>
    </div>
  );
}

function ClientCompanyRow({ item, rank, totalDeployments }) {
  const percentage =
    totalDeployments > 0
      ? Math.round((Number(item.total || 0) / totalDeployments) * 100)
      : 0;

  const hasCompleted = Number(item.completed || 0) > 0;
  const hasCancelled = Number(item.cancelled || 0) > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:border-indigo-300 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-indigo-500/50 dark:hover:bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-black text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
          #{rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                {item.company}
              </h4>

              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {percentage}% of total deployments
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-black leading-none text-slate-900 dark:text-white">
                {item.total}
              </p>

              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                Total
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <StatusPill
                label="Done"
                value={item.completed}
                tone={hasCompleted ? "blue" : "muted"}
              />

              <StatusPill
                label="Cancel"
                value={item.cancelled}
                tone={hasCancelled ? "rose" : "muted"}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ label, value, tone = "muted" }) {
  const toneStyles = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    muted:
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
        toneStyles[tone] || toneStyles.muted
      }`}
    >
      {label}: {value}
    </span>
  );
}