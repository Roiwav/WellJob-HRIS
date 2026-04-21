import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DeploymentTable from "../components/deployments/DeploymentTable";
import DeploymentModal from "../components/deployments/DeploymentModal";

/* TOAST */
function Toast({ show, message }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[9999] transform transition-all duration-500 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="bg-green-600 text-white px-5 py-3 rounded shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}

export default function Deployments() {
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [deployments, setDeployments] = useState([]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 🔥 SEARCH + DATE FILTER
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");

  useEffect(() => {
    loadDeployments();
  }, []);

  const loadDeployments = () => {
    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    let updated = false;

    // AUTO START DATE
    employees = employees.map((emp) => {
      if (
        emp.status &&
        emp.status.toLowerCase() === "deployed" &&
        !emp.start
      ) {
        updated = true;
        return {
          ...emp,
          start: new Date().toISOString().split("T")[0],
        };
      }
      return emp;
    });

    if (updated) {
      localStorage.setItem("employees", JSON.stringify(employees));
    }

    const mapped = employees
      .filter(
        (emp) =>
          emp.status &&
          emp.status.toLowerCase() === "deployed"
      )
      .map((emp) => ({
        id: emp.id,
        employee: emp.name,
        company: emp.company || "-",
        location: emp.location || "-",
        start: emp.start || "-",
        end: emp.end || "-",
        status: emp.status || "Active",
      }));

    setDeployments(mapped);
  };

  const openView = (deployment) => {
    setModalMode("view");
    setSelectedDeployment(deployment);
  };

  const openEdit = (deployment) => {
    setModalMode("edit");
    setSelectedDeployment(deployment);
  };

  const updateDeployment = (updated) => {
    const employees = JSON.parse(localStorage.getItem("employees")) || [];

    const updatedEmployees = employees.map((emp) =>
      emp.id === updated.id
        ? {
            ...emp,
            status: updated.status,
            location: updated.location,
            start:
              updated.start ||
              new Date().toISOString().split("T")[0],
            end: updated.end,
          }
        : emp
    );

    localStorage.setItem("employees", JSON.stringify(updatedEmployees));

    loadDeployments();

    setShowToast(false);

    setTimeout(() => {
      setToastMessage("Deployment updated successfully!");
      setShowToast(true);

      setTimeout(() => setShowToast(false), 2000);
    }, 50);
  };

  // 🔥 FILTER LOGIC (NO END DATE)
  const filteredDeployments = deployments.filter((d) => {
    const matchSearch =
      d.employee.toLowerCase().includes(search.toLowerCase()) ||
      d.company.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase());

    const startDate = new Date(d.start);

    const matchFrom =
      !fromDate || startDate >= new Date(fromDate);

    return matchSearch && matchFrom;
  });

  return (
    <>
      <div className="space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Deployment Tracking
          </h1>

          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Monitor employee deployments across client companies
          </p>
        </div>

        {/* 🔥 SEARCH + FROM DATE ONLY */}
        <div className="flex flex-col md:flex-row gap-4">

          <input
            type="text"
            placeholder="Search deployment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-white"
          />

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-white"
          />

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