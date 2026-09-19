import { ROLES } from "../constants/roles";

export const sidebarItems = [
  {
    title: "Dashboard",
    path: "/",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
    ],
  },

  {
    title: "Employees",
    path: "/employees",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
      ROLES.HR_COORDINATOR,
    ],
  },

  {
    title: "Deployments",
    path: "/deployments",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
      ROLES.HR_COORDINATOR,
    ],
  },

  {
    title: "Incidents",
    path: "/incidents",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
      ROLES.HR_COORDINATOR,
    ],
  },

  {
    title: "KPI Reports",
    path: "/kpi",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
    ],
  },

  {
    title: "Notifications",
    path: "/notifications",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
      ROLES.IT_SUPPORT,
    ],
  },

  {
    title: "User Management",
    path: "/settings",
    allowedRoles: [
      ROLES.IT_SUPPORT,
    ],
  },

  {
    title: "Super Admin Portal",
    path: "/super-admin",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
    ],
  },

  {
    title: "System Configuration",
    path: "/system-configuration",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
    ],
  },

  {
    title: "Technical Audit",
    path: "/technical-audit-logs",
    allowedRoles: [
      ROLES.IT_SUPPORT,
    ],
  },

  {
    title: "Operational Audit",
    path: "/operational-audit-logs",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
    ],
  },
];