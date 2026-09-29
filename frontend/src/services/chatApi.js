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
 * API configuration:
 * - Uses the centralized WELLJOB frontend API origin.
 * - Does not maintain a separate Messenger API URL.
 */

import API_ORIGIN from "../config/api";

/**
 * Shared backend origin used by Messenger REST requests
 * and existing Messenger components that import
 * CHAT_SERVER_URL.
 *
 * Keeping this export preserves compatibility while
 * making src/config/api.js the single source of truth.
 */
export const CHAT_SERVER_URL = API_ORIGIN;

/**
 * ==================================================
 * GET EXISTING LOGIN TOKEN
 * ==================================================
 *
 * The existing WELLJOB authentication system stores
 * the JWT under the localStorage key "token".
 */
export function getChatToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

/**
 * ==================================================
 * CHAT API REQUEST
 * ==================================================
 */
export async function chatApi(path, options = {}) {
  const token = getChatToken();

  if (!token) {
    throw new Error(
      "Your login session is missing. Please sign in again."
    );
  }

  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("Invalid Messenger API path.");
  }

  const headers = new Headers(options.headers || {});

  if (
    options.body != null &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(
    `${CHAT_SERVER_URL}/api/chat${path}`,
    {
      ...options,
      headers,
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error ||
        `Chat request failed (${response.status}).`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

/**
 * One chat message may contain multiple PDFs.
 * The 15 MB limit is combined across all selected files.
 */
export function uploadChatPdfs(
  conversationId,
  files,
  body = "",
  onProgress = () => {}
) {
  const selected = Array.from(files || []);
  const total = selected.reduce(
    (size, file) => size + file.size,
    0
  );
  const maxBytes = 15 * 1024 * 1024;

  if (
    !selected.length ||
    selected.length > 30 ||
    total > maxBytes ||
    selected.some(
      (file) =>
        file.size <= 0 ||
        !file.name.toLowerCase().endsWith(".pdf") ||
        (file.type && file.type !== "application/pdf")
    )
  ) {
    return Promise.reject(
      new Error(
        "Select 1–30 valid PDF files with a combined size of 15 MB or less."
      )
    );
  }

  if (
    typeof body !== "string" ||
    body.trim().length > 2000
  ) {
    return Promise.reject(
      new Error(
        "Message must contain at most 2000 characters."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const token = getChatToken();

    if (!token) {
      reject(new Error("Please sign in again."));
      return;
    }

    const request = new XMLHttpRequest();

    request.open(
      "POST",
      `${CHAT_SERVER_URL}/api/chat/conversations/${encodeURIComponent(
        conversationId
      )}/attachments`
    );

    request.setRequestHeader(
      "Authorization",
      `Bearer ${token}`
    );

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(
          Math.min(
            100,
            Math.round(
              (event.loaded / event.total) * 100
            )
          )
        );
      }
    };

    request.onerror = () => {
      reject(
        new Error(
          "PDF upload failed. Check your connection."
        )
      );
    };

    request.onload = () => {
      let data = {};

      try {
        data = JSON.parse(request.responseText);
      } catch {
        // The response status below determines whether the upload succeeded.
      }

      if (
        request.status >= 200 &&
        request.status < 300
      ) {
        resolve(data);
      } else {
        reject(
          new Error(
            data.error ||
              data.message ||
              `PDF upload failed (${request.status}).`
          )
        );
      }
    };

    const payload = new FormData();

    for (const file of selected) {
      payload.append(
        "files",
        file,
        file.name
      );
    }

    if (body.trim()) {
      payload.append(
        "body",
        body.trim()
      );
    }

    request.send(payload);
  });
}

/**
 * Preserve compatibility with older components that
 * send a single PDF attachment.
 */
export function uploadChatPdf(
  conversationId,
  file,
  onProgress = () => {}
) {
  return uploadChatPdfs(
    conversationId,
    [file],
    "",
    onProgress
  );
}

/**
 * Protected file download.
 * The Bearer token is sent through the Authorization
 * header and is never exposed in the download URL.
 */
export async function downloadChatAttachment(
  attachmentId,
  filename
) {
  const token = getChatToken();

  if (!token) {
    throw new Error("Please sign in again.");
  }

  const response = await fetch(
    `${CHAT_SERVER_URL}/api/chat/attachments/${encodeURIComponent(
      attachmentId
    )}/download`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      data.error ||
        `Unable to download attachment (${response.status}).`
    );
  }

  const objectUrl = URL.createObjectURL(
    await response.blob()
  );

  const link = document.createElement("a");

  link.href = objectUrl;

  link.download = String(
    filename || "attachment.pdf"
  ).replace(/[\\/]/g, "_");

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}