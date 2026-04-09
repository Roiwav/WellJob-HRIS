import { useCallback, useMemo, useState, useEffect } from "react";
import { hasPermission as checkPermission } from "../utils/hasPermission";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

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
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}