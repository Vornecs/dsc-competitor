-- Migration: 005_operator_diagnostics.sql

-- Update CHECK constraints for audit_events action and target_type
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_target_type_check;

ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
    'message.edited',
    'message.deleted',
    'message.reaction.added',
    'message.reaction.removed',
    'member.joined',
    'member.left',
    'member.role_assigned',
    'member.role_removed',
    'member.banned',
    'member.unbanned',
    'channel.created',
    'channel.deleted',
    'role.created',
    'role.updated',
    'role.deleted',
    'invite.created',
    'invite.revoked',
    'invite.used'
));

ALTER TABLE audit_events ADD CONSTRAINT audit_events_target_type_check CHECK (target_type IN ('message', 'member', 'channel', 'role', 'invite'));

-- Bans Table
CREATE TABLE IF NOT EXISTS bans (
    community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    account_id   TEXT NOT NULL,
    reason       TEXT,
    actor_id     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (community_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_bans_community ON bans(community_id);
