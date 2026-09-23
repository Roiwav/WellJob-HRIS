/** WELLJOB Messenger: direct chats, groups, activity notices and private PDF batches. */
const express = require('express');
const db = require('../config/db');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { chatAuth, isChatRole, normalizeRole } = require('../middleware/chatAuth');
const { config, col, table, userSelect } = require('../config/chatConfig');
const { publishToUsers } = require('../services/chatSocket');

const router = express.Router();
router.use(chatAuth);
const sql = db.promise();
const MAX_BATCH_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 30;
const MESSAGE_LIMIT = 2000;
const PAGE_SIZE = 50;
const MAX_GROUP_MEMBERS = 30;
const PRIVATE_FOLDER = path.resolve(__dirname, '../private_chat_uploads');

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
  return path.basename(String(name || 'attachment.pdf').replace(/\\/g, '/'))
    .replace(/[\x00-\x1f\x7f"<>:|?*]/g, '_').slice(0, 240) || 'attachment.pdf';
}
function validPdf(buf) {
  return Buffer.isBuffer(buf) && buf.length > 0 && buf.length <= MAX_BATCH_BYTES &&
    buf.subarray(0, 5).toString('ascii') === '%PDF-' &&
    buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1').includes('%%EOF');
}

/** Bounded *combined* memory buffering, including chunked multipart requests. */
const boundedStorage = {
  _handleFile(req, file, callback) {
    const chunks = [];
    let size = 0;
    let completed = false;
    function finish(error, result) {
      if (completed) return;
      completed = true;
      callback(error, result);
    }
    file.stream.on('data', chunk => {
      if (completed) return;
      size += chunk.length;
      req.chatUploadBytes = (req.chatUploadBytes || 0) + chunk.length;
      if (req.chatUploadBytes > MAX_BATCH_BYTES) {
        file.stream.resume();
        finish(httpError(413, 'Combined PDF size must not exceed 15 MB.'));
        return;
      }
      chunks.push(chunk);
    });
    file.stream.on('error', error => finish(error));
    file.stream.on('end', () => {
      if (!completed) finish(null, { buffer: Buffer.concat(chunks, size), size });
    });
  },
  _removeFile(req, file, callback) { delete file.buffer; callback(null); },
};
const upload = multer({
  storage: boundedStorage,
  limits: { fileSize: MAX_BATCH_BYTES, files: MAX_FILES, fields: 1, parts: MAX_FILES + 1 },
  fileFilter(req, file, cb) {
    if (path.extname(file.originalname || '').toLowerCase() !== '.pdf' ||
        (file.mimetype && file.mimetype !== 'application/pdf')) {
      return cb(httpError(400, 'Only PDF attachments are allowed.'));
    }
    cb(null, true);
  },
}).fields([{ name: 'files', maxCount: MAX_FILES }, { name: 'file', maxCount: 1 }]);

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
async function emit(users, eventName, payload) {
  try { await publishToUsers(users, eventName, payload); }
  catch (e) { console.error('CHAT SOCKET ERROR:', e); }
}

function attachmentsForRow(row) { return Array.isArray(row.attachments) ? row.attachments : []; }
function directDto(row) {
  const attachments = attachmentsForRow(row);
  return { id: String(row.id), conversationId: String(row.conversation_id),
    senderId: Number(row.sender_id), body: row.body, createdAt: row.created_at,
    readAt: row.read_at, attachments, attachment: attachments[0] || null, isSystem: false };
}
function groupDto(row) {
  const attachments = attachmentsForRow(row);
  return { id: String(row.id), conversationId: `g:${row.group_id}`,
    senderId: Number(row.sender_id), senderName: row.senderName || null, body: row.body,
    createdAt: row.created_at, readAt: null, attachments, attachment: attachments[0] || null,
    isSystem: Boolean(row.system_action), systemAction: row.system_action || null };
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
async function fetchMessage(kind, messageId, conn = sql) {
  const [rows] = kind === 'group'
    ? await conn.query('SELECT m.*,u.full_name AS senderName FROM chat_group_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.id=? LIMIT 1', [messageId])
    : await conn.query('SELECT * FROM chat_messages WHERE id=? LIMIT 1', [messageId]);
  if (!rows.length) return null;
  const enriched = await attachFiles(kind, rows, conn);
  return kind === 'group' ? groupDto(enriched[0]) : directDto(enriched[0]);
}
/** Mutations are serialized on chat_groups row. Store genuine, server-generated system messages. */
async function groupNotice(conn, groupIdValue, actorId, action, text) {
  const [insert] = await conn.query('INSERT INTO chat_group_messages(group_id,sender_id,body,system_action) VALUES(?,?,?,?)', [groupIdValue, actorId, text, action]);
  await conn.query('UPDATE chat_groups SET updated_at=CURRENT_TIMESTAMP(3) WHERE id=?', [groupIdValue]);
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
  const writtenPaths = [];
  try {
    await conn.beginTransaction();
    let receiver = null;
    if (selection.kind === 'group') {
      const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [selection.value]);
      if (!locked.length) throw httpError(404, 'Group not found.');
      if (!await membership(selection.value, senderId, conn)) throw httpError(403, 'You are not a member of this group.');
    } else {
      const conversation = await direct(selection.value, senderId, conn);
      if (!conversation) throw httpError(404, 'Conversation not found.');
      receiver = Number(conversation.user1_id) === senderId ? Number(conversation.user2_id) : Number(conversation.user1_id);
      if (!eligible(await findUser(receiver, conn))) throw httpError(403, 'Recipient is unavailable.');
    }
    const target = selection.kind === 'group' ? 'chat_group_messages' : 'chat_messages';
    const foreignKey = selection.kind === 'group' ? 'group_id' : 'conversation_id';
    const [insert] = await conn.query(`INSERT INTO ${target}(${foreignKey},sender_id,body) VALUES(?,?,?)`, [selection.value, senderId, body]);
    if (files.length) {
      await fs.mkdir(PRIVATE_FOLDER, { recursive: true, mode: 0o700 });
      for (const file of files) {
        const storageName = crypto.randomUUID();
        const disk = path.join(PRIVATE_FOLDER, storageName);
        await fs.writeFile(disk, file.buffer, { flag: 'wx', mode: 0o600 });
        writtenPaths.push(disk);
        await conn.query('INSERT INTO chat_attachments(conversation_type,message_id,storage_name,original_name,byte_size) VALUES(?,?,?,?,?)', [selection.kind, insert.insertId, storageName, safeFilename(file.originalname), file.size]);
      }
    }
    await conn.query(`UPDATE ${selection.kind === 'group' ? 'chat_groups' : 'chat_conversations'} SET updated_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [selection.value]);
    const users = selection.kind === 'group' ? await groupUsers(selection.value, conn) : [senderId, receiver];
    const message = await fetchMessage(selection.kind, insert.insertId, conn);
    await conn.commit();
    return { users, message };
  } catch (error) {
    await conn.rollback();
    await Promise.all(writtenPaths.map(file => fs.unlink(file).catch(() => {})));
    throw error;
  } finally { conn.release(); }
}
async function notifySaved(saved, req) {
  await emit(saved.users, 'chat:message', { message: saved.message,
    sender: { id: req.chatUser.id, username: req.chatUser.username, fullName: req.chatUser.fullName } });
}

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
    const [[g]] = await sql.query('SELECT COUNT(*) AS n FROM chat_group_messages m JOIN chat_group_members gm ON gm.group_id=m.group_id WHERE gm.user_id=? AND m.id>GREATEST(gm.joined_after_message_id,gm.last_read_message_id) AND m.sender_id<>?', [uid, uid]);
    return res.json({ unreadCount: Number(d.n) + Number(g.n) });
  } catch (e) { return serverError(res, e); }
});
router.get('/conversations', async (req, res) => {
  try {
    const uid = req.chatUser.id;
    const [directRows] = await sql.query(`SELECT c.id AS conversationId,c.created_at AS createdAt,c.updated_at AS updatedAt,${userSelect('u')},u.${col('status')} AS accountStatus,u.${col('assigned_company')} AS assignedCompany,
      (SELECT IF((SELECT COUNT(*) FROM chat_attachments a WHERE a.conversation_type='direct' AND a.message_id=m.id)>0,IF(m.body='', 'PDF attachments',CONCAT(m.body,' · PDF attachments')),m.body) FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastBody,
      (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastAt,
      (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) AS unreadCount
      FROM chat_conversations c JOIN ${table} u ON u.${col(config.userIdColumn)}=IF(c.user1_id=?,c.user2_id,c.user1_id) WHERE c.user1_id=? OR c.user2_id=?`, [uid, uid, uid, uid]);
    const [groupRows] = await sql.query(`SELECT g.id,g.name,g.created_at AS createdAt,g.updated_at AS updatedAt,gm.is_admin AS isAdmin,
      (SELECT IF(m.system_action IS NOT NULL,m.body,IF((SELECT COUNT(*) FROM chat_attachments a WHERE a.conversation_type='group' AND a.message_id=m.id)>0,IF(m.body='', 'PDF attachments',CONCAT(m.body,' · PDF attachments')),m.body)) FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>gm.joined_after_message_id ORDER BY m.id DESC LIMIT 1) AS lastBody,
      (SELECT m.created_at FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>gm.joined_after_message_id ORDER BY m.id DESC LIMIT 1) AS lastAt,
      (SELECT COUNT(*) FROM chat_group_messages m WHERE m.group_id=g.id AND m.id>GREATEST(gm.joined_after_message_id,gm.last_read_message_id) AND m.sender_id<>?) AS unreadCount
      FROM chat_groups g JOIN chat_group_members gm ON gm.group_id=g.id WHERE gm.user_id=?`, [uid, uid]);
    const directs = directRows.map(r => ({ id: String(r.conversationId), kind: 'direct', createdAt: r.createdAt, updatedAt: r.updatedAt,
      partner: userDto(r), canMessage: eligible(r), lastBody: r.lastBody, lastAt: r.lastAt, unreadCount: Number(r.unreadCount) }));
    const groups = groupRows.map(r => ({ id: `g:${r.id}`, kind: 'group', name: r.name, isAdmin: !!r.isAdmin,
      createdAt: r.createdAt, updatedAt: r.updatedAt, lastBody: r.lastBody, lastAt: r.lastAt, unreadCount: Number(r.unreadCount), canMessage: true }));
    // Last actual message time controls priority; empty threads fall back to creation date.
    return res.json([...directs, ...groups].sort((a, b) =>
      new Date(b.lastAt || b.createdAt).getTime() - new Date(a.lastAt || a.createdAt).getTime()));
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
    await conn.query('UPDATE chat_groups SET name=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?', [name, gid]);
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

router.get('/conversations/:id/messages', async (req, res) => {
  const selection = selectedConversation(req.params.id);
  const before = req.query.before === undefined ? null : id(req.query.before);
  if (!selection || (req.query.before !== undefined && !before)) return fail(res, 400, 'Invalid conversation or cursor.');
  try {
    const params = [selection.value];
    let query;
    if (selection.kind === 'group') {
      const member = await membership(selection.value, req.chatUser.id);
      if (!member) return fail(res, 404, 'Group not found.');
      query = `SELECT m.*,u.full_name AS senderName FROM chat_group_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.group_id=? AND m.id>? ${before ? 'AND m.id<?' : ''} ORDER BY m.id DESC LIMIT 51`;
      params.push(member.joined_after_message_id);
      if (before) params.push(before);
    } else {
      if (!await direct(selection.value, req.chatUser.id)) return fail(res, 404, 'Conversation not found.');
      query = `SELECT m.* FROM chat_messages m WHERE m.conversation_id=? ${before ? 'AND m.id<?' : ''} ORDER BY m.id DESC LIMIT 51`;
      if (before) params.push(before);
    }
    const [rows] = await sql.query(query, params);
    const hasMore = rows.length > PAGE_SIZE;
    const result = await attachFiles(selection.kind, rows.slice(0, PAGE_SIZE).reverse());
    return res.json({ messages: result.map(selection.kind === 'group' ? groupDto : directDto), hasMore });
  } catch (e) { return serverError(res, e); }
});
router.post('/conversations/:id/messages', async (req, res) => {
  const selection = selectedConversation(req.params.id), body = cleanBody(req.body?.body);
  if (!selection || !body || body.length > MESSAGE_LIMIT) return fail(res, 400, 'Message must contain 1–2000 characters.');
  try {
    const saved = await saveMessage(selection, req.chatUser.id, body);
    res.status(201).json({ message: saved.message });
    await notifySaved(saved, req);
  } catch (e) { serverError(res, e); }
});
router.post('/conversations/:id/attachments', (req, res) => {
  const selection = selectedConversation(req.params.id);
  if (!selection) return fail(res, 400, 'Invalid conversation.');
  upload(req, res, async error => {
    if (error) {
      const status = error.status || (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_PART_COUNT' ? 413 : 400);
      return fail(res, status, error.status ? error.message : 'PDF upload exceeded the 15 MB total or file count limit.');
    }
    const files = [...(req.files?.files || []), ...(req.files?.file || [])];
    const body = cleanBody(req.body?.body);
    if (!files.length || files.length > MAX_FILES || body.length > MESSAGE_LIMIT)
      return fail(res, 400, 'Choose PDF files and keep your message within 2000 characters.');
    if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES)
      return fail(res, 413, 'Combined PDF size must not exceed 15 MB.');
    if (files.some(file => !validPdf(file.buffer)))
      return fail(res, 400, 'Every attachment must be a valid PDF (15 MB combined maximum).');
    try {
      const saved = await saveMessage(selection, req.chatUser.id, body, files);
      res.status(201).json({ message: saved.message });
      await notifySaved(saved, req);
    } catch (e) { serverError(res, e); }
  });
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
      if (!message[0] || !await direct(message[0].conversation_id, uid)) return fail(res, 404, 'Attachment not found.');
    } else {
      const [message] = await sql.query('SELECT group_id FROM chat_group_messages WHERE id=?', [file.message_id]);
      if (!message[0]) return fail(res, 404, 'Attachment not found.');
      const member = await membership(message[0].group_id, uid);
      if (!member || BigInt(file.message_id) <= BigInt(member.joined_after_message_id)) return fail(res, 404, 'Attachment not found.');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(file.storage_name))
      return fail(res, 404, 'Attachment not found.');
    const disk = path.join(PRIVATE_FOLDER, file.storage_name);
    const filename = safeFilename(file.original_name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.setHeader('Content-Disposition', `attachment; filename="attachment.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.sendFile(disk, e => { if (e && !res.headersSent) serverError(res, e); });
  } catch (e) { return serverError(res, e); }
});
router.post('/conversations/:id/read', async (req, res) => {
  const selection = selectedConversation(req.params.id), uid = req.chatUser.id;
  if (!selection) return fail(res, 400, 'Invalid conversation.');
  try {
    let updated = 0, users = [];
    if (selection.kind === 'group') {
      const conn = await sql.getConnection();
      try {
        await conn.beginTransaction();
        const [locked] = await conn.query('SELECT id FROM chat_groups WHERE id=? FOR UPDATE', [selection.value]);
        if (!locked.length) throw httpError(404, 'Group not found.');
        if (!await membership(selection.value, uid, conn)) throw httpError(404, 'Not a group member.');
        const [[last]] = await conn.query('SELECT COALESCE(MAX(id),0) AS n FROM chat_group_messages WHERE group_id=?', [selection.value]);
        await conn.query('UPDATE chat_group_members SET last_read_message_id=GREATEST(last_read_message_id,?) WHERE group_id=? AND user_id=?', [last.n, selection.value, uid]);
        updated = 1;
        users = await groupUsers(selection.value, conn);
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    } else {
      const conversation = await direct(selection.value, uid);
      if (!conversation) return fail(res, 404, 'Conversation not found.');
      const [result] = await sql.query('UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP(3) WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL', [selection.value, uid]);
      updated = Number(result.affectedRows);
      users = [Number(conversation.user1_id), Number(conversation.user2_id)];
    }
    res.json({ updated });
    if (updated) await emit(users, 'chat:read', { conversationId: req.params.id, readerId: uid, readAt: new Date().toISOString() });
  } catch (e) { serverError(res, e); }
});
module.exports = router;
