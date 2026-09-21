
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  hasPermission as checkPermission,
} from "../utils/hasPermission";

import {
  AUTH_SESSION_INVALID_EVENT,
} from "../utils/authenticatedFetch";

import {
  AuthContext,
} from "./auth-context";

/*
 * ==================================================
 * GET STORED USER
 * ==================================================
 */

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
      typeof parsedUser === "object" &&
      !Array.isArray(parsedUser)
      ? parsedUser
      : null;
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    return null;
  }
}

/*
 * ==================================================
 * CLEAR STORED SESSION
 * ==================================================
 */

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

/*
 * ==================================================
 * AUTH PROVIDER
 * ==================================================
 */

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(getStoredUser);

  /*
   * ==================================================
   * HANDLE INVALID SESSION
   * ==================================================
   *
   * Preserve the existing behavior:
   * clear localStorage and React user state
   * when the authenticated session becomes invalid.
   */

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

  /*
   * ==================================================
   * UPDATE OWN PROFILE PICTURE
   * ==================================================
   *
   * Call this function only AFTER the backend
   * successfully uploads or removes the avatar.
   *
   * The backend remains responsible for verifying
   * the authenticated user and saving the image.
   *
   * This function updates only the frontend's
   * avatar information.
   *
   * It does not change the user's role,
   * company assignment, permissions, or JWT.
   */

  const updateUserAvatar = useCallback(
    (avatarFilename) => {
      /*
       * Do not recreate a local user session
       * if the user has already logged out
       * or the token has been removed.
       */

      if (
        !user ||
        !localStorage.getItem("token")
      ) {
        return;
      }

      /*
       * A null value indicates that the user
       * has removed their profile picture.
       */

      const normalizedFilename =
        typeof avatarFilename === "string" &&
        avatarFilename.trim()
          ? avatarFilename.trim()
          : null;

      /*
       * Preserve every existing user field.
       *
       * Only update the profile picture
       * properties returned by the backend.
       */

      const updatedUser = {
        ...user,

        avatar_filename:
          normalizedFilename,

        avatarFilename:
          normalizedFilename,
      };

      /*
       * Save the updated user information so
       * the avatar state survives a page refresh.
       */

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      /*
       * Update React state immediately so
       * components using useAuth() can react
       * to the new avatar information.
       */

      setUser(updatedUser);
    },
    [user]
  );

  /*
   * ==================================================
   * PERMISSION CHECK
   * ==================================================
   *
   * Preserve the existing role-based
   * permission behavior.
   */

  const hasPermission = useCallback(
    (permission) =>
      checkPermission(
        user?.role,
        permission
      ),
    [user]
  );

  /*
   * ==================================================
   * AUTH CONTEXT VALUE
   * ==================================================
   *
   * Existing consumers can continue using:
   *
   * user
   * setUser
   * hasPermission
   *
   * NEW:
   *
   * updateUserAvatar
   */

  const value = useMemo(
    () => ({
      user,

      setUser,

      hasPermission,

      updateUserAvatar,
    }),
    [
      user,
      hasPermission,
      updateUserAvatar,
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