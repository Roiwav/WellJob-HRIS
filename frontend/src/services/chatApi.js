import API_ORIGIN from "../config/api";

/**
 * ==================================================
 * WELLJOB SOLUTIONS
 * MESSENGER API SERVICE
 * ==================================================
 *
 * Connects the Messenger frontend to the existing
 * WELLJOB Express backend using the current login JWT.
 */

export const CHAT_SERVER_URL = String(
  API_ORIGIN
)
  .trim()
  .replace(/\/+$/, "");

const MAX_CHAT_FILES = 30;
const MAX_CHAT_ATTACHMENT_BYTES =
  15 * 1024 * 1024;
const MAX_CHAT_MESSAGE_LENGTH = 2000;

const CHAT_ATTACHMENT_TYPES =
  Object.freeze({
    pdf: {
      mime:
        "application/pdf",
      label:
        "PDF",
    },

    docx: {
      mime:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      label:
        "Word file",
    },

    xls: {
      mime:
        "application/vnd.ms-excel",
      label:
        "Excel file",
    },

    xlsx: {
      mime:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      label:
        "Excel file",
    },

    png: {
      mime:
        "image/png",
      label:
        "image",
    },

    jpg: {
      mime:
        "image/jpeg",
      label:
        "image",
    },

    jpeg: {
      mime:
        "image/jpeg",
      label:
        "image",
    },

    webp: {
      mime:
        "image/webp",
      label:
        "image",
    },

    gif: {
      mime:
        "image/gif",
      label:
        "image",
    },
  });

function fileExtension(
  filename
) {
  const normalized =
    String(
      filename || ""
    )
      .trim()
      .toLowerCase();

  const dotIndex =
    normalized.lastIndexOf(
      "."
    );

  if (
    dotIndex < 0 ||
    dotIndex ===
      normalized.length - 1
  ) {
    return "";
  }

  return normalized.slice(
    dotIndex + 1
  );
}

function getAttachmentType(
  file
) {
  if (!file) {
    return null;
  }

  const extension =
    fileExtension(
      file.name
    );

  return (
    CHAT_ATTACHMENT_TYPES[
      extension
    ] || null
  );
}

/*
 * ==================================================
 * GET EXISTING LOGIN TOKEN
 * ==================================================
 *
 * Uses the same WELLJOB login session.
 * The optional argument is retained for compatibility.
 */

export function getChatToken(
  _user
) {
  void _user;

  try {
    return (
      localStorage.getItem(
        "token"
      ) || ""
    );
  } catch {
    return "";
  }
}

/*
 * ==================================================
 * CHAT API REQUEST
 * ==================================================
 */

export async function chatApi(
  path,
  options = {},
  _user
) {
  void _user;

  const token =
    getChatToken();

  if (!token) {
    throw new Error(
      "Your session has ended. Please sign in again."
    );
  }

  if (
    typeof path !==
      "string" ||
    !path.startsWith(
      "/"
    )
  ) {
    throw new Error(
      "This Messenger request could not be completed."
    );
  }

  const headers =
    new Headers(
      options.headers ||
        {}
    );

  if (
    options.body !=
      null &&
    !headers.has(
      "Content-Type"
    ) &&
    !(
      options.body instanceof
      FormData
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  const response =
    await fetch(
      `${CHAT_SERVER_URL}/api/chat${path}`,
      {
        ...options,
        headers,
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    const error =
      new Error(
        data.message ||
          data.error ||
          "Messenger could not complete that request."
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/*
 * ==================================================
 * ATTACHMENT VALIDATION
 * ==================================================
 */

function normalizeChatAttachmentSelection(
  files,
  body
) {
  const selected =
    Array.from(
      files || []
    );

  const total =
    selected.reduce(
      (
        sum,
        file
      ) =>
        sum +
        Number(
          file?.size || 0
        ),
      0
    );

  const invalidFile =
    selected.find(
      (file) => {
        const type =
          getAttachmentType(
            file
          );

        return (
          !file ||
          !type ||
          !Number.isSafeInteger(
            Number(
              file.size
            )
          ) ||
          Number(
            file.size
          ) <= 0
        );
      }
    );

  if (
    selected.length <
      1 ||
    selected.length >
      MAX_CHAT_FILES
  ) {
    throw new Error(
      `You can attach 1–${MAX_CHAT_FILES} files in one message.`
    );
  }

  if (invalidFile) {
    throw new Error(
      "You can send PDF, Word, Excel, and image files only."
    );
  }

  if (
    total >
    MAX_CHAT_ATTACHMENT_BYTES
  ) {
    throw new Error(
      "Your selected files are over the 15 MB total limit."
    );
  }

  const normalizedBody =
    typeof body ===
      "string"
      ? body.trim()
      : "";

  if (
    normalizedBody.length >
    MAX_CHAT_MESSAGE_LENGTH
  ) {
    throw new Error(
      `Messages can contain up to ${MAX_CHAT_MESSAGE_LENGTH} characters.`
    );
  }

  return {
    selected,
    total,
    body:
      normalizedBody,
  };
}

function uploadFileToSignedUrl(
  signedUrl,
  file,
  mime,
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
        mime
      );

      request.setRequestHeader(
        "x-upsert",
        "false"
      );

      request.upload.onprogress =
        (
          event
        ) => {
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
              "The file could not be uploaded. Check your connection and try again."
            )
          );
        };

      request.onload =
        () => {
          if (
            request.status >=
              200 &&
            request.status <
              300
          ) {
            resolve();

            return;
          }

          reject(
            new Error(
              "The file could not be uploaded. Please try again."
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
    directUploads.length ===
      0
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
     * The backend also refuses to remove any object
     * that is already referenced by a saved message.
     */
  }
}

/*
 * ==================================================
 * GENERIC CHAT ATTACHMENT UPLOAD
 * ==================================================
 *
 * Supports PDF, DOCX, XLS/XLSX, PNG, JPEG, WEBP,
 * and GIF files through the backend's signed-upload
 * authorization flow.
 */

export async function uploadChatAttachments(
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
    normalizeChatAttachmentSelection(
      files,
      body
    );

  const fileMetadata =
    selected.map(
      (
        file
      ) => {
        const type =
          getAttachmentType(
            file
          );

        return {
          name:
            file.name,

          type:
            type.mime,

          size:
            file.size,
        };
      }
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
              fileMetadata,
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
      "The selected files could not be prepared for sending. Please try again."
    );
  }

  const directUploads =
    [];

  let completedBytes =
    0;

  let finalized =
    false;

  try {
    for (
      let authorizationIndex =
        0;
      authorizationIndex <
        uploads.length;
      authorizationIndex +=
        1
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
        clientIndex <
          0 ||
        clientIndex >=
          selected.length
      ) {
        throw new Error(
          "One of the selected files could not be prepared for sending."
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
          "The selected files could not be prepared for sending. Please try again."
        );
      }

      const file =
        selected[
          clientIndex
        ];

      const type =
        getAttachmentType(
          file
        );

      if (!type) {
        throw new Error(
          "One of the selected files is not supported."
        );
      }

      await uploadFileToSignedUrl(
        signedUrl,
        file,
        type.mime,
        {
          onLoaded(
            loaded
          ) {
            if (
              total >
                0 &&
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

    finalized =
      true;

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

/*
 * Backward-compatible aliases.
 *
 * Existing callers can continue using the older
 * PDF-named functions while the application moves
 * to the generic attachment service.
 */

export function uploadChatPdfs(
  conversationId,
  files,
  body = "",
  onProgress = () => {}
) {
  return uploadChatAttachments(
    conversationId,
    files,
    body,
    onProgress
  );
}

export function uploadChatPdf(
  conversationId,
  file,
  onProgress = () => {}
) {
  return uploadChatAttachments(
    conversationId,
    [
      file,
    ],
    "",
    onProgress
  );
}

/*
 * ==================================================
 * PROTECTED FILE DOWNLOAD
 * ==================================================
 *
 * The WELLJOB JWT is sent only to the WELLJOB API.
 * The backend returns a short-lived private-storage
 * signed URL for the actual download.
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
      "This file is not available for download right now."
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
      "The file could not be downloaded. Please try again."
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
        "attachment"
    ).replace(
      /[\\/]/g,
      "_"
    );

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        objectUrl
      ),
    1000
  );
}