import { FiAlertTriangle } from "react-icons/fi";

export const COMPANY_OPTIONS = [
  "SM Supermalls", "Robinsons Retail Holdings", "Ayala Land Inc.",
  "Jollibee Foods Corporation", "San Miguel Corporation", "PLDT Inc.",
  "Globe Telecom", "BDO Unibank", "Metrobank", "Puregold Price Club",
  "Wilcon Depot", "DMCI Holdings", "Megaworld Corporation",
  "Unilab Inc.", "Nestlé Philippines", "Coca-Cola Philippines",
  "Pepsi-Cola Products Philippines", "Toyota Philippines", "Honda Philippines",
  "Accenture Philippines", "IBM Philippines", "Teleperformance Philippines",
  "Concentrix Philippines", "Sitel Philippines",
];

export const DOCUMENT_OPTIONS = [
  { name: "Resume", expirable: false },
  { name: "NSO/PSA", expirable: false },
  { name: "SSS (ID or E1 form)", expirable: false },
  { name: "Pag-IBIG (ID or MDRF Form)", expirable: false },
  { name: "PhilHealth (ID or MDF Form)", expirable: false },
  { name: "Diploma", expirable: false },
  { name: "Cedula", expirable: false },
  { name: "Barangay Clearance", expirable: true },
  { name: "NBI/Police Clearance", expirable: true },
];

export const MIN_DEPLOYED_DOCUMENTS = 5;

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function toProperName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function createDefaultDocuments(existingDocs = []) {
  return DOCUMENT_OPTIONS.map((doc) => {
    const matched = existingDocs.find((d) => d.name === doc.name);

    return {
      name: doc.name,
      expirable: doc.expirable,
      checked: !!matched,
      expirationDate: matched?.expirationDate || "",
      filePath: matched?.filePath || null,
      file: matched?.filePath
        ? {
            url: `http://localhost:5000/${matched.filePath}`,
            name: matched.name,
            type: matched.filePath.endsWith(".pdf") ? "application/pdf" : "image/*",
          }
        : null,
    };
  });
}

export function getDocumentStatus(expirationDate) {
  if (!expirationDate) return "No Data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "Expired";
  if (diffDays <= 30) return "Expiring Soon";
  return "Valid";
}

export function ErrorText({ children }) {
  if (!children) return null;

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      <FiAlertTriangle />
      {children}
    </p>
  );
}

export function StatusPill({ children, tone = "slate" }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    green:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    amber:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
    indigo:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
}

export function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-slate-800">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

export function ReviewBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-extrabold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}