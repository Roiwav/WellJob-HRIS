import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiShield,
  FiTarget,
  FiUsers,
  FiZap,
} from "react-icons/fi";

function formatEmployeeId(id) {
  return String(id || "-").replace(/^KPI-/i, "");
}

function getInitials(name) {
  return String(name || "Employee")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getPriorityEmployees(employees = []) {
  return [...employees]
    .filter((emp) => {
      return (
        emp.riskLevel === "High Risk" ||
        emp.riskLevel === "Repeat" ||
        Number(emp.criticalIncidentCount || 0) > 0 ||
        Number(emp.violationCount || 0) >= 3
      );
    })
    .sort((a, b) => {
      const criticalDiff =
        Number(b.criticalIncidentCount || 0) -
        Number(a.criticalIncidentCount || 0);

      if (criticalDiff !== 0) return criticalDiff;

      const severityDiff =
        Number(b.severityScore || 0) - Number(a.severityScore || 0);

      if (severityDiff !== 0) return severityDiff;

      return Number(b.violationCount || 0) - Number(a.violationCount || 0);
    })
    .slice(0, 3);
}

function SnapshotMetric({ icon, label, value, helper, tone = "slate" }) {
  const tones = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
  };

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        tones[tone] || tones.slate
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide opacity-75">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black leading-none sm:text-3xl">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-base shadow-sm dark:bg-slate-950/30">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 opacity-85">
        {helper}
      </p>
    </article>
  );
}

function PriorityEmployeeCard({ employee }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-black text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {getInitials(employee.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                {employee.name || "Unknown Employee"}
              </p>

              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                ID: {formatEmployeeId(employee.id)} •{" "}
                {employee.company || "Unassigned"}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/60">
              {employee.riskLevel || "For Review"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Vio.
              </p>
              <p className="mt-0.5 text-sm font-black text-slate-700 dark:text-slate-200">
                {employee.violationCount || 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Severity
              </p>
              <p className="mt-0.5 text-sm font-black text-slate-700 dark:text-slate-200">
                {employee.severityScore || 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Action
              </p>
              <p className="mt-0.5 truncate text-xs font-black text-slate-700 dark:text-slate-200">
                {employee.suggestedHRAction || "Review"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function WorkforceStandingSnapshot({
  employees = [],
  totalEmployees = 0,
  goodStandingEmployees = 0,
  highRiskEmployees = 0,
  pendingRecommendationCount = 0,
  onOpenIntelligence,
  onOpenReview,
}) {
  const priorityEmployees = getPriorityEmployees(employees);

  const stablePercentage =
    totalEmployees > 0
      ? Math.round((goodStandingEmployees / totalEmployees) * 100)
      : 0;

  const reviewPercentage =
    totalEmployees > 0
      ? Math.round((pendingRecommendationCount / totalEmployees) * 100)
      : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
            <FiUsers className="text-indigo-600 dark:text-indigo-300" />
            Employee Standing Overview
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
           Quick summary of employee standing, pending HR reviews, and priority cases.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenIntelligence}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-600"
          >
            Employee Intelligence
            <FiArrowRight />
          </button>

          <button
            type="button"
            onClick={onOpenReview}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white transition hover:bg-indigo-700"
          >
            Review Queue
            <FiArrowRight />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotMetric
          icon={<FiCheckCircle />}
          label="Good Standing"
          value={goodStandingEmployees}
          helper={`${stablePercentage}% stable based on current KPI records.`}
          tone="emerald"
        />

        <SnapshotMetric
          icon={<FiTarget />}
          label="Needs HR Review"
          value={pendingRecommendationCount}
          helper={`${reviewPercentage}% have pending HR validation.`}
          tone="amber"
        />

        <SnapshotMetric
          icon={<FiAlertTriangle />}
          label="High Risk"
          value={highRiskEmployees}
          helper="Critical indicators or repeated violation patterns."
          tone="rose"
        />

        <SnapshotMetric
          icon={<FiShield />}
          label="Total Monitored"
          value={totalEmployees}
          helper="Active employees included in KPI evaluation."
          tone="indigo"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                <FiZap className="text-rose-500 dark:text-rose-300" />
                Priority Attention
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Top records that may need immediate checking.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
              Top {priorityEmployees.length}
            </span>
          </div>

          {priorityEmployees.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
              <p className="text-sm font-black">
                No priority attention detected.
              </p>

              <p className="mt-1 text-xs leading-5 opacity-80">
                Current KPI records do not show high-risk or critical employee
                cases.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {priorityEmployees.map((employee) => (
                <PriorityEmployeeCard
                  key={employee.id || employee.employeeId || employee.name}
                  employee={employee}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
            <FiCheckCircle className="text-emerald-500 dark:text-emerald-300" />
            Stable Workforce
          </h3>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
            <p className="text-3xl font-black">{goodStandingEmployees}</p>

            <p className="mt-2 text-sm font-black leading-5">
              employees have no recorded negative KPI pattern.
            </p>

            <p className="mt-2 text-xs font-medium leading-5 opacity-80">
              Detailed employee standing is available in the Employee
              Intelligence tab.
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onOpenIntelligence}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
            >
              View full employee standing
              <FiArrowRight />
            </button>

            <button
              type="button"
              onClick={onOpenReview}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-900/60 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white"
            >
              Open review queue
              <FiArrowRight />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}