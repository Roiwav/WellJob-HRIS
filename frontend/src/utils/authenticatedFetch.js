/**
 * Global event dispatched when the backend
 * reports that the system is under maintenance.
 */
export const MAINTENANCE_MODE_DETECTED_EVENT =
  "maintenanceModeDetected";

/**
 * Checks whether a backend response is specifically
 * a maintenance-mode response.
 *
 * The response is cloned so existing callers can
 * still read the original response body normally.
 */
async function isMaintenanceResponse(
  response
) {
  if (
    !response ||
    response.status !== 503
  ) {
    return false;
  }

  try {
    const responseText =
      await response
        .clone()
        .text();

    if (!responseText) {
      return false;
    }

    let message =
      responseText;

    try {
      const parsed =
        JSON.parse(
          responseText
        );

      message =
        parsed?.error ||
        parsed?.message ||
        responseText;
    } catch {
      // Keep the original text response.
    }

    return String(
      message || ""
    )
      .toLowerCase()
      .includes(
        "maintenance"
      );
  } catch {
    return false;
  }
}

/**
 * Performs a fetch request with the currently stored JWT token.
 *
 * The token is attached automatically as:
 * Authorization: Bearer <token>
 *
 * Existing headers and fetch options are preserved.
 *
 * If the backend responds with a maintenance-related
 * HTTP 503 response, a global browser event is dispatched.
 * The application shell can listen for this event and
 * replace normal HR screens with a maintenance notice.
 */
export async function authenticatedFetch(
  url,
  options = {}
) {
  const token = String(
    localStorage.getItem("token") || ""
  ).trim();

  const headers =
    new Headers(
      options.headers || {}
    );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response =
    await fetch(url, {
      ...options,
      headers,
    });

  const maintenanceDetected =
    await isMaintenanceResponse(
      response
    );

  if (
    maintenanceDetected &&
    typeof window !==
      "undefined"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        MAINTENANCE_MODE_DETECTED_EVENT,
        {
          detail: {
            status:
              response.status,
            detectedAt:
              Date.now(),
          },
        }
      )
    );
  }

  return response;
}

export default authenticatedFetch;