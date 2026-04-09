import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { ROLES } from "../../constants/roles";

export default function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === ROLES.HR_STAFF) return <Navigate to="/employees" replace />;
    if (user.role === ROLES.IT_SUPPORT) return <Navigate to="/settings" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}