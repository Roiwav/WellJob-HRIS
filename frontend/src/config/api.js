const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "");

export const API_BASE = `${API_ORIGIN}/api`;

export const documentUrl = (path) => {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  return `${API_ORIGIN}/${normalizedPath.replace(
    /^\/+/,
    ""
  )}`;
};

export default API_ORIGIN;