import { ROLES } from "../constants/roles";

export const sidebarItems = [
  {
    title: "Dashboard",
    path: "/",
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.HR_MANAGER,
      ROLES.HR_STAFF,
      ROLES.IT_SUPPORT,
    ],
  },
  {
    title: "Employees",
    path: "/employees",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.HR_STAFF],
  },
  {
    title: "Deployments",
    path: "/deployments",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.HR_STAFF],
  },
  {
    title: "Incidents",
    path: "/incidents",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.HR_STAFF],
  },
  {
    title: "KPI Reports",
    path: "/kpi",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.HR_MANAGER],
  },
  {
    title: "Notifications",
    path: "/notifications",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.HR_STAFF],
  },
  {
    title: "Settings",
    path: "/settings",
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.IT_SUPPORT],
  },
  {
    title: "Super Admin Portal",
    path: "/super-admin",
    allowedRoles: [ROLES.SUPER_ADMIN],
  },
];