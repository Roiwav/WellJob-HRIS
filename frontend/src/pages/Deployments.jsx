import { useMemo, useState } from "react";
import { FiCalendar, FiSearch } from "react-icons/fi";

import DeploymentTable from "../components/deployments/table/DeploymentTable";
import DeploymentModal from "../components/deployments/modals/DeploymentModal";
import DeploymentToast from "../components/deployments/shared/DeploymentToast";

import {
  COMPANY_LOCATIONS,
  safeParse,
  getDeploymentsFromStorage,
  getMonthOptions,
  getYearOptions,
} from "../utils/deployments/deploymentHelpers";

const EMPLOYEES_KEY = "employees";

export default function Deployments() {
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [deployments, setDeployments] = useState(() =>
    getDeploymentsFromStorage()
  );

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(deployments), [deployments]);

  const openView = (deployment) => {
    setModalMode("view");
    setSelectedDeployment(deployment);
  };

  const showSuccessToast = (message) => {
    setShowToast(false);

    setTimeout(() => {
      setToastMessage(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2200);
    }, 50);
  };

  const updateDeployment = (updatedDeployment) => {
    const employees = safeParse(EMPLOYEES_KEY);

    const updatedEmployees = employees.map((emp) =>
      emp.id === updatedDeployment.id
        ? {
            ...emp,
            deployment: {
              location: COMPANY_LOCATIONS[updatedDeployment.company] || "-",
              start: updatedDeployment.start,
              status: updatedDeployment.status,
            },
          }
        : emp
    );

    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(updatedEmployees));
    window.dispatchEvent(new Event("dataUpdated"));

    setDeployments(getDeploymentsFromStorage());
    showSuccessToast("Deployment updated successfully!");
  };

  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      const keyword = search.toLowerCase().trim();

      const matchSearch =
        String(deployment.id || "").toLowerCase().includes(keyword) ||
        String(deployment.employee || "").toLowerCase().includes(keyword) ||
        String(deployment.company || "").toLowerCase().includes(keyword) ||
        String(deployment.location || "").toLowerCase().includes(keyword) ||
        String(deployment.status || "").toLowerCase().includes(keyword) ||
        String(deployment.employmentType || "").toLowerCase().includes(keyword);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Deployment Tracking
          </h1>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor employee assignments, client locations, and contract duration.
          </p>
        </div>

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

        <DeploymentTable deployments={filteredDeployments} openView={openView} />

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