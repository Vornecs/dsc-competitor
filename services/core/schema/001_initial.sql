-- Cove Core — Initial PostgreSQL Schema
-- Migration: 001_initial.sql
-- Applies to: cove database (create externally or via docker-compose)

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
    email       TEXT PRIMARY KEY,
    data        JSONB NOT NULL,        -- serialized Account (from @cove/contracts)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email verification challenges
CREATE TABLE IF NOT EXISTS email_challenges (
    key          TEXT PRIMARY KEY,      -- email or challenge lookup key
    code         TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    expires_at   BIGINT NOT NULL,       -- epoch ms
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WebAuthn passkey credentials
CREATE TABLE IF NOT EXISTS passkeys (
    id                 BIGSERIAL PRIMARY KEY,
    email              TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
    credential_id      TEXT NOT NULL,
    raw_id             TEXT NOT NULL,
    attestation_object TEXT NOT NULL,
    client_data_json   TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passkeys_email ON passkeys(email);

-- Device sessions
CREATE TABLE IF NOT EXISTS sessions (
    token                  TEXT PRIMARY KEY,
    email                  TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
    device_name            TEXT NOT NULL,
    ip_address             TEXT NOT NULL,
    last_active_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    registration_challenge TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

-- Communities
CREATE TABLE IF NOT EXISTS communities (
    id         TEXT PRIMARY KEY,
    data       JSONB NOT NULL,         -- serialized Community
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships (community_id + account_id is unique)
CREATE TABLE IF NOT EXISTS memberships (
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    account_id   TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    role_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string array of assigned role IDs
    PRIMARY KEY (community_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_account ON memberships(account_id);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id           TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    data         JSONB NOT NULL,       -- serialized Channel
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channels_community ON channels(community_id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id           TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    data         JSONB NOT NULL,       -- serialized Role
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_community ON roles(community_id);

-- Invites
CREATE TABLE IF NOT EXISTS invites (
    id           TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    code         TEXT NOT NULL UNIQUE,
    data         JSONB NOT NULL,       -- serialized Invite
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invites_community ON invites(community_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    data            JSONB NOT NULL,    -- serialized Message
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);

-- Idempotency keys (for retry-safe mutations)
CREATE TABLE IF NOT EXISTS idempotency (
    key         TEXT PRIMARY KEY,
    message_id  TEXT NOT NULL,
    data        JSONB NOT NULL,        -- serialized Message stored on first attempt
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
