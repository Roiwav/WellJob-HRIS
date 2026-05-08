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
            Loading deployment records from backend...
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
