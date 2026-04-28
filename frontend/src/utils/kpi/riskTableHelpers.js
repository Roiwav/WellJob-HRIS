export function getSeverityClasses(severity) {
  switch (severity) {
    case "Critical":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
    case "Major":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "Minor":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    default:
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  }
}

export function getRecommendationClasses(recommendation) {
  switch (recommendation) {
    case "Termination Review":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-300";
    case "Suspension Review":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/70 dark:bg-orange-950/30 dark:text-orange-300";
    case "Final Warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300";
    case "Monitor Employee":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
}

export function getRecommendationWeight(recommendation) {
  switch (recommendation) {
    case "Termination Review":
      return 5;
    case "Suspension Review":
      return 4;
    case "Final Warning":
      return 3;
    case "Monitor Employee":
      return 2;
    default:
      return 1;
  }
}

export function getRiskTableSummary(employees = []) {
  return {
    retain: employees.filter((emp) => emp.recommendation === "Retain").length,
    monitor: employees.filter(
      (emp) => emp.recommendation === "Monitor Employee"
    ).length,
    warning: employees.filter(
      (emp) => emp.recommendation === "Final Warning"
    ).length,
    serious: employees.filter((emp) =>
      ["Suspension Review", "Termination Review"].includes(emp.recommendation)
    ).length,
  };
}