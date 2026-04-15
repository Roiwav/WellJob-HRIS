import { useCallback, useMemo, useState } from "react";
import { hasPermission as checkPermission } from "../utils/hasPermission";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const hasPermission = useCallback(
    (permission) => {
      return checkPermission(user?.role, permission);
    },
    [user]
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