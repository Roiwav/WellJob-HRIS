import { useAuth } from "../../context/useAuth";

export default function RoleGuard({ permission, children }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}