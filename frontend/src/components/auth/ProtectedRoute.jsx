import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { ROLES } from "../../constants/roles";

function getDefaultRouteByRole(role) {
  switch (role) {
    case ROLES.HR_STAFF:
      return "/employees";
    case ROLES.HR_MANAGER:
      return "/";
    case ROLES.IT_SUPPORT:
      return "/settings";
    case ROLES.SUPER_ADMIN:
    default:
      return "/";
  }
}

function shouldForceChangePassword(user) {
  return (
    user?.mustChangePassword === true ||
    user?.mustChangePassword === 1 ||
    user?.mustChangePassword === "1" ||
    user?.must_change_password === true ||
    user?.must_change_password === 1 ||
    user?.must_change_password === "1"
  );
}

export default function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    shouldForceChangePassword(user) &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteByRole(user.role)} replace />;
  }

  return <Outlet />;
}