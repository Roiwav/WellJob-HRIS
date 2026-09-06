import { ROLES } from "../constants/roles";

export const sidebarItems = [
  {
    title: "Dashboard",
    path: "/",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
    ],
  },

  {
    title: "Employees",
    path: "/employees",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
    ],
  },

  {
    title: "Deployments",
    path: "/deployments",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
    ],
  },

  {
    title: "Incidents",
    path: "/incidents",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
    ],
  },

  {
    title: "KPI Reports",
    path: "/kpi",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
    ],
  },

  {
    title: "Notifications",
    path: "/notifications",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
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