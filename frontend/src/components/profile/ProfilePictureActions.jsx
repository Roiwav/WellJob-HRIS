import { useEffect, useRef, useState } from "react";
import {
  FiCamera,
  FiCheckCircle,
  FiImage,
  FiLoader,
  FiMove,
  FiTrash2,
  FiX,
  FiZoomIn,
} from "react-icons/fi";

import { useAuth } from "../../context/useAuth";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const CROP_SIZE = 280;
const OUTPUT_SIZE = 512;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function readApiResponse(response) {
  const data = await response.json().catch(() => null);

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

function getDisplayName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User"
  );
}

function getInitials(user) {
  return (
    getDisplayName(user)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "U"
  );
}

function getBaseScale(imageSize) {
  if (!imageSize.width || !imageSize.height) {
    return 1;
  }

  return Math.max(
    CROP_SIZE / imageSize.width,
    CROP_SIZE / imageSize.height
  );
}

function clampOffset(nextX, nextY, imageSize, zoom) {
  const scale = getBaseScale(imageSize) * zoom;
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;

  const maxX = Math.max(0, (renderedWidth - CROP_SIZE) / 2);
  const maxY = Math.max(0, (renderedHeight - CROP_SIZE) / 2);

  return {
    x: Math.min(maxX, Math.max(-maxX, nextX)),
    y: Math.min(maxY, Math.max(-maxY, nextY)),
  };
}

function createCroppedAvatar(image, imageSize, zoom, offset) {
  return new Promise((resolve, reject) => {
    try {
      const renderedScale = getBaseScale(imageSize) * zoom;
      const sourceSize = CROP_SIZE / renderedScale;

      const rawSourceX =
        imageSize.width / 2 -
        sourceSize / 2 -
        offset.x / renderedScale;

      const rawSourceY =
        imageSize.height / 2 -
        sourceSize / 2 -
        offset.y / renderedScale;

      const sourceX = Math.min(
        imageSize.width - sourceSize,
        Math.max(0, rawSourceX)
      );

      const sourceY = Math.min(
        imageSize.height - sourceSize,
        Math.max(0, rawSourceY)
      );

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Unable to prepare the profile picture."));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Unable to create the cropped profile picture."));
            return;
          }

          const extension =
            blob.type === "image/jpeg"
              ? "jpg"
              : blob.type === "image/png"
                ? "png"
                : "webp";

          resolve(
            new File([blob], `profile-avatar.${extension}`, {
              type: blob.type || "image/webp",
              lastModified: Date.now(),
            })
          );
        },
        "image/webp",
        0.92
      );
    } catch (cropError) {
      reject(cropError);
    }
  });
}

export default function ProfilePictureActions() {
  const { user, updateUserAvatar } = useAuth();

  const fileInputRef = useRef(null);
  const cropImageRef = useRef(null);
  const dragStateRef = useRef(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [avatarState, setAvatarState] = useState({
    key: null,
    url: null,
    loading: false,
  });

  const [cropSourceUrl, setCropSourceUrl] = useState(null);
  const [cropSourceName, setCropSourceName] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const userId = user?.id ?? null;
  const avatarFilename =
    user?.avatarFilename ?? user?.avatar_filename ?? null;

  const hasAvatar = Boolean(avatarFilename);

  const avatarKey =
    userId && avatarFilename ? `${userId}:${avatarFilename}` : null;

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const avatarUrl =
    avatarKey && avatarState.key === avatarKey ? avatarState.url : null;

  useEffect(() => {
    if (!avatarKey || !userId) {
      setAvatarState({
        key: null,
        url: null,
        loading: false,
      });

      return undefined;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setAvatarState({
        key: avatarKey,
        url: null,
        loading: false,
      });

      return undefined;
    }

    const controller = new AbortController();
    let objectUrl = null;

    setAvatarState({
      key: avatarKey,
      url: null,
      loading: true,
    });

    async function loadAvatar() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/users/${encodeURIComponent(
            String(userId)
          )}/avatar`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setAvatarState({
            key: avatarKey,
            url: null,
            loading: false,
          });

          return;
        }

        const contentType = String(
          response.headers.get("content-type") || ""
        ).toLowerCase();

        if (!contentType.startsWith("image/")) {
          setAvatarState({
            key: avatarKey,
            url: null,
            loading: false,
          });

          return;
        }

        const blob = await response.blob();

        if (controller.signal.aborted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);

        setAvatarState({
          key: avatarKey,
          url: objectUrl,
          loading: false,
        });
      } catch (loadError) {
        if (loadError?.name !== "AbortError") {
          console.error("Unable to load profile picture:", loadError);

          setAvatarState({
            key: avatarKey,
            url: null,
            loading: false,
          });
        }
      }
    }

    void loadAvatar();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [avatarKey, userId]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  useEffect(() => {
    if (!cropSourceUrl && !showRemoveConfirm) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape" || isSaving) {
        return;
      }

      if (cropSourceUrl) {
        setCropSourceUrl(null);
        setCropSourceName("");
        setImageSize({ width: 0, height: 0 });
        setZoom(1);
        setCropOffset({ x: 0, y: 0 });
      }

      if (showRemoveConfirm) {
        setShowRemoveConfirm(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [cropSourceUrl, showRemoveConfirm, isSaving]);

  useEffect(() => {
    if (!imageSize.width || !imageSize.height) {
      return;
    }

    setCropOffset((current) =>
      clampOffset(
        current.x,
        current.y,
        imageSize,
        zoom
      )
    );
  }, [imageSize, zoom]);

  const resetCropEditor = () => {
    setCropSourceUrl(null);
    setCropSourceName("");
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setCropOffset({ x: 0, y: 0 });

    dragStateRef.current = null;
  };

  const closeCropEditor = () => {
    if (!isSaving) {
      resetCropEditor();
    }
  };

  const handleSelectFile = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || isSaving) {
      return;
    }

    setError("");
    setNotice("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Select a JPG, PNG, or WebP image.");
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

    setCropSourceUrl(
      URL.createObjectURL(file)
    );

    setCropSourceName(file.name);
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const handleCropImageLoad = (event) => {
    setImageSize({
      width:
        event.currentTarget.naturalWidth,
      height:
        event.currentTarget.naturalHeight,
    });

    setCropOffset({
      x: 0,
      y: 0,
    });
  };

  const handlePointerDown = (event) => {
    if (
      isSaving ||
      !imageSize.width
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    dragStateRef.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originX:
        cropOffset.x,

      originY:
        cropOffset.y,
    };
  };

  const handlePointerMove = (event) => {
    const dragState =
      dragStateRef.current;

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId ||
      isSaving
    ) {
      return;
    }

    setCropOffset(
      clampOffset(
        dragState.originX +
          event.clientX -
          dragState.startX,

        dragState.originY +
          event.clientY -
          dragState.startY,

        imageSize,
        zoom
      )
    );
  };

  const handlePointerEnd = (event) => {
    if (
      dragStateRef.current?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    dragStateRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  };

  const uploadAvatar = async (file) => {
    const token =
      localStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    if (
      file.size === 0 ||
      file.size > MAX_AVATAR_SIZE
    ) {
      throw new Error(
        "The cropped profile picture is too large. Please try again."
      );
    }

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

    if (
      localStorage.getItem("token") !== token
    ) {
      return null;
    }

    return newFilename;
  };

  const handleSaveCrop = async () => {
    if (
      isSaving ||
      !cropSourceUrl ||
      !cropImageRef.current ||
      !imageSize.width ||
      !imageSize.height
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const croppedFile =
        await createCroppedAvatar(
          cropImageRef.current,
          imageSize,
          zoom,
          cropOffset
        );

      const newFilename =
        await uploadAvatar(
          croppedFile
        );

      if (!newFilename) {
        return;
      }

      updateUserAvatar(
        newFilename
      );

      resetCropEditor();

      setNotice(
        "Profile picture updated successfully."
      );
    } catch (uploadError) {
      setError(
        uploadError?.message ||
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

    const token =
      localStorage.getItem("token");

    if (!token) {
      setShowRemoveConfirm(false);

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

      await readApiResponse(
        response
      );

      if (
        localStorage.getItem("token") !== token
      ) {
        return;
      }

      updateUserAvatar(null);

      setShowRemoveConfirm(
        false
      );

      setNotice(
        "Profile picture removed successfully."
      );
    } catch (removeError) {
      setError(
        removeError?.message ||
          "Unable to remove your profile picture."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const scale =
    getBaseScale(imageSize) *
    zoom;

  const cropImageStyle =
    imageSize.width &&
    imageSize.height
      ? {
          width:
            imageSize.width *
            scale,

          height:
            imageSize.height *
            scale,

          left:
            `calc(50% + ${cropOffset.x}px)`,

          top:
            `calc(50% + ${cropOffset.y}px)`,

          transform:
            "translate(-50%, -50%)",
        }
      : undefined;

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-black text-white shadow-lg ring-1 ring-slate-200 dark:border-slate-900 dark:ring-slate-700">
              {avatarState.loading ? (
                <FiLoader
                  className="animate-spin"
                  size={26}
                  aria-label="Loading profile picture"
                />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${displayName} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden="true">
                  {initials}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={isSaving}
              className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-900"
              aria-label={
                hasAvatar
                  ? "Change profile picture"
                  : "Upload profile picture"
              }
              title={
                hasAvatar
                  ? "Change profile picture"
                  : "Upload profile picture"
              }
            >
              <FiCamera aria-hidden="true" />
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-base font-extrabold text-slate-900 dark:text-white">
              {displayName}
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Choose a clear photo, then crop and reposition it before saving.
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

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={isSaving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCamera aria-hidden="true" />

                {hasAvatar
                  ? "Change Photo"
                  : "Upload Photo"}
              </button>

              {hasAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setShowRemoveConfirm(true);
                  }}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <FiTrash2 aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <FiImage aria-hidden="true" />
              JPG, PNG, or WebP · Maximum 2 MB
            </div>
          </div>
        </div>

        {error &&
          !cropSourceUrl &&
          !showRemoveConfirm && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </div>
          )}
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[120] flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl dark:border-emerald-900/60 dark:bg-slate-900"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <FiCheckCircle
              size={19}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
              Profile updated
            </p>

            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {notice}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setNotice("")
            }
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Dismiss notification"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}

      {cropSourceUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-crop-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                  Profile Picture
                </p>

                <h3
                  id="avatar-crop-title"
                  className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white"
                >
                  Crop & Position Photo
                </h3>

                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {cropSourceName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCropEditor}
                disabled={isSaving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close crop editor"
              >
                <FiX
                  size={20}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-950/70">
                <div
                  className="relative mx-auto h-[280px] w-[280px] max-w-full touch-none cursor-grab overflow-hidden rounded-2xl bg-slate-200 active:cursor-grabbing dark:bg-slate-800"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                >
                  <img
                    ref={cropImageRef}
                    src={cropSourceUrl}
                    alt="Selected profile preview"
                    onLoad={handleCropImageLoad}
                    draggable="false"
                    className="pointer-events-none absolute max-w-none select-none"
                    style={cropImageStyle}
                  />

                  <div
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90"
                    style={{
                      boxShadow:
                        "0 0 0 9999px rgba(15, 23, 42, 0.48)",
                    }}
                    aria-hidden="true"
                  />

                  {isSaving && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white backdrop-blur-[1px]">
                      <FiLoader
                        size={28}
                        className="animate-spin"
                        aria-hidden="true"
                      />

                      <p className="mt-3 text-sm font-bold">
                        Saving photo...
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <FiMove aria-hidden="true" />
                  Drag the image to reposition it inside the circle.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="profile-photo-zoom"
                    className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"
                  >
                    <FiZoomIn aria-hidden="true" />
                    Zoom
                  </label>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {Math.round(
                      zoom * 100
                    )}
                    %
                  </span>
                </div>

                <input
                  id="profile-photo-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) =>
                    setZoom(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  disabled={isSaving}
                  className="w-full accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeCropEditor}
                disabled={isSaving}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={
                  isSaving ||
                  !imageSize.width
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <FiLoader
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiCheckCircle aria-hidden="true" />
                    Save Photo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-avatar-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <FiTrash2
                size={21}
                aria-hidden="true"
              />
            </div>

            <div className="mt-4 text-center">
              <h3
                id="remove-avatar-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Remove profile picture?
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Your account will return to showing your initials until you upload another photo.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowRemoveConfirm(
                    false
                  )
                }
                disabled={isSaving}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isSaving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <FiLoader
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Removing...
                  </>
                ) : (
                  <>
                    <FiTrash2 aria-hidden="true" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}