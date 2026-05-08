import {
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";

function CompactMetric({ icon, label, value, suffix = "", tone = "slate" }) {
  const tones = {
    indigo:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-200",
    emerald:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-200",
    rose:
      "border-rose-500/30 bg-rose-500/10 text-rose-200",
    slate:
      "border-slate-700 bg-slate-900 text-slate-200",
  };

  return (
    <article
      className={`rounded-2xl border px-4 py-3 shadow-sm ${
        tones[tone] || tones.slate
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide opacity-70">
            {label}
          </p>

          <div className="mt-1 flex items-end gap-1">
            <p className="text-2xl font-black leading-none">{value}</p>

            {suffix && (
              <span className="pb-0.5 text-xs font-black opacity-80">
                {suffix}
              </span>
            )}
          </div>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950/30 text-sm">
          {icon}
        </div>
      </div>
    </article>
  );
}

export default function KPISummarySection({
  totalEmployees = 0,
  complianceRate = 0,
  repeatOffenders = 0,
  highRiskEmployees = 0,
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-black text-gray-900 dark:text-white">
          KPI Summary
        </h2>

        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
          Quick workforce indicators generated from employee and incident
          records.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CompactMetric
          icon={<FiUsers />}
          label="Total Employees"
          value={totalEmployees}
          tone="indigo"
        />

        <CompactMetric
          icon={<FiCheckCircle />}
          label="Compliance Rate"
          value={complianceRate}
          suffix="%"
          tone={complianceRate >= 80 ? "emerald" : "rose"}
        />

        <CompactMetric
          icon={<FiRefreshCw />}
          label="Repeat Offenders"
          value={repeatOffenders}
          tone="amber"
        />

        <CompactMetric
          icon={<FiAlertTriangle />}
          label="High Risk"
          value={highRiskEmployees}
          tone="rose"
        />
      </div>
    </section>
  );
}