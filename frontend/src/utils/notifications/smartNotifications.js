const API_BASE = "http://localhost:5000/api";

export function canViewSmartAlerts(role) {
  return ["HR_MANAGER", "HR_STAFF", "SUPER_ADMIN"].includes(role);
}

export function getUserKey(user) {
  return String(
    user?.id ||
      user?.userId ||
      user?.employeeId ||
      user?.username ||
      user?.name ||
      user?.role ||
      "UNKNOWN_USER"
  );
}

export function getAlertPriorityClasses(priority) {
  switch (priority) {
    case "High":
      return {
        card: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300",
        icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
        badge:
          "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      };

    case "Medium":
      return {
        card: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
        icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      };

    default:
      return {
        card: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300",
        icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
        badge:
          "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      };
  }
}

export function formatSmartAlertDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function requestSmartAlertJson(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}