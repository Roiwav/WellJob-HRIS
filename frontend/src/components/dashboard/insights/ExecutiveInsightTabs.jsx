import { useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiMapPin,
} from "react-icons/fi";

const TABS = [
  {
    key: "riskSites",
    label: "Risk Sites",
  },
  {
    key: "caseAging",
    label: "Case Aging",
  },
  {
    key: "compliance",
    label: "Compliance",
  },
  {
    key: "positiveSignals",
    label: "Positive Signals",
  },
];

function InsightTabIcon({ tabKey }) {
  switch (tabKey) {
    case "riskSites":
      return (
        <FiMapPin
          size={14}
          aria-hidden="true"
        />
      );

    case "caseAging":
      return (
        <FiClock
          size={14}
          aria-hidden="true"
        />
      );

    case "compliance":
      return (
        <FiFileText
          size={14}
          aria-hidden="true"
        />
      );

    case "positiveSignals":
      return (
        <FiCheckCircle
          size={14}
          aria-hidden="true"
        />
      );

    default:
      return null;
  }
}

export default function ExecutiveInsightTabs({
  insights,
  onOpenDrilldown,
}) {
  const [activeTab, setActiveTab] =
    useState("riskSites");

  if (!insights) {
    return null;
  }

  let activeContent = null;

  if (activeTab === "riskSites") {
    activeContent = (
      <RiskSitesPanel
        riskSites={insights.riskSites}
        onOpen={() =>
          onOpenDrilldown?.("riskSites")
        }
      />
    );
  } else if (activeTab === "caseAging") {
    activeContent = (
      <CaseAgingPanel
        caseAging={insights.caseAging}
        onOpen={() =>
          onOpenDrilldown?.("overdueCases")
        }
      />
    );
  } else if (activeTab === "compliance") {
    activeContent = (
      <CompliancePanel
        complianceBreakdown={
          insights.complianceBreakdown
        }
        onOpen={() =>
          onOpenDrilldown?.(
            "complianceBreakdown"
          )
        }
      />
    );
  } else if (
    activeTab === "positiveSignals"
  ) {
    activeContent = (
      <PositiveSignalsPanel
        positiveSignals={
          insights.positiveSignals
        }
        onOpen={() =>
          onOpenDrilldown?.(
            "positiveSignals"
          )
        }
      />
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Executive Insight Center
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Drillable summaries for
            client-site risk, case aging,
            compliance monitoring, and
            positive workforce indicators.
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2"
          aria-label="Executive insight categories"
        >
          {TABS.map((tab) => {
            const isActive =
              activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  setActiveTab(tab.key)
                }
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <InsightTabIcon
                  tabKey={tab.key}
                />

                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="p-5"
        aria-live="polite"
      >
        {activeContent}
      </div>
    </section>
  );
}

function InsightEmptyState({
  title,
  description,
}) {
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

function ViewButton({
  onClick,
  children = "View Details",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
    >
      {children}

      <FiExternalLink
        size={13}
        aria-hidden="true"
      />
    </button>
  );
}

function RiskSitesPanel({
  riskSites = [],
  onOpen,
}) {
  const safeRiskSites = Array.isArray(
    riskSites
  )
    ? riskSites
    : [];

  const topSites = safeRiskSites.slice(
    0,
    4
  );

  if (topSites.length === 0) {
    return (
      <InsightEmptyState
        title="No client-site risk concentration detected"
        description="Incident records do not show a concentrated risk pattern by company or deployment site."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topSites.map((site, index) => (
          <div
            key={
              site.company ||
              `risk-site-${index}`
            }
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/30"
          >
            <p className="line-clamp-1 text-sm font-extrabold text-slate-900 dark:text-white">
              {site.company ||
                "Unassigned"}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniMetric
                label="Total"
                value={site.total}
              />

              <MiniMetric
                label="Critical"
                value={site.critical}
              />

              <MiniMetric
                label="Active"
                value={site.active}
              />
            </div>

            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {site.recommendation ||
                "Continue regular site monitoring."}
            </p>
          </div>
        ))}
      </div>

      <ViewButton onClick={onOpen}>
        View Risk Sites
      </ViewButton>
    </div>
  );
}

function CaseAgingPanel({
  caseAging,
  onOpen,
}) {
  if (!caseAging) {
    return (
      <InsightEmptyState
        title="No case-aging information available"
        description="Case-aging metrics could not be generated from the current reporting data."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="0–7 Days"
          value={caseAging.zeroToSeven}
          tone="blue"
        />

        <MetricCard
          label="8–30 Days"
          value={caseAging.eightToThirty}
          tone="amber"
        />

        <MetricCard
          label="30+ Days"
          value={caseAging.overThirty}
          tone="red"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/30 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {caseAging.recommendation ||
            "Continue regular case monitoring."}
        </p>

        <ViewButton onClick={onOpen}>
          View Overdue Cases
        </ViewButton>
      </div>
    </div>
  );
}

function CompliancePanel({
  complianceBreakdown = [],
  onOpen,
}) {
  const safeComplianceBreakdown =
    Array.isArray(complianceBreakdown)
      ? complianceBreakdown
      : [];

  const topDocs =
    safeComplianceBreakdown.slice(0, 4);

  if (topDocs.length === 0) {
    return (
      <InsightEmptyState
        title="No compliance expiration concern"
        description="No expiring document type was detected within the monitored period."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topDocs.map((doc, index) => (
          <div
            key={
              doc.document ||
              `compliance-document-${index}`
            }
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <p className="line-clamp-1 text-sm font-extrabold text-amber-800 dark:text-amber-200">
              {doc.document ||
                "Compliance Document"}
            </p>

            <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">
              {Number(doc.count) || 0}
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700/80 dark:text-amber-200/80">
              {doc.recommendation ||
                "Follow up updated document submission."}
            </p>
          </div>
        ))}
      </div>

      <ViewButton onClick={onOpen}>
        View Compliance Breakdown
      </ViewButton>
    </div>
  );
}

function PositiveSignalsPanel({
  positiveSignals = [],
  onOpen,
}) {
  const safePositiveSignals =
    Array.isArray(positiveSignals)
      ? positiveSignals
      : [];

  const topSignals =
    safePositiveSignals.slice(0, 4);

  if (topSignals.length === 0) {
    return (
      <InsightEmptyState
        title="No positive workforce signal detected"
        description="The current reporting scope does not yet contain a qualifying positive workforce pattern."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topSignals.map(
          (signal, index) => (
            <div
              key={
                signal.title ||
                `positive-signal-${index}`
              }
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  aria-hidden="true"
                >
                  <FiCheckCircle
                    size={17}
                  />
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                    {signal.title ||
                      "Positive Signal"}
                  </p>

                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-emerald-700/80 dark:text-emerald-200/80">
                    {signal.basis ||
                      "A positive workforce indicator was detected."}
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <ViewButton onClick={onOpen}>
        View Positive Signals
      </ViewButton>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-white px-2 py-2 dark:bg-slate-900">
      <p className="text-base font-black text-slate-900 dark:text-white">
        {Number(value) || 0}
      </p>

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}) {
  const tones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",

    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",

    red:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  };

  const toneClass =
    tones[tone] || tones.blue;

  return (
    <div
      className={`rounded-2xl border p-4 ${toneClass}`}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {Number(value) || 0}
      </p>
    </div>
  );
}