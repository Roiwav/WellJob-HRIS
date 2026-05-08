import { useCallback, useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiEye,
  FiInbox,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ComplianceBadge from "../components/employees/ComplianceBadge";
import EmployeeModal from "../components/employees/EmployeeModal";

const EMPLOYEE_API_URL = "http://localhost:5000/api/employees";

const REQUIRED_DOCUMENTS = [
  "Resume",
  "NSO/PSA",
  "SSS (ID or E1 form)",
  "Pag-IBIG (ID or MDRF Form)",
  "PhilHealth (ID or MDF Form)",
  "Diploma",
  "Cedula",
  "Barangay Clearance",
  "NBI/Police Clearance",
];

const EXPIRABLE_DOCUMENTS = ["Barangay Clearance", "NBI/Police Clearance"];

function getApiError(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function parseDocuments(documents) {
  if (typeof documents === "string") {
    try {
      const parsed = JSON.parse(documents);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(documents) ? documents : [];
}

function getDocumentStatus(expirationDate) {
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  if (Number.isNaN(exp.getTime())) return "No Data";

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}

function getCompliance(rawDocuments = []) {
  const documents = parseDocuments(rawDocuments);

  if (!documents.length) return "No Data";

  const hasExpired = documents.some((doc) => {
    if (!doc || typeof doc === "string") return false;
    if (!EXPIRABLE_DOCUMENTS.includes(doc.name)) return false;
    return getDocumentStatus(doc.expirationDate || doc.expiration_date) === "Expired";
  });

  if (hasExpired) return "Expired";

  const hasExpiringSoon = documents.some((doc) => {
    if (!doc || typeof doc === "string") return false;
    if (!EXPIRABLE_DOCUMENTS.includes(doc.name)) return false;
    return getDocumentStatus(doc.expirationDate || doc.expiration_date) === "Expiring Soon";
  });

  if (hasExpiringSoon) return "Expiring Soon";

  const completedCount = REQUIRED_DOCUMENTS.filter((requiredName) => {
    const doc = documents.find((item) =>
      typeof item === "string" ? item === requiredName : item?.name === requiredName
    );

    if (!doc) return false;

    if (typeof doc === "string") {
      return !EXPIRABLE_DOCUMENTS.includes(requiredName);
    }

    if (!doc.filePath && !doc.file_path && !doc.file) return false;

    if (
      EXPIRABLE_DOCUMENTS.includes(requiredName) &&
      !(doc.expirationDate || doc.expiration_date)
    ) {
      return false;
    }

    return true;
  }).length;

  if (completedCount === REQUIRED_DOCUMENTS.length) return "Complete";
  return "Incomplete";
}

function SuccessModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="mb-2 text-lg font-extrabold text-green-600">Success</h3>
        <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  tone = "green",
  isProcessing = false,
  onConfirm,
  onCancel,
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-green-600 hover:bg-green-700 text-white";

  const titleClass =
    tone === "red"
      ? "text-red-700 dark:text-red-300"
      : "text-green-700 dark:text-green-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className={`mb-4 text-lg font-extrabold ${titleClass}`}>
          {title}
        </h2>
        <p className="mb-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
          {message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
          >
            {isProcessing ? "Processing..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 rounded-xl bg-gray-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ArchivedEmployees() {
  const navigate = useNavigate();

  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchArchivedEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await axios.get(EMPLOYEE_API_URL);
      const employees = Array.isArray(response.data) ? response.data : [];

      const archived = employees.filter(
        (emp) => emp.archived === true || Number(emp.archived) === 1
      );

      setArchivedEmployees(archived);
    } catch (error) {
      console.error("Error fetching archived employees:", error);
      setArchivedEmployees([]);
      setErrorMessage(getApiError(error, "Unable to fetch archived employees."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchivedEmployees();
  }, [fetchArchivedEmployees]);

  const handleRestore = async (id) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMessage("");

      await axios.put(`${EMPLOYEE_API_URL}/restore/${id}`);
      setArchivedEmployees((prev) => prev.filter((emp) => String(emp.id) !== String(id)));
      setRestoreTarget(null);
      setSuccessMessage("Employee restored successfully.");
    } catch (error) {
      console.error("Error restoring employee:", error);
      setErrorMessage(getApiError(error, "Failed to restore employee."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMessage("");

      await axios.delete(`${EMPLOYEE_API_URL}/${id}`);
      setArchivedEmployees((prev) => prev.filter((emp) => String(emp.id) !== String(id)));
      setDeleteTarget(null);
      setSuccessMessage("Employee permanently deleted.");
    } catch (error) {
      console.error("Error deleting employee:", error);
      setErrorMessage(getApiError(error, "Failed to delete employee."));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            title="Back to Employees"
          >
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
              Archived Employees
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              View, restore, or permanently delete inactive employee records.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchArchivedEmployees}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-white/10">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
              Archived Records
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Records removed from the active employee list.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {archivedEmployees.length} archived
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr className="border-b border-gray-200 text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Compliance</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-14 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                    Loading archived employees from backend...
                  </td>
                </tr>
              ) : archivedEmployees.length > 0 ? (
                archivedEmployees.map((emp) => {
                  const compliance = getCompliance(emp.documents);
                  return (
                    <tr
                      key={emp.id}
                      className="transition hover:bg-indigo-50/50 dark:hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {emp.id || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {emp.name || "-"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {emp.company || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300">
                          Inactive
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ComplianceBadge status={compliance} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewEmployee(emp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500"
                            title="View employee"
                          >
                            <FiEye />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRestoreTarget(emp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-green-100 bg-green-50 text-green-700 transition hover:bg-green-600 hover:text-white dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300 dark:hover:bg-green-600"
                            title="Restore employee"
                          >
                            <FiRotateCcw />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(emp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-700 transition hover:bg-red-600 hover:text-white dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-600"
                            title="Permanently delete employee"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10">
                        <FiInbox size={24} />
                      </div>
                      <p className="font-extrabold text-gray-900 dark:text-white">
                        No archived employees
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Archived employees will appear here once HR marks them as inactive.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewEmployee && (
        <EmployeeModal employee={viewEmployee} onClose={() => setViewEmployee(null)} />
      )}

      {restoreTarget && (
        <ConfirmModal
          title="Restore Employee"
          message={
            <>
              Are you sure you want to restore <b>{restoreTarget.name}</b>? This employee will return to the main employee table.
            </>
          }
          confirmLabel="Yes, Restore"
          tone="green"
          isProcessing={isProcessing}
          onConfirm={() => handleRestore(restoreTarget.id)}
          onCancel={() => setRestoreTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Permanently Delete Employee"
          message={
            <>
              Are you sure you want to permanently delete <b>{deleteTarget.name}</b>? This action cannot be undone.
            </>
          }
          confirmLabel="Yes, Delete"
          tone="red"
          isProcessing={isProcessing}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage("")} />
    </div>
  );
}
