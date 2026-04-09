import { useCallback, useMemo, useState, useEffect } from "react";
import { ROLES } from "../constants/roles";
import { hasPermission as checkPermission } from "../utils/hasPermission";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // 🔥 LOAD USER FROM LOCAL STORAGE
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

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