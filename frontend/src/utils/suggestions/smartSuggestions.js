import authenticatedFetch from "../authenticatedFetch";

const API_BASE = "http://localhost:5000/api";

export function canViewSmartSuggestions(
  role
) {
  return [
    "HR_MANAGER",
    "SUPER_ADMIN",
  ].includes(role);
}

export function getSmartSuggestionUserKey(
  user
) {
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

export async function requestSmartSuggestionJson(
  endpoint,
  options = {}
) {
  const response =
    await authenticatedFetch(
      `${API_BASE}${endpoint}`,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

export function getSuggestionPriorityClasses(
  priority
) {
  switch (priority) {
    case "High":
      return {
        card:
          "border-rose-500/30 bg-rose-500/10 text-rose-300",

        badge:
          "bg-rose-500/15 text-rose-300 border-rose-500/30",

        icon:
          "bg-rose-500/15 text-rose-300",
      };

    case "Medium":
      return {
        card:
          "border-amber-500/30 bg-amber-500/10 text-amber-300",

        badge:
          "bg-amber-500/15 text-amber-300 border-amber-500/30",

        icon:
          "bg-amber-500/15 text-amber-300",
      };

    default:
      return {
        card:
          "border-sky-500/30 bg-sky-500/10 text-sky-300",

        badge:
          "bg-sky-500/15 text-sky-300 border-sky-500/30",

        icon:
          "bg-sky-500/15 text-sky-300",
      };
  }
}

export function getSuggestionCategoryClasses(
  category
) {
  switch (category) {
    case "Workforce":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";

    case "Incident Prevention":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";

    case "Compliance":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

    case "Deployment":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";

    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

export function formatSuggestionDate(
  value
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    "en-PH",
    {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}