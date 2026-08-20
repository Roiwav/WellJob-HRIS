/**
 * Global event dispatched when the backend reports
 * that the system is under maintenance.
 */
export const MAINTENANCE_MODE_DETECTED_EVENT =
  "maintenanceModeDetected";

/**
 * Global event dispatched when an authenticated
 * request is rejected with HTTP 401.
 *
 * The AuthProvider listens for this event and owns
 * the actual session cleanup.
 */
export const AUTH_SESSION_INVALID_EVENT =
  "authSessionInvalid";

/**
 * Safely reads the backend message from a cloned
 * response without consuming the original body.
 */
async function getResponseMessage(response) {
  try {
    const responseText = await response
      .clone()
      .text();

    if (!responseText) {
      return "";
    }

    try {
      const parsed = JSON.parse(responseText);

      return String(
        parsed?.error ||
          parsed?.message ||
          responseText
      ).trim();
    } catch {
      return responseText.trim();
    }
  } catch {
    return "";
  }
}

/**
 * Checks whether a 503 response specifically
 * represents application maintenance mode.
 */
async function isMaintenanceResponse(response) {
  if (
    !response ||
    response.status !== 503
  ) {
    return false;
  }

  const message =
    await getResponseMessage(response);

  return message
    .toLowerCase()
    .includes("maintenance");
}

/**
 * Dispatches a browser event only when running
 * in a browser environment.
 */
function dispatchBrowserEvent(
  eventName,
  detail
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
    })
  );
}

/**
 * Performs a fetch request using the JWT currently
 * stored in localStorage.
 *
 * The token is automatically attached as:
 *
 * Authorization: Bearer <token>
 *
 * Existing request headers/options are preserved.
 *
 * Global handling:
 * - maintenance-related HTTP 503
 *   -> MAINTENANCE_MODE_DETECTED_EVENT
 *
 * - HTTP 401 from a request that carried a JWT
 *   -> AUTH_SESSION_INVALID_EVENT
 *
 * The response itself is always returned unchanged
 * so existing callers can continue handling their
 * own response bodies and status codes.
 */
export async function authenticatedFetch(
  url,
  options = {}
) {
  const token = String(
    localStorage.getItem("token") || ""
  ).trim();

  const headers = new Headers(
    options.headers || {}
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (
    response.status === 401 &&
    token
  ) {
    const message =
      await getResponseMessage(response);

    dispatchBrowserEvent(
      AUTH_SESSION_INVALID_EVENT,
      {
        status: response.status,
        message:
          message ||
          "Authentication session is no longer valid.",
        detectedAt: Date.now(),
      }
    );
  }

  const maintenanceDetected =
    await isMaintenanceResponse(
      response
    );

  if (maintenanceDetected) {
    dispatchBrowserEvent(
      MAINTENANCE_MODE_DETECTED_EVENT,
      {
        status: response.status,
        detectedAt: Date.now(),
      }
    );
  }

  return response;
}

export default authenticatedFetch;