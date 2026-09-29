import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClipboard,
  FiEdit3,
  FiFileText,
  FiImage,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import { useAuth } from "../context/useAuth";
import { EMPLOYEE_API_URL } from "../utils/employees/employeeFormHelpers";
const ATTENDANCE_STATUSES = [
  { value: "Unmarked", label: "Not Marked" },
  { value: "Present", label: "Present" },
  { value: "Late", label: "Late" },
  { value: "Absent", label: "Absent" },
  { value: "On Leave", label: "On Leave" },
  { value: "Rest Day", label: "Rest Day" },
];
const ATTENDANCE_SOURCES = [
  {
    value: "coordinator",
    label: "Coordinator Monitoring",
    description: "Recorded directly by the assigned HR Coordinator.",
  },
  {
    value: "client",
    label: "Client-Provided Record",
    description: "Copied from an attendance record provided by the client.",
  },
];
const NOTE_RECOMMENDED_STATUSES = ["Late", "Absent", "On Leave"];
const MAX_CLIENT_RECORD_SIZE = 10 * 1024 * 1024;
const DRAFT_STORAGE_PREFIX = "welljob:attendance-draft";
const CLIENT_RECORD_DRAFTS = new Map();
const STATUS_META = {
  Unmarked: {
    selectClass:
      "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
  },
  Present: {
    selectClass:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  Late: {
    selectClass:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  Absent: {
    selectClass:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  },
  "On Leave": {
    selectClass:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  },
  "Rest Day": {
    selectClass:
      "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  },
};
function employeeIdOf(employee) {
  return String(
    employee?.id ||
      employee?.employeeId ||
      employee?.employee_id ||
      ""
  ).trim();
}
function employeeNameOf(employee) {
  return String(
    employee?.name ||
      employee?.fullName ||
      employee?.full_name ||
      employeeIdOf(employee) ||
      "Unnamed Employee"
  ).trim();
}
function employeePositionOf(employee) {
  return String(
    employee?.position ||
      employee?.jobPosition ||
      employee?.job_position ||
      employee?.positionName ||
      employee?.position_name ||
      "Not Assigned"
  ).trim();
}
function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}
function isNoteRecommended(status) {
  return NOTE_RECOMMENDED_STATUSES.includes(status);
}
function getNotePlaceholder(status) {
  if (status === "Late") {
    return "Example: Arrived late due to transport delay.";
  }
  if (status === "Absent") {
    return "Example: Reported sick and informed the coordinator.";
  }
  if (status === "On Leave") {
    return "Example: Approved leave for a personal appointment.";
  }
  return "Add an optional note...";
}
function summaryCardToneClass(tone) {
  const classes = {
    indigo:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    red:
      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    blue:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  };
  return classes[tone] || classes.indigo;
}
function SummaryCard({ label, value, icon, tone = "indigo" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${summaryCardToneClass(
            tone
          )}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
function TabButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
function NoteModal({
  employee,
  status,
  value,
  onChange,
  onCancel,
  onSave,
}) {
  if (!employee) {
    return null;
  }
  const employeeName = employeeNameOf(employee);
  const employeeId = employeeIdOf(employee);
  const position = employeePositionOf(employee);
  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-note-title"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Attendance Note
              </p>
              <h2
                id="attendance-note-title"
                className="mt-1 text-xl font-black text-slate-900 dark:text-white"
              >
                {employeeName}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Employee {employeeId} • {position} • {status === "Unmarked" ? "Not Marked" : status}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close note"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <label
            htmlFor="attendance-note"
            className="text-sm font-bold text-slate-800 dark:text-slate-200"
          >
            Note
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Keep it short and clear. Add only the details needed to explain the attendance record.
          </p>
          <textarea
            id="attendance-note"
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={getNotePlaceholder(status)}
            className="mt-4 min-h-[150px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Note</Button>
        </div>
      </div>
    </div>
  );
}
export default function Attendance() {
  const { user } = useAuth();
  const assignedCompany = String(
    user?.assignedCompany ??
      user?.assigned_company ??
      "Assigned Client Company"
  ).trim();
  const draftOwner = String(
    user?.id ??
      user?.userId ??
      user?.user_id ??
      user?.username ??
      user?.email ??
      "hr-coordinator"
  ).trim();
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${encodeURIComponent(
    draftOwner || "hr-coordinator"
  )}:${encodeURIComponent(assignedCompany)}`;
  const [activeTab, setActiveTab] = useState("daily");
  const [attendanceDate, setAttendanceDate] = useState(todayInputValue);
  const [attendanceSource, setAttendanceSource] = useState("coordinator");
  const [sourceLocked, setSourceLocked] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [remarks, setRemarks] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [openRemarkFor, setOpenRemarkFor] = useState(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [performancePeriod, setPerformancePeriod] = useState("1 Month");
  const [clientRecordFile, setClientRecordFile] = useState(null);
  const [clientRecordPreview, setClientRecordPreview] = useState("");
  const [clientRecordError, setClientRecordError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    setDraftReady(false);
    try {
      window.localStorage.removeItem(draftStorageKey);
      const savedDraft = window.sessionStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        if (
          parsedDraft?.attendanceDate &&
          typeof parsedDraft.attendanceDate === "string"
        ) {
          setAttendanceDate(parsedDraft.attendanceDate);
        }
        if (
          parsedDraft?.attendanceSource === "coordinator" ||
          parsedDraft?.attendanceSource === "client"
        ) {
          setAttendanceSource(parsedDraft.attendanceSource);
        }
        setSourceLocked(Boolean(parsedDraft?.sourceLocked));
        if (
          parsedDraft?.attendanceDraft &&
          typeof parsedDraft.attendanceDraft === "object"
        ) {
          setAttendanceDraft(parsedDraft.attendanceDraft);
        }
        if (parsedDraft?.remarks && typeof parsedDraft.remarks === "object") {
          setRemarks(parsedDraft.remarks);
          setNoteDrafts(parsedDraft.remarks);
        }
      }
      const savedClientRecord = CLIENT_RECORD_DRAFTS.get(draftStorageKey);
      if (savedClientRecord?.file) {
        setClientRecordFile(savedClientRecord.file);
        setClientRecordPreview(URL.createObjectURL(savedClientRecord.file));
      }
    } catch (error) {
      console.error("Restore attendance draft error:", error);
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadEmployees() {
      try {
        setIsLoading(true);
        setLoadError("");
        const { data } = await axios.get(EMPLOYEE_API_URL, {
          signal: controller.signal,
          params: {
            view: "summary",
            page: 1,
            pageSize: 500,
            scope: "active",
            sort: "latest",
          },
        });
        if (controller.signal.aborted) {
          return;
        }
        const records = Array.isArray(data?.employees) ? data.employees : [];
        setEmployees(records);
        setAttendanceDraft((current) => {
          const next = { ...current };
          records.forEach((employee) => {
            const id = employeeIdOf(employee);
            if (id && !next[id]) {
              next[id] = "Unmarked";
            }
          });
          return next;
        });
      } catch (error) {
        if (
          error?.code === "ERR_CANCELED" ||
          error?.name === "CanceledError" ||
          error?.name === "AbortError"
        ) {
          return;
        }
        console.error("Load attendance employees error:", error);
        setLoadError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            "Unable to load assigned-company employees."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }
    void loadEmployees();
    return () => {
      controller.abort();
    };
  }, []);
  useEffect(() => {
    return () => {
      if (clientRecordPreview) {
        URL.revokeObjectURL(clientRecordPreview);
      }
    };
  }, [clientRecordPreview]);
  useEffect(() => {
    if (!openRemarkFor) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        const employeeId = openRemarkFor;
        setNoteDrafts((current) => ({
          ...current,
          [employeeId]: remarks[employeeId] || "",
        }));
        setOpenRemarkFor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openRemarkFor, remarks]);
  const positions = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map(employeePositionOf)
          .filter((position) => position && position !== "Not Assigned")
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [employees]);
  const visibleEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesPosition =
        positionFilter === "All" ||
        employeePositionOf(employee) === positionFilter;
      const matchesSearch =
        !normalizedSearch ||
        employeeNameOf(employee).toLowerCase().includes(normalizedSearch) ||
        employeeIdOf(employee).toLowerCase().includes(normalizedSearch) ||
        employeePositionOf(employee).toLowerCase().includes(normalizedSearch);
      return matchesPosition && matchesSearch;
    });
  }, [employees, positionFilter, search]);
  const summary = useMemo(() => {
    const values = employees.map(
      (employee) => attendanceDraft[employeeIdOf(employee)] || "Unmarked"
    );
    return {
      total: employees.length,
      present: values.filter((value) => value === "Present").length,
      late: values.filter((value) => value === "Late").length,
      absent: values.filter((value) => value === "Absent").length,
      leave: values.filter((value) => value === "On Leave").length,
    };
  }, [attendanceDraft, employees]);
  const sourceDetails =
    ATTENDANCE_SOURCES.find((source) => source.value === attendanceSource) ||
    ATTENDANCE_SOURCES[0];
  const hasActiveRosterFilter =
    Boolean(search.trim()) || positionFilter !== "All";
  const clientProofMissing =
    attendanceSource === "client" && !clientRecordFile;
  const hasRecordedStatus = useMemo(
    () =>
      Object.values(attendanceDraft).some(
        (status) => status && status !== "Unmarked"
      ),
    [attendanceDraft]
  );
  const hasSavedNote = useMemo(
    () =>
      Object.values(remarks).some((note) => String(note || "").trim()),
    [remarks]
  );
  const hasUnsavedDraft =
    sourceLocked ||
    hasRecordedStatus ||
    hasSavedNote ||
    Boolean(clientRecordFile);
  useEffect(() => {
    if (!draftReady) {
      return;
    }
    try {
      const snapshot = {
        attendanceDate,
        attendanceSource,
        sourceLocked,
        attendanceDraft,
        remarks,
      };
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify(snapshot)
      );
    } catch (error) {
      console.error("Save attendance draft error:", error);
    }
  }, [
    attendanceDate,
    attendanceDraft,
    attendanceSource,
    draftReady,
    draftStorageKey,
    remarks,
    sourceLocked,
  ]);
  useEffect(() => {
    if (!hasUnsavedDraft) {
      return undefined;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedDraft]);
  useEffect(() => {
    const handlePageHide = () => {
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch (error) {
        console.error("Discard attendance draft error:", error);
      }
      CLIENT_RECORD_DRAFTS.delete(draftStorageKey);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [draftStorageKey]);
  const activeNoteEmployee = useMemo(
    () =>
      employees.find(
        (employee) => employeeIdOf(employee) === openRemarkFor
      ) || null,
    [employees, openRemarkFor]
  );
  const activeNoteStatus = openRemarkFor
    ? attendanceDraft[openRemarkFor] || "Unmarked"
    : "Unmarked";
  const activeNoteValue = openRemarkFor
    ? noteDrafts[openRemarkFor] ?? remarks[openRemarkFor] ?? ""
    : "";
  const handleStatusChange = (employeeId, status) => {
    setAttendanceDraft((current) => ({
      ...current,
      [employeeId]: status,
    }));
    if (status !== "Unmarked") {
      setSourceLocked(true);
    }
  };
  const handleOpenNote = (employeeId) => {
    setNoteDrafts((current) => ({
      ...current,
      [employeeId]: remarks[employeeId] || "",
    }));
    setOpenRemarkFor(employeeId);
  };
  const handleNoteDraftChange = (value) => {
    if (!openRemarkFor) {
      return;
    }
    setNoteDrafts((current) => ({
      ...current,
      [openRemarkFor]: value,
    }));
  };
  const handleSaveNote = () => {
    if (!openRemarkFor) {
      return;
    }
    const employeeId = openRemarkFor;
    const nextNote = String(noteDrafts[employeeId] || "").trim();
    setRemarks((current) => ({
      ...current,
      [employeeId]: nextNote,
    }));
    if (nextNote) {
      setSourceLocked(true);
    }
    setOpenRemarkFor(null);
  };
  const handleCancelNote = () => {
    if (!openRemarkFor) {
      return;
    }
    const employeeId = openRemarkFor;
    setNoteDrafts((current) => ({
      ...current,
      [employeeId]: remarks[employeeId] || "",
    }));
    setOpenRemarkFor(null);
  };
  const handleClearNote = (employeeId) => {
    setRemarks((current) => ({
      ...current,
      [employeeId]: "",
    }));
    setNoteDrafts((current) => ({
      ...current,
      [employeeId]: "",
    }));
  };
  const handleMarkPresent = () => {
    setAttendanceDraft((current) => {
      const next = { ...current };
      visibleEmployees.forEach((employee) => {
        const id = employeeIdOf(employee);
        if (id) {
          next[id] = "Present";
        }
      });
      return next;
    });
    if (visibleEmployees.length > 0) {
      setSourceLocked(true);
    }
  };
  const handleClearFilters = () => {
    setSearch("");
    setPositionFilter("All");
  };
  const handleAttendanceSourceChange = (event) => {
    if (sourceLocked) {
      return;
    }
    const nextSource = event.target.value;
    setAttendanceSource(nextSource);
    setClientRecordError("");
    if (nextSource !== "client") {
      if (clientRecordPreview) {
        URL.revokeObjectURL(clientRecordPreview);
      }
      setClientRecordFile(null);
      setClientRecordPreview("");
    }
  };
  const handleClientRecordChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setClientRecordError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_CLIENT_RECORD_SIZE) {
      setClientRecordError("The image must be 10 MB or smaller.");
      return;
    }
    if (clientRecordPreview) {
      URL.revokeObjectURL(clientRecordPreview);
    }
    setClientRecordFile(file);
    setClientRecordPreview(URL.createObjectURL(file));
    CLIENT_RECORD_DRAFTS.set(draftStorageKey, { file });
    setClientRecordError("");
  };
  const handleRemoveClientRecord = () => {
    if (clientRecordPreview) {
      URL.revokeObjectURL(clientRecordPreview);
    }
    setClientRecordFile(null);
    setClientRecordPreview("");
    CLIENT_RECORD_DRAFTS.delete(draftStorageKey);
    setClientRecordError("");
  };
  const handleStartOver = () => {
    const shouldReset = window.confirm(
      "Start over with this attendance sheet? This will clear all selected statuses, notes, and the attached client record."
    );
    if (!shouldReset) {
      return;
    }
    const resetDraft = {};
    employees.forEach((employee) => {
      const employeeId = employeeIdOf(employee);
      if (employeeId) {
        resetDraft[employeeId] = "Unmarked";
      }
    });
    if (clientRecordPreview) {
      URL.revokeObjectURL(clientRecordPreview);
    }
    setAttendanceDraft(resetDraft);
    setRemarks({});
    setNoteDrafts({});
    setOpenRemarkFor(null);
    setSourceLocked(false);
    setClientRecordFile(null);
    setClientRecordPreview("");
    setClientRecordError("");
    try {
      window.sessionStorage.removeItem(draftStorageKey);
      window.localStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.error("Clear attendance draft error:", error);
    }
    CLIENT_RECORD_DRAFTS.delete(draftStorageKey);
  };
  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Monitoring"
        title="Attendance"
        description={`Track the daily status of WELLJOB employees assigned to ${assignedCompany}.`}
        icon={<FiClipboard size={22} aria-hidden="true" />}
      />
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Assigned Company
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {assignedCompany}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Choose the date and source first, then record each employee's status.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                <label
                  htmlFor="attendance-date"
                  className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                >
                  Date
                </label>
                <input
                  id="attendance-date"
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="attendance-source"
                    className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                  >
                    Source
                  </label>
                  {sourceLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      <FiLock aria-hidden="true" />
                      Locked
                    </span>
                  )}
                </div>
                <div className="relative mt-2">
                  <select
                    id="attendance-source"
                    value={attendanceSource}
                    disabled={sourceLocked}
                    onChange={handleAttendanceSourceChange}
                    className="min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                  >
                    {ATTENDANCE_SOURCES.map((source) => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {sourceLocked
                    ? "The source stays fixed once attendance recording has started."
                    : sourceDetails.description}
                </p>
              </div>
            </div>
          </div>
          {attendanceSource === "client" && (
            <div className="mt-5 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                    <FiImage aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      Client attendance record
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      You may start encoding now. Attach the client record once received so the entries can be checked before final submission.
                    </p>
                  </div>
                </div>
                {!clientRecordFile && (
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500">
                    <FiUploadCloud aria-hidden="true" />
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleClientRecordChange}
                    />
                  </label>
                )}
              </div>
              {clientRecordError && (
                <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">
                  {clientRecordError}
                </p>
              )}
              {clientRecordFile && clientRecordPreview && (
                <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-900">
                  <img
                    src={clientRecordPreview}
                    alt="Client attendance record preview"
                    className="h-28 w-28 rounded-xl border border-slate-200 object-cover dark:border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {clientRecordFile.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Use this image to verify the attendance details before final submission.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveClientRecord}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                  >
                    <FiTrash2 aria-hidden="true" />
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
            <div className="flex flex-wrap gap-2">
              <TabButton
                active={activeTab === "daily"}
                icon={<FiClipboard aria-hidden="true" />}
                label="Daily"
                onClick={() => setActiveTab("daily")}
              />
              <TabButton
                active={activeTab === "history"}
                icon={<FiFileText aria-hidden="true" />}
                label="History"
                onClick={() => setActiveTab("history")}
              />
              <TabButton
                active={activeTab === "performance"}
                icon={<FiBarChart2 aria-hidden="true" />}
                label="Performance"
                onClick={() => setActiveTab("performance")}
              />
            </div>
            {sourceLocked && (
              <button
                type="button"
                onClick={handleStartOver}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiRefreshCw aria-hidden="true" />
                Start Over
              </button>
            )}
          </div>
        </div>
      </section>
      {activeTab === "daily" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Employees"
              value={summary.total}
              icon={<FiUsers aria-hidden="true" />}
            />
            <SummaryCard
              label="Present"
              value={summary.present}
              tone="emerald"
              icon={<FiCheckCircle aria-hidden="true" />}
            />
            <SummaryCard
              label="Late"
              value={summary.late}
              tone="amber"
              icon={<FiCalendar aria-hidden="true" />}
            />
            <SummaryCard
              label="Absent"
              value={summary.absent}
              tone="red"
              icon={<FiCalendar aria-hidden="true" />}
            />
            <SummaryCard
              label="On Leave"
              value={summary.leave}
              tone="blue"
              icon={<FiFileText aria-hidden="true" />}
            />
          </section>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    Daily Sheet
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Search the roster, filter by position, and mark the day's status.
                  </p>
                </div>
                <Button
                  onClick={handleMarkPresent}
                  disabled={
                    isLoading ||
                    visibleEmployees.length === 0
                  }
                  leftIcon={<FiCheckCircle aria-hidden="true" />}
                >
                  {hasActiveRosterFilter ? "Mark Filtered Present" : "Mark All Present"}
                </Button>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
                <SearchInput
                  label="Search employees"
                  hideLabel
                  placeholder="Search employee name, ID, or position..."
                  value={search}
                  disabled={isLoading}
                  onChange={(event) => setSearch(event.target.value)}
                  onClear={() => setSearch("")}
                />
                <div className="relative">
                  <select
                    aria-label="Filter by position"
                    value={positionFilter}
                    disabled={isLoading}
                    onChange={(event) => setPositionFilter(event.target.value)}
                    className="min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                  >
                    <option value="All">All Positions</option>
                    {positions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={isLoading}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{attendanceDate}</span>
                <span aria-hidden="true">•</span>
                <span>{sourceDetails.label}</span>
                {attendanceSource === "client" && clientRecordFile && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>Client record attached</span>
                  </>
                )}
              </div>
              {clientProofMissing && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  You can continue editing. Attach the client record before the attendance is finalized.
                </div>
              )}
            </div>
            {loadError ? (
              <div className="p-6">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  {loadError}
                </div>
              </div>
            ) : isLoading ? (
              <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                Loading employees...
              </div>
            ) : visibleEmployees.length === 0 ? (
              <div className="p-10 text-center">
                <FiSearch
                  className="mx-auto text-3xl text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
                  No employees found.
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Try another search or position.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[940px] border-separate border-spacing-0 text-left">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur dark:bg-slate-800/95">
                      <tr className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Position</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((employee) => {
                        const employeeId = employeeIdOf(employee);
                        const employeeName = employeeNameOf(employee);
                        const position = employeePositionOf(employee);
                        const status = attendanceDraft[employeeId] || "Unmarked";
                        const note = remarks[employeeId] || "";
                        const noteRecommended = isNoteRecommended(status);
                        const statusMeta =
                          STATUS_META[status] || STATUS_META.Unmarked;
                        return (
                          <tr
                            key={employeeId}
                            className="border-t border-slate-200 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.03]"
                          >
                            <td className="px-6 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-indigo-50 px-2 text-xs font-extrabold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                  {employeeId || "—"}
                                </div>
                                <p className="max-w-[280px] truncate text-sm font-bold text-slate-900 dark:text-white">
                                  {employeeName}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {position}
                              </span>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <div className="relative max-w-[180px]">
                                <select
                                  value={status}
                                                                    onChange={(event) =>
                                    handleStatusChange(
                                      employeeId,
                                      event.target.value
                                    )
                                  }
                                  className={`min-h-11 w-full appearance-none rounded-xl border px-3 py-2 pr-10 text-sm font-bold outline-none transition focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${statusMeta.selectClass}`}
                                >
                                  {ATTENDANCE_STATUSES.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      style={{
                                        color: "#0f172a",
                                        backgroundColor: "#ffffff",
                                      }}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <FiChevronDown
                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-current opacity-70"
                                  aria-hidden="true"
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              {note ? (
                                <div className="flex max-w-[320px] items-center gap-2">
                                  <p
                                    title={note}
                                    className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300"
                                  >
                                    {note}
                                  </p>
                                  <button
                                    type="button"
                                                                        onClick={() => handleOpenNote(employeeId)}
                                    title="Edit note"
                                    aria-label={`Edit note for ${employeeName}`}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                                  >
                                    <FiEdit3 aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                                                        onClick={() => handleClearNote(employeeId)}
                                    title="Remove note"
                                    aria-label={`Remove note for ${employeeName}`}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                                  >
                                    <FiX aria-hidden="true" />
                                  </button>
                                </div>
                              ) : noteRecommended ? (
                                <button
                                  type="button"
                                                                    onClick={() => handleOpenNote(employeeId)}
                                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                                >
                                  <FiEdit3 aria-hidden="true" />
                                  Add reason
                                </button>
                              ) : (
                                <button
                                  type="button"
                                                                    onClick={() => handleOpenNote(employeeId)}
                                  title="Add optional note"
                                  aria-label={`Add optional note for ${employeeName}`}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                >
                                  <FiEdit3 aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your unfinished entries stay while you move around WELLJOB. Reloading or leaving the site will discard them.
                  </p>
                  <Button disabled>Save Attendance</Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      {activeTab === "history" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FiFileText className="text-2xl" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
              History
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Saved records will show the date, source, employee statuses, notes,
              and any client record attached.
            </p>
          </div>
        </section>
      )}
      {activeTab === "performance" && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Attendance Performance
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review attendance reliability over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["1 Month", "3 Months", "6 Months", "Annual"].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPerformancePeriod(period)}
                  className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                    performancePeriod === period
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FiBarChart2 className="text-2xl" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
              {performancePeriod} summary
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Present, late, absent, leave counts, attendance rate, and
              attendance reliability will appear here once attendance records
              are saved.
            </p>
          </div>
        </section>
      )}
      <NoteModal
        employee={activeNoteEmployee}
        status={activeNoteStatus}
        value={activeNoteValue}
        onChange={handleNoteDraftChange}
        onCancel={handleCancelNote}
        onSave={handleSaveNote}
      />
    </main>
  );
}