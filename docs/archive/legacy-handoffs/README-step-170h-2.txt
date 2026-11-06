WELLJOB SOLUTIONS — STEP 170H-2
Vercel-safe Messenger polling transport

Replace:
frontend/src/context/ChatContext.jsx
frontend/src/pages/Messenger.jsx

What changes:
- Removes the Socket.IO client connection from ChatContext.
- Uses authenticated REST polling for unread count and toast notifications.
- Polls active Messenger conversations every 4 seconds.
- Polls global notification state every 5 seconds.
- Preserves read receipts, group refresh, unread badges, toast notifications,
  message sending, and Supabase-backed PDF attachments.
- Keeps context.socket = null for compatibility with any component that still reads it.

What does NOT change:
- Backend REST authorization rules
- Aiven database schema/data
- Supabase attachment storage
- chatApi.js from STEP 170H-1
- backend/services/chatSocket.js (unused by the Vercel app runtime)
