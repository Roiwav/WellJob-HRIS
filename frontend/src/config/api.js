/**
 * Frontend API configuration.
 *
 * Expected environment variable:
 *   VITE_API_BASE_URL=http://<backend-host>:5000
 *
 * IMPORTANT:
 * - VITE_API_BASE_URL must contain the backend ORIGIN only.
 * - Do not include a trailing "/api".
 * - The application appends "/api" automatically.
 *
 * Example:
 *   VITE_API_BASE_URL=http://100.119.171.111:5000
 */

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function getRuntimeApiOrigin() {
  if (
    typeof window === "undefined" ||
    !window.location
  ) {
    return "";
  }

  const protocol =
    window.location.protocol || "http:";

  const hostname =
    window.location.hostname;

  if (!hostname) {
    return "";
  }

  /*
   * Safe LAN/dev fallback:
   * use the SAME hostname/IP that served the frontend,
   * not localhost, so another workstation does not try
   * to call itself.
   *
   * Production/client deployment should still define
   * VITE_API_BASE_URL explicitly.
   */
  return `${protocol}//${hostname}:5000`;
}

const configuredApiOrigin =
  normalizeOrigin(
    import.meta.env.VITE_API_BASE_URL
  );

if (
  configuredApiOrigin &&
  /\/api$/i.test(configuredApiOrigin)
) {
  throw new Error(
    "VITE_API_BASE_URL must contain the backend origin only and must not include /api."
  );
}

const runtimeApiOrigin =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "";

const API_ORIGIN =
  configuredApiOrigin ||
  runtimeApiOrigin;

if (!API_ORIGIN) {
  throw new Error(
    "Unable to determine API origin. Set VITE_API_BASE_URL to the backend origin."
  );
}

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

  const relativePath =
    normalizedPath.replace(
      /^\/+/, 
      ""
    );

  return `${API_ORIGIN}/${relativePath}`;
};

export default API_ORIGIN;
