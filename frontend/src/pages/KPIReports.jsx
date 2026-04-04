import { useMemo, useState } from "react";

import KPICards from "../components/kpi/KPICards";
import RiskTable from "../components/kpi/RiskTable";
import HighRiskEmployees from "../components/kpi/HighRiskEmployees";

const employeeData = [
  { id: 1, name: "John Mark", company: "ABC Security", violationCount: 0 },
  { id: 2, name: "Sarah Lopez", company: "XYZ Corp", violationCount: 2 },
  { id: 3, name: "Michael Tan", company: "Delta Inc", violationCount: 3 },
  { id: 4, name: "Anna Cruz", company: "ABC Security", violationCount: 1 },
];

export default function KPIReports() {

  const [filter, setFilter] = useState("All");

  const getSeverity = (count) => {
    if (count === 0) return "None";
    if (count === 1) return "Low";
    if (count === 2) return "Medium";
    if (count === 3) return "High";
    return "Critical";
  };

  const getRiskLevel = (count) => {
    if (count >= 3) return "High Risk";
    if (count >= 2) return "Repeat";
    if (count === 1) return "Monitor";
    return "Clean";
  };

  const totalEmployees = employeeData.length;

  const compliantEmployees = employeeData.filter(
    (e) => e.violationCount === 0
  ).length;

  const repeatOffenders = employeeData.filter(
    (e) => e.violationCount >= 2
  ).length;

  const highRiskEmployees = employeeData.filter(
    (e) => e.violationCount >= 3
  ).length;

  const complianceRate = (
    (compliantEmployees / totalEmployees) *
    100
  ).toFixed(1);

  const filteredEmployees = useMemo(() => {

    if (filter === "All") return employeeData;

    if (filter === "High Risk")
      return employeeData.filter((e) => e.violationCount >= 3);

    if (filter === "Repeat")
      return employeeData.filter((e) => e.violationCount >= 2);

    if (filter === "Clean")
      return employeeData.filter((e) => e.violationCount === 0);

    return employeeData;

  }, [filter]);

  return (

    <div className="space-y-10">

      {/* HEADER */}

      <div>

        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          KPI & Reports Center
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Strategic Employee Risk & Compliance Monitoring
        </p>

      </div>

      {/* KPI CARDS */}

      <KPICards
        totalEmployees={totalEmployees}
        complianceRate={complianceRate}
        repeatOffenders={repeatOffenders}
        highRiskEmployees={highRiskEmployees}
      />

      {/* FILTER + REPORT BUTTON */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        {/* FILTERS */}

        <div className="flex gap-3">

          {["All", "Clean", "Repeat", "High Risk"].map((f) => (

            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              }`}
            >
              {f}
            </button>

          ))}

        </div>

        {/* REPORT BUTTON */}

        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          Export KPI Report
        </button>

      </div>

      {/* RISK TABLE */}

      <RiskTable
        employees={filteredEmployees}
        getSeverity={getSeverity}
        getRiskLevel={getRiskLevel}
      />

      {/* HIGH RISK EMPLOYEES */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <HighRiskEmployees employees={employeeData} />

      </div>

    </div>

  );
}