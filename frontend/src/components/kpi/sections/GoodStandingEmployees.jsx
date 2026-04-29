import { FiAward, FiCheckCircle, FiUserCheck } from "react-icons/fi";

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDocumentSummary(employee) {
  const docs = Array.isArray(employee?.documents) ? employee.documents : [];

  if (docs.length === 0) {
    return "No compliance documents recorded";
  }

  const completedDocs = docs.filter((doc) => {
    const hasFile = Boolean(doc.filePath || doc.file || doc.url);
    const needsExpiration =
      doc.name === "Barangay Clearance" || doc.name === "NBI/Police Clearance";

    if (!hasFile) return false;
    if (needsExpiration && !doc.expirationDate && !doc.expiration_date) {
      return false;
    }

    return true;
  }).length;

  return `${completedDocs}/${docs.length} document(s) completed`;
}

export default function GoodStandingEmployees({ employees = [] }) {
  const goodStandingEmployees = employees
    .filter((emp) => {
      const violationCount = Number(emp.violationCount || 0);
      const criticalIncidentCount = Number(emp.criticalIncidentCount || 0);
      const riskLevel = String(emp.riskLevel || "").toLowerCase();

      return (
        violationCount === 0 &&
        criticalIncidentCount === 0 &&
        !riskLevel.includes("high") &&
        !riskLevel.includes("repeat")
      );
    })
    .sort((a, b) => {
      const deployedA = a.isDeployed ? 1 : 0;
      const deployedB = b.isDeployed ? 1 : 0;

      if (deployedA !== deployedB) return deployedB - deployedA;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  return (
    <div className="flex max-h-[430px] min-h-[245px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
            <FiAward className="text-emerald-500 dark:text-emerald-400" />
            Good Standing Employees
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Employees with clean incident records recommended for positive HR
            monitoring.
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/70">
          {goodStandingEmployees.length}
        </span>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <FiUserCheck />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                No employee records available yet.
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Good-standing employees will appear once employee records are
                added.
              </p>
            </div>
          </div>
        </div>
      ) : goodStandingEmployees.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <FiCheckCircle />
            </div>

            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                No good-standing employees detected yet.
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700/80 dark:text-amber-300/80">
                Employees with zero recorded violations will appear here for
                retention or recognition consideration.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <div className="space-y-3">
            {goodStandingEmployees.map((emp) => (
              <div
                key={emp.id || emp.employeeId || emp.name}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {getInitials(emp.name)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {emp.name || "Unknown Employee"}
                      </p>

                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {emp.company || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Clean
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-400">Violations</p>

                    <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">
                      {emp.violationCount || 0}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-400">Recommendation</p>

                    <p className="mt-1 font-bold text-emerald-700 dark:text-emerald-300">
                      Retain
                    </p>
                  </div>
                </div>

                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-medium leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                    Basis:
                  </span>{" "}
                  No recorded violations. {getDocumentSummary(emp)}.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}