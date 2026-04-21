import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiCalendar, FiSearch } from "react-icons/fi";
import DeploymentTable from "../components/deployments/DeploymentTable";
import DeploymentModal from "../components/deployments/DeploymentModal";

function Toast({ show, message }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[9999] transform transition-all duration-500 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}

function getDeploymentsFromStorage() {
  const employees = JSON.parse(localStorage.getItem("employees")) || [];

  return employees
    .filter((emp) => emp.status === "Deployed" && !emp.archived)
    .map((emp) => ({
      id: emp.id,
      employee: emp.name,
      company: emp.company || "-",

      // 🔥 CONNECTED NA SA EMPLOYEE DEPLOYMENT
      location: emp.deployment?.location || "-",
      start: emp.deployment?.start || new Date().toISOString().split("T")[0],
      end: emp.deployment?.end || "-",
      status: emp.deployment?.status || "Active",
    }));
}

function getMonthOptions() {
  return [
    { value: "", label: "All Months" },
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];
}

function getYearOptions(deployments) {
  const years = deployments
    .map((deployment) => {
      if (!deployment.start || deployment.start === "-") return null;
      const date = new Date(deployment.start);
      if (Number.isNaN(date.getTime())) return null;
      return String(date.getFullYear());
    })
    .filter(Boolean);

  const uniqueYears = [...new Set(years)].sort((a, b) => Number(b) - Number(a));

  return [{ value: "", label: "All Years" }, ...uniqueYears.map((year) => ({
    value: year,
    label: year,
  }))];
}

export default function Deployments() {
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [deployments, setDeployments] = useState(() => getDeploymentsFromStorage());

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

  const openEdit = (deployment) => {
    setModalMode("edit");
    setSelectedDeployment(deployment);
  };

  const updateDeployment = (updatedDeployment) => {
    const employees = JSON.parse(localStorage.getItem("employees")) || [];

  const updatedEmployees = employees.map((emp) =>
    emp.id === updatedDeployment.id
      ? {
          ...emp,
          deployment: {
            location: updatedDeployment.location,
            start: updatedDeployment.start,
            end: updatedDeployment.end,
            status: updatedDeployment.status,
          },
        }
      : emp
  );

    localStorage.setItem("employees", JSON.stringify(updatedEmployees));
    setDeployments(getDeploymentsFromStorage());

    setShowToast(false);

    setTimeout(() => {
      setToastMessage("Deployment updated successfully!");
      setShowToast(true);

      setTimeout(() => setShowToast(false), 2200);
    }, 50);
  };

  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      const keyword = search.toLowerCase().trim();

      const matchSearch =
        deployment.employee.toLowerCase().includes(keyword) ||
        deployment.company.toLowerCase().includes(keyword) ||
        deployment.location.toLowerCase().includes(keyword) ||
        deployment.status.toLowerCase().includes(keyword);

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

          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Monitor employee deployments across client companies.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center">
          <div className="relative w-full max-w-xs">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search employee, company, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
            />
          </div>

          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
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
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
          >
            {yearOptions.map((year) => (
              <option key={year.label} value={year.value}>
                {year.label}
              </option>
            ))}
          </select>
        </div>

        <DeploymentTable
          deployments={filteredDeployments}
          openView={openView}
          openEdit={openEdit}
        />

        <DeploymentModal
          deployment={selectedDeployment}
          mode={modalMode}
          onUpdate={updateDeployment}
          close={() => setSelectedDeployment(null)}
        />
      </div>

      <Toast show={showToast} message={toastMessage} />
    </>
  );
}