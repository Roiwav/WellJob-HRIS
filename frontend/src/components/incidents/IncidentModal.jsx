import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiFileText,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";
import IncidentActions from "./IncidentActions";

const INCIDENTS_KEY = "incidents";

const severityStyle = {
  Minor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Major: "bg-amber-100 text-amber-700 border-amber-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const penaltyLevelStyle = {
  Warning: "bg-sky-100 text-sky-700 border-sky-200",
  "Warning / 1–7 Days Suspension":
    "bg-cyan-100 text-cyan-700 border-cyan-200",
  "1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "15–30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
};

export default function IncidentModal({ incident, close }) {
  const [currentIncident, setCurrentIncident] = useState(incident);

  useEffect(() => {
    setCurrentIncident(incident);
  }, [incident]);

  useEffect(() => {
    if (!incident?.id) return;

    const syncIncident = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(INCIDENTS_KEY) || "[]");
        const updatedIncident = stored.find((item) => item.id === incident.id);
        if (updatedIncident) setCurrentIncident(updatedIncident);
      } catch (error) {
        console.error("Failed to sync incident:", error);
      }
    };

    window.addEventListener("dataUpdated", syncIncident);
    window.addEventListener("storage", syncIncident);

    return () => {
      window.removeEventListener("dataUpdated", syncIncident);
      window.removeEventListener("storage", syncIncident);
    };
  }, [incident]);

  if (!currentIncident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiAlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Incident Details
                </h2>
                <p className="mt-1 text-sm text-red-100">
                  {currentIncident.id || "-"} • {currentIncident.status || "-"}
                </p>
              </div>
            </div>

            <button
              onClick={close}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section className="grid gap-4 md:grid-cols-2">
            <InfoCard
              icon={<FiUser />}
              label="Employee"
              value={currentIncident.employee}
            />
            <InfoCard
              icon={<FiBriefcase />}
              label="Company / Client"
              value={currentIncident.company}
            />
            <InfoCard
              icon={<FiCalendar />}
              label="Reported Date"
              value={currentIncident.date}
            />
            <InfoCard
              icon={<FiFileText />}
              label="Reported By"
              value={currentIncident.reportedBy}
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
              <FiShield />
              Violation Classification
            </h3>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Violation Type
                </p>
                <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">
                  {currentIncident.violation || "-"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {currentIncident.violationCategory || "-"}{" "}
                  {currentIncident.violationSection
                    ? `• ${currentIncident.violationSection}`
                    : ""}
                </p>

                {currentIncident.violationDescription && (
                  <p
                    className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400"
                    dangerouslySetInnerHTML={{
                      __html: currentIncident.violationDescription,
                    }}
                  />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BadgeCard
                  label="Penalty Level"
                  value={currentIncident.penaltyLevel || currentIncident.sanction}
                  styleMap={penaltyLevelStyle}
                />
                <BadgeCard
                  label="Severity"
                  value={currentIncident.severity}
                  styleMap={severityStyle}
                />
              </div>
            </div>

            {(currentIncident.penalties || []).length > 0 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Penalties
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {(currentIncident.penalties || []).map((penalty, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-red-500">•</span>
                      <span>{penalty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Incident Description
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-300">
              {currentIncident.description || "-"}
            </p>
          </section>

          <IncidentActions incident={currentIncident} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

function BadgeCard({ label, value, styleMap }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <div className="mt-3">
        {value ? (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
              styleMap[value] || "border-gray-200 bg-gray-100 text-gray-700"
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </div>
    </div>
  );
}