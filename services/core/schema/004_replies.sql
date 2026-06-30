-- Cove Core — Same-channel message replies
-- Migration: 004_replies.sql

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
