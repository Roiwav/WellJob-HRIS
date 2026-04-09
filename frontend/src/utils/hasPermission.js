import { ROLE_PERMISSIONS } from '../constants/rolePermissions';

export const hasPermission = (role, permission) => {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};