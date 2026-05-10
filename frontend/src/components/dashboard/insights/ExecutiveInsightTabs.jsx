import { useMemo, useState } from "react";
import {
  FiClock,
  FiFileText,
  FiMapPin,
  FiExternalLink,
} from "react-icons/fi";

const TABS = [
  {
    key: "riskSites",
    label: "Risk Sites",
    icon: FiMapPin,
  },
  {
    key: "caseAging",
    label: "Case Aging",
    icon: FiClock,
  },
  {
    key: "compliance",
    label: "Compliance",
    icon: FiFileText,
  },
];

export default function ExecutiveInsightTabs({ insights, onOpenDrilldown }) {
  const [activeTab, setActiveTab] = useState("riskSites");

  const activeContent = useMemo(() => {
    if (!insights) return null;

    if (activeTab === "riskSites") {
      return (
        <RiskSitesPanel
          riskSites={insights.riskSites}
          onOpen={() => onOpenDrilldown?.("riskSites")}
        />
      );
    }

    if (activeTab === "caseAging") {
      return (
        <CaseAgingPanel
          caseAging={insights.caseAging}
          onOpen={() => onOpenDrilldown?.("overdueCases")}
        />
      );
    }

return (
  <CompliancePanel complianceBreakdown={insights.complianceBreakdown} />
);
  }, [activeTab, insights, onOpenDrilldown]);

  if (!insights) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Executive Insight Center
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Drillable summaries for client-site risk, case aging, and compliance focus.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">{activeContent}</div>
    </section>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/40">
      <p className="text-sm font-extrabold text-slate-800 dark:text-white">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function ViewButton({ onClick, children = "View Details" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {children}
      <FiExternalLink size={13} />
    </button>
  );
}

function RiskSitesPanel({ riskSites = [], onOpen }) {
  const topSites = riskSites.slice(0, 4);

  if (topSites.length === 0) {
    return (
      <EmptyState
        title="No client-site risk concentration detected"
        description="Incident records do not show a concentrated risk pattern by company or deployment site."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topSites.map((site) => (
          <div
            key={site.company}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/30"
          >
            <p className="line-clamp-1 text-sm font-extrabold text-slate-900 dark:text-white">
              {site.company}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Total" value={site.total} />
              <MiniMetric label="Critical" value={site.critical} />
              <MiniMetric label="Active" value={site.active} />
            </div>

            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {site.recommendation}
            </p>
          </div>
        ))}
      </div>

      <ViewButton onClick={onOpen}>View Risk Sites</ViewButton>
    </div>
  );
}

function CaseAgingPanel({ caseAging, onOpen }) {
  if (!caseAging) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="0–7 Days" value={caseAging.zeroToSeven} tone="blue" />

        <MetricCard
          label="8–30 Days"
          value={caseAging.eightToThirty}
          tone="amber"
        />

        <MetricCard label="30+ Days" value={caseAging.overThirty} tone="red" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/30 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {caseAging.recommendation}
        </p>

        <ViewButton onClick={onOpen}>View Overdue Cases</ViewButton>
      </div>
    </div>
  );
}

function CompliancePanel({ complianceBreakdown = [] }) {
  const topDocs = complianceBreakdown.slice(0, 4);

  if (topDocs.length === 0) {
    return (
      <EmptyState
        title="No compliance expiration concern"
        description="No expiring document type was detected within the monitored period."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topDocs.map((doc) => (
          <div
            key={doc.document}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <p className="line-clamp-1 text-sm font-extrabold text-amber-800 dark:text-amber-200">
              {doc.document}
            </p>

            <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">
              {doc.count}
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700/80 dark:text-amber-200/80">
              {doc.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-2 py-2 dark:bg-slate-900">
      <p className="text-base font-black text-slate-900 dark:text-white">
        {value}
      </p>

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}