import {
  FiAlertTriangle,
  FiCheckCircle,
  FiShield,
  FiTarget,
  FiUsers,
  FiZap,
} from "react-icons/fi";

const STANDING_METRIC_TONES = {
  emerald: {
    card:
      "border-emerald-500/20 bg-emerald-500/[0.08]",
    text: "text-emerald-300",
    icon:
      "bg-emerald-500/10 text-emerald-300",
  },

  amber: {
    card:
      "border-amber-500/20 bg-amber-500/[0.08]",
    text: "text-amber-300",
    icon:
      "bg-amber-500/10 text-amber-300",
  },

  red: {
    card:
      "border-red-500/20 bg-red-500/[0.08]",
    text: "text-red-300",
    icon:
      "bg-red-500/10 text-red-300",
  },

  indigo: {
    card:
      "border-indigo-500/20 bg-indigo-500/[0.08]",
    text: "text-indigo-300",
    icon:
      "bg-indigo-500/10 text-indigo-300",
  },

  slate: {
    card:
      "border-slate-800 bg-slate-950/30",
    text: "text-slate-200",
    icon:
      "bg-slate-800 text-slate-300",
  },
};

function formatEmployeeId(id) {
  return String(id || "-").replace(
    /^KPI-/i,
    ""
  );
}

function getInitials(name) {
  return String(
    name || "Employee"
  )
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase()
    )
    .join("");
}

function getPriorityEmployees(
  employees = []
) {
  const safeEmployees =
    Array.isArray(employees)
      ? employees
      : [];

  return [...safeEmployees]
    .filter((employee) => {
      return (
        employee?.riskLevel ===
          "High Risk" ||
        employee?.riskLevel ===
          "Repeat" ||
        Number(
          employee?.criticalIncidentCount ||
            0
        ) > 0 ||
        Number(
          employee?.violationCount ||
            0
        ) >= 3
      );
    })
    .sort(
      (
        firstEmployee,
        secondEmployee
      ) => {
        const severityDifference =
          Number(
            secondEmployee?.severityScore ||
              0
          ) -
          Number(
            firstEmployee?.severityScore ||
              0
          );

        if (
          severityDifference !== 0
        ) {
          return severityDifference;
        }

        return (
          Number(
            secondEmployee?.violationCount ||
              0
          ) -
          Number(
            firstEmployee?.violationCount ||
              0
          )
        );
      }
    )
    .slice(0, 3);
}

function getPriorityEmployeeStyle(
  employee
) {
  const isHighRisk =
    employee?.riskLevel ===
      "High Risk" ||
    Number(
      employee?.criticalIncidentCount ||
        0
    ) > 0;

  if (isHighRisk) {
    return {
      avatar:
        "bg-red-500/10 text-red-300",

      badge:
        "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  return {
    avatar:
      "bg-amber-500/10 text-amber-300",

    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
}

function StandingMetric({
  icon,
  label,
  value,
  helper,
  tone = "slate",
}) {
  const style =
    STANDING_METRIC_TONES[tone] ||
    STANDING_METRIC_TONES.slate;

  return (
    <article
      className={`rounded-2xl border px-4 py-3 ${style.card}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p
            className={`mt-1 text-2xl font-black leading-none ${style.text}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${style.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <p className="mt-2 truncate text-[11px] font-semibold text-slate-400">
        {helper}
      </p>
    </article>
  );
}

function PriorityEmployeeRow({
  employee,
}) {
  const priorityStyle =
    getPriorityEmployeeStyle(
      employee
    );

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${priorityStyle.avatar}`}
          aria-hidden="true"
        >
          {getInitials(
            employee?.name
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {employee?.name ||
                  "Unknown Employee"}
              </p>

              <p className="mt-0.5 truncate text-xs text-slate-500">
                ID:{" "}
                {formatEmployeeId(
                  employee?.id
                )}{" "}
                •{" "}
                {employee?.company ||
                  "Unassigned"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${priorityStyle.badge}`}
            >
              {employee?.riskLevel ||
                "For Review"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1">
              Vio.{" "}
              {Number(
                employee?.violationCount
              ) || 0}
            </span>

            <span className="rounded-lg bg-slate-900 px-2.5 py-1">
              Severity{" "}
              {Number(
                employee?.severityScore
              ) || 0}
            </span>

            <span className="rounded-lg bg-slate-900 px-2.5 py-1">
              {employee?.suggestedHRAction ||
                "Review"}
            </span>
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
}) {
  const priorityEmployees =
    getPriorityEmployees(
      employees
    );

  const safeTotalEmployees =
    Math.max(
      0,
      Number(
        totalEmployees || 0
      )
    );

  const safeGoodStandingEmployees =
    Math.max(
      0,
      Number(
        goodStandingEmployees || 0
      )
    );

  const safeHighRiskEmployees =
    Math.max(
      0,
      Number(
        highRiskEmployees || 0
      )
    );

  const safePendingRecommendationCount =
    Math.max(
      0,
      Number(
        pendingRecommendationCount ||
          0
      )
    );

  const stablePercentage =
    safeTotalEmployees > 0
      ? Math.round(
          (safeGoodStandingEmployees /
            safeTotalEmployees) *
            100
        )
      : 0;

  const reviewPercentage =
    safeTotalEmployees > 0
      ? Math.round(
          (safePendingRecommendationCount /
            safeTotalEmployees) *
            100
        )
      : 0;

  return (
    <section
      className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm"
      aria-labelledby="employee-standing-title"
    >
      <div className="mb-4 flex flex-col gap-1">
        <h2
          id="employee-standing-title"
          className="flex items-center gap-2 text-base font-black text-white"
        >
          <FiUsers
            className="text-indigo-300"
            aria-hidden="true"
          />

          Employee Standing Overview
        </h2>

        <p className="text-xs leading-5 text-slate-400">
          Summary of employee standing,
          pending HR review, and priority
          cases.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StandingMetric
          icon={
            <FiCheckCircle
              aria-hidden="true"
            />
          }
          label="Good Standing"
          value={
            safeGoodStandingEmployees
          }
          helper={`${stablePercentage}% stable records`}
          tone="emerald"
        />

        <StandingMetric
          icon={
            <FiTarget
              aria-hidden="true"
            />
          }
          label="Needs Review"
          value={
            safePendingRecommendationCount
          }
          helper={`${reviewPercentage}% pending validation`}
          tone="amber"
        />

        <StandingMetric
          icon={
            <FiAlertTriangle
              aria-hidden="true"
            />
          }
          label="High Risk"
          value={
            safeHighRiskEmployees
          }
          helper="Priority monitoring cases"
          tone="red"
        />

        <StandingMetric
          icon={
            <FiShield
              aria-hidden="true"
            />
          }
          label="Monitored"
          value={
            safeTotalEmployees
          }
          helper="Active KPI records"
          tone="indigo"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-white">
                <FiZap
                  className="text-red-300"
                  aria-hidden="true"
                />

                Priority Attention
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Top employees requiring
                immediate HR checking.
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-black text-slate-300">
              Top{" "}
              {
                priorityEmployees.length
              }
            </span>
          </div>

          {priorityEmployees.length ===
          0 ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-300">
              <p className="text-sm font-black">
                No priority attention
                detected.
              </p>

              <p className="mt-1 text-xs leading-5 opacity-80">
                Current records do not
                show high-risk employee
                cases.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {priorityEmployees.map(
                (employee) => (
                  <PriorityEmployeeRow
                    key={
                      employee?.id ||
                      employee?.employeeId ||
                      employee?.name
                    }
                    employee={
                      employee
                    }
                  />
                )
              )}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-800 bg-slate-950/30 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <FiCheckCircle
              className="text-emerald-300"
              aria-hidden="true"
            />

            Stable Workforce
          </h3>

          <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <p className="text-3xl font-black text-emerald-300">
              {
                safeGoodStandingEmployees
              }
            </p>

            <p className="mt-2 text-xs font-bold leading-5 text-emerald-200">
              employees have no recorded
              negative KPI pattern.
            </p>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Interpretation
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Detailed employee records
              are available in Employee
              Intelligence. Pending
              validation is handled in
              Recommendation Review.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}