import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { hasPermission as checkPermission } from "../utils/hasPermission";
import { AUTH_SESSION_INVALID_EVENT } from "../utils/authenticatedFetch";

import { AuthContext } from "./auth-context";

function getStoredUser() {
  const storedUser =
    localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser =
      JSON.parse(storedUser);

    return parsedUser &&
      typeof parsedUser === "object"
      ? parsedUser
      : null;
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(getStoredUser);

  useEffect(() => {
    const handleInvalidSession = () => {
      clearStoredSession();
      setUser(null);
    };

    window.addEventListener(
      AUTH_SESSION_INVALID_EVENT,
      handleInvalidSession
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_INVALID_EVENT,
        handleInvalidSession
      );
    };
  }, []);

  const hasPermission = useCallback(
    (permission) =>
      checkPermission(
        user?.role,
        permission
      ),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      hasPermission,
    }),
    [
      user,
      hasPermission,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}