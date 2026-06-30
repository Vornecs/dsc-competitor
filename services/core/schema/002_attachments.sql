-- Cove Core — Attachment Pipeline
-- Migration: 002_attachments.sql

CREATE TABLE IF NOT EXISTS attachments (
    id                TEXT PRIMARY KEY,
    channel_id        TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    uploader_id       TEXT NOT NULL,
    filename          TEXT NOT NULL,
    mime_type         TEXT NOT NULL,
    size              BIGINT NOT NULL,
    storage_key       TEXT NOT NULL UNIQUE,
    quarantine_status TEXT NOT NULL CHECK (quarantine_status IN ('pending', 'approved', 'rejected')),
    uploaded_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_channel  ON attachments(channel_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader_id);
