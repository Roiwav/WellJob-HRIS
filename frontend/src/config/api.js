const configuredApiOrigin =
  import.meta.env.VITE_API_BASE_URL?.trim();

const runtimeApiOrigin =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

const API_ORIGIN = (
  configuredApiOrigin ||
  runtimeApiOrigin
).replace(/\/+$/, "");

export const API_BASE =
  `${API_ORIGIN}/api`;

export const documentUrl = (path) => {
  const normalizedPath =
    String(path || "").trim();

  if (!normalizedPath) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      normalizedPath
    )
  ) {
    return normalizedPath;
  }

  return `${API_ORIGIN}/${normalizedPath.replace(
    /^\/+/,
    ""
  )}`;
};

export default API_ORIGIN;