const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: "Super Admin", HR_MANAGER: "HR Manager", HR_STAFF: "HR Staff",
  HR_COORDINATOR: "HR Coordinator", IT_SUPPORT: "IT Support",
});

export function formatRoleLabel(role) {
  return ROLE_LABELS[String(role || "").trim().toUpperCase()] || "Role unavailable";
}

export function getUserFullName(user = {}) {
  const direct = [user.fullName, user.full_name, user.displayName, user.display_name, user.name]
    .find((value) => typeof value === "string" && value.trim() && value.trim() !== user.username);
  if (direct) return direct.trim();
  return [user.firstName || user.first_name, user.middleName || user.middle_name, user.lastName || user.last_name]
    .map((part) => String(part || "").trim()).filter(Boolean).join(" ") || "Reviewer name unavailable";
}
