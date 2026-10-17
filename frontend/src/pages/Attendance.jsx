import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClipboard,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiImage,
  FiLock,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import welljobLogoUrl from "../assets/Logo.png";
import { useAuth } from "../context/useAuth";
import { EMPLOYEE_API_URL } from "../utils/employees/employeeFormHelpers";
import {
  getAttendanceByDate,
  getAttendanceEvidence,
  getEmployeeAttendanceHistory,
  getAttendanceHistory,
  getAttendanceHistoryDetail,
  getAttendancePerformance,
  saveAttendanceRecord,
} from "../utils/attendance/attendanceApi";
const ATTENDANCE_STATUSES = [
  { value: "Present", label: "Present" },
  { value: "Late", label: "Late" },
  { value: "Absent", label: "Absent" },
  { value: "On Leave", label: "On Leave" },
  { value: "Rest Day", label: "Rest Day" },
];
const ATTENDANCE_SOURCES = [
  {
    value: "coordinator",
    label: "HR Coordinator Record",
    description: "Recorded by the assigned HR Coordinator.",
  },
  {
    value: "client",
    label: "Client Attendance Record",
    description: "Recorded from an attendance record provided by the client.",
  },
];
const NOTE_RECOMMENDED_STATUSES = ["Late", "Absent", "On Leave"];
const MAX_CLIENT_RECORD_SIZE = 10 * 1024 * 1024;
const DRAFT_STORAGE_PREFIX = "welljob:attendance-draft";
const CLIENT_RECORD_DRAFTS = new Map();
const ATTENDANCE_TIME_ZONE = "Asia/Manila";

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

function matchesLooseSearch(
  value,
  query
) {
  const normalizedValue =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  const searchTokens =
    String(
      query || ""
    )
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  if (
    searchTokens.length ===
    0
  ) {
    return true;
  }

  return searchTokens.every(
    (token) =>
      normalizedValue.includes(
        token
      )
  );
}

function getPerformanceRemarksCount(
  employee
) {
  const explicitCount =
    employee?.remarksCount ??
    employee?.remarks_count ??
    employee?.remarkCount ??
    employee?.remark_count ??
    employee?.noteCount ??
    employee?.note_count;

  if (
    explicitCount !==
      undefined &&
    explicitCount !==
      null &&
    explicitCount !==
      ""
  ) {
    const parsed =
      Number(
        explicitCount
      );

    if (
      Number.isFinite(
        parsed
      ) &&
      parsed >= 0
    ) {
      return Math.floor(
        parsed
      );
    }
  }

  if (
    Array.isArray(
      employee?.remarks
    )
  ) {
    return employee.remarks.filter(
      (remark) =>
        Boolean(
          String(
            remark?.note ??
              remark?.remark ??
              remark ??
              ""
          ).trim()
        )
    ).length;
  }

  if (
    employee?.hasRemarks ===
      true ||
    employee?.has_remarks ===
      true
  ) {
    return 1;
  }

  if (
    employee?.hasRemarks ===
      false ||
    employee?.has_remarks ===
      false
  ) {
    return 0;
  }

  return null;
}
function todayInputValue() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          ATTENDANCE_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day
  ) {
    return "";
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function formatAttendanceGeneratedAt() {
  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        ATTENDANCE_TIME_ZONE,
      year:
        "numeric",
      month:
        "short",
      day:
        "2-digit",
      hour:
        "numeric",
      minute:
        "2-digit",
      second:
        "2-digit",
      hour12:
        true,
    }
  ).format(
    new Date()
  );
}

function subtractDays(
  isoDate,
  days
) {
  const [
    year,
    month,
    day,
  ] = String(
    isoDate ||
      ""
  )
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day - days
      )
    );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function performanceDateRange(
  period
) {
  const to =
    todayInputValue();

  const days =
    period === "3 Months"
      ? 90
      : period === "6 Months"
        ? 180
        : period === "Annual"
          ? 365
          : 30;

  return {
    from:
      subtractDays(
        to,
        days - 1
      ),

    to,
  };
}

function formatAttendanceRate(
  value
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? `${parsed.toFixed(2)}%`
    : "—";
}

function normalizeAttendanceDateValue(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .slice(
        0,
        10
      );

  return /^\d{4}-\d{2}-\d{2}$/.test(
    normalized
  )
    ? normalized
    : "";
}

function isAttendanceDateWithinRange(
  value,
  from,
  to
) {
  const date =
    normalizeAttendanceDateValue(
      value
    );

  if (
    !date ||
    !from ||
    !to
  ) {
    return false;
  }

  return (
    date >= from &&
    date <= to
  );
}

function isNoteRecommended(status) {
  return NOTE_RECOMMENDED_STATUSES.includes(status);
}

function cleanAttendanceReportValue(
  value,
  fallback = "—"
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  return normalized ||
    fallback;
}

function getAttendanceGeneratedBy(
  user
) {
  const firstName =
    cleanAttendanceReportValue(
      user?.first_name ||
        user?.firstName,
      ""
    );

  const lastName =
    cleanAttendanceReportValue(
      user?.last_name ||
        user?.lastName,
      ""
    );

  const composedName =
    [
      firstName,
      lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return cleanAttendanceReportValue(
    user?.full_name ||
      user?.fullName ||
      composedName ||
      user?.name,
    "Authorized User"
  );
}

function sanitizeAttendanceFilePart(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /[^a-z0-9_-]+/gi,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(
      0,
      80
    ) ||
    "Attendance";
}

function attendanceBlobToDataUrl(
  blob
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            String(
              reader.result ||
                ""
            )
          );

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read Welljob logo."
            )
          );

      reader.readAsDataURL(
        blob
      );
    }
  );
}

async function loadAttendanceReportLogo() {
  try {
    const response =
      await fetch(
        welljobLogoUrl
      );

    if (!response.ok) {
      return "";
    }

    return await attendanceBlobToDataUrl(
      await response.blob()
    );
  } catch {
    return "";
  }
}

function addAttendanceReportFooters(
  doc
) {
  const pageCount =
    doc.internal.getNumberOfPages();

  for (
    let pageNumber = 1;
    pageNumber <= pageCount;
    pageNumber += 1
  ) {
    doc.setPage(
      pageNumber
    );

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    doc.setFontSize(
      7
    );

    doc.setFont(
      undefined,
      "normal"
    );

    doc.setTextColor(
      100
    );

    doc.text(
      `Attendance Record Report | Page ${pageNumber} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 7,
      {
        align:
          "right",
      }
    );
  }
}

async function exportAttendanceRecordPdf({
  record,
  detail,
  assignedCompany,
  user,
}) {
  const doc =
    new jsPDF({
      orientation:
        "portrait",
      unit:
        "mm",
      format:
        "a4",
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const logoDataUrl =
    await loadAttendanceReportLogo();

  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        "PNG",
        14,
        9,
        18,
        18
      );
    } catch {
      /*
       * Keep export available even if the bundled
       * logo cannot be decoded by the browser.
       */
    }
  }

  doc.setFont(
    undefined,
    "bold"
  );

  doc.setFontSize(
    12.5
  );

  doc.setTextColor(
    30,
    41,
    59
  );

  doc.text(
    "WELLJOB SOLUTIONS & GENERAL SERVICES INC.",
    38,
    15
  );

  doc.setFontSize(
    14
  );

  doc.text(
    "ATTENDANCE RECORD REPORT",
    pageWidth / 2,
    32,
    {
      align:
        "center",
    }
  );

  doc.setFont(
    undefined,
    "normal"
  );

  doc.setFontSize(
    8.5
  );

  doc.setTextColor(
    71,
    85,
    105
  );

  const reportCompany =
    cleanAttendanceReportValue(
      detail?.company ||
        record?.company ||
        assignedCompany,
      "Not recorded"
    );

  const reportDate =
    cleanAttendanceReportValue(
      detail?.date ||
        record?.date,
      "Not recorded"
    );

  const reportSource =
    (
      detail?.source ||
      record?.source
    ) === "client"
      ? "Client Attendance Record"
      : "HR Coordinator Record";

  doc.text(
    `Client Company: ${reportCompany}`,
    14,
    44
  );

  doc.text(
    `Attendance Date: ${reportDate}`,
    14,
    49
  );

  doc.text(
    `Source: ${reportSource}`,
    14,
    54
  );

  doc.text(
    `Generated by: ${getAttendanceGeneratedBy(user)}`,
    112,
    44
  );

  doc.text(
    `Generated on: ${formatAttendanceGeneratedAt()}`,
    112,
    49
  );

  if (
    (
      detail?.source ||
      record?.source
    ) === "client"
  ) {
    doc.text(
      `Client Record: ${
        record?.hasEvidence ||
        detail?.hasEvidence
          ? "Attached"
          : "None"
      }`,
      112,
      54
    );
  }

  const entries =
    Array.isArray(
      detail?.entries
    )
      ? detail.entries
      : [];

  const summary =
    detail?.summary ||
    record?.summary ||
    {};

  doc.setFont(
    undefined,
    "bold"
  );

  doc.setFontSize(
    10.5
  );

  doc.setTextColor(
    15,
    23,
    42
  );

  doc.text(
    "Attendance Summary",
    14,
    66
  );

  autoTable(
    doc,
    {
      startY:
        70,

      head: [[
        "Employees",
        "Present",
        "Late",
        "Absent",
        "On Leave",
        "Rest Day",
        "No Entry",
      ]],

      body: [[
        entries.length,
        summary?.present ?? 0,
        summary?.late ?? 0,
        summary?.absent ?? 0,
        summary?.onLeave ?? 0,
        summary?.restDay ?? 0,
        summary?.unmarked ?? 0,
      ]],

      theme:
        "grid",

      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        halign:
          "center",
      },

      headStyles: {
        fillColor: [
          30,
          41,
          59,
        ],
      },
    }
  );

  const detailStartY =
    (
      doc.lastAutoTable
        ?.finalY ||
      84
    ) + 10;

  doc.setFontSize(
    10.5
  );

  doc.setFont(
    undefined,
    "bold"
  );

  doc.text(
    "Employee Attendance",
    14,
    detailStartY
  );

  const rows =
    entries.length
      ? entries.map(
          (entry) => [
            cleanAttendanceReportValue(
              entry?.employeeId
            ),
            cleanAttendanceReportValue(
              entry?.employeeName
            ),
            cleanAttendanceReportValue(
              entry?.position
            ),
            entry?.status ===
              "Unmarked"
              ? "No Entry"
              : cleanAttendanceReportValue(
                  entry?.status
                ),
            cleanAttendanceReportValue(
              entry?.note
            ),
          ]
        )
      : [[
          "—",
          "No attendance entries found.",
          "—",
          "—",
          "—",
        ]];

  autoTable(
    doc,
    {
      startY:
        detailStartY + 4,

      margin: {
        left: 14,
        right: 14,
        bottom: 14,
      },

      head: [[
        "Employee ID",
        "Employee Name",
        "Position",
        "Status",
        "Remarks",
      ]],

      body:
        rows,

      theme:
        "grid",

      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        valign:
          "top",
        overflow:
          "linebreak",
      },

      headStyles: {
        fillColor: [
          30,
          41,
          59,
        ],
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        0: {
          cellWidth: 24,
        },
        1: {
          cellWidth: 42,
        },
        2: {
          cellWidth: 34,
        },
        3: {
          cellWidth: 25,
        },
        4: {
          cellWidth: 57,
        },
      },
    }
  );

  addAttendanceReportFooters(
    doc
  );

  const safeCompany =
    sanitizeAttendanceFilePart(
      reportCompany
    );

  const safeDate =
    sanitizeAttendanceFilePart(
      reportDate
    );

  doc.save(
    `Welljob_Attendance_${safeCompany}_${safeDate}.pdf`
  );
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
function CompactPerformanceCard({
  label,
  value,
  icon,
  tone = "indigo",
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-black leading-none tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>

        <p className="mt-1 truncate text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>

      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${summaryCardToneClass(
          tone
        )}`}
      >
        {icon}
      </div>
    </div>
  );
}

function WorkspaceTabButton({
  active,
  icon,
  label,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "group flex min-h-[92px] w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
        active
          ? "border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500/20 dark:border-indigo-400/50 dark:bg-indigo-500/10"
          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:border-indigo-500/30 dark:hover:bg-slate-800/70",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
          active
            ? "bg-indigo-600 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-300",
        ].join(" ")}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span
          className={[
            "block text-sm font-black",
            active
              ? "text-indigo-800 dark:text-indigo-200"
              : "text-slate-900 dark:text-white",
          ].join(" ")}
        >
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
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
                Employee {employeeId} • {position} • {status === "Unmarked" ? "No Entry" : status}
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
        <div className="px-5 py-5 transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02] sm:px-6">
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
  const [performanceEmployeeSearch, setPerformanceEmployeeSearch] =
    useState("");
  const [clientRecordFile, setClientRecordFile] = useState(null);
  const [clientRecordPreview, setClientRecordPreview] = useState("");
  const [clientRecordError, setClientRecordError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);

  const [savedAttendance, setSavedAttendance] = useState(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [attendanceLoadError, setAttendanceLoadError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyExportingId, setHistoryExportingId] = useState("");

  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState("");

  const [employeeHistory, setEmployeeHistory] = useState(null);
  const [employeeHistoryLoading, setEmployeeHistoryLoading] = useState(false);
  const [employeeHistoryError, setEmployeeHistoryError] = useState("");
  const [performanceRemarkTargetId, setPerformanceRemarkTargetId] =
    useState("");

  const applySavedAttendanceRecord = useCallback(
    (record) => {
      const nextDraft = {};
      const nextRemarks = {};

      employees.forEach(
        (employee) => {
          const employeeId =
            employeeIdOf(
              employee
            );

          if (employeeId) {
            nextDraft[
              employeeId
            ] =
              "";
          }
        }
      );

      const entries =
        Array.isArray(
          record?.entries
        )
          ? record.entries
          : [];

      entries.forEach(
        (entry) => {
          const employeeId =
            String(
              entry?.employeeId ??
                entry?.employee_id ??
                ""
            ).trim();

          if (!employeeId) {
            return;
          }

          nextDraft[
            employeeId
          ] =
            entry?.status ||
            "Unmarked";

          nextRemarks[
            employeeId
          ] =
            String(
              entry?.note ||
              ""
            );
        }
      );

      setClientRecordPreview(
        (currentPreview) => {
          if (currentPreview) {
            URL.revokeObjectURL(
              currentPreview
            );
          }

          return "";
        }
      );

      setAttendanceDraft(
        nextDraft
      );

      setRemarks(
        nextRemarks
      );

      setNoteDrafts(
        nextRemarks
      );

      setAttendanceSource(
        record?.source ===
          "client"
          ? "client"
          : "coordinator"
      );

      setSourceLocked(true);

      setClientRecordFile(null);
      setClientRecordError("");

      CLIENT_RECORD_DRAFTS.delete(
        draftStorageKey
      );

      setSavedAttendance(
        record
      );
    },
    [
      draftStorageKey,
      employees,
    ]
  );

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
              next[id] = "";
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
          "Unable to load employees for your assigned client company. Please try again."
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
    if (
      !attendanceDate ||
      employees.length === 0
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    async function loadSavedAttendance() {
      try {
        setIsAttendanceLoading(true);
        setAttendanceLoadError("");
        setSaveError("");
        setSaveSuccess("");

        const data =
          await getAttendanceByDate(
            attendanceDate,
            {
              signal:
                controller.signal,
            }
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        const record =
          data?.attendance ||
          null;

        if (record) {
          applySavedAttendanceRecord(
            record
          );
          return;
        }

        setSavedAttendance(
          (current) => {
            if (
              current?.date &&
              current.date !==
                attendanceDate
            ) {
              const resetDraft = {};

              employees.forEach(
                (employee) => {
                  const employeeId =
                    employeeIdOf(
                      employee
                    );

                  if (employeeId) {
                    resetDraft[
                      employeeId
                    ] =
                      "";
                  }
                }
              );

              setAttendanceDraft(
                resetDraft
              );

              setRemarks({});
              setNoteDrafts({});

              setAttendanceSource(
                "coordinator"
              );

              setSourceLocked(false);

              return null;
            }

            return current?.date ===
              attendanceDate
              ? null
              : current;
          }
        );
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Load saved Attendance error:",
          error
        );

        setAttendanceLoadError(
          "Unable to load the saved attendance record. Please try again."
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setIsAttendanceLoading(
            false
          );
        }
      }
    }

    void loadSavedAttendance();

    return () => {
      controller.abort();
    };
  }, [
    applySavedAttendanceRecord,
    attendanceDate,
    employees,
  ]);

  useEffect(() => {
    if (
      activeTab !==
      "history"
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        setHistoryError("");

        const data =
          await getAttendanceHistory({
            limit:
              100,

            signal:
              controller.signal,
          });

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setHistoryRecords(
          Array.isArray(
            data?.history
          )
            ? data.history
            : []
        );
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Load Attendance history error:",
          error
        );

        setHistoryError(
          "Unable to load attendance history. Please try again."
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setHistoryLoading(
            false
          );
        }
      }
    }

    void loadHistory();

    return () => {
      controller.abort();
    };
  }, [
    activeTab,
  ]);

  useEffect(() => {
    if (
      activeTab !==
      "performance"
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    async function loadPerformance() {
      try {
        setPerformanceLoading(true);
        setPerformanceError("");

        const {
          from,
          to,
        } =
          performanceDateRange(
            performancePeriod
          );

        const data =
          await getAttendancePerformance({
            from,
            to,

            signal:
              controller.signal,
          });

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setPerformanceData(
          data
        );
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Load Attendance performance error:",
          error
        );

        setPerformanceError(
          "Unable to load attendance performance. Please try again."
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setPerformanceLoading(
            false
          );
        }
      }
    }

    void loadPerformance();

    return () => {
      controller.abort();
    };
  }, [
    activeTab,
    performancePeriod,
  ]);

  useEffect(() => {
    return () => {
      if (clientRecordPreview) {
        URL.revokeObjectURL(clientRecordPreview);
      }
    };
  }, [clientRecordPreview]);

  useEffect(() => {
    setPerformanceRemarkTargetId("");
    setEmployeeHistory(null);
    setEmployeeHistoryError("");
    setPerformanceEmployeeSearch("");
  }, [
    activeTab,
    performancePeriod,
  ]);

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
    return employees.filter((employee) => {
      const matchesPosition =
        positionFilter === "All" ||
        employeePositionOf(employee) === positionFilter;

      const searchableEmployee =
        [
          employeeNameOf(
            employee
          ),
          employeeIdOf(
            employee
          ),
          employeePositionOf(
            employee
          ),
        ].join(" ");

      const matchesSearch =
        matchesLooseSearch(
          searchableEmployee,
          search
        );

      return (
        matchesPosition &&
        matchesSearch
      );
    });
  }, [
    employees,
    positionFilter,
    search,
  ]);
  const summary = useMemo(() => {
    const values = employees.map(
      (employee) => attendanceDraft[employeeIdOf(employee)] || ""
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
    attendanceSource === "client" &&
    !clientRecordFile &&
    !savedAttendance?.hasEvidence;
  const hasRecordedStatus = useMemo(
    () =>
      Object.values(attendanceDraft).some(
        (status) => Boolean(status)
      ),
    [attendanceDraft]
  );
  const hasSavedNote = useMemo(
    () =>
      Object.values(remarks).some((note) => String(note || "").trim()),
    [remarks]
  );
  const hasUnsavedDraft =
    !savedAttendance &&
    (
      sourceLocked ||
      hasRecordedStatus ||
      hasSavedNote ||
      Boolean(clientRecordFile)
    );
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
    ? attendanceDraft[openRemarkFor] || ""
    : "";
  const activeNoteValue = openRemarkFor
    ? noteDrafts[openRemarkFor] ?? remarks[openRemarkFor] ?? ""
    : "";

  const performanceRange =
    useMemo(
      () =>
        performanceDateRange(
          performancePeriod
        ),
      [
        performancePeriod,
      ]
    );

  const filteredPerformanceEmployees =
    useMemo(
      () => {
        const records =
          Array.isArray(
            performanceData?.employees
          )
            ? performanceData.employees
            : [];

        if (
          !performanceEmployeeSearch.trim()
        ) {
          return records;
        }

        return records.filter(
          (employee) =>
            matchesLooseSearch(
              employee?.employeeName,
              performanceEmployeeSearch
            )
        );
      },
      [
        performanceData,
        performanceEmployeeSearch,
      ]
    );

  const performanceRemarkRecords =
    useMemo(
      () => {
        if (
          !employeeHistory ||
          !Array.isArray(
            employeeHistory.history
          )
        ) {
          return [];
        }

        return employeeHistory.history
          .filter(
            (record) =>
              isAttendanceDateWithinRange(
                record?.date,
                performanceRange.from,
                performanceRange.to
              )
          )
          .map(
            (record) => ({
              ...record,
              note:
                String(
                  record?.note ||
                    ""
                ).trim(),
            })
          )
          .filter(
            (record) =>
              Boolean(
                record.note
              )
          )
          .sort(
            (
              first,
              second
            ) =>
              String(
                second?.date ||
                  ""
              ).localeCompare(
                String(
                  first?.date ||
                    ""
                )
              )
          );
      },
      [
        employeeHistory,
        performanceRange.from,
        performanceRange.to,
      ]
    );

  const handleStatusChange = (employeeId, status) => {
    if (
      savedAttendance ||
      isSaving
    ) {
      return;
    }

    setAttendanceDraft((current) => ({
      ...current,
      [employeeId]: status,
    }));
    if (status !== "Unmarked") {
      setSourceLocked(true);
    }
  };
  const handleOpenNote = (employeeId) => {
    if (
      savedAttendance ||
      isSaving
    ) {
      return;
    }

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
    if (
      savedAttendance ||
      isSaving
    ) {
      return;
    }

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
    if (
      savedAttendance ||
      isSaving
    ) {
      return;
    }

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
    if (
      ![
        "image/png",
        "image/jpeg",
      ].includes(
        String(
          file.type ||
          ""
        ).toLowerCase()
      )
    ) {
      setClientRecordError(
        "Please choose a PNG or JPEG image."
      );
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
    if (
      isSaving ||
      savedAttendance
    ) {
      return;
    }

    setShowStartOverConfirm(
      true
    );
  };

  const handleCancelStartOver = () => {
    setShowStartOverConfirm(
      false
    );
  };

  const handleConfirmStartOver = () => {
    const resetDraft = {};

    employees.forEach((employee) => {
      const employeeId =
        employeeIdOf(
          employee
        );

      if (employeeId) {
        resetDraft[
          employeeId
        ] =
          "";
      }
    });

    if (clientRecordPreview) {
      URL.revokeObjectURL(
        clientRecordPreview
      );
    }

    setAttendanceDraft(
      resetDraft
    );
    setRemarks({});
    setNoteDrafts({});
    setOpenRemarkFor(null);
    setSourceLocked(false);
    setClientRecordFile(null);
    setClientRecordPreview("");
    setClientRecordError("");
    setShowStartOverConfirm(
      false
    );

    try {
      window.sessionStorage.removeItem(
        draftStorageKey
      );
      window.localStorage.removeItem(
        draftStorageKey
      );
    } catch (error) {
      console.error(
        "Clear attendance draft error:",
        error
      );
    }

    CLIENT_RECORD_DRAFTS.delete(
      draftStorageKey
    );
  };

  const handleSaveAttendance =
    async () => {
      if (
        isSaving ||
        savedAttendance
      ) {
        return;
      }

      setSaveError("");
      setSaveSuccess("");

      if (!attendanceDate) {
        setSaveError(
          "Choose an attendance date."
        );
        return;
      }

      if (
        employees.length ===
        0
      ) {
        setSaveError(
          "There are no employees available to save."
        );
        return;
      }

      if (
        attendanceSource ===
          "client" &&
        !clientRecordFile
      ) {
        setSaveError(
          "Attach the client attendance image before saving."
        );
        return;
      }

      const entries =
        employees.map(
          (employee) => {
            const employeeId =
              employeeIdOf(
                employee
              );

            return {
              employeeId:
                Number(
                  employeeId
                ),

              status:
                String(
                  attendanceDraft[
                    employeeId
                  ] ||
                  ""
                ).trim(),

              note:
                String(
                  remarks[
                    employeeId
                  ] ||
                  ""
                ).trim(),
            };
          }
        );

      if (
        entries.some(
          (entry) =>
            !entry.status
        )
      ) {
        setSaveError(
          "Choose an attendance status for every employee before saving."
        );
        return;
      }

      if (
        entries.some(
          (entry) =>
            !Number.isSafeInteger(
              entry.employeeId
            ) ||
            entry.employeeId <= 0
        )
      ) {
        setSaveError(
          "One or more employee records could not be saved. Please refresh and try again."
        );
        return;
      }

      try {
        setIsSaving(true);

        await saveAttendanceRecord({
          attendanceDate,

          source:
            attendanceSource,

          entries,

          evidenceFile:
            attendanceSource ===
              "client"
              ? clientRecordFile
              : null,
        });

        const refreshed =
          await getAttendanceByDate(
            attendanceDate
          );

        const record =
          refreshed?.attendance ||
          null;

        if (record) {
          applySavedAttendanceRecord(
            record
          );
        }

        try {
          window.sessionStorage.removeItem(
            draftStorageKey
          );

          window.localStorage.removeItem(
            draftStorageKey
          );
        } catch (error) {
          console.error(
            "Clear saved Attendance draft error:",
            error
          );
        }

        CLIENT_RECORD_DRAFTS.delete(
          draftStorageKey
        );

        setSaveSuccess(
          "Attendance saved successfully."
        );
      } catch (error) {
        console.error(
          "Save Attendance error:",
          error
        );

        setSaveError(
          "Unable to save attendance. Please try again."
        );
      } finally {
        setIsSaving(
          false
        );
      }
    };

  const handleExportAttendanceRecord =
    async (
      record
    ) => {
      const recordId =
        String(
          record?.id ||
            ""
        ).trim();

      if (
        !recordId ||
        historyExportingId
      ) {
        return;
      }

      try {
        setHistoryExportingId(
          recordId
        );

        setHistoryError(
          ""
        );

        const data =
          await getAttendanceHistoryDetail(
            recordId
          );

        const detail =
          data?.attendance ||
          null;

        if (!detail) {
          throw new Error(
            "Attendance details are unavailable for this record."
          );
        }

        await exportAttendanceRecordPdf({
          record,
          detail,
          assignedCompany,
          user,
        });
      } catch (error) {
        console.error(
          "Export Attendance PDF error:",
          error
        );

        setHistoryError(
          "Unable to export the attendance PDF. Please try again."
        );
      } finally {
        setHistoryExportingId(
          ""
        );
      }
    };

  const handleViewEvidence =
    async (
      recordId
    ) => {
      try {
        setHistoryError("");

        const data =
          await getAttendanceEvidence(
            recordId
          );

        const signedUrl =
          String(
            data?.evidence
              ?.signedUrl ||
            ""
          ).trim();

        if (!signedUrl) {
          throw new Error(
            "The client attendance record is unavailable."
          );
        }

        const link =
          document.createElement(
            "a"
          );

        link.href =
          signedUrl;

        link.target =
          "_blank";

        link.rel =
          "noopener noreferrer";

        document.body.appendChild(
          link
        );

        link.click();
        link.remove();
      } catch (error) {
        console.error(
          "View Attendance evidence error:",
          error
        );

        setHistoryError(
          "Unable to open the client attendance record. Please try again."
        );
      }
    };

  const handleEmployeeAttendanceHistory =
    async (
      employeeId
    ) => {
      const normalizedEmployeeId =
        String(
          employeeId ||
            ""
        ).trim();

      if (
        !normalizedEmployeeId
      ) {
        return;
      }

      if (
        performanceRemarkTargetId ===
        normalizedEmployeeId
      ) {
        setPerformanceRemarkTargetId(
          ""
        );

        setEmployeeHistory(
          null
        );

        setEmployeeHistoryError(
          ""
        );

        return;
      }

      setPerformanceRemarkTargetId(
        normalizedEmployeeId
      );

      setEmployeeHistory(
        null
      );

      setEmployeeHistoryError(
        ""
      );

      try {
        setEmployeeHistoryLoading(
          true
        );

        const data =
          await getEmployeeAttendanceHistory(
            normalizedEmployeeId,
            {
              limit:
                365,
            }
          );

        setEmployeeHistory(
          data
        );
      } catch (error) {
        console.error(
          "Load employee Attendance remarks error:",
          error
        );

        setEmployeeHistory(
          null
        );

        setEmployeeHistoryError(
          "Unable to load attendance remarks. Please try again."
        );
      } finally {
        setEmployeeHistoryLoading(
          false
        );
      }
    };

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Workforce Monitoring"
        title="Attendance"
        description={`Record daily attendance, review saved records, and monitor attendance performance for ${assignedCompany}.`}
        icon={<FiClipboard size={22} aria-hidden="true" />}
      />
      <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60 sm:p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            Assigned Client Company
          </p>

          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            {assignedCompany}
          </h2>

          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            Choose Daily, History, or Performance to continue.
          </p>
        </div>

        <div
          className="mt-4 grid gap-3 md:grid-cols-3"
          role="tablist"
          aria-label="Attendance workspace"
        >
          <WorkspaceTabButton
            active={activeTab === "daily"}
            icon={<FiClipboard aria-hidden="true" />}
            label="Daily"
            description="Record or review attendance for one work date."
            onClick={() => setActiveTab("daily")}
          />

          <WorkspaceTabButton
            active={activeTab === "history"}
            icon={<FiFileText aria-hidden="true" />}
            label="History"
            description="Review saved attendance records and export PDF copies."
            onClick={() => setActiveTab("history")}
          />

          <WorkspaceTabButton
            active={activeTab === "performance"}
            icon={<FiBarChart2 aria-hidden="true" />}
            label="Performance"
            description="Review attendance rates and employee remarks."
            onClick={() => setActiveTab("performance")}
          />
        </div>
      </section>
      {activeTab === "daily" && (
        <>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Step 1
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                Set Attendance Details
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Choose the work date and where the attendance record came from before marking employees.
              </p>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                <label
                  htmlFor="attendance-date"
                  className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                >
                  Attendance Date
                </label>

                <input
                  id="attendance-date"
                  type="date"
                  value={attendanceDate}
                  max={todayInputValue()}
                  disabled={isSaving}
                  onChange={(event) =>
                    setAttendanceDate(
                      event.target.value
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="attendance-source"
                    className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                  >
                    Record Source
                  </label>

                  {sourceLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      <FiLock aria-hidden="true" />
                      Confirmed
                    </span>
                  )}
                </div>

                <div className="relative mt-2">
                  <select
                    id="attendance-source"
                    value={attendanceSource}
                    disabled={
                      sourceLocked ||
                      isSaving ||
                      Boolean(
                        savedAttendance
                      )
                    }
                    onChange={handleAttendanceSourceChange}
                    className="min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                  >
                    {ATTENDANCE_SOURCES.map(
                      (source) => (
                        <option
                          key={source.value}
                          value={source.value}
                        >
                          {source.label}
                        </option>
                      )
                    )}
                  </select>

                  <FiChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {sourceLocked
                    ? "The record source cannot be changed after attendance recording begins."
                    : sourceDetails.description}
                </p>
              </div>
            </div>

            {attendanceSource === "client" && (
              <div className="border-t border-slate-200 p-5 dark:border-white/10 sm:p-6">
                <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                        <FiImage aria-hidden="true" />
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          Client Attendance Record
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Attach the client-provided attendance image before saving so the entries can be checked.
                        </p>
                      </div>
                    </div>

                    {!clientRecordFile &&
                      !savedAttendance && (
                        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500">
                          <FiUploadCloud aria-hidden="true" />
                          Choose Image
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
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

                  {clientRecordFile &&
                    clientRecordPreview && (
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
                            Check the attendance entries against this image before saving.
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
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {attendanceDate} • {sourceDetails.label}
              </p>

              {sourceLocked &&
                !savedAttendance && (
                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <FiRefreshCw aria-hidden="true" />
                    Start Over
                  </button>
                )}
            </div>
          </section>

          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
              Step 2 · Daily Summary
            </p>
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
          </div>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                    Step 3
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                    Record Employee Attendance
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Give every employee a daily attendance status. Add a short remark when context is needed.
                  </p>
                </div>
                <Button
                  onClick={handleMarkPresent}
                  disabled={
                    isLoading ||
                    isAttendanceLoading ||
                    isSaving ||
                    Boolean(savedAttendance) ||
                    visibleEmployees.length === 0
                  }
                  leftIcon={<FiCheckCircle aria-hidden="true" />}
                >
                  {hasActiveRosterFilter ? "Mark Shown Present" : "Mark All Present"}
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
                {attendanceSource === "client" &&
                  (clientRecordFile || savedAttendance?.hasEvidence) && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>Client record attached</span>
                  </>
                )}
              </div>
              {clientProofMissing && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  You can continue editing. Attach the client attendance record before saving.
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
                        const status = attendanceDraft[employeeId] || "";
                        const note = remarks[employeeId] || "";
                        const noteRecommended = isNoteRecommended(status);
                        const statusMeta =
                          STATUS_META[status] || {
                            selectClass:
                              "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400",
                          };
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
                                                                    disabled={
                                                                      Boolean(savedAttendance) ||
                                                                      isSaving
                                                                    }
                                                                    onChange={(event) =>
                                    handleStatusChange(
                                      employeeId,
                                      event.target.value
                                    )
                                  }
                                  className={`min-h-11 w-full appearance-none rounded-xl border px-3 py-2 pr-10 text-sm font-bold outline-none transition focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${statusMeta.selectClass}`}
                                >
                                  <option
                                    value=""
                                    disabled
                                    style={{
                                      color: "#64748b",
                                      backgroundColor: "#ffffff",
                                    }}
                                  >
                                    Select Status
                                  </option>

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
                    Your unfinished entries are kept while you use WELLJOB. They will be cleared if you refresh or leave the site.
                  </p>
                  <div className="flex min-w-0 flex-col items-end gap-2">
                    {attendanceLoadError && (
                      <p className="max-w-md text-right text-sm font-semibold text-red-600 dark:text-red-300">
                        {attendanceLoadError}
                      </p>
                    )}

                    {saveError && (
                      <p className="max-w-md text-right text-sm font-semibold text-red-600 dark:text-red-300">
                        {saveError}
                      </p>
                    )}

                    {saveSuccess && (
                      <p className="max-w-md text-right text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                        {saveSuccess}
                      </p>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {savedAttendance?.hasEvidence && (
                        <Button
                          type="button"
                          onClick={() => handleViewEvidence(savedAttendance.id)}
                          leftIcon={<FiImage aria-hidden="true" />}
                        >
                          View Client Record
                        </Button>
                      )}

                      <Button
                        type="button"
                        onClick={handleSaveAttendance}
                        disabled={
                          isLoading ||
                          isAttendanceLoading ||
                          isSaving ||
                          Boolean(savedAttendance) ||
                          employees.length === 0 ||
                          clientProofMissing
                        }
                      >
                        {isSaving
                          ? "Saving..."
                          : savedAttendance
                            ? "Attendance Saved"
                            : "Save Attendance"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      {activeTab === "history" && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
              Saved Records
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              Attendance History
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Each row is one saved attendance record. Export a PDF when you need a printable copy.
            </p>
          </div>

          {historyError && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:px-6">
              {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Loading attendance history...
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="p-10 text-center">
              <FiFileText
                className="mx-auto text-3xl text-slate-400"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                No saved attendance records yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {historyRecords.map((record) => (
                <div
                  key={record.id}
                  className="px-5 py-5 sm:px-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900 dark:text-white">
                          {record.date}
                        </p>

                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                          {record.source === "client"
                            ? "Client Attendance Record"
                            : "HR Coordinator Record"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>
                          Present: {record.summary?.present ?? 0}
                        </span>

                        <span>
                          Late: {record.summary?.late ?? 0}
                        </span>

                        <span>
                          Absent: {record.summary?.absent ?? 0}
                        </span>

                        <span>
                          On Leave: {record.summary?.onLeave ?? 0}
                        </span>

                        <span>
                          Rest Day: {record.summary?.restDay ?? 0}
                        </span>

                        <span>
                          No Entry: {record.summary?.unmarked ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {record.hasEvidence && (
                        <Button
                          type="button"
                          onClick={() => handleViewEvidence(record.id)}
                          leftIcon={<FiImage aria-hidden="true" />}
                        >
                          View Client Record
                        </Button>
                      )}

                      <Button
                        type="button"
                        disabled={Boolean(historyExportingId)}
                        onClick={() =>
                          void handleExportAttendanceRecord(
                            record
                          )
                        }
                        leftIcon={<FiDownload aria-hidden="true" />}
                      >
                        {historyExportingId ===
                        String(record.id)
                          ? "Exporting..."
                          : "Export PDF"}
                      </Button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {activeTab === "performance" && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Workforce Review
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                Attendance Performance
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review attendance reliability by period, then open Remarks when you need more context for an employee's result.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Reporting Period
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  "1 Month",
                  "3 Months",
                  "6 Months",
                  "Annual",
                ].map((period) => (
                  <button
                    key={period}
                    type="button"
                    disabled={performanceLoading}
                    onClick={() =>
                      setPerformancePeriod(
                        period
                      )
                    }
                    className={`rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
          </div>

          {performanceError && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:px-6">
              {performanceError}
            </div>
          )}

          {performanceLoading ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Loading attendance performance...
            </div>
          ) : !performanceData ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              No attendance performance data is available.
            </div>
          ) : (
            <>
              <div className="grid gap-2 border-b border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-5">
                <CompactPerformanceCard
                  label="Attendance Rate"
                  value={formatAttendanceRate(
                    performanceData.summary?.attendanceRate
                  )}
                  icon={<FiBarChart2 size={12} aria-hidden="true" />}
                />

                <CompactPerformanceCard
                  label="Present"
                  value={performanceData.summary?.present ?? 0}
                  tone="emerald"
                  icon={<FiCheckCircle size={12} aria-hidden="true" />}
                />

                <CompactPerformanceCard
                  label="Late"
                  value={performanceData.summary?.late ?? 0}
                  tone="amber"
                  icon={<FiCalendar size={12} aria-hidden="true" />}
                />

                <CompactPerformanceCard
                  label="Absent"
                  value={performanceData.summary?.absent ?? 0}
                  tone="red"
                  icon={<FiCalendar size={12} aria-hidden="true" />}
                />

                <CompactPerformanceCard
                  label="On Leave"
                  value={performanceData.summary?.onLeave ?? 0}
                  tone="blue"
                  icon={<FiFileText size={12} aria-hidden="true" />}
                />
              </div>

              {(performanceData.employees || []).length === 0 ? (
                <div className="border-t border-slate-200 p-10 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No saved attendance entries exist for this period.
                </div>
              ) : (
                <>
                  <div className="border-t border-slate-200 px-4 py-3 dark:border-white/10">
                    <div className="max-w-sm">
                      <SearchInput
                        label="Search employee name"
                        hideLabel
                        placeholder="Search any part of employee name..."
                        value={performanceEmployeeSearch}
                        onChange={(event) =>
                          setPerformanceEmployeeSearch(
                            event.target.value
                          )
                        }
                        onClear={() =>
                          setPerformanceEmployeeSearch(
                            ""
                          )
                        }
                      />
                    </div>
                  </div>

                  {filteredPerformanceEmployees.length === 0 ? (
                    <div className="border-t border-slate-200 p-10 text-center dark:border-white/10">
                      <FiSearch
                        className="mx-auto text-3xl text-slate-400"
                        aria-hidden="true"
                      />

                      <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                        No employee found.
                      </p>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Try another employee name.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-auto border-t border-slate-200 dark:border-white/10">
                  <table className="w-full min-w-[880px] divide-y divide-slate-200 text-left text-sm dark:divide-white/10">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Employee
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Present
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Late
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Absent
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Leave
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Rest Day
                        </th>

                        <th className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          Remarks
                        </th>

                        <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                          Rate
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredPerformanceEmployees.map((employee) => (
                        <tr
                          key={employee.employeeId}
                          className="transition hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {employee.employeeName}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {employee.position}
                            </p>

                          </td>

                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {employee.present}
                          </td>

                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {employee.late}
                          </td>

                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {employee.absent}
                          </td>

                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {employee.onLeave}
                          </td>

                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {employee.restDay}
                          </td>

                          <td className="px-3 py-3 align-middle">
                            {getPerformanceRemarksCount(
                              employee
                            ) === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-600">
                                —
                              </span>
                            ) : (
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  disabled={
                                    employeeHistoryLoading &&
                                    performanceRemarkTargetId !==
                                      String(
                                        employee.employeeId
                                      )
                                  }
                                  aria-expanded={
                                    performanceRemarkTargetId ===
                                    String(
                                      employee.employeeId
                                    )
                                  }
                                  onClick={() =>
                                    void handleEmployeeAttendanceHistory(
                                      employee.employeeId
                                    )
                                  }
                                  className={[
                                    "inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                                    performanceRemarkTargetId ===
                                    String(
                                      employee.employeeId
                                    )
                                      ? "bg-indigo-600 text-white"
                                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20",
                                  ].join(" ")}
                                >
                                  <FiMessageSquare aria-hidden="true" />
                                  Remarks
                                  {Number.isInteger(
                                    getPerformanceRemarksCount(
                                      employee
                                    )
                                  ) &&
                                    getPerformanceRemarksCount(
                                      employee
                                    ) > 0 && (
                                      <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-white/10 dark:text-indigo-200">
                                        {getPerformanceRemarksCount(
                                          employee
                                        )}
                                      </span>
                                    )}
                                </button>

                                {performanceRemarkTargetId ===
                                  String(
                                    employee.employeeId
                                  ) && (
                                <div
                                  className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                                  role="dialog"
                                  aria-label={`Attendance remarks for ${employee.employeeName}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                                        Attendance Remarks
                                      </p>

                                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {employee.employeeName} · {performancePeriod}
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPerformanceRemarkTargetId(
                                          ""
                                        );

                                        setEmployeeHistory(
                                          null
                                        );

                                        setEmployeeHistoryError(
                                          ""
                                        );
                                      }}
                                      aria-label="Close remarks"
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    >
                                      <FiX aria-hidden="true" />
                                    </button>
                                  </div>

                                  <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    {employeeHistoryLoading ? (
                                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Loading remarks...
                                      </p>
                                    ) : employeeHistoryError ? (
                                      <p className="text-xs font-semibold leading-5 text-red-600 dark:text-red-300">
                                        {employeeHistoryError}
                                      </p>
                                    ) : performanceRemarkRecords.length ===
                                      0 ? (
                                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        No remarks were recorded for this employee during the selected period.
                                      </p>
                                    ) : (
                                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                        {performanceRemarkRecords.map(
                                          (
                                            record
                                          ) => (
                                            <div
                                              key={`remark-${record.id || record.batchId || record.date}`}
                                              className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950"
                                            >
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                                  {record.date}
                                                </span>

                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                  {record.status ===
                                                  "Unmarked"
                                                    ? "No Entry"
                                                    : record.status}
                                                </span>
                                              </div>

                                              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700 dark:text-slate-300">
                                                {record.note}
                                              </p>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400 dark:border-slate-800 dark:text-slate-500">
                                    For reference only. Remarks are recorded by the HR Coordinator during Daily Attendance.
                                  </p>
                                </div>
                              )}
                            </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-black text-indigo-700 dark:text-indigo-300">
                            {formatAttendanceRate(
                              employee.attendanceRate
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
      <Dialog
        open={showStartOverConfirm}
        onClose={handleCancelStartOver}
        title="Start Over Attendance?"
        description="This will clear the attendance statuses, notes, and attached client record for the current unsaved sheet."
        tone="warning"
        size="sm"
        closeOnOverlay
        closeOnEscape
        footer={
          <div className="flex w-full flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancelStartOver}
            >
              Keep Entries
            </Button>

            <Button
              type="button"
              variant="warning"
              onClick={handleConfirmStartOver}
            >
              Start Over
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Saved attendance records will not be affected.
        </p>
      </Dialog>

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