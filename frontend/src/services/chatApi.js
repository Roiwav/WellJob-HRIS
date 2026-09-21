
/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER API SERVICE
 * ==================================================
 *
 * Connects the Messenger frontend to the existing
 * WELLJOB Express backend.
 *
 * Authentication:
 * - Uses the existing WELLJOB login JWT.
 * - Reads the token from localStorage.
 * - Sends the token through Authorization headers.
 * - Does not create a separate login session.
 *
 * Backend:
 * http://localhost:5000/api/chat
 */

/*
 * ==================================================
 * API SERVER CONFIGURATION
 * ==================================================
 *
 * The environment variable must contain the
 * backend origin, without /api at the end.
 *
 * Example:
 * VITE_API_URL=http://localhost:5000
 */

export const CHAT_SERVER_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
)
  .trim()
  .replace(/\/+$/, "");

/*
 * ==================================================
 * GET EXISTING LOGIN TOKEN
 * ==================================================
 *
 * The existing WELLJOB authentication system
 * stores the JWT under the localStorage key:
 *
 * "token"
 *
 * This function does not generate a new token.
 *
 * The optional parameter is retained for
 * compatibility with existing Messenger
 * components that call getChatToken(user).
 */

export function getChatToken(_user) {
  try {
    return (
      localStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}

/*
 * ==================================================
 * CHAT API REQUEST
 * ==================================================
 *
 * Usage:
 *
 * chatApi("/users")
 *
 * chatApi("/conversations")
 *
 * chatApi("/conversations", {
 *   method: "POST",
 *   body: JSON.stringify({
 *     recipientId: 1,
 *   }),
 * })
 *
 * The optional third argument is retained
 * for compatibility with Messenger components.
 */

export async function chatApi(
  path,
  options = {},
  _user
) {
  /*
   * Retrieve the existing WELLJOB login token.
   */

  const token = getChatToken();

  if (!token) {
    throw new Error(
      "Your login session is missing. Please sign in again."
    );
  }

  /*
   * Validate the requested API path.
   */

  if (
    typeof path !== "string" ||
    !path.startsWith("/")
  ) {
    throw new Error(
      "Invalid Messenger API path."
    );
  }

  /*
   * Build the request headers.
   *
   * The JWT always comes from the existing
   * WELLJOB login session.
   */

  const headers = new Headers(
    options.headers || {}
  );

  /*
   * Messenger currently sends JSON request
   * bodies for conversation and message
   * creation.
   *
   * Do not overwrite a Content-Type already
   * explicitly provided by the caller.
   */

  if (
    options.body != null &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData)
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  /*
   * Set Authorization after reading any
   * custom request headers.
   *
   * This prevents a caller from accidentally
   * replacing the current login token.
   */

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  /*
   * ==================================================
   * SEND REQUEST TO WELLJOB BACKEND
   * ==================================================
   */

  const response = await fetch(
    `${CHAT_SERVER_URL}/api/chat${path}`,
    {
      ...options,

      headers,
    }
  );

  /*
   * Parse the backend response.
   */

  const data = await response
    .json()
    .catch(() => ({}));

  /*
   * ==================================================
   * API ERROR HANDLING
   * ==================================================
   *
   * Preserve the HTTP status for components
   * that need to distinguish authentication
   * failures from other request errors.
   */

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error ||
        `Chat request failed (${response.status}).`
    );

    error.status = response.status;

    throw error;
  }

  /*
   * Return successful API response.
   */

  return data;
}