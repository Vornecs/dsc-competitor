/**
 * In-memory repository — deterministic, zero-dependency adapter for tests
 * and local development. Implements the full Repository interface using
 * plain Maps and arrays in process memory.
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
import type {
  AttachmentRecord,
  EmailChallenge,
  Membership,
  MessageReactionRecord,
  PasskeyCredential,
  Repository,
  SessionRecord,
} from './repository.js';

export function createMemoryRepository(): Repository {
  const accountsByEmail = new Map<string, Account>();
  const emailChallenges = new Map<string, EmailChallenge>();
  const passkeys = new Map<string, PasskeyCredential[]>();
  const sessions = new Map<string, SessionRecord>();
  const communities = new Map<string, Community>();
  const memberships = new Map<string, Membership[]>();
  const channelsByCommunity = new Map<string, Channel[]>();
  const rolesByCommunity = new Map<string, Role[]>();
  const invitesByCommunity = new Map<string, Invite[]>();
  const invitesByCode = new Map<string, Invite>();
  const messages: Message[] = [];
  const idempotency = new Map<string, Message>();
  const attachments = new Map<string, AttachmentRecord>();
  const messageReactions = new Map<string, MessageReactionRecord>();
  const channelReadStates = new Map<string, ChannelReadState>();
  const auditEvents: AuditEvent[] = [];
  const bansByCommunity = new Map<string, Ban[]>();

  return {
    // -- Accounts -----------------------------------------------------------
    async getAccountByEmail(email) {
      return accountsByEmail.get(email);
    },
    async getAccountById(id) {
      for (const account of accountsByEmail.values()) {
        if (account.id === id) return account;
      }
      return undefined;
    },
    async setAccount(email, account) {
      accountsByEmail.set(email, account);
    },

    // -- Email challenges ---------------------------------------------------
    async getEmailChallenge(key) {
      return emailChallenges.get(key);
    },
    async setEmailChallenge(key, challenge) {
      emailChallenges.set(key, challenge);
    },
    async deleteEmailChallenge(key) {
      emailChallenges.delete(key);
    },

    // -- Passkeys -----------------------------------------------------------
    async getPasskeys(email) {
      return passkeys.get(email) ?? [];
    },
    async addPasskey(email, credential) {
      const list = passkeys.get(email) ?? [];
      list.push(credential);
      passkeys.set(email, list);
    },

    // -- Sessions -----------------------------------------------------------
    async getSession(token) {
      return sessions.get(token);
    },
    async setSession(token, session) {
      sessions.set(token, session);
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async listSessionsByEmail(email) {
      const result: Array<{ token: string; session: SessionRecord }> = [];
      for (const [token, session] of sessions.entries()) {
        if (session.email === email) result.push({ token, session });
      }
      return result;
    },

    // -- Communities --------------------------------------------------------
    async getCommunity(id) {
      return communities.get(id);
    },
    async setCommunity(community) {
      communities.set(community.id, community);
    },
    async deleteCommunity(id) {
      communities.delete(id);
    },
    async listCommunitiesForAccount(accountId) {
      const result: Community[] = [];
      for (const [communityId, members] of memberships.entries()) {
        if (members.some((m) => m.accountId === accountId)) {
          const community = communities.get(communityId);
          if (community) result.push(community);
        }
      }
      return result;
    },

    // -- Memberships --------------------------------------------------------
    async getMemberships(communityId) {
      return memberships.get(communityId) ?? [];
    },
    async getMembership(communityId, accountId) {
      return (memberships.get(communityId) ?? []).find((m) => m.accountId === accountId);
    },
    async addMembership(communityId, membership) {
      const list = memberships.get(communityId) ?? [];
      list.push(membership);
      memberships.set(communityId, list);
    },
    async removeMembership(communityId, accountId) {
      const list = memberships.get(communityId) ?? [];
      const index = list.findIndex((m) => m.accountId === accountId);
      if (index >= 0) list.splice(index, 1);
      if (list.length === 0) {
        memberships.delete(communityId);
      } else {
        memberships.set(communityId, list);
      }
    },
    async clearMemberships(communityId) {
      memberships.delete(communityId);
    },

    // -- Channels -----------------------------------------------------------
    async getChannelsByCommunity(communityId) {
      return channelsByCommunity.get(communityId) ?? [];
    },
    async addChannel(channel) {
      const list = channelsByCommunity.get(channel.communityId) ?? [];
      list.push(channel);
      channelsByCommunity.set(channel.communityId, list);
    },
    async clearChannels(communityId) {
      channelsByCommunity.delete(communityId);
    },
    async findChannelById(channelId) {
      for (const channels of channelsByCommunity.values()) {
        const channel = channels.find((c) => c.id === channelId);
        if (channel) return channel;
      }
      return undefined;
    },

    // -- Roles --------------------------------------------------------------
    async getRolesByCommunity(communityId) {
      return rolesByCommunity.get(communityId) ?? [];
    },
    async addRole(role) {
      const list = rolesByCommunity.get(role.communityId) ?? [];
      list.push(role);
      rolesByCommunity.set(role.communityId, list);
    },
    async updateRole(communityId, roleId, updatedRole) {
      const list = rolesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((r) => r.id === roleId);
      if (index >= 0) list[index] = updatedRole;
    },
    async deleteRole(communityId, roleId) {
      const list = rolesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((r) => r.id === roleId);
      if (index >= 0) list.splice(index, 1);
    },
    async clearRoles(communityId) {
      rolesByCommunity.delete(communityId);
    },

    // -- Role assignments ---------------------------------------------------
    async assignRoleToMember(communityId, memberId, roleId) {
      const membership = (memberships.get(communityId) ?? []).find((m) => m.accountId === memberId);
      if (!membership) return false;
      if (!membership.roleIds.includes(roleId)) {
        membership.roleIds.push(roleId);
        return true;
      }
      return false;
    },
    async removeRoleFromMember(communityId, memberId, roleId) {
      const membership = (memberships.get(communityId) ?? []).find((m) => m.accountId === memberId);
      if (membership) {
        membership.roleIds = membership.roleIds.filter((id) => id !== roleId);
      }
    },
    async removeRoleFromAllMembers(communityId, roleId) {
      for (const member of memberships.get(communityId) ?? []) {
        member.roleIds = member.roleIds.filter((id) => id !== roleId);
      }
    },

    // -- Invites ------------------------------------------------------------
    async getInvitesByCommunity(communityId) {
      return invitesByCommunity.get(communityId) ?? [];
    },
    async getInviteByCode(code) {
      return invitesByCode.get(code);
    },
    async addInvite(invite) {
      const list = invitesByCommunity.get(invite.communityId) ?? [];
      list.push(invite);
      invitesByCommunity.set(invite.communityId, list);
      invitesByCode.set(invite.code, invite);
    },
    async updateInvite(invite) {
      invitesByCode.set(invite.code, invite);
    },
    async deleteInvite(communityId, inviteId) {
      const list = invitesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((i) => i.id === inviteId);
      if (index >= 0) {
        const [removed] = list.splice(index, 1);
        if (removed) invitesByCode.delete(removed.code);
      }
    },
    async deleteInviteByCode(code) {
      invitesByCode.delete(code);
    },
    async clearInvites(communityId) {
      for (const invite of invitesByCommunity.get(communityId) ?? []) {
        invitesByCode.delete(invite.code);
      }
      invitesByCommunity.delete(communityId);
    },

    // -- Messages -----------------------------------------------------------
    async getMessagesByChannel(channelId) {
      return messages.filter((m) => m.channelId === channelId);
    },
    async getMessage(id) {
      return messages.find((message) => message.id === id);
    },
    async addMessage(message) {
      messages.push(message);
    },
    async updateMessage(message) {
      const index = messages.findIndex((candidate) => candidate.id === message.id);
      if (index >= 0) messages[index] = message;
    },
    async getIdempotentMessage(key) {
      return idempotency.get(key);
    },
    async setIdempotentMessage(key, message) {
      idempotency.set(key, message);
    },

    // -- Message reactions -------------------------------------------------
    async getMessageReactions(messageId) {
      return Array.from(messageReactions.values()).filter(
        (reaction) => reaction.messageId === messageId,
      );
    },
    async addMessageReaction(reaction) {
      const key = `${reaction.messageId}:${reaction.accountId}:${reaction.emoji}`;
      if (messageReactions.has(key)) return false;
      messageReactions.set(key, reaction);
      return true;
    },
    async removeMessageReaction(messageId, accountId, emoji) {
      return messageReactions.delete(`${messageId}:${accountId}:${emoji}`);
    },
    async clearMessageReactions(messageId) {
      for (const [key, reaction] of messageReactions) {
        if (reaction.messageId === messageId) messageReactions.delete(key);
      }
    },

    // -- Channel read state ------------------------------------------------
    async getChannelReadState(channelId, accountId) {
      return channelReadStates.get(`${channelId}:${accountId}`);
    },
    async setChannelReadState(state) {
      channelReadStates.set(`${state.channelId}:${state.accountId}`, state);
    },

    // -- Audit events ------------------------------------------------------
    async addAuditEvent(event) {
      auditEvents.push(event);
    },
    async getAuditEventsByCommunity(communityId, opts) {
      const limit = opts?.limit ?? 50;
      const sorted = auditEvents
        .filter((event) => event.communityId === communityId)
        .sort((a, b) => {
          const timeDiff = b.createdAt.localeCompare(a.createdAt);
          return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
        });

      let startIndex = 0;
      if (opts?.cursor) {
        const { createdAt: cursorAt, id: cursorId } = JSON.parse(
          Buffer.from(opts.cursor, 'base64url').toString('utf8'),
        ) as { createdAt: string; id: string };
        const idx = sorted.findIndex((e) => e.createdAt === cursorAt && e.id === cursorId);
        startIndex = idx >= 0 ? idx + 1 : 0;
      }

      const page = sorted.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < sorted.length;
      const nextCursor = hasMore
        ? Buffer.from(
            JSON.stringify({
              createdAt: page[page.length - 1]!.createdAt,
              id: page[page.length - 1]!.id,
            }),
            'utf8',
          ).toString('base64url')
        : null;

      return { items: page, nextCursor };
    },

    // -- Community stats -------------------------------------------------------
    async getCommunityStats(communityId): Promise<CommunityStats> {
      const members = memberships.get(communityId) ?? [];
      const channels = channelsByCommunity.get(communityId) ?? [];
      const channelIds = new Set(channels.map((c) => c.id));
      const messageCount = messages.filter((m) => channelIds.has(m.channelId)).length;
      let onlineCount = 0;
      for (const member of members) {
        for (const account of accountsByEmail.values()) {
          if (account.id === member.accountId && account.status !== 'offline') {
            onlineCount++;
            break;
          }
        }
      }
      return {
        memberCount: members.length,
        channelCount: channels.length,
        messageCount,
        onlineCount,
      };
    },

    // -- Attachments ----------------------------------------------------------
    async getAttachment(id) {
      return attachments.get(id);
    },
    async addAttachment(attachment) {
      attachments.set(attachment.id, { ...attachment });
    },
    async updateAttachmentStatus(id, status, uploadedAt) {
      const record = attachments.get(id);
      if (record) {
        record.quarantineStatus = status;
        if (uploadedAt) record.uploadedAt = uploadedAt;
      }
    },
    async getAttachmentsByIds(ids) {
      return ids.flatMap((id) => {
        const rec = attachments.get(id);
        return rec ? [rec] : [];
      });
    },
    async deleteAttachment(id) {
      attachments.delete(id);
    },

    // -- Bans -----------------------------------------------------------------
    async getBansByCommunity(communityId) {
      return bansByCommunity.get(communityId) ?? [];
    },
    async getBan(communityId, accountId) {
      return (bansByCommunity.get(communityId) ?? []).find((b) => b.accountId === accountId);
    },
    async addBan(ban) {
      const list = bansByCommunity.get(ban.communityId) ?? [];
      const filtered = list.filter((b) => b.accountId !== ban.accountId);
      filtered.push({ ...ban });
      bansByCommunity.set(ban.communityId, filtered);
    },
    async removeBan(communityId, accountId) {
      const list = bansByCommunity.get(communityId) ?? [];
      bansByCommunity.set(
        communityId,
        list.filter((b) => b.accountId !== accountId),
      );
    },

    // -- Backup & Restore -----------------------------------------------------
    async exportBackup() {
      const data = {
        accounts: Array.from(accountsByEmail.entries()),
        emailChallenges: Array.from(emailChallenges.entries()),
        passkeys: Array.from(passkeys.entries()),
        sessions: Array.from(sessions.entries()),
        communities: Array.from(communities.entries()),
        memberships: Array.from(memberships.entries()),
        channels: Array.from(channelsByCommunity.values()).flat(),
        roles: Array.from(rolesByCommunity.values()).flat(),
        invites: Array.from(invitesByCommunity.values()).flat(),
        messages: [...messages],
        idempotency: Array.from(idempotency.entries()),
        attachments: Array.from(attachments.values()),
        messageReactions: Array.from(messageReactions.values()),
        channelReadStates: Array.from(channelReadStates.values()),
        auditEvents: [...auditEvents],
        bans: Array.from(bansByCommunity.values()).flat(),
      };
      return JSON.stringify(data);
    },
    async importBackup(backupJson) {
      const data = JSON.parse(backupJson);
      accountsByEmail.clear();
      emailChallenges.clear();
      passkeys.clear();
      sessions.clear();
      communities.clear();
      memberships.clear();
      channelsByCommunity.clear();
      rolesByCommunity.clear();
      invitesByCommunity.clear();
      invitesByCode.clear();
      messages.length = 0;
      idempotency.clear();
      attachments.clear();
      messageReactions.clear();
      channelReadStates.clear();
      auditEvents.length = 0;
      bansByCommunity.clear();

      for (const [k, v] of data.accounts || []) accountsByEmail.set(k, v);
      for (const [k, v] of data.emailChallenges || []) emailChallenges.set(k, v);
      for (const [k, v] of data.passkeys || []) passkeys.set(k, v);
      for (const [k, v] of data.sessions || []) sessions.set(k, v);
      for (const [k, v] of data.communities || []) communities.set(k, v);
      for (const [k, v] of data.memberships || []) memberships.set(k, v);
      for (const chan of data.channels || []) {
        const list = channelsByCommunity.get(chan.communityId) || [];
        list.push(chan);
        channelsByCommunity.set(chan.communityId, list);
      }
      for (const role of data.roles || []) {
        const list = rolesByCommunity.get(role.communityId) || [];
        list.push(role);
        rolesByCommunity.set(role.communityId, list);
      }
      for (const invite of data.invites || []) {
        const list = invitesByCommunity.get(invite.communityId) || [];
        list.push(invite);
        invitesByCommunity.set(invite.communityId, list);
        invitesByCode.set(invite.code, invite);
      }
      if (data.messages) messages.push(...data.messages);
      for (const [k, v] of data.idempotency || []) idempotency.set(k, v);
      for (const attach of data.attachments || []) attachments.set(attach.id, attach);
      for (const react of data.messageReactions || []) {
        messageReactions.set(`${react.messageId}:${react.accountId}:${react.emoji}`, react);
      }
      for (const rs of data.channelReadStates || []) {
        channelReadStates.set(`${rs.channelId}:${rs.accountId}`, rs);
      }
      if (data.auditEvents) auditEvents.push(...data.auditEvents);
      for (const ban of data.bans || []) {
        const list = bansByCommunity.get(ban.communityId) || [];
        list.push(ban);
        bansByCommunity.set(ban.communityId, list);
      }
    },
  };
}
