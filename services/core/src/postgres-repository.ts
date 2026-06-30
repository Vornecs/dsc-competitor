/**
 * PostgreSQL repository — production-persistence adapter implementing the
 * full Repository interface against a PostgreSQL database.
 *
 * Connection string is read from DATABASE_URL (env) with a fallback to
 * the local docker-compose default.
 */

import type {
  Account,
  AuditEvent,
  Channel,
  ChannelReadState,
  Community,
  Invite,
  Message,
  Role,
} from '@cove/contracts';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  AttachmentRecord,
  EmailChallenge,
  Membership,
  PasskeyCredential,
  Repository,
  SessionRecord,
} from './repository.js';

// ---------------------------------------------------------------------------
// Row shapes returned by PostgreSQL queries
// ---------------------------------------------------------------------------

interface AccountRow extends QueryResultRow {
  email: string;
  data: Account;
}

interface EmailChallengeRow extends QueryResultRow {
  key: string;
  code: string;
  challenge_id: string;
  expires_at: string; // bigint arrives as string from pg
}

interface PasskeyRow extends QueryResultRow {
  email: string;
  credential_id: string;
  raw_id: string;
  attestation_object: string;
  client_data_json: string;
}

interface SessionRow extends QueryResultRow {
  token: string;
  email: string;
  device_name: string;
  ip_address: string;
  last_active_at: string;
  registration_challenge: string | null;
}

interface CommunityRow extends QueryResultRow {
  id: string;
  data: Community;
}

interface MembershipRow extends QueryResultRow {
  community_id: string;
  account_id: string;
  role: 'owner' | 'admin' | 'member';
  role_ids: string[];
}

interface ChannelRow extends QueryResultRow {
  id: string;
  community_id: string;
  data: Channel;
}

interface RoleRow extends QueryResultRow {
  id: string;
  community_id: string;
  data: Role;
}

interface InviteRow extends QueryResultRow {
  id: string;
  community_id: string;
  code: string;
  data: Invite;
}

interface MessageRow extends QueryResultRow {
  id: string;
  channel_id: string;
  data: Message;
}

interface IdempotencyRow extends QueryResultRow {
  key: string;
  message_id: string;
  data: Message;
}

interface MessageReactionRow extends QueryResultRow {
  message_id: string;
  account_id: string;
  emoji: string;
  created_at: string;
}

interface ChannelReadStateRow extends QueryResultRow {
  channel_id: string;
  account_id: string;
  last_read_message_id: string;
  updated_at: string;
}

interface AuditEventRow extends QueryResultRow {
  id: string;
  community_id: string;
  actor_id: string;
  action: AuditEvent['action'];
  target_type: 'message';
  target_id: string;
  metadata: AuditEvent['metadata'];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPostgresRepository(pool: Pool): Repository {
  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const query = async <T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> => {
    const result = await pool.query<T>(text, params);
    return result.rows;
  };

  const queryOne = async <T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | undefined> => {
    const rows = await query<T>(text, params);
    return rows[0];
  };

  // -----------------------------------------------------------------------
  // Repository implementation
  // -----------------------------------------------------------------------

  return {
    // -- Accounts -----------------------------------------------------------

    getAccountByEmail(email) {
      return queryOne<AccountRow>('SELECT data FROM accounts WHERE email = $1', [email]).then(
        (row) => row?.data,
      );
    },

    async setAccount(email, account) {
      await pool.query(
        `INSERT INTO accounts (email, data) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET data = $2`,
        [email, JSON.stringify(account)],
      );
    },

    // -- Email challenges ---------------------------------------------------

    async getEmailChallenge(key) {
      const row = await queryOne<EmailChallengeRow>(
        'SELECT code, challenge_id, expires_at FROM email_challenges WHERE key = $1',
        [key],
      );
      if (!row) return undefined;
      return {
        code: row.code,
        challengeId: row.challenge_id,
        expiresAt: Number(row.expires_at),
      };
    },

    async setEmailChallenge(key, challenge) {
      await pool.query(
        `INSERT INTO email_challenges (key, code, challenge_id, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET code = $2, challenge_id = $3, expires_at = $4`,
        [key, challenge.code, challenge.challengeId, challenge.expiresAt],
      );
    },

    async deleteEmailChallenge(key) {
      await pool.query('DELETE FROM email_challenges WHERE key = $1', [key]);
    },

    // -- Passkeys -----------------------------------------------------------

    async getPasskeys(email) {
      const rows = await query<PasskeyRow>(
        'SELECT credential_id, raw_id, attestation_object, client_data_json FROM passkeys WHERE email = $1',
        [email],
      );
      return rows.map((r) => ({
        credentialId: r.credential_id,
        rawId: r.raw_id,
        attestationObject: r.attestation_object,
        clientDataJSON: r.client_data_json,
      }));
    },

    async addPasskey(email, credential) {
      await pool.query(
        `INSERT INTO passkeys (email, credential_id, raw_id, attestation_object, client_data_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          email,
          credential.credentialId,
          credential.rawId,
          credential.attestationObject,
          credential.clientDataJSON,
        ],
      );
    },

    // -- Sessions -----------------------------------------------------------

    async getSession(token) {
      const row = await queryOne<SessionRow>(
        'SELECT email, device_name, ip_address, last_active_at, registration_challenge FROM sessions WHERE token = $1',
        [token],
      );
      if (!row) return undefined;
      return {
        sessionId: token,
        email: row.email,
        deviceName: row.device_name,
        ipAddress: row.ip_address,
        lastActiveAt: row.last_active_at,
        ...(row.registration_challenge
          ? { registrationChallenge: row.registration_challenge }
          : {}),
      };
    },

    async setSession(token, session) {
      await pool.query(
        `INSERT INTO sessions (token, email, device_name, ip_address, last_active_at, registration_challenge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (token) DO UPDATE SET
           email = $2, device_name = $3, ip_address = $4,
           last_active_at = $5, registration_challenge = $6`,
        [
          token,
          session.email,
          session.deviceName,
          session.ipAddress,
          session.lastActiveAt,
          session.registrationChallenge ?? null,
        ],
      );
    },

    async deleteSession(token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    },

    async listSessionsByEmail(email) {
      const rows = await query<SessionRow>(
        'SELECT token, email, device_name, ip_address, last_active_at, registration_challenge FROM sessions WHERE email = $1',
        [email],
      );
      return rows.map((r) => ({
        token: r.token,
        session: {
          sessionId: r.token,
          email: r.email,
          deviceName: r.device_name,
          ipAddress: r.ip_address,
          lastActiveAt: r.last_active_at,
          ...(r.registration_challenge ? { registrationChallenge: r.registration_challenge } : {}),
        },
      }));
    },

    // -- Communities --------------------------------------------------------

    async getCommunity(id) {
      const row = await queryOne<CommunityRow>('SELECT data FROM communities WHERE id = $1', [id]);
      return row?.data;
    },

    async setCommunity(community) {
      await pool.query(
        `INSERT INTO communities (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = $2`,
        [community.id, JSON.stringify(community)],
      );
    },

    async deleteCommunity(id) {
      await pool.query('DELETE FROM communities WHERE id = $1', [id]);
    },

    async listCommunitiesForAccount(accountId) {
      const rows = await query<CommunityRow>(
        `SELECT c.data FROM communities c
         INNER JOIN memberships m ON m.community_id = c.id
         WHERE m.account_id = $1`,
        [accountId],
      );
      return rows.map((r) => r.data);
    },

    // -- Memberships --------------------------------------------------------

    async getMemberships(communityId) {
      const rows = await query<MembershipRow>(
        'SELECT account_id, role, role_ids FROM memberships WHERE community_id = $1',
        [communityId],
      );
      return rows.map((r) => ({
        accountId: r.account_id,
        role: r.role,
        roleIds: r.role_ids,
      }));
    },

    async getMembership(communityId, accountId) {
      const row = await queryOne<MembershipRow>(
        'SELECT account_id, role, role_ids FROM memberships WHERE community_id = $1 AND account_id = $2',
        [communityId, accountId],
      );
      if (!row) return undefined;
      return { accountId: row.account_id, role: row.role, roleIds: row.role_ids };
    },

    async addMembership(communityId, membership) {
      await pool.query(
        `INSERT INTO memberships (community_id, account_id, role, role_ids)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (community_id, account_id) DO UPDATE SET role = $3, role_ids = $4`,
        [communityId, membership.accountId, membership.role, JSON.stringify(membership.roleIds)],
      );
    },

    async removeMembership(communityId, accountId) {
      await pool.query('DELETE FROM memberships WHERE community_id = $1 AND account_id = $2', [
        communityId,
        accountId,
      ]);
    },

    async clearMemberships(communityId) {
      await pool.query('DELETE FROM memberships WHERE community_id = $1', [communityId]);
    },

    // -- Channels -----------------------------------------------------------

    async getChannelsByCommunity(communityId) {
      const rows = await query<ChannelRow>('SELECT data FROM channels WHERE community_id = $1', [
        communityId,
      ]);
      return rows.map((r) => r.data);
    },

    async addChannel(channel) {
      await pool.query(
        `INSERT INTO channels (id, community_id, data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET data = $3`,
        [channel.id, channel.communityId, JSON.stringify(channel)],
      );
    },

    async clearChannels(communityId) {
      await pool.query('DELETE FROM channels WHERE community_id = $1', [communityId]);
    },

    async findChannelById(channelId) {
      const row = await queryOne<ChannelRow>('SELECT data FROM channels WHERE id = $1', [
        channelId,
      ]);
      return row?.data;
    },

    // -- Roles --------------------------------------------------------------

    async getRolesByCommunity(communityId) {
      const rows = await query<RoleRow>('SELECT data FROM roles WHERE community_id = $1', [
        communityId,
      ]);
      return rows.map((r) => r.data);
    },

    async addRole(role) {
      await pool.query(
        `INSERT INTO roles (id, community_id, data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET data = $3`,
        [role.id, role.communityId, JSON.stringify(role)],
      );
    },

    async updateRole(communityId, roleId, updatedRole) {
      await pool.query('UPDATE roles SET data = $3 WHERE community_id = $1 AND id = $2', [
        communityId,
        roleId,
        JSON.stringify(updatedRole),
      ]);
    },

    async deleteRole(communityId, roleId) {
      await pool.query('DELETE FROM roles WHERE community_id = $1 AND id = $2', [
        communityId,
        roleId,
      ]);
    },

    async clearRoles(communityId) {
      await pool.query('DELETE FROM roles WHERE community_id = $1', [communityId]);
    },

    // -- Role assignments ---------------------------------------------------

    async assignRoleToMember(communityId, memberId, roleId) {
      const result = await pool.query(
        `UPDATE memberships
         SET role_ids = (
           SELECT jsonb_build_array(roleId) ||
                  (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(role_ids) AS elem WHERE elem <> roleId)
         )
         WHERE community_id = $1 AND account_id = $2 AND NOT role_ids @> $3::jsonb
         RETURNING 1`,
        [communityId, memberId, JSON.stringify([roleId])],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async removeRoleFromMember(communityId, memberId, roleId) {
      await pool.query(
        `UPDATE memberships
         SET role_ids = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                         FROM jsonb_array_elements_text(role_ids) AS elem
                         WHERE elem <> $3)
         WHERE community_id = $1 AND account_id = $2`,
        [communityId, memberId, roleId],
      );
    },

    async removeRoleFromAllMembers(communityId, roleId) {
      await pool.query(
        `UPDATE memberships
         SET role_ids = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                         FROM jsonb_array_elements_text(role_ids) AS elem
                         WHERE elem <> $2)
         WHERE community_id = $1`,
        [communityId, roleId],
      );
    },

    // -- Invites ------------------------------------------------------------

    async getInvitesByCommunity(communityId) {
      const rows = await query<InviteRow>('SELECT data FROM invites WHERE community_id = $1', [
        communityId,
      ]);
      return rows.map((r) => r.data);
    },

    async getInviteByCode(code) {
      const row = await queryOne<InviteRow>('SELECT data FROM invites WHERE code = $1', [code]);
      return row?.data;
    },

    async addInvite(invite) {
      await pool.query(
        `INSERT INTO invites (id, community_id, code, data) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET data = $4`,
        [invite.id, invite.communityId, invite.code, JSON.stringify(invite)],
      );
    },

    async updateInvite(invite) {
      await pool.query('UPDATE invites SET data = $2 WHERE id = $1', [
        invite.id,
        JSON.stringify(invite),
      ]);
    },

    async deleteInvite(communityId, inviteId) {
      await pool.query('DELETE FROM invites WHERE community_id = $1 AND id = $2', [
        communityId,
        inviteId,
      ]);
    },

    async deleteInviteByCode(code) {
      await pool.query('DELETE FROM invites WHERE code = $1', [code]);
    },

    async clearInvites(communityId) {
      await pool.query('DELETE FROM invites WHERE community_id = $1', [communityId]);
    },

    // -- Messages -----------------------------------------------------------

    async getMessagesByChannel(channelId) {
      const rows = await query<MessageRow>(
        'SELECT data FROM messages WHERE channel_id = $1 ORDER BY created_at',
        [channelId],
      );
      return rows.map((r) => r.data);
    },

    async getMessage(id) {
      const row = await queryOne<MessageRow>('SELECT data FROM messages WHERE id = $1', [id]);
      return row?.data;
    },

    async addMessage(message) {
      await pool.query(
        `INSERT INTO messages (id, channel_id, data) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [message.id, message.channelId, JSON.stringify(message)],
      );
    },

    async updateMessage(message) {
      await pool.query('UPDATE messages SET data = $2 WHERE id = $1', [
        message.id,
        JSON.stringify(message),
      ]);
    },

    async getIdempotentMessage(key) {
      const row = await queryOne<IdempotencyRow>('SELECT data FROM idempotency WHERE key = $1', [
        key,
      ]);
      return row?.data;
    },

    async setIdempotentMessage(key, message) {
      await pool.query(
        `INSERT INTO idempotency (key, message_id, data) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, message.id, JSON.stringify(message)],
      );
    },

    // -- Message reactions -------------------------------------------------

    async getMessageReactions(messageId) {
      const rows = await query<MessageReactionRow>(
        `SELECT message_id, account_id, emoji, created_at
         FROM message_reactions WHERE message_id = $1 ORDER BY created_at`,
        [messageId],
      );
      return rows.map((row) => ({
        messageId: row.message_id,
        accountId: row.account_id,
        emoji: row.emoji,
        createdAt: row.created_at,
      }));
    },

    async addMessageReaction(reaction) {
      const result = await pool.query(
        `INSERT INTO message_reactions (message_id, account_id, emoji, created_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [reaction.messageId, reaction.accountId, reaction.emoji, reaction.createdAt],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async removeMessageReaction(messageId, accountId, emoji) {
      const result = await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND account_id = $2 AND emoji = $3',
        [messageId, accountId, emoji],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async clearMessageReactions(messageId) {
      await pool.query('DELETE FROM message_reactions WHERE message_id = $1', [messageId]);
    },

    // -- Channel read state ------------------------------------------------

    async getChannelReadState(channelId, accountId) {
      const row = await queryOne<ChannelReadStateRow>(
        `SELECT channel_id, account_id, last_read_message_id, updated_at
         FROM channel_read_states WHERE channel_id = $1 AND account_id = $2`,
        [channelId, accountId],
      );
      if (!row) return undefined;
      return {
        channelId: row.channel_id,
        accountId: row.account_id,
        lastReadMessageId: row.last_read_message_id,
        updatedAt: row.updated_at,
      } satisfies ChannelReadState;
    },

    async setChannelReadState(state) {
      await pool.query(
        `INSERT INTO channel_read_states
           (channel_id, account_id, last_read_message_id, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (channel_id, account_id) DO UPDATE SET
           last_read_message_id = $3, updated_at = $4`,
        [state.channelId, state.accountId, state.lastReadMessageId, state.updatedAt],
      );
    },

    // -- Audit events ------------------------------------------------------

    async addAuditEvent(event) {
      await pool.query(
        `INSERT INTO audit_events
           (id, community_id, actor_id, action, target_type, target_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          event.id,
          event.communityId,
          event.actorId,
          event.action,
          event.targetType,
          event.targetId,
          JSON.stringify(event.metadata),
          event.createdAt,
        ],
      );
    },

    async getAuditEventsByCommunity(communityId) {
      const rows = await query<AuditEventRow>(
        `SELECT id, community_id, actor_id, action, target_type, target_id, metadata, created_at
         FROM audit_events WHERE community_id = $1 ORDER BY created_at DESC`,
        [communityId],
      );
      return rows.map((row) => ({
        id: row.id,
        communityId: row.community_id,
        actorId: row.actor_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      }));
    },

    // -- Attachments --------------------------------------------------------

    async getAttachment(id) {
      const row = await queryOne<AttachmentRow>('SELECT * FROM attachments WHERE id = $1', [id]);
      return row ? rowToAttachment(row) : undefined;
    },

    async addAttachment(attachment) {
      await pool.query(
        `INSERT INTO attachments
           (id, channel_id, uploader_id, filename, mime_type, size, storage_key,
            quarantine_status, uploaded_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          attachment.id,
          attachment.channelId,
          attachment.uploaderAccountId,
          attachment.filename,
          attachment.mimeType,
          attachment.size,
          attachment.storageKey,
          attachment.quarantineStatus,
          attachment.uploadedAt ?? null,
          attachment.createdAt,
        ],
      );
    },

    async updateAttachmentStatus(id, status, uploadedAt) {
      await pool.query(
        `UPDATE attachments SET quarantine_status = $2, uploaded_at = COALESCE($3::timestamptz, uploaded_at)
         WHERE id = $1`,
        [id, status, uploadedAt ?? null],
      );
    },

    async getAttachmentsByIds(ids) {
      if (ids.length === 0) return [];
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const rows = await query<AttachmentRow>(
        `SELECT * FROM attachments WHERE id IN (${placeholders})`,
        ids,
      );
      return rows.map(rowToAttachment);
    },

    async deleteAttachment(id) {
      await pool.query('DELETE FROM attachments WHERE id = $1', [id]);
    },
  };
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

interface AttachmentRow extends QueryResultRow {
  id: string;
  channel_id: string;
  uploader_id: string;
  filename: string;
  mime_type: string;
  size: string; // bigint arrives as string
  storage_key: string;
  quarantine_status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string | null;
  created_at: string;
}

function rowToAttachment(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    uploaderAccountId: row.uploader_id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: Number(row.size),
    storageKey: row.storage_key,
    quarantineStatus: row.quarantine_status,
    createdAt: row.created_at,
    ...(row.uploaded_at ? { uploadedAt: row.uploaded_at } : {}),
  };
}
