import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { ROLES } from "../../constants/roles";

function getDefaultRouteByRole(role) {
  switch (role) {
    case ROLES.HR_STAFF:
      return "/";
    case ROLES.HR_MANAGER:
      return "/";
    case ROLES.IT_SUPPORT:
      return "/settings";
    case ROLES.SUPER_ADMIN:
    default:
      return "/";
  }
}

export default function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteByRole(user.role)} replace />;
  }

  return <Outlet />;
}