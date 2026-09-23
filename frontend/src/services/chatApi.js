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
/* One chat message may contain multiple PDFs. The 15 MB cap is COMBINED. */
export function uploadChatPdfs(conversationId, files, body = '', onProgress = () => {}) {
  const selected = Array.from(files || []);
  const total = selected.reduce((n, file) => n + file.size, 0);
  const maxBytes = 15 * 1024 * 1024;
  if (!selected.length || selected.length > 30 || total > maxBytes ||
      selected.some(file => file.size <= 0 || !file.name.toLowerCase().endsWith('.pdf') ||
        (file.type && file.type !== 'application/pdf'))) {
    return Promise.reject(new Error('Select 1–30 valid PDF files with a combined size of 15 MB or less.'));
  }
  if (typeof body !== 'string' || body.trim().length > 2000) {
    return Promise.reject(new Error('Message must contain at most 2000 characters.'));
  }
  return new Promise((resolve, reject) => {
    const token = getChatToken();
    if (!token) { reject(new Error('Please sign in again.')); return; }
    const request = new XMLHttpRequest();
    request.open('POST', `${CHAT_SERVER_URL}/api/chat/conversations/${encodeURIComponent(conversationId)}/attachments`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    request.onerror = () => reject(new Error('PDF upload failed. Check your connection.'));
    request.onload = () => {
      let data = {};
      try { data = JSON.parse(request.responseText); } catch { /* API response below */ }
      if (request.status >= 200 && request.status < 300) resolve(data);
      else reject(new Error(data.error || data.message || `PDF upload failed (${request.status}).`));
    };
    const payload = new FormData();
    for (const file of selected) payload.append('files', file, file.name);
    if (body.trim()) payload.append('body', body.trim());
    request.send(payload);
  });
}

/* Preserve compatibility with any older component that sends a single PDF. */
export function uploadChatPdf(conversationId, file, onProgress = () => {}) {
  return uploadChatPdfs(conversationId, [file], '', onProgress);
}

/* Protected file download: do not expose the Bearer token in a link/URL. */
export async function downloadChatAttachment(attachmentId, filename) {
  const token = getChatToken();
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`${CHAT_SERVER_URL}/api/chat/attachments/${encodeURIComponent(attachmentId)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Unable to download attachment (${response.status}).`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = String(filename || 'attachment.pdf').replace(/[\\/]/g, '_');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
