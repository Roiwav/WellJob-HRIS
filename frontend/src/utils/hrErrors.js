const DEFAULT_ERROR = "The information could not be loaded. Please try again.";
const TIMEOUT_ERROR = "The service is taking longer than expected. Please try again. If the problem continues, contact IT Support.";
const MESSAGES = [
  [/mobile handoff.*invalid|mobile handoff.*expired|mobile handoff.*unavailable/i, "This phone link is no longer available. Generate a new QR code from the employee record."],
  [/valid mobile handoff token is required/i, "This phone link is invalid."],
  [/unable to (?:activate|create).*handoff/i, "Unable to start the phone document session. Please try again."],
  [/suggestion key is invalid/i, "This suggestion is no longer available. Refresh the page and try again."],
  [/invalid decision type/i, "Select a valid review decision."],
  [/authenticated user identity could not be verified/i, "Your session could not be verified. Sign in again and reopen the link."],
];
const TECHNICAL_ERROR = /HTTP\b|status\s*\d{3}|SQL|database|backend|supabase|storage provider|bucket|stack trace|ER_[A-Z_]+|ECONN|ETIMEDOUT|failed to fetch|network error|fetch failed|<!doctype|<html|\{"|protected .*upload failed|internal server error|unexpected token|invalid json/i;

export function hrErrorMessage(error, fallback = DEFAULT_ERROR, status) {
  const code = Number(status || error?.status || error?.response?.status);
  const identityMessage = typeof error === "string" ? error : error?.message || error?.error;
  if (/authenticated user identity could not be verified/i.test(identityMessage || "")) return "Your session could not be verified. Sign in again and reopen the link.";
  if (code === 401) return "Your session has expired. Sign in again to continue.";
  if (code === 403) return "You do not have access to this information. Contact your HR administrator if you need help.";
  if (error?.name === "AbortError" || /timed? out|took too long/i.test(error?.message || "")) return TIMEOUT_ERROR;
  if (code >= 500) return fallback;
  const value = typeof error === "string" ? error
    : error?.response?.data?.message || error?.response?.data?.error || error?.message || error?.error;
  const message = String(value || "").trim();
  for (const [pattern, replacement] of MESSAGES) if (pattern.test(message)) return replacement;
  if (!message || TECHNICAL_ERROR.test(message)) return fallback;
  // Safe business validation and 409 refresh-and-review instructions survive.
  return message;
}
