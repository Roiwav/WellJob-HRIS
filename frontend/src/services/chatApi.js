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
  // Retain the optional argument for backward-compatible callers.
  void _user;

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
  // Retain the optional third argument for backward-compatible callers.
  void _user;

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
function normalizeChatPdfSelection(files, body) {
  const selected = Array.from(files || []);
  const total = selected.reduce((sum, file) => sum + Number(file?.size || 0), 0);
  const maxBytes = 15 * 1024 * 1024;

  if (
    !selected.length ||
    selected.length > 30 ||
    total > maxBytes ||
    selected.some(
      (file) =>
        !file ||
        Number(file.size) <= 0 ||
        !String(file.name || "").toLowerCase().endsWith(".pdf") ||
        (file.type && file.type !== "application/pdf")
    )
  ) {
    throw new Error(
      "Select 1–30 valid PDF files with a combined size of 15 MB or less."
    );
  }

  const normalizedBody =
    typeof body === "string"
      ? body.trim()
      : "";

  if (normalizedBody.length > 2000) {
    throw new Error(
      "Message must contain at most 2000 characters."
    );
  }

  return {
    selected,
    total,
    body:
      normalizedBody,
  };
}

function uploadPdfToSignedUrl(
  signedUrl,
  file,
  {
    onLoaded,
  } = {}
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const request =
        new XMLHttpRequest();

      request.open(
        "PUT",
        signedUrl
      );

      request.setRequestHeader(
        "Content-Type",
        "application/pdf"
      );

      request.setRequestHeader(
        "x-upsert",
        "false"
      );

      request.upload.onprogress =
        (event) => {
          if (
            event.lengthComputable &&
            typeof onLoaded ===
              "function"
          ) {
            onLoaded(
              event.loaded,
              event.total
            );
          }
        };

      request.onerror =
        () => {
          reject(
            new Error(
              "PDF upload to private storage failed. Check your connection."
            )
          );
        };

      request.onload =
        () => {
          if (
            request.status >= 200 &&
            request.status < 300
          ) {
            resolve();
            return;
          }

          reject(
            new Error(
              `PDF upload failed (${request.status}).`
            )
          );
        };

      request.send(
        file
      );
    }
  );
}

async function cleanupChatDirectUploads(
  conversationId,
  directUploads
) {
  if (
    !Array.isArray(
      directUploads
    ) ||
    directUploads.length === 0
  ) {
    return;
  }

  try {
    await chatApi(
      `/conversations/${encodeURIComponent(
        conversationId
      )}/attachments/cleanup`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            directUploads,
          }),
      }
    );
  } catch {
    /*
     * Cleanup is best-effort only.
     *
     * The backend also refuses to delete any object
     * that is already referenced by chat_attachments.
     */
  }
}

export async function uploadChatPdfs(
  conversationId,
  files,
  body = "",
  onProgress = () => {}
) {
  const {
    selected,
    total,
    body:
      normalizedBody,
  } =
    normalizeChatPdfSelection(
      files,
      body
    );

  const authorization =
    await chatApi(
      `/conversations/${encodeURIComponent(
        conversationId
      )}/attachments/authorize`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            body:
              normalizedBody,

            files:
              selected.map(
                (file) => ({
                  name:
                    file.name,

                  type:
                    file.type ||
                    "application/pdf",

                  size:
                    file.size,
                })
              ),
          }),
      }
    );

  const uploads =
    Array.isArray(
      authorization?.uploads
    )
      ? authorization.uploads
      : [];

  if (
    uploads.length !==
    selected.length
  ) {
    throw new Error(
      "The server returned an incomplete Messenger upload authorization."
    );
  }

  const directUploads = [];
  let completedBytes = 0;
  let finalized = false;

  try {
    for (
      let authorizationIndex = 0;
      authorizationIndex <
        uploads.length;
      authorizationIndex += 1
    ) {
      const upload =
        uploads[
          authorizationIndex
        ];

      const clientIndex =
        Number(
          upload?.clientIndex
        );

      if (
        !Number.isInteger(
          clientIndex
        ) ||
        clientIndex < 0 ||
        clientIndex >=
          selected.length
      ) {
        throw new Error(
          "Messenger upload authorization contains an invalid file index."
        );
      }

      const signedUrl =
        String(
          upload?.signedUrl ||
            ""
        ).trim();

      const descriptor =
        String(
          upload?.descriptor ||
            ""
        ).trim();

      if (
        !signedUrl ||
        !descriptor
      ) {
        throw new Error(
          "Messenger upload authorization is incomplete."
        );
      }

      const file =
        selected[
          clientIndex
        ];

      await uploadPdfToSignedUrl(
        signedUrl,
        file,
        {
          onLoaded(
            loaded
          ) {
            if (
              total > 0 &&
              typeof onProgress ===
                "function"
            ) {
              onProgress(
                Math.min(
                  100,
                  Math.round(
                    (
                      completedBytes +
                      loaded
                    ) /
                      total *
                      100
                  )
                )
              );
            }
          },
        }
      );

      completedBytes +=
        file.size;

      directUploads.push({
        descriptor,
      });

      if (
        typeof onProgress ===
        "function"
      ) {
        onProgress(
          Math.min(
            100,
            Math.round(
              completedBytes /
                total *
                100
            )
          )
        );
      }
    }

    const result =
      await chatApi(
        `/conversations/${encodeURIComponent(
          conversationId
        )}/attachments`,
        {
          method:
            "POST",

          body:
            JSON.stringify({
              body:
                normalizedBody,

              directUploads,
            }),
        }
      );

    finalized = true;

    if (
      typeof onProgress ===
        "function"
    ) {
      onProgress(
        100
      );
    }

    return result;
  } catch (error) {
    if (!finalized) {
      await cleanupChatDirectUploads(
        conversationId,
        directUploads
      );
    }

    throw error;
  }
}

/* Preserve compatibility with any older component that sends a single PDF. */
export function uploadChatPdf(
  conversationId,
  file,
  onProgress = () => {}
) {
  return uploadChatPdfs(
    conversationId,
    [
      file,
    ],
    "",
    onProgress
  );
}

/*
 * Protected file download.
 *
 * The WELLJOB JWT is sent only to the WELLJOB API.
 * After authorization, the browser receives a short-
 * lived Supabase signed URL and downloads the binary
 * without forwarding the WELLJOB Bearer token.
 */
export async function downloadChatAttachment(
  attachmentId,
  filename
) {
  const authorization =
    await chatApi(
      `/attachments/${encodeURIComponent(
        attachmentId
      )}/download`
    );

  const signedUrl =
    String(
      authorization?.downloadUrl ||
        ""
    ).trim();

  if (!signedUrl) {
    throw new Error(
      "The attachment download authorization is invalid."
    );
  }

  const response =
    await fetch(
      signedUrl,
      {
        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Unable to download attachment (${response.status}).`
    );
  }

  const objectUrl =
    URL.createObjectURL(
      await response.blob()
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    String(
      authorization?.filename ||
        filename ||
        "attachment.pdf"
    ).replace(
      /[\\/]/g,
      "_"
    );

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        objectUrl
      ),
    1000
  );
}