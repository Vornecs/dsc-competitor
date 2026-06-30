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
  Ban,
  Channel,
  ChannelReadState,
  Community,
  CommunityStats,
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
  target_type: AuditEvent['targetType'];
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
    getAccountById(id) {
      return queryOne<AccountRow>("SELECT data FROM accounts WHERE data->>'id' = $1", [id]).then(
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

    async getAuditEventsByCommunity(communityId, opts) {
      const limit = opts?.limit ?? 50;
      let rows: AuditEventRow[];
      if (opts?.cursor) {
        const { createdAt: cursorAt, id: cursorId } = JSON.parse(
          Buffer.from(opts.cursor, 'base64url').toString('utf8'),
        ) as { createdAt: string; id: string };
        rows = await query<AuditEventRow>(
          `SELECT id, community_id, actor_id, action, target_type, target_id, metadata, created_at
           FROM audit_events
           WHERE community_id = $1
             AND (created_at < $2 OR (created_at = $2 AND id < $3))
           ORDER BY created_at DESC, id DESC
           LIMIT $4`,
          [communityId, cursorAt, cursorId, limit],
        );
      } else {
        rows = await query<AuditEventRow>(
          `SELECT id, community_id, actor_id, action, target_type, target_id, metadata, created_at
           FROM audit_events WHERE community_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
          [communityId, limit],
        );
      }
      const items = rows.map((row) => ({
        id: row.id,
        communityId: row.community_id,
        actorId: row.actor_id,
        action: row.action as AuditEvent['action'],
        targetType: row.target_type as AuditEvent['targetType'],
        targetId: row.target_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      }));
      const hasMore = rows.length === limit;
      const nextCursor =
        hasMore && items.length > 0
          ? Buffer.from(
              JSON.stringify({
                createdAt: items[items.length - 1]!.createdAt,
                id: items[items.length - 1]!.id,
              }),
              'utf8',
            ).toString('base64url')
          : null;
      return { items, nextCursor };
    },

    async getCommunityStats(communityId): Promise<CommunityStats> {
      const result = await pool.query<{
        member_count: string;
        channel_count: string;
        message_count: string;
        online_count: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM memberships WHERE community_id = $1) AS member_count,
           (SELECT COUNT(*) FROM channels WHERE community_id = $1) AS channel_count,
           (SELECT COUNT(*) FROM messages m
            JOIN channels c ON m.channel_id = c.id
            WHERE c.community_id = $1) AS message_count,
           (SELECT COUNT(*) FROM memberships mb
            JOIN accounts a ON (a.data->>'id') = mb.account_id
            WHERE mb.community_id = $1 AND a.data->>'status' != 'offline') AS online_count`,
        [communityId],
      );
      const row = result.rows[0]!;
      return {
        memberCount: parseInt(row.member_count, 10),
        channelCount: parseInt(row.channel_count, 10),
        messageCount: parseInt(row.message_count, 10),
        onlineCount: parseInt(row.online_count, 10),
      };
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

    // -- Bans -----------------------------------------------------------------
    async getBansByCommunity(communityId) {
      const { rows } = await pool.query(
        'SELECT community_id, account_id, reason, actor_id, created_at FROM bans WHERE community_id = $1',
        [communityId],
      );
      return rows.map((r) => ({
        communityId: r.community_id,
        accountId: r.account_id,
        reason: r.reason ?? undefined,
        actorId: r.actor_id,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      }));
    },
    async getBan(communityId, accountId) {
      const { rows } = await pool.query(
        'SELECT community_id, account_id, reason, actor_id, created_at FROM bans WHERE community_id = $1 AND account_id = $2',
        [communityId, accountId],
      );
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        communityId: r.community_id,
        accountId: r.account_id,
        reason: r.reason ?? undefined,
        actorId: r.actor_id,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      };
    },
    async addBan(ban) {
      await pool.query(
        `INSERT INTO bans (community_id, account_id, reason, actor_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (community_id, account_id) DO UPDATE
         SET reason = $3, actor_id = $4, created_at = $5`,
        [ban.communityId, ban.accountId, ban.reason ?? null, ban.actorId, ban.createdAt],
      );
    },
    async removeBan(communityId, accountId) {
      await pool.query('DELETE FROM bans WHERE community_id = $1 AND account_id = $2', [
        communityId,
        accountId,
      ]);
    },

    // -- Backup & Restore -----------------------------------------------------
    async exportBackup() {
      const getRows = async (table: string): Promise<any[]> => {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        return rows;
      };

      const data = {
        accounts: await getRows('accounts'),
        emailChallenges: await getRows('email_challenges'),
        passkeys: await getRows('passkeys'),
        sessions: await getRows('sessions'),
        communities: await getRows('communities'),
        memberships: await getRows('memberships'),
        channels: await getRows('channels'),
        roles: await getRows('roles'),
        invites: await getRows('invites'),
        messages: await getRows('messages'),
        idempotency: await getRows('idempotency'),
        attachments: await getRows('attachments'),
        messageReactions: await getRows('message_reactions'),
        channelReadStates: await getRows('channel_read_states'),
        auditEvents: await getRows('audit_events'),
        bans: await getRows('bans'),
      };
      return JSON.stringify(data);
    },
    async importBackup(backupJson) {
      const data = JSON.parse(backupJson);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
          TRUNCATE TABLE 
            accounts, email_challenges, passkeys, sessions, communities, 
            memberships, channels, roles, invites, messages, idempotency, 
            attachments, message_reactions, channel_read_states, audit_events, bans 
          CASCADE
        `);

        for (const row of data.accounts || []) {
          await client.query('INSERT INTO accounts (email, data, created_at) VALUES ($1, $2, $3)', [
            row.email,
            typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
            row.created_at,
          ]);
        }
        for (const row of data.emailChallenges || []) {
          await client.query(
            'INSERT INTO email_challenges (key, code, challenge_id, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
            [row.key, row.code, row.challenge_id, row.expires_at, row.created_at],
          );
        }
        for (const row of data.passkeys || []) {
          await client.query(
            'INSERT INTO passkeys (id, email, credential_id, raw_id, attestation_object, client_data_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [
              row.id,
              row.email,
              row.credential_id,
              row.raw_id,
              row.attestation_object,
              row.client_data_json,
              row.created_at,
            ],
          );
        }
        if ((data.passkeys || []).length > 0) {
          await client.query(
            "SELECT setval(pg_get_serial_sequence('passkeys', 'id'), coalesce(max(id), 1)) FROM passkeys",
          );
        }
        for (const row of data.sessions || []) {
          await client.query(
            'INSERT INTO sessions (token, email, device_name, ip_address, last_active_at, registration_challenge, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [
              row.token,
              row.email,
              row.device_name,
              row.ip_address,
              row.last_active_at,
              row.registration_challenge,
              row.created_at,
            ],
          );
        }
        for (const row of data.communities || []) {
          await client.query('INSERT INTO communities (id, data, created_at) VALUES ($1, $2, $3)', [
            row.id,
            typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
            row.created_at,
          ]);
        }
        for (const row of data.memberships || []) {
          await client.query(
            'INSERT INTO memberships (community_id, account_id, role, role_ids) VALUES ($1, $2, $3, $4)',
            [
              row.community_id,
              row.account_id,
              row.role,
              typeof row.role_ids === 'string' ? row.role_ids : JSON.stringify(row.role_ids),
            ],
          );
        }
        for (const row of data.channels || []) {
          await client.query(
            'INSERT INTO channels (id, community_id, data, created_at) VALUES ($1, $2, $3)',
            [
              row.id,
              row.community_id,
              typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
              row.created_at,
            ],
          );
        }
        for (const row of data.roles || []) {
          await client.query(
            'INSERT INTO roles (id, community_id, data, created_at) VALUES ($1, $2, $3)',
            [
              row.id,
              row.community_id,
              typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
              row.created_at,
            ],
          );
        }
        for (const row of data.invites || []) {
          await client.query(
            'INSERT INTO invites (id, community_id, code, data, created_at) VALUES ($1, $2, $3, $4)',
            [
              row.id,
              row.community_id,
              row.code,
              typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
              row.created_at,
            ],
          );
        }
        for (const row of data.messages || []) {
          await client.query(
            'INSERT INTO messages (id, channel_id, data, created_at, reply_to_id) VALUES ($1, $2, $3, $4, $5)',
            [
              row.id,
              row.channel_id,
              typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
              row.created_at,
              row.reply_to_id,
            ],
          );
        }
        for (const row of data.idempotency || []) {
          await client.query(
            'INSERT INTO idempotency (key, message_id, data, created_at) VALUES ($1, $2, $3, $4)',
            [
              row.key,
              row.message_id,
              typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
              row.created_at,
            ],
          );
        }
        for (const row of data.attachments || []) {
          await client.query(
            'INSERT INTO attachments (id, channel_id, uploader_id, filename, mime_type, size, storage_key, quarantine_status, uploaded_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [
              row.id,
              row.channel_id,
              row.uploader_id,
              row.filename,
              row.mime_type,
              row.size,
              row.storage_key,
              row.quarantine_status,
              row.uploaded_at,
              row.created_at,
            ],
          );
        }
        for (const row of data.messageReactions || []) {
          await client.query(
            'INSERT INTO message_reactions (message_id, account_id, emoji, created_at) VALUES ($1, $2, $3, $4)',
            [row.message_id, row.account_id, row.emoji, row.created_at],
          );
        }
        for (const row of data.channelReadStates || []) {
          await client.query(
            'INSERT INTO channel_read_states (channel_id, account_id, last_read_message_id, updated_at) VALUES ($1, $2, $3, $4)',
            [row.channel_id, row.account_id, row.last_read_message_id, row.updated_at],
          );
        }
        for (const row of data.auditEvents || []) {
          await client.query(
            'INSERT INTO audit_events (id, community_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [
              row.id,
              row.community_id,
              row.actor_id,
              row.action,
              row.target_type,
              row.target_id,
              typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata),
              row.created_at,
            ],
          );
        }
        for (const row of data.bans || []) {
          await client.query(
            'INSERT INTO bans (community_id, account_id, reason, actor_id, created_at) VALUES ($1, $2, $3, $4, $5)',
            [row.community_id, row.account_id, row.reason, row.actor_id, row.created_at],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async reconcileVoiceParticipants() {
      await pool.query(`
        UPDATE channels 
        SET data = jsonb_set(data, '{participants}', '[]'::jsonb)
        WHERE data->>'kind' IN ('voice', 'stage')
      `);
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
