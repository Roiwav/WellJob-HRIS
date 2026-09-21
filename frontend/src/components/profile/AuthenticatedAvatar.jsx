import {
  useEffect,
  useState,
} from "react";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
).replace(/\/+$/, "");

/*
 * ==================================================
 * WELLJOB SOLUTIONS
 * AUTHENTICATED CHAT AVATAR
 * ==================================================
 *
 * The backend avatar endpoint requires a JWT.
 *
 * Do not use the protected API endpoint directly
 * as an <img src> because the Authorization header
 * cannot be attached that way.
 *
 * This component:
 * - Fetches the avatar with the current JWT
 * - Displays an image using a temporary object URL
 * - Shows initials when no image is available
 * - Revokes object URLs during cleanup
 * - Reloads when avatarFilename changes
 */

function getDisplayName(user) {
  return (
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    "Unknown user"
  );
}

function getInitials(user) {
  const name = getDisplayName(user);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

  return initials || "?";
}

export default function AuthenticatedAvatar({
  user,
  small = false,
}) {
  /*
   * Store the loaded image together with the
   * user ID and filename it belongs to.
   *
   * This prevents an old image from appearing
   * while a replacement image is being loaded.
   */

  const [avatarState, setAvatarState] =
    useState({
      key: null,
      url: null,
    });

  const [brokenImageKey, setBrokenImageKey] =
    useState(null);

  const userId =
    user?.id ?? null;

  const avatarFilename =
    user?.avatarFilename ??
    user?.avatar_filename ??
    null;

  const avatarKey =
    userId != null &&
    typeof avatarFilename === "string" &&
    avatarFilename.trim()
      ? `${userId}:${avatarFilename.trim()}`
      : null;

  /*
   * ==================================================
   * LOAD PROTECTED AVATAR
   * ==================================================
   */

  useEffect(() => {
    if (!avatarKey) {
      return undefined;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      return undefined;
    }

    const controller =
      new AbortController();

    let objectUrl = null;

    async function loadAvatar() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/users/${encodeURIComponent(
            String(userId)
          )}/avatar`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache: "no-store",

            signal:
              controller.signal,
          }
        );

        if (!response.ok) {
          return;
        }

        /*
         * The existing avatar controller converts
         * uploaded images to WebP.
         */

        const contentType = String(
          response.headers.get(
            "content-type"
          ) || ""
        ).toLowerCase();

        if (
          !contentType.startsWith(
            "image/webp"
          )
        ) {
          return;
        }

        const imageBlob =
          await response.blob();

        if (
          controller.signal.aborted
        ) {
          return;
        }

        objectUrl =
          URL.createObjectURL(
            imageBlob
          );

        /*
         * The user may have switched conversations
         * or the component may have unmounted while
         * the request was running.
         */

        if (
          controller.signal.aborted
        ) {
          URL.revokeObjectURL(
            objectUrl
          );

          objectUrl = null;

          return;
        }

        setAvatarState({
          key: avatarKey,
          url: objectUrl,
        });
      } catch (error) {
        if (
          error?.name !==
          "AbortError"
        ) {
          console.error(
            "Unable to load chat avatar:",
            error
          );
        }
      }
    }

    loadAvatar();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl
        );
      }
    };
  }, [
    avatarKey,
    userId,
  ]);

  /*
   * ==================================================
   * DISPLAY
   * ==================================================
   */

  const sizeClass = small
    ? "h-9 w-9"
    : "h-10 w-10";

  const imageUrl =
    avatarKey &&
    avatarState.key === avatarKey &&
    brokenImageKey !== avatarKey
      ? avatarState.url
      : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        onError={() => {
          setBrokenImageKey(
            avatarKey
          );
        }}
      />
    );
  }

  /*
   * Show initials when the user has no avatar,
   * the image is loading, or retrieval failed.
   */

  return (
    <div
      aria-hidden="true"
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200`}
    >
      {getInitials(user)}
    </div>
  );
}