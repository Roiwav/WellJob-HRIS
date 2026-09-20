
import { useRef, useState } from "react";

import {
  FiCamera,
  FiTrash2,
} from "react-icons/fi";

import { useAuth } from "../../context/useAuth";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
).replace(/\/+$/, "");

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function readApiResponse(response) {
  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to process your profile picture."
    );
  }

  if (!data?.success) {
    throw new Error(
      "The server did not confirm the profile picture update."
    );
  }

  return data;
}

export default function ProfilePictureActions() {
  const {
    user,
    updateUserAvatar,
  } = useAuth();

  const fileInputRef = useRef(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const avatarFilename =
    user?.avatarFilename ??
    user?.avatar_filename ??
    null;

  const hasAvatar = Boolean(
    avatarFilename
  );

  const handleSelectFile = async (event) => {
    const file =
      event.target.files?.[0];

    /*
     * Reset the input so users can select
     * the same image again after an error.
     */
    event.target.value = "";

    if (!file || isSaving) {
      return;
    }

    setError("");
    setNotice("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setError(
        "Select a JPG, PNG, or WebP image."
      );
      return;
    }

    if (
      file.size === 0 ||
      file.size > MAX_AVATAR_SIZE
    ) {
      setError(
        "Profile picture must be smaller than 2 MB."
      );
      return;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      setError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    setIsSaving(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "avatar",
        file
      );

      const response = await fetch(
        `${API_BASE_URL}/api/users/me/avatar`,
        {
          method: "PUT",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          body: formData,
        }
      );

      const data =
        await readApiResponse(response);

      const newFilename =
        data.avatarFilename ??
        data.avatar_filename;

      if (
        typeof newFilename !== "string" ||
        !newFilename.trim()
      ) {
        throw new Error(
          "The server did not return a valid profile picture filename."
        );
      }

      /*
       * Do not update a different local session
       * if the user logged out while uploading.
       */
      if (
        localStorage.getItem("token") !==
        token
      ) {
        return;
      }

      updateUserAvatar(
        newFilename
      );

      setNotice(
        "Profile picture updated successfully."
      );
    } catch (uploadError) {
      setError(
        uploadError.message ||
          "Unable to upload your profile picture."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (
      !hasAvatar ||
      isSaving
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Remove your current profile picture?"
    );

    if (!confirmed) {
      return;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      setError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/me/avatar`,
        {
          method: "DELETE",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      await readApiResponse(response);

      if (
        localStorage.getItem("token") !==
        token
      ) {
        return;
      }

      updateUserAvatar(null);

      setNotice(
        "Profile picture removed successfully."
      );
    } catch (removeError) {
      setError(
        removeError.message ||
          "Unable to remove your profile picture."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-b border-gray-100 px-4 py-3 dark:border-white/10">
      <p className="mb-2 text-xs font-bold text-gray-600 dark:text-gray-300">
        Profile Picture
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleSelectFile}
        disabled={isSaving}
        className="hidden"
        aria-label="Select profile picture"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiCamera
            aria-hidden="true"
          />

          {isSaving
            ? "Please wait..."
            : hasAvatar
              ? "Change Photo"
              : "Upload Photo"}
        </button>

        {hasAvatar && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <FiTrash2
              aria-hidden="true"
            />

            Remove
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        JPG, PNG, or WebP. Maximum 2 MB.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-2 text-xs font-medium text-green-600 dark:text-green-400"
        >
          {notice}
        </p>
      )}
    </div>
  );
}