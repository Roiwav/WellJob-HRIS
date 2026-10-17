/** WELLJOB Messenger: direct chats, groups, activity notices and private PDF batches. */
const express = require('express');
const db = require('../config/db');
const crypto = require('node:crypto');
const { chatAuth, isChatRole, normalizeRole } = require('../middleware/chatAuth');
const { config, col, table, userSelect } = require('../config/chatConfig');
const { publishToUsers } = require('../services/chatSocket');
const {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  downloadBuffer,
  removeObject,
  isStorageNotFoundError,
} = require('../services/storageService');
const router = express.Router();
router.use(chatAuth);
const sql = db.promise();
const MAX_BATCH_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 30;
const MESSAGE_LIMIT = 2000;
const PAGE_SIZE = 50;
const MAX_GROUP_MEMBERS = 30;
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function fail(res, status, message) { return res.status(status).json({ error: message }); }
function serverError(res, e) {
  console.error('CHAT ERROR:', e);
  if (res.headersSent) return;
  return fail(res, e.status || 500, e.status ? e.message : 'Messenger request failed.');
}
function id(v) {
  if (!['string', 'number'].includes(typeof v) || !/^[1-9]\d*$/.test(String(v).trim())) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function groupId(v) { return typeof v === 'string' && /^g:[1-9]\d*$/.test(v) ? id(v.slice(2)) : null; }
function selectedConversation(raw) {
  const g = groupId(raw);
  if (g) return { kind: 'group', value: g };
  const d = id(raw);
  return d ? { kind: 'direct', value: d } : null;
}
function cleanBody(v) { return typeof v === 'string' ? v.trim() : ''; }
function eligible(u) {
  return !!u && String(u.accountStatus || '').toUpperCase() === 'ACTIVE' && isChatRole(u.role) &&
    (normalizeRole(u.role) !== 'HR_COORDINATOR' || !!String(u.assignedCompany || '').trim());
}
function userDto(u) {
  return { id: Number(u.id), username: u.username, fullName: u.fullName || null,
    role: normalizeRole(u.role), avatarFilename: u.avatarFilename || null, avatarUrl: null };
}
function safeFilename(name) {
  const normalized =
    String(
      name ||
        "attachment"
    ).replace(
      /\\/g,
      "/"
    );

  const basename =
    normalized
      .split("/")
      .pop() ||
    "attachment";

  return (
    basename
      .replace(
        /[\x00-\x1f\x7f"<>:|?*]/g,
        "_"
      )
      .slice(
        0,
        240
      ) ||
    "attachment"
  );
}

const CHAT_ATTACHMENT_TYPES =
  Object.freeze({
    ".pdf": {
      mime:
        "application/pdf",
      kind:
        "pdf",
    },

    ".png": {
      mime:
        "image/png",
      kind:
        "png",
    },

    ".jpg": {
      mime:
        "image/jpeg",
      kind:
        "jpeg",
    },

    ".jpeg": {
      mime:
        "image/jpeg",
      kind:
        "jpeg",
    },

    ".webp": {
      mime:
        "image/webp",
      kind:
        "webp",
    },

    ".gif": {
      mime:
        "image/gif",
      kind:
        "gif",
    },

    ".docx": {
      mime:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      kind:
        "docx",
    },

    ".xlsx": {
      mime:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      kind:
        "xlsx",
    },

    ".xls": {
      mime:
        "application/vnd.ms-excel",
      kind:
        "xls",
    },
  });

function getFileExtension(
  filename
) {
  const safeName =
    safeFilename(
      filename
    );

  const dotIndex =
    safeName.lastIndexOf(
      "."
    );

  if (
    dotIndex <= 0 ||
    dotIndex ===
      safeName.length - 1
  ) {
    return "";
  }

  return safeName
    .slice(
      dotIndex
    )
    .toLowerCase();
}

function resolveAttachmentType(
  filename,
  suppliedMime = ""
) {
  const extension =
    getFileExtension(
      filename
    );

  const type =
    CHAT_ATTACHMENT_TYPES[
      extension
    ];

  if (!type) {
    return null;
  }

  const normalizedMime =
    String(
      suppliedMime || ""
    )
      .trim()
      .toLowerCase();

  if (
    normalizedMime &&
    normalizedMime !==
      type.mime
  ) {
    return null;
  }

  return {
    extension,
    mime:
      type.mime,
    kind:
      type.kind,
  };
}

function hasBytes(
  buffer,
  expected,
  offset = 0
) {
  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length <
      offset +
        expected.length
  ) {
    return false;
  }

  return expected.every(
    (
      byte,
      index
    ) =>
      buffer[
        offset + index
      ] === byte
  );
}

function validPdf(
  buffer
) {
  return (
    Buffer.isBuffer(
      buffer
    ) &&
    buffer.length >
      0 &&
    buffer.length <=
      MAX_BATCH_BYTES &&
    buffer
      .subarray(
        0,
        5
      )
      .toString(
        "ascii"
      ) ===
      "%PDF-" &&
    buffer
      .subarray(
        Math.max(
          0,
          buffer.length -
            2048
        )
      )
      .toString(
        "latin1"
      )
      .includes(
        "%%EOF"
      )
  );
}

function validPng(
  buffer
) {
  return hasBytes(
    buffer,
    [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]
  );
}

function validJpeg(
  buffer
) {
  return hasBytes(
    buffer,
    [
      0xff,
      0xd8,
      0xff,
    ]
  );
}

function validGif(
  buffer
) {
  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length <
      6
  ) {
    return false;
  }

  const signature =
    buffer
      .subarray(
        0,
        6
      )
      .toString(
        "ascii"
      );

  return (
    signature ===
      "GIF87a" ||
    signature ===
      "GIF89a"
  );
}

function validWebp(
  buffer
) {
  return (
    Buffer.isBuffer(
      buffer
    ) &&
    buffer.length >=
      12 &&
    buffer
      .subarray(
        0,
        4
      )
      .toString(
        "ascii"
      ) ===
      "RIFF" &&
    buffer
      .subarray(
        8,
        12
      )
      .toString(
        "ascii"
      ) ===
      "WEBP"
  );
}

function validZipOfficeFile(
  buffer,
  kind
) {
  if (
    !hasBytes(
      buffer,
      [
        0x50,
        0x4b,
        0x03,
        0x04,
      ]
    )
  ) {
    return false;
  }

  const searchable =
    buffer.toString(
      "latin1"
    );

  if (
    !searchable.includes(
      "[Content_Types].xml"
    )
  ) {
    return false;
  }

  if (
    kind ===
    "docx"
  ) {
    return searchable.includes(
      "word/"
    );
  }

  if (
    kind ===
    "xlsx"
  ) {
    return searchable.includes(
      "xl/"
    );
  }

  return false;
}

function validLegacyExcel(
  buffer
) {
  return hasBytes(
    buffer,
    [
      0xd0,
      0xcf,
      0x11,
      0xe0,
      0xa1,
      0xb1,
      0x1a,
      0xe1,
    ]
  );
}

function validStoredAttachment(
  file,
  buffer
) {
  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length <= 0 ||
    buffer.length >
      MAX_BATCH_BYTES ||
    buffer.length !==
      file.size
  ) {
    return false;
  }

  switch (
    file.kind
  ) {
    case "pdf":
      return validPdf(
        buffer
      );

    case "png":
      return validPng(
        buffer
      );

    case "jpeg":
      return validJpeg(
        buffer
      );

    case "gif":
      return validGif(
        buffer
      );

    case "webp":
      return validWebp(
        buffer
      );

    case "docx":
    case "xlsx":
      return validZipOfficeFile(
        buffer,
        file.kind
      );

    case "xls":
      return validLegacyExcel(
        buffer
      );

    default:
      return false;
  }
}

function timestampToIso(
  value
) {
  const milliseconds =
    Number(
      value
    );

  if (
    !Number.isFinite(
      milliseconds
    ) ||
    milliseconds <= 0
  ) {
    return null;
  }

  const date =
    new Date(
      milliseconds
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}

/*
 * Supported Messenger attachments:
 * PDF, DOCX, XLS/XLSX, PNG, JPEG, WEBP, and GIF.
 *
 * The existing chat_attachments table remains compatible because
 * file type is verified through the signed descriptor + stored bytes;
 * no schema change is required for this phase.
 */
const CHAT_ATTACHMENT_PREFIX = 'chat/attachments';
const CHAT_UPLOAD_DESCRIPTOR_VERSION = 1;
const CHAT_UPLOAD_TTL_MS = 10 * 60 * 1000;
const CHAT_UPLOAD_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function chatAttachmentObjectPath(storageName) {
  if (!UUID_V4_PATTERN.test(String(storageName || ''))) {
    throw httpError(400, 'Invalid attachment storage identity.');
  }
  return `${CHAT_ATTACHMENT_PREFIX}/${storageName}`;
}
function chatUploadSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is required for Messenger upload authorization.');
  return secret;
}
function signChatUploadDescriptor(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', chatUploadSecret())
    .update(`welljob-chat-upload-v1.${encoded}`)
    .digest('base64url');
  return `${encoded}.${signature}`;
}
function verifyChatUploadDescriptor(
  rawDescriptor,
  userId,
  selection,
  {
    allowExpired = false,
  } = {}
) {
  if (
    typeof rawDescriptor !==
      "string" ||
    rawDescriptor.length <
      20 ||
    rawDescriptor.length >
      4096
  ) {
    throw httpError(
      400,
      "Invalid Messenger upload authorization."
    );
  }

  const parts =
    rawDescriptor.split(
      "."
    );

  if (
    parts.length !==
      2 ||
    !parts[0] ||
    !parts[1]
  ) {
    throw httpError(
      400,
      "Invalid Messenger upload authorization."
    );
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        chatUploadSecret()
      )
      .update(
        `welljob-chat-upload-v1.${parts[0]}`
      )
      .digest();

  let received;

  try {
    received =
      Buffer.from(
        parts[1],
        "base64url"
      );
  } catch {
    throw httpError(
      400,
      "Invalid Messenger upload authorization."
    );
  }

  if (
    received.length !==
      expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
  ) {
    throw httpError(
      400,
      "Invalid Messenger upload authorization."
    );
  }

  let payload;

  try {
    payload =
      JSON.parse(
        Buffer.from(
          parts[0],
          "base64url"
        ).toString(
          "utf8"
        )
      );
  } catch {
    throw httpError(
      400,
      "Invalid Messenger upload authorization."
    );
  }

  const descriptorUserId =
    id(
      payload?.uid
    );

  const descriptorConversationId =
    id(
      payload?.cid
    );

  const size =
    Number(
      payload?.size
    );

  const expiresAt =
    Number(
      payload?.exp
    );

  const storageName =
    String(
      payload?.storageName ||
        ""
    ).trim();

  const originalName =
    safeFilename(
      payload?.name
    );

  if (
    Number(
      payload?.v
    ) !==
      CHAT_UPLOAD_DESCRIPTOR_VERSION ||
    descriptorUserId !==
      userId ||
    payload?.kind !==
      selection.kind ||
    descriptorConversationId !==
      selection.value ||
    !UUID_V4_PATTERN.test(
      storageName
    ) ||
    !Number.isSafeInteger(
      size
    ) ||
    size <= 0 ||
    size >
      MAX_BATCH_BYTES ||
    !Number.isSafeInteger(
      expiresAt
    )
  ) {
    throw httpError(
      400,
      "Messenger upload authorization does not match this request."
    );
  }

  const attachmentType =
    resolveAttachmentType(
      originalName,
      payload?.mime
    );

  if (!attachmentType) {
    throw httpError(
      400,
      "Messenger upload authorization contains an unsupported attachment type."
    );
  }

  if (
    !allowExpired &&
    Date.now() >
      expiresAt
  ) {
    throw httpError(
      410,
      "Messenger upload authorization expired. Please choose the attachments again."
    );
  }

  if (
    allowExpired &&
    Date.now() -
      expiresAt >
      CHAT_UPLOAD_CLEANUP_GRACE_MS
  ) {
    throw httpError(
      410,
      "Messenger upload cleanup authorization expired."
    );
  }

  return {
    storageName,
    originalName,
    size,
    expiresAt,
    mime:
      attachmentType.mime,
    kind:
      attachmentType.kind,
  };
}

function validateUploadMetadata(
  rawFiles
) {
  if (
    !Array.isArray(
      rawFiles
    ) ||
    rawFiles.length <
      1 ||
    rawFiles.length >
      MAX_FILES
  ) {
    throw httpError(
      400,
      "Choose 1–30 attachments."
    );
  }

  const files =
    rawFiles.map(
      (
        file,
        index
      ) => {
        if (
          !file ||
          typeof file !==
            "object" ||
          Array.isArray(
            file
          )
        ) {
          throw httpError(
            400,
            `Invalid attachment metadata at item ${index + 1}.`
          );
        }

        const originalName =
          safeFilename(
            file.name ||
              file.originalName
          );

        const size =
          Number(
            file.size
          );

        const type =
          resolveAttachmentType(
            originalName,
            file.type ||
              file.mimeType ||
              ""
          );

        if (
          !type ||
          !Number.isSafeInteger(
            size
          ) ||
          size <= 0 ||
          size >
            MAX_BATCH_BYTES
        ) {
          throw httpError(
            400,
            "Attachments must be supported PDF, DOCX, Excel, or image files with a positive file size."
          );
        }

        return {
          originalName,
          size,
          mime:
            type.mime,
          kind:
            type.kind,
        };
      }
    );

  const total =
    files.reduce(
      (
        sum,
        file
      ) =>
        sum +
        file.size,
      0
    );

  if (
    total >
    MAX_BATCH_BYTES
  ) {
    throw httpError(
      413,
      "Combined attachment size must not exceed 15 MB."
    );
  }

  return files;
}

async function removeUnreferencedChatObjects(storageNames) {
  const unique = [...new Set(storageNames.filter(name => UUID_V4_PATTERN.test(String(name || ''))))];
  for (const storageName of unique) {
    try {
      const [rows] = await sql.query(
        'SELECT 1 FROM chat_attachments WHERE storage_name=? LIMIT 1',
        [storageName]
      );
      if (rows.length) continue;
      await removeObject(chatAttachmentObjectPath(storageName));
    } catch (error) {
      if (!isStorageNotFoundError(error)) {
        console.error('CHAT ATTACHMENT CLEANUP ERROR:', {
          storageName,
          message: error?.message || error,
        });
      }
    }
  }
}
async function validateDirectUploadDescriptors(
  rawUploads,
  userId,
  selection,
  options = {}
) {
  if (
    !Array.isArray(
      rawUploads
    ) ||
    rawUploads.length <
      1 ||
    rawUploads.length >
      MAX_FILES
  ) {
    throw httpError(
      400,
      "Choose 1–30 authorized attachments."
    );
  }

  const files =
    rawUploads.map(
      (item) =>
        verifyChatUploadDescriptor(
          item?.descriptor,
          userId,
          selection,
          options
        )
    );

  const names =
    files.map(
      (file) =>
        file.storageName
    );

  if (
    new Set(
      names
    ).size !==
    names.length
  ) {
    throw httpError(
      400,
      "Duplicate Messenger upload authorization."
    );
  }

  const total =
    files.reduce(
      (
        sum,
        file
      ) =>
        sum +
        file.size,
      0
    );

  if (
    total >
    MAX_BATCH_BYTES
  ) {
    throw httpError(
      413,
      "Combined attachment size must not exceed 15 MB."
    );
  }

  return files;
}

async function verifyStoredChatUploads(
  files
) {
  for (
    const file of files
  ) {
    const [usedRows] =
      await sql.query(
        "SELECT 1 FROM chat_attachments WHERE storage_name=? LIMIT 1",
        [
          file.storageName,
        ]
      );

    if (
      usedRows.length
    ) {
      throw httpError(
        409,
        "One of these attachment uploads has already been finalized."
      );
    }

    const buffer =
      await downloadBuffer(
        chatAttachmentObjectPath(
          file.storageName
        )
      );

    if (
      !validStoredAttachment(
        file,
        buffer
      )
    ) {
      throw httpError(
        400,
        "A stored Messenger attachment failed file verification."
      );
    }
  }
}

async function findUser(userId, conn = sql) {
  const [rows] = await conn.query(`SELECT ${userSelect('u')},u.${col('status')} AS accountStatus,u.${col('assigned_company')} AS assignedCompany FROM ${table} u WHERE u.${col(config.userIdColumn)}=? LIMIT 1`, [userId]);
  return rows[0] || null;
}
async function direct(conversationId, userId, conn = sql) {
  const [rows] = await conn.query('SELECT * FROM chat_conversations WHERE id=? AND (user1_id=? OR user2_id=?) LIMIT 1', [conversationId, userId, userId]);
  return rows[0] || null;
}
async function membership(groupIdValue, userId, conn = sql) {
  const [rows] = await conn.query('SELECT g.id,g.name,g.created_by,m.is_admin,m.joined_after_message_id,m.last_read_message_id FROM chat_groups g JOIN chat_group_members m ON m.group_id=g.id WHERE g.id=? AND m.user_id=? LIMIT 1', [groupIdValue, userId]);
  return rows[0] || null;
}
async function groupUsers(groupIdValue, conn = sql) {
  const [rows] = await conn.query('SELECT user_id FROM chat_group_members WHERE group_id=?', [groupIdValue]);
  return rows.map(row => Number(row.user_id));
}
async function authorizeSend(selection, senderId, conn = sql) {
  if (selection.kind === 'group') {
    const member = await membership(selection.value, senderId, conn);
    if (!member) throw httpError(403, 'You are not a member of this group.');
    return { receiver: null };
  }
  const conversation = await direct(selection.value, senderId, conn);
  if (!conversation) throw httpError(404, 'Conversation not found.');
  const receiver = Number(conversation.user1_id) === senderId
    ? Number(conversation.user2_id)
    : Number(conversation.user1_id);
  if (!eligible(await findUser(receiver, conn))) {
    throw httpError(403, 'Recipient is unavailable.');
  }
  return { receiver };
}
async function emit(users, eventName, payload) {
  try { await publishToUsers(users, eventName, payload); }
  catch (e) { console.error('CHAT SOCKET ERROR:', e); }
}
function attachmentsForRow(
  row
) {
  return Array.isArray(
    row.attachments
  )
    ? row.attachments
    : [];
}

function directDto(
  row
) {
  const attachments =
    attachmentsForRow(
      row
    );

  return {
    id:
      String(
        row.id
      ),

    conversationId:
      String(
        row.conversation_id
      ),

    senderId:
      Number(
        row.sender_id
      ),

    body:
      row.body,

    createdAt:
      timestampToIso(
        row.created_at_ms
      ) ||
      row.created_at,

    readAt:
      timestampToIso(
        row.read_at_ms
      ) ||
      row.read_at ||
      null,

    attachments,

    attachment:
      attachments[0] ||
      null,

    isSystem:
      false,
  };
}

function groupDto(
  row
) {
  const attachments =
    attachmentsForRow(
      row
    );

  return {
    id:
      String(
        row.id
      ),

    conversationId:
      `g:${row.group_id}`,

    senderId:
      Number(
        row.sender_id
      ),

    senderName:
      row.senderName ||
      null,

    body:
      row.body,

    createdAt:
      timestampToIso(
        row.created_at_ms
      ) ||
      row.created_at,

    readAt:
      null,

    seenByCount:
      Number(
        row.seenByCount ||
          0
      ),

    recipientCount:
      Number(
        row.recipientCount ||
          0
      ),

    attachments,

    attachment:
      attachments[0] ||
      null,

    isSystem:
      Boolean(
        row.system_action
      ),

    systemAction:
      row.system_action ||
      null,
  };
}

async function attachFiles(kind, rows, conn = sql) {
  if (!rows.length) return rows;
  const placeholders = rows.map(() => '?').join(',');
  const [files] = await conn.query(`SELECT id,message_id,original_name,byte_size FROM chat_attachments WHERE conversation_type=? AND message_id IN (${placeholders}) ORDER BY id ASC`, [kind, ...rows.map(row => row.id)]);
  const grouped = new Map();
  for (const file of files) {
    const key = String(file.message_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ id: String(file.id), name: file.original_name, size: Number(file.byte_size) });
  }
  return rows.map(row => ({ ...row, attachments: grouped.get(String(row.id)) || [] }));
}
async function fetchMessage(
  kind,
  messageId,
  conn = sql
) {
  const [rows] =
    kind ===
    "group"
      ? await conn.query(
          `
          SELECT
            m.*,
            u.full_name AS senderName,
            UNIX_TIMESTAMP(
              m.created_at
            ) * 1000 AS created_at_ms,
            (
              SELECT
                COUNT(*)
              FROM
                chat_group_members AS gm_seen
              WHERE
                gm_seen.group_id =
                  m.group_id
                AND gm_seen.user_id <>
                  m.sender_id
                AND gm_seen.last_read_message_id >=
                  m.id
            ) AS seenByCount,
            (
              SELECT
                COUNT(*)
              FROM
                chat_group_members AS gm_total
              WHERE
                gm_total.group_id =
                  m.group_id
                AND gm_total.user_id <>
                  m.sender_id
            ) AS recipientCount
          FROM
            chat_group_messages AS m
          LEFT JOIN
            users AS u
              ON u.id =
                m.sender_id
          WHERE
            m.id = ?
          LIMIT 1
          `,
          [
            messageId,
          ]
        )
      : await conn.query(
          `
          SELECT
            m.*,
            UNIX_TIMESTAMP(
              m.created_at
            ) * 1000 AS created_at_ms,
            UNIX_TIMESTAMP(
              m.read_at
            ) * 1000 AS read_at_ms
          FROM
            chat_messages AS m
          WHERE
            m.id = ?
          LIMIT 1
          `,
          [
            messageId,
          ]
        );

  if (
    !rows.length
  ) {
    return null;
  }

  const enriched =
    await attachFiles(
      kind,
      rows,
      conn
    );

  return kind ===
    "group"
    ? groupDto(
        enriched[0]
      )
    : directDto(
        enriched[0]
      );
}

/** Mutations are serialized/** Mutations are serialized on chat_groups row. Store genuine, server-generated system messages. */
async function groupNotice(conn, groupIdValue, actorId, action, text) {
  const [insert] = await conn.query('INSERT INTO chat_group_messages(group_id,sender_id,body,system_action,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP(3))', [groupIdValue, actorId, text, action]);
  await conn.query('UPDATE chat_groups SET updated_at=UTC_TIMESTAMP(3) WHERE id=?', [groupIdValue]);
  return fetchMessage('group', insert.insertId, conn);
}
function actorName(req) { return String(req.chatUser.fullName || req.chatUser.username || 'A member').trim().slice(0, 100); }
function targetName(user) { return String(user.fullName || user.username || 'a member').trim().slice(0, 100); }
async function notifyGroupChange(groupIdValue, recipients, notice) {
  const conversationId = `g:${groupIdValue}`;
  await emit(recipients, 'chat:changed', { conversationId });
  if (notice) await emit(recipients, 'chat:message', { message: notice,
    sender: { id: notice.senderId, fullName: 'Group activity' } });
}
async function saveMessage(selection, senderId, body, files = []) {
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    let receiver = null;
    if (selection.kind === 'group') {
      const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [selection.value]);
      if (!locked.length) throw httpError(404, 'Group not found.');
      if (!await membership(selection.value, senderId, conn)) throw httpError(403, 'You are not a member of this group.');
    } else {
      const access = await authorizeSend(selection, senderId, conn);
      receiver = access.receiver;
    }
    const target = selection.kind === 'group' ? 'chat_group_messages' : 'chat_messages';
    const foreignKey = selection.kind === 'group' ? 'group_id' : 'conversation_id';
    const [insert] = await conn.query(
      `INSERT INTO ${target}(${foreignKey},sender_id,body,created_at) VALUES(?,?,?,UTC_TIMESTAMP(3))`,
      [selection.value, senderId, body]
    );
    for (const file of files) {
      await conn.query(
        'INSERT INTO chat_attachments(conversation_type,message_id,storage_name,original_name,byte_size) VALUES(?,?,?,?,?)',
        [selection.kind, insert.insertId, file.storageName, file.originalName, file.size]
      );
    }
    await conn.query(
      `UPDATE ${selection.kind === 'group' ? 'chat_groups' : 'chat_conversations'} SET updated_at=UTC_TIMESTAMP(3) WHERE id=?`,
      [selection.value]
    );
    const users = selection.kind === 'group'
      ? await groupUsers(selection.value, conn)
      : [senderId, receiver];
    const message = await fetchMessage(selection.kind, insert.insertId, conn);
    await conn.commit();
    return { users, message };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
async function notifySaved(saved, req) {
  await emit(saved.users, 'chat:message', { message: saved.message,
    sender: { id: req.chatUser.id, username: req.chatUser.username, fullName: req.chatUser.fullName } });
}
/**
 * TEMPORARY PRODUCTION DATABASE DIAGNOSTIC
 *
 * Read-only. An authenticated, ACTIVE Super Admin is checked against
 * the users table, not solely against a client-supplied role or JWT claim.
 *
 * Does not return any connection strings, credentials, hostnames, usernames,
 * message bodies, attachment filenames, or individual employee information.
 *
 * Remove this route after the Messenger production DB mismatch is resolved.
 */
router.get('/diagnostics/database', async (req, res) => {
  try {
    const actor = await findUser(req.chatUser.id);
    if (
      !actor ||
      String(actor.accountStatus || '').toUpperCase() !== 'ACTIVE' ||
      normalizeRole(actor.role) !== 'SUPER_ADMIN'
    ) {
      return fail(res, 403, 'Super Admin access required.');
    }
    const [[result]] = await sql.query(`
      SELECT
        DATABASE() AS databaseName,
        LEFT(SHA2(CONCAT(@@server_uuid, '|', DATABASE()), 256), 16) AS fingerprint,
        (SELECT COUNT(*) FROM chat_messages) AS privateMessages,
        (SELECT COUNT(*) FROM chat_group_messages) AS groupMessages,
        (SELECT COUNT(*) FROM chat_attachments) AS attachments,
        (SELECT COUNT(*) FROM chat_conversations) AS conversations,
        (SELECT COUNT(*) FROM chat_groups) AS chatGroups,
        (SELECT COUNT(*) FROM chat_group_members) AS groupMembers
    `);
    const expectedHost =
      'mysql-1fa118a2-hriswelljobsolutions.j.aivencloud.com';
    const expectedPort = 16505;
    const expectedDatabase = 'welljob_hris';
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    return res.json({
      diagnosticVersion: 'welljob-db-check-20261013-01',
      databaseFingerprint: String(result.fingerprint || ''),
      targetChecks: {
        configuredHostMatchesExpected:
          String(process.env.DB_HOST || '').trim().toLowerCase() === expectedHost,
        configuredPortMatchesExpected:
          Number(process.env.DB_PORT) === expectedPort,
        configuredDatabaseMatchesExpected:
          String(process.env.DB_NAME || '').trim() === expectedDatabase,
        connectedDatabaseMatchesExpected:
          String(result.databaseName || '') === expectedDatabase,
      },
      messageCounts: {
        private: Number(result.privateMessages),
        group: Number(result.groupMessages),
        attachments: Number(result.attachments),
      },
      preservedStructureCounts: {
        conversations: Number(result.conversations),
        groups: Number(result.chatGroups),
        groupMembers: Number(result.groupMembers),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
});
router.get('/users', async (req, res) => {
  try {
    const [rows] = await sql.query(`SELECT ${userSelect('u')},u.${col('status')} AS accountStatus,u.${col('assigned_company')} AS assignedCompany FROM ${table} u WHERE u.${col(config.userIdColumn)}<>? ORDER BY u.${col(config.usernameColumn)}`, [req.chatUser.id]);
    return res.json(rows.filter(eligible).map(userDto));
  } catch (e) { return serverError(res, e); }
});
router.get('/unread-count', async (req, res) => {
  try {
    const uid = req.chatUser.id;
    const [[d]] = await sql.query('SELECT COUNT(*) AS n FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE (c.user1_id=? OR c.user2_id=?) AND m.sender_id<>? AND m.read_at IS NULL', [uid, uid, uid]);
    const [[g]] = await sql.query('SELECT COUNT(*) AS n FROM chat_group_messages m JOIN chat_group_members gm ON gm.group_id=m.group_id WHERE gm.user_id=? AND m.id>GREATEST(gm.joined_after_message_id,gm.last_read_message_id) AND m.sender_id<>? AND m.system_action IS NULL', [uid, uid]);
    return res.json({ unreadCount: Number(d.n) + Number(g.n) });
  } catch (e) { return serverError(res, e); }
});
router.get('/conversations', async (req, res) => {
  try {
    const uid = req.chatUser.id;
    const [directRows] = await sql.query(`SELECT c.id AS conversationId,c.created_at AS createdAt,c.updated_at AS updatedAt,${userSelect('u')},u.${col('status')} AS accountStatus,u.${col('assigned_company')} AS assignedCompany,
      (SELECT IF((SELECT COUNT(*) FROM chat_attachments a WHERE a.conversation_type='direct' AND a.message_id=m.id)>0,IF(m.body='', 'Attachments',CONCAT(m.body,' · Attachments')),m.body) FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastBody,
      (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastAt,
      (SELECT UNIX_TIMESTAMP(m.created_at) * 1000 FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastAtTimestamp,
      (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) AS unreadCount
      FROM chat_conversations c JOIN ${table} u ON u.${col(config.userIdColumn)}=IF(c.user1_id=?,c.user2_id,c.user1_id) WHERE c.user1_id=? OR c.user2_id=?`, [uid, uid, uid, uid]);
    const [groupRows] = await sql.query(`SELECT g.id,g.name,g.created_at AS createdAt,g.updated_at AS updatedAt,gm.is_admin AS isAdmin,
      (SELECT IF(m.system_action IS NOT NULL,m.body,IF((SELECT COUNT(*) FROM chat_attachments a WHERE a.conversation_type='group' AND a.message_id=m.id)>0,IF(m.body='', 'Attachments',CONCAT(m.body,' · Attachments')),m.body)) FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>gm.joined_after_message_id ORDER BY m.id DESC LIMIT 1) AS lastBody,
      (SELECT m.created_at FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>gm.joined_after_message_id ORDER BY m.id DESC LIMIT 1) AS lastAt,
      (SELECT UNIX_TIMESTAMP(m.created_at) * 1000 FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>gm.joined_after_message_id ORDER BY m.id DESC LIMIT 1) AS lastAtTimestamp,
      (SELECT COUNT(*) FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>GREATEST(gm.joined_after_message_id,gm.last_read_message_id) AND m.sender_id<>? AND m.system_action IS NULL) AS unreadCount
      FROM chat_groups g JOIN chat_group_members gm ON gm.group_id=g.id WHERE gm.user_id=?`, [uid, uid]);
    const directs =
      directRows.map(
        (row) => ({
          id:
            String(
              row.conversationId
            ),

          kind:
            "direct",

          createdAt:
            row.createdAt,

          updatedAt:
            row.updatedAt,

          partner:
            userDto(
              row
            ),

          canMessage:
            eligible(
              row
            ),

          lastBody:
            row.lastBody,

          lastAt:
            timestampToIso(
              row.lastAtTimestamp
            ) ||
            row.lastAt ||
            null,

          lastAtTimestamp:
            Number(
              row.lastAtTimestamp ||
                0
            ),

          unreadCount:
            Number(
              row.unreadCount
            ),
        })
      );

    const groups =
      groupRows.map(
        (row) => ({
          id:
            `g:${row.id}`,

          kind:
            "group",

          name:
            row.name,

          isAdmin:
            Boolean(
              row.isAdmin
            ),

          createdAt:
            row.createdAt,

          updatedAt:
            row.updatedAt,

          lastBody:
            row.lastBody,

          lastAt:
            timestampToIso(
              row.lastAtTimestamp
            ) ||
            row.lastAt ||
            null,

          lastAtTimestamp:
            Number(
              row.lastAtTimestamp ||
                0
            ),

          unreadCount:
            Number(
              row.unreadCount
            ),

          canMessage:
            true,
        })
      );

    /*
     * Last actual message time controls priority.
     * Empty threads preserve the existing creation-date fallback.
     */
    return res.json(
      [
        ...directs,
        ...groups,
      ]
        .sort(
          (
            first,
            second
          ) => {
            const firstLastAt =
              Number(
                first.lastAtTimestamp ||
                  0
              );

            const secondLastAt =
              Number(
                second.lastAtTimestamp ||
                  0
              );

            if (
              firstLastAt ||
              secondLastAt
            ) {
              return (
                secondLastAt -
                firstLastAt
              );
            }

            return (
              new Date(
                second.createdAt
              ).getTime() -
              new Date(
                first.createdAt
              ).getTime()
            );
          }
        )
        .map(
          ({
            lastAtTimestamp,
            ...conversation
          }) =>
            conversation
        )
    );
  } catch (e) { return serverError(res, e); }
});
router.post('/conversations', async (req, res) => {
  const recipient = id(req.body?.recipientId), uid = req.chatUser.id;
  if (!recipient || recipient === uid) return fail(res, 400, 'Choose a different valid user.');
  try {
    if (!eligible(await findUser(recipient))) return fail(res, 404, 'Recipient is unavailable.');
    const [insert] = await sql.query('INSERT INTO chat_conversations(user1_id,user2_id) VALUES(?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [Math.min(uid, recipient), Math.max(uid, recipient)]);
    return res.json({ conversationId: String(insert.insertId) });
  } catch (e) { return serverError(res, e); }
});
router.post('/groups', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const raw = req.body?.memberIds;
  if (name.length < 2 || name.length > 100 || !Array.isArray(raw) || raw.length < 1 || raw.length > MAX_GROUP_MEMBERS - 1)
    return fail(res, 400, 'Enter a group name (2–100 characters) and select 1–29 participants.');
  const ids = raw.map(id);
  if (ids.some(x => !x) || new Set(ids).size !== ids.length || ids.includes(req.chatUser.id)) return fail(res, 400, 'Invalid or duplicate group members.');
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    for (const userId of ids) if (!eligible(await findUser(userId, conn))) throw httpError(400, 'One or more members are unavailable.');
    const [result] = await conn.query('INSERT INTO chat_groups(name,created_by) VALUES(?,?)', [name, req.chatUser.id]);
    const gid = result.insertId;
    for (const userId of [req.chatUser.id, ...ids]) await conn.query('INSERT INTO chat_group_members(group_id,user_id,is_admin) VALUES(?,?,?)', [gid, userId, userId === req.chatUser.id ? 1 : 0]);
    await conn.query('INSERT INTO chat_group_audit(group_id,actor_id,action) VALUES(?,?,?)', [gid, req.chatUser.id, 'CREATE_GROUP']);
    const notice = await groupNotice(conn, gid, req.chatUser.id, 'CREATE_GROUP', `${actorName(req)} created the group.`);
    await conn.commit();
    res.status(201).json({ conversationId: `g:${gid}` });
    await notifyGroupChange(gid, [req.chatUser.id, ...ids], notice);
  } catch (e) { await conn.rollback(); serverError(res, e); } finally { conn.release(); }
});
router.get('/groups/:id/members', async (req, res) => {
  const gid = id(req.params.id);
  if (!gid) return fail(res, 400, 'Invalid group.');
  try {
    if (!await membership(gid, req.chatUser.id)) return fail(res, 404, 'Group not found.');
    const [rows] = await sql.query(`SELECT ${userSelect('u')},gm.is_admin AS isAdmin FROM chat_group_members gm JOIN ${table} u ON u.${col(config.userIdColumn)}=gm.user_id WHERE gm.group_id=? ORDER BY gm.is_admin DESC,u.${col(config.usernameColumn)}`, [gid]);
    return res.json(rows.map(row => ({ ...userDto(row), isAdmin: !!row.isAdmin })));
  } catch (e) { return serverError(res, e); }
});
router.post('/groups/:id/members', async (req, res) => {
  const gid = id(req.params.id), newId = id(req.body?.userId);
  if (!gid || !newId) return fail(res, 400, 'Invalid group or user.');
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [gid]);
    if (!locked.length) throw httpError(404, 'Group not found.');
    const actor = await membership(gid, req.chatUser.id, conn);
    if (!actor?.is_admin) throw httpError(403, 'Only group admins can add members.');
    const newUser = await findUser(newId, conn);
    if (!eligible(newUser)) throw httpError(400, 'Selected user is unavailable.');
    const [[count]] = await conn.query('SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id=?', [gid]);
    if (Number(count.n) >= MAX_GROUP_MEMBERS) throw httpError(400, 'Group member limit reached.');
    const [[last]] = await conn.query('SELECT COALESCE(MAX(id),0) AS lastId FROM chat_group_messages WHERE group_id=?', [gid]);
    const [insert] = await conn.query('INSERT IGNORE INTO chat_group_members(group_id,user_id,joined_after_message_id,last_read_message_id) VALUES(?,?,?,?)', [gid, newId, last.lastId, last.lastId]);
    if (!insert.affectedRows) throw httpError(409, 'User is already a member.');
    await conn.query('INSERT INTO chat_group_audit(group_id,actor_id,target_user_id,action) VALUES(?,?,?,?)', [gid, req.chatUser.id, newId, 'ADD_MEMBER']);
    const notice = await groupNotice(conn, gid, req.chatUser.id, 'ADD_MEMBER', `${actorName(req)} added ${targetName(newUser)} to the group.`);
    const users = await groupUsers(gid, conn);
    await conn.commit();
    res.json({ success: true });
    await notifyGroupChange(gid, users, notice);
  } catch (e) { await conn.rollback(); serverError(res, e); } finally { conn.release(); }
});
router.delete('/groups/:id/members/:userId', async (req, res) => {
  const gid = id(req.params.id), target = id(req.params.userId), uid = req.chatUser.id;
  if (!gid || !target) return fail(res, 400, 'Invalid group or user.');
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [gid]);
    if (!locked.length) throw httpError(404, 'Group not found.');
    const actor = await membership(gid, uid, conn), member = await membership(gid, target, conn);
    if (!actor || !member) throw httpError(404, 'Membership not found.');
    if (uid !== target && !actor.is_admin) throw httpError(403, 'Only group admins can remove other members.');
    if (member.is_admin) {
      const [[count]] = await conn.query('SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id=? AND is_admin=1', [gid]);
      if (Number(count.n) <= 1) throw httpError(400, 'Assign another admin before removing the last admin.');
    }
    const affectedUser = await findUser(target, conn);
    await conn.query('DELETE FROM chat_group_members WHERE group_id=? AND user_id=?', [gid, target]);
    const action = uid === target ? 'LEAVE_GROUP' : 'REMOVE_MEMBER';
    await conn.query('INSERT INTO chat_group_audit(group_id,actor_id,target_user_id,action) VALUES(?,?,?,?)', [gid, uid, target, action]);
    const notice = await groupNotice(conn, gid, uid, action,
      uid === target ? `${actorName(req)} left the group.` : `${actorName(req)} removed ${targetName(affectedUser)} from the group.`);
    const users = await groupUsers(gid, conn);
    await conn.commit();
    res.json({ success: true });
    await notifyGroupChange(gid, [...users, target], null);
    await emit(users, 'chat:message', { message: notice, sender: { id: uid, fullName: 'Group activity' } });
  } catch (e) { await conn.rollback(); serverError(res, e); } finally { conn.release(); }
});
router.patch('/groups/:id/name', async (req, res) => {
  const gid = id(req.params.id), name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!gid || name.length < 2 || name.length > 100) return fail(res, 400, 'Invalid group name.');
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [gid]);
    if (!locked.length) throw httpError(404, 'Group not found.');
    if (!(await membership(gid, req.chatUser.id, conn))?.is_admin) throw httpError(403, 'Only a group admin can rename the group.');
    await conn.query('UPDATE chat_groups SET name=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [name, gid]);
    await conn.query('INSERT INTO chat_group_audit(group_id,actor_id,action) VALUES(?,?,?)', [gid, req.chatUser.id, 'RENAME_GROUP']);
    const notice = await groupNotice(conn, gid, req.chatUser.id, 'RENAME_GROUP', `${actorName(req)} renamed the group to ${name}.`);
    const users = await groupUsers(gid, conn);
    await conn.commit();
    res.json({ success: true });
    await notifyGroupChange(gid, users, notice);
  } catch (e) { await conn.rollback(); serverError(res, e); } finally { conn.release(); }
});
router.patch('/groups/:id/members/:userId/admin', async (req, res) => {
  const gid = id(req.params.id), target = id(req.params.userId);
  if (!gid || !target || req.body?.isAdmin !== true) return fail(res, 400, 'Invalid admin assignment.');
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [gid]);
    if (!locked.length) throw httpError(404, 'Group not found.');
    const actor = await membership(gid, req.chatUser.id, conn), member = await membership(gid, target, conn);
    if (!actor?.is_admin || !member) throw httpError(403, 'Admin authorization required.');
    if (member.is_admin) throw httpError(409, 'This member is already an admin.');
    const affectedUser = await findUser(target, conn);
    await conn.query('UPDATE chat_group_members SET is_admin=1 WHERE group_id=? AND user_id=?', [gid, target]);
    await conn.query('INSERT INTO chat_group_audit(group_id,actor_id,target_user_id,action) VALUES(?,?,?,?)', [gid, req.chatUser.id, target, 'GRANT_ADMIN']);
    const notice = await groupNotice(conn, gid, req.chatUser.id, 'GRANT_ADMIN', `${actorName(req)} made ${targetName(affectedUser)} a group admin.`);
    const users = await groupUsers(gid, conn);
    await conn.commit();
    res.json({ success: true });
    await notifyGroupChange(gid, users, notice);
  } catch (e) { await conn.rollback(); serverError(res, e); } finally { conn.release(); }
});
router.get(
  "/conversations/:id/messages",
  async (
    req,
    res
  ) => {
    const selection =
      selectedConversation(
        req.params.id
      );

    const before =
      req.query.before ===
      undefined
        ? null
        : id(
            req.query.before
          );

    if (
      !selection ||
      (
        req.query.before !==
          undefined &&
        !before
      )
    ) {
      return fail(
        res,
        400,
        "Invalid conversation or cursor."
      );
    }

    try {
      const params = [
        selection.value,
      ];

      let query;

      if (
        selection.kind ===
        "group"
      ) {
        const member =
          await membership(
            selection.value,
            req.chatUser.id
          );

        if (!member) {
          return fail(
            res,
            404,
            "Group not found."
          );
        }

        query = `
          SELECT
            m.*,
            u.full_name AS senderName,
            UNIX_TIMESTAMP(
              m.created_at
            ) * 1000 AS created_at_ms,
            (
              SELECT
                COUNT(*)
              FROM
                chat_group_members AS gm_seen
              WHERE
                gm_seen.group_id =
                  m.group_id
                AND gm_seen.user_id <>
                  m.sender_id
                AND gm_seen.last_read_message_id >=
                  m.id
            ) AS seenByCount,
            (
              SELECT
                COUNT(*)
              FROM
                chat_group_members AS gm_total
              WHERE
                gm_total.group_id =
                  m.group_id
                AND gm_total.user_id <>
                  m.sender_id
            ) AS recipientCount
          FROM
            chat_group_messages AS m
          LEFT JOIN
            users AS u
              ON u.id =
                m.sender_id
          WHERE
            m.group_id = ?
            AND m.id >
              ?
            ${
              before
                ? "AND m.id < ?"
                : ""
            }
          ORDER BY
            m.id DESC
          LIMIT 51
        `;

        params.push(
          member.joined_after_message_id
        );

        if (before) {
          params.push(
            before
          );
        }
      } else {
        if (
          !await direct(
            selection.value,
            req.chatUser.id
          )
        ) {
          return fail(
            res,
            404,
            "Conversation not found."
          );
        }

        query = `
          SELECT
            m.*,
            UNIX_TIMESTAMP(
              m.created_at
            ) * 1000 AS created_at_ms,
            UNIX_TIMESTAMP(
              m.read_at
            ) * 1000 AS read_at_ms
          FROM
            chat_messages AS m
          WHERE
            m.conversation_id = ?
            ${
              before
                ? "AND m.id < ?"
                : ""
            }
          ORDER BY
            m.id DESC
          LIMIT 51
        `;

        if (before) {
          params.push(
            before
          );
        }
      }

      const [rows] =
        await sql.query(
          query,
          params
        );

      const hasMore =
        rows.length >
        PAGE_SIZE;

      const result =
        await attachFiles(
          selection.kind,
          rows
            .slice(
              0,
              PAGE_SIZE
            )
            .reverse()
        );

      return res.json({
        messages:
          result.map(
            selection.kind ===
              "group"
              ? groupDto
              : directDto
          ),

        hasMore,
      });
    } catch (error) {
      return serverError(
        res,
        error
      );
    }
  }
);

router.post('/conversations/:id/messages', async (req, res) => {
  const selection = selectedConversation(req.params.id), body = cleanBody(req.body?.body);
  if (!selection || !body || body.length > MESSAGE_LIMIT) return fail(res, 400, 'Message must contain 1–2000 characters.');
  try {
    const saved = await saveMessage(selection, req.chatUser.id, body);
    res.status(201).json({ message: saved.message });
    await notifySaved(saved, req);
  } catch (e) { serverError(res, e); }
});
router.post('/conversations/:id/attachments/authorize', async (req, res) => {
  const selection = selectedConversation(req.params.id);
  const body = cleanBody(req.body?.body);
  if (!selection) return fail(res, 400, 'Invalid conversation.');
  if (body.length > MESSAGE_LIMIT) return fail(res, 400, 'Message must contain at most 2000 characters.');
  try {
    const files = validateUploadMetadata(req.body?.files);
    await authorizeSend(selection, req.chatUser.id);
    const uploads = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storageName = crypto.randomUUID();
      const objectPath = chatAttachmentObjectPath(storageName);
      const authorization = await createSignedUploadUrl(objectPath, { upsert: false });
      const descriptor = signChatUploadDescriptor({
        v: CHAT_UPLOAD_DESCRIPTOR_VERSION,
        uid: req.chatUser.id,
        kind: selection.kind,
        cid: selection.value,
        storageName,
        name: file.originalName,
        size: file.size,
        mime: file.mime,
        exp: Date.now() + CHAT_UPLOAD_TTL_MS,
      });
      uploads.push({
        clientIndex: index,
        originalName: file.originalName,
        size: file.size,
        mime: file.mime,
        kind: file.kind,
        signedUrl: authorization.signedUrl,
        descriptor,
      });
    }
    return res.json({
      success: true,
      uploads,
      expiresInSeconds: Math.floor(CHAT_UPLOAD_TTL_MS / 1000),
    });
  } catch (e) {
    return serverError(res, e);
  }
});
router.post('/conversations/:id/attachments', async (req, res) => {
  const selection = selectedConversation(req.params.id);
  const body = cleanBody(req.body?.body);
  if (!selection) return fail(res, 400, 'Invalid conversation.');
  if (body.length > MESSAGE_LIMIT) return fail(res, 400, 'Message must contain at most 2000 characters.');
  let files = [];
  try {
    files = await validateDirectUploadDescriptors(
      req.body?.directUploads,
      req.chatUser.id,
      selection
    );
    await authorizeSend(selection, req.chatUser.id);
    await verifyStoredChatUploads(files);
    const saved = await saveMessage(selection, req.chatUser.id, body, files);
    res.status(201).json({ message: saved.message });
    await notifySaved(saved, req);
  } catch (e) {
    if (files.length) {
      await removeUnreferencedChatObjects(files.map(file => file.storageName));
    }
    return serverError(res, e);
  }
});
router.post('/conversations/:id/attachments/cleanup', async (req, res) => {
  const selection = selectedConversation(req.params.id);
  if (!selection) return fail(res, 400, 'Invalid conversation.');
  try {
    const files = await validateDirectUploadDescriptors(
      req.body?.directUploads,
      req.chatUser.id,
      selection,
      { allowExpired: true }
    );
    await removeUnreferencedChatObjects(files.map(file => file.storageName));
    return res.json({ success: true });
  } catch (e) {
    return serverError(res, e);
  }
});
router.get('/attachments/:id/download', async (req, res) => {
  const attachmentId = id(req.params.id), uid = req.chatUser.id;
  if (!attachmentId) return fail(res, 400, 'Invalid attachment.');
  try {
    const [rows] = await sql.query('SELECT * FROM chat_attachments WHERE id=? LIMIT 1', [attachmentId]);
    const file = rows[0];
    if (!file) return fail(res, 404, 'Attachment not found.');
    if (file.conversation_type === 'direct') {
      const [message] = await sql.query('SELECT conversation_id FROM chat_messages WHERE id=?', [file.message_id]);
      if (!message[0] || !await direct(message[0].conversation_id, uid)) {
        return fail(res, 404, 'Attachment not found.');
      }
    } else if (file.conversation_type === 'group') {
      const [message] = await sql.query('SELECT group_id FROM chat_group_messages WHERE id=?', [file.message_id]);
      if (!message[0]) return fail(res, 404, 'Attachment not found.');
      const member = await membership(message[0].group_id, uid);
      if (!member || BigInt(file.message_id) <= BigInt(member.joined_after_message_id)) {
        return fail(res, 404, 'Attachment not found.');
      }
    } else {
      return fail(res, 404, 'Attachment not found.');
    }
    const storageName = String(file.storage_name || '');
    if (!UUID_V4_PATTERN.test(storageName)) return fail(res, 404, 'Attachment not found.');
    const signed = await createSignedDownloadUrl(
      chatAttachmentObjectPath(storageName),
      { expiresIn: 60 }
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      downloadUrl: signed.signedUrl,
      filename: safeFilename(file.original_name),
      expiresIn: signed.expiresIn,
    });
  } catch (e) {
    return serverError(res, e);
  }
});
router.post('/conversations/:id/read', async (req, res) => {
  const selection = selectedConversation(req.params.id), uid = req.chatUser.id;
  if (!selection) return fail(res, 400, 'Invalid conversation.');

  try {
    let updated = 0;
    let users = [];
    let readState = null;

    if (selection.kind === 'group') {
      const conn = await sql.getConnection();

      try {
        await conn.beginTransaction();

        const [lockedGroup] = await conn.query(
          'SELECT id FROM chat_groups WHERE id=? FOR UPDATE',
          [selection.value]
        );

        if (!lockedGroup.length) {
          throw httpError(404, 'Group not found.');
        }

        const [memberRows] = await conn.query(
          `SELECT
             joined_after_message_id,
             last_read_message_id
           FROM chat_group_members
           WHERE group_id=? AND user_id=?
           LIMIT 1
           FOR UPDATE`,
          [selection.value, uid]
        );

        const member = memberRows[0];

        if (!member) {
          throw httpError(404, 'Not a group member.');
        }

        const [[last]] = await conn.query(
          'SELECT COALESCE(MAX(id),0) AS n FROM chat_group_messages WHERE group_id=?',
          [selection.value]
        );

        const previousReadId = BigInt(
          member.last_read_message_id ?? 0
        );

        const joinedAfterMessageId = BigInt(
          member.joined_after_message_id ?? 0
        );

        const latestMessageId = BigInt(
          last?.n ?? 0
        );

        await conn.query(
          `UPDATE chat_group_members
           SET last_read_message_id =
             CASE
               WHEN COALESCE(last_read_message_id, 0) < ?
                 THEN ?
               ELSE COALESCE(last_read_message_id, 0)
             END
           WHERE group_id=? AND user_id=?`,
          [
            latestMessageId.toString(),
            latestMessageId.toString(),
            selection.value,
            uid,
          ]
        );

        const [persistedRows] = await conn.query(
          `SELECT
             COALESCE(last_read_message_id, 0) AS lastReadMessageId
           FROM chat_group_members
           WHERE group_id=? AND user_id=?
           LIMIT 1`,
          [selection.value, uid]
        );

        if (!persistedRows.length) {
          throw httpError(500, 'Unable to save group read state.');
        }

        const persistedReadId = BigInt(
          persistedRows[0].lastReadMessageId ?? 0
        );

        if (persistedReadId < latestMessageId) {
          throw httpError(500, 'Unable to save group read state.');
        }

        const [[remaining]] = await conn.query(
          `SELECT COUNT(*) AS n
           FROM chat_group_messages m
           WHERE
             m.group_id=?
             AND m.id > GREATEST(?, ?)
             AND m.sender_id<>?
             AND m.system_action IS NULL`,
          [
            selection.value,
            joinedAfterMessageId.toString(),
            persistedReadId.toString(),
            uid,
          ]
        );

        updated =
          persistedReadId > previousReadId
            ? 1
            : 0;

        users =
          updated
            ? await groupUsers(selection.value, conn)
            : [];

        readState = {
          lastReadMessageId:
            persistedReadId.toString(),
          latestMessageId:
            latestMessageId.toString(),
          unreadCount:
            Number(remaining?.n || 0),
        };

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } else {
      const conversation = await direct(selection.value, uid);

      if (!conversation) {
        return fail(res, 404, 'Conversation not found.');
      }

      const [result] = await sql.query(
        'UPDATE chat_messages SET read_at=UTC_TIMESTAMP(3) WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL',
        [selection.value, uid]
      );

      updated = Number(result.affectedRows);
      users = [
        Number(conversation.user1_id),
        Number(conversation.user2_id),
      ];
    }

    res.json({
      updated,
      ...(readState || {}),
    });

    if (updated) {
      await emit(
        users,
        'chat:read',
        {
          conversationId:
            req.params.id,
          readerId:
            uid,
          readAt:
            new Date().toISOString(),
        }
      );
    }
  } catch (e) {
    serverError(res, e);
  }
});
module.exports = router;