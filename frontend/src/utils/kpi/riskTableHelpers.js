import { RECOMMENDATION_LABELS } from "./kpiHelpers";

export function getSeverityClasses(severity) {
  switch (severity) {
    case "Critical":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
    case "Major":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "Minor":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    case "None":
    case "Clean":
    default:
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  }
}

export function getRecommendationClasses(recommendation) {
  switch (recommendation) {
    case "Performance Improvement Plan":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/70 dark:bg-orange-950/30 dark:text-orange-300";
    case "Reassignment of Position":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300";
    case "Employee Training":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300";
    case "Seminar & Webinar":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "Verbal Counseling":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-300";
    case RECOMMENDATION_LABELS.RETAIN:
    case "Retain":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
}

export function getRecommendationWeight(recommendation) {
  switch (recommendation) {
    case "Performance Improvement Plan":
      return 5;
    case "Reassignment of Position":
      return 4;
    case "Employee Training":
      return 3;
    case "Seminar & Webinar":
      return 2;
    case "Verbal Counseling":
      return 1;
    case RECOMMENDATION_LABELS.RETAIN:
    case "Retain":
    default:
      return 0;
  }
}

export function getRiskTableSummary(employees = []) {
  return {
    maintain: employees.filter(
      (emp) =>
        emp.recommendation === RECOMMENDATION_LABELS.RETAIN ||
        emp.recommendation === "Retain"
    ).length,

    counseling: employees.filter(
      (emp) => emp.recommendation === "Verbal Counseling"
    ).length,

    improvement: employees.filter(
      (emp) => emp.recommendation === "Performance Improvement Plan"
    ).length,

    development: employees.filter((emp) =>
      [
        "Reassignment of Position",
        "Seminar & Webinar",
        "Employee Training",
      ].includes(emp.recommendation)
    ).length,
  };
}