-- Cove Core — Managed message lifecycle, read state, and audit events
-- Migration: 003_message_lifecycle.sql

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, account_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS channel_read_states (
    channel_id           TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    account_id           TEXT NOT NULL,
    last_read_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    updated_at           TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (channel_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_read_states_account ON channel_read_states(account_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id           TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    actor_id     TEXT NOT NULL,
    action       TEXT NOT NULL CHECK (action IN (
        'message.edited',
        'message.deleted',
        'message.reaction.added',
        'message.reaction.removed'
    )),
    target_type  TEXT NOT NULL CHECK (target_type = 'message'),
    target_id    TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_community_created
    ON audit_events(community_id, created_at DESC);
