import { useCallback, useMemo, useState } from "react";
import { ROLES } from "../constants/roles";
import { hasPermission as checkPermission } from "../utils/hasPermission";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    name: "Admin User",
    role: ROLES.SUPER_ADMIN,
    isFirstLogin: false,
  });

  const hasPermission = useCallback(
    (permission) => {
      return checkPermission(user?.role, permission);
    },
    [user?.role]
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      hasPermission,
    }),
    [user, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}