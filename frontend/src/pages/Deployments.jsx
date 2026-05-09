// Deployments.jsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiRefreshCw, FiSearch, FiBriefcase, FiUsers } from "react-icons/fi";
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
  return {
    id: item.id || item.employeeId || item.employee_id,
    employeeId: item.employeeId || item.id || item.employee_id,
    employee:
      item.employee ||
      item.employeeName ||
      item.employee_name ||
      item.name ||
      "Unknown Employee",
    company: item.company || "-",
    location: item.location || "-",
    start: item.start || item.contractStart || item.contract_start || "-",
    status: item.status || "Active",
    employmentType:
      item.employmentType || item.employment_type || "Permanent",
    contractStart: item.contractStart || item.contract_start || item.start || "-",
    contractEnd: item.contractEnd || item.contract_end || "-",
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: item.updatedAt || item.updated_at || null,
  };
}

export default function Deployments() {
  const { user } = useAuth();
  // Kinuha ang current user info
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  // Check kung Super Admin

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
        `${DEPLOYMENT_API_URL}/${updatedDeployment.employeeId || updatedDeployment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: targetStatus,
          }),
        }
      );
      await fetchDeployments();

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
      await axios.put(`${EMPLOYEES_API_URL}/${updatedDeployment.employeeId || updatedDeployment.id}/contract-end`, {
        contractEnd: updatedDeployment.contractEnd
      });
      setDeployments((prev) =>
        prev.map((dep) =>
          dep.id === updatedDeployment.id ? updatedDeployment : dep
        )
      );
      showSuccessToast("Contract end date updated successfully!");

    } catch (error) {
      console.error("Error updating contract end date:", error);
      setFetchError("Failed to update contract end date. Please check your backend.");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDeployments();
  };

  // UPDATED SEARCH LOGIC (WITH STRING NORMALIZATION & MULTI-TERM SEARCH)
  const filteredDeployments = useMemo(() => {
    // 1. Linisin ang search bar input (tanggalin ang tuldok, special chars, at gawing lowercase)
    const cleanSearch = search.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    
    // 2. I-split sa mga salita
    const searchTerms = cleanSearch ? cleanSearch.split(/\s+/) : [];

    return deployments.filter((deployment) => {
      // 3. Linisin ang employee name mula sa database bago i-check
      const cleanEmployeeName = String(deployment.employee || "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
      
      // 4. I-check kung ang BAWAT salitang tinype ay nasa malinis na pangalan ng employee
      const matchName = searchTerms.every(term => cleanEmployeeName.includes(term));

      // 5. Fallback check para sa ID, Company, Location, Status, at Employment Type
      const rawSearch = search.toLowerCase().trim();
      const matchSearch = matchName ||
        String(deployment.id || "").toLowerCase().includes(rawSearch) ||
        String(deployment.company || "").toLowerCase().includes(rawSearch) ||
        String(deployment.location || "").toLowerCase().includes(rawSearch) ||
        String(deployment.status || "").toLowerCase().includes(rawSearch) ||
        String(deployment.employmentType || "").toLowerCase().includes(rawSearch);

      // Date filtering logic (walang binago para hindi masira ang Calendar filtering)
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
              Monitor employee assignments, client locations, and contract duration.
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

        {/* ============================================================== */}
        {/* NEW: CLIENT DEPLOYMENT SUMMARY GRID (24 COMPANIES)             */}
        {/* ============================================================== */}
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

// ============================================================================
// CLIENT DEPLOYMENT SUMMARY COMPONENT (Ang grid ng 24 Companies)
// ============================================================================
export function ClientDeploymentSummary({ deployments = [] }) {
  // GINAWANG FALSE: Para naka-hide na agad ang summary by default
  const [isVisible, setIsVisible] = useState(false);

  const companyStats = useMemo(() => {
    const COMPANIES = [
      "SM Supermalls", "Robinsons Retail Holdings", "Ayala Land Inc.",
      "Jollibee Foods Corporation", "San Miguel Corporation", "PLDT Inc.",
      "Globe Telecom", "BDO Unibank", "Metrobank", "Puregold Price Club",
      "Wilcon Depot", "DMCI Holdings", "Megaworld Corporation",
      "Unilab Inc.", "Nestlé Philippines", "Coca-Cola Philippines",
      "Pepsi-Cola Products Philippines", "Toyota Philippines", "Honda Philippines",
      "Accenture Philippines", "IBM Philippines", "Teleperformance Philippines",
      "Concentrix Philippines", "Sitel Philippines",
    ];

    const stats = {};
    COMPANIES.forEach((company) => {
      stats[company] = 0; 
    });

    deployments.forEach((dep) => {
      const status = String(dep?.status || "").trim().toLowerCase();
      const isActive = status === "active" || status === "deployed" || status === "active deployed";

      if (isActive && dep.company && stats[dep.company] !== undefined) {
        stats[dep.company] += 1;
      }
    });

    return Object.entries(stats)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count); 
  }, [deployments]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
      
      {/* HEADER SECTION */}
      <div className={`flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center ${isVisible ? "mb-6" : ""}`}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
            <FiUsers size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Active Client Deployments</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Live headcount distribution across 24 partner companies.
            </p>
          </div>
        </div>

        {/* HIDE / SHOW BUTTON */}
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="shrink-0 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {isVisible ? "Hide Summary" : "Show Summary"}
        </button>
      </div>

      {/* GRID SECTION */}
      {isVisible && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {companyStats.map((item) => (
            <div 
              key={item.company} 
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-800/50"
            >
              <div className="mb-3">
                <span className={`text-3xl font-black tracking-tight ${item.count > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}>
                  {item.count}
                </span>
                <span className="ml-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Staff
                </span>
              </div>

              {/* Company Name Section (No Icon) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/50">
                <h3 className="line-clamp-2 text-xs font-bold leading-snug text-slate-700 dark:text-slate-300">
                  {item.company}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}