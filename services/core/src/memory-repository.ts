/**
 * In-memory repository — deterministic, zero-dependency adapter for tests
 * and local development. Implements the full Repository interface using
 * plain Maps and arrays in process memory.
 */

import type { Account, Channel, Community, Invite, Message, Role } from '@cove/contracts';
import type {
  EmailChallenge,
  Membership,
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

  return {
    // -- Accounts -----------------------------------------------------------
    getAccountByEmail(email) {
      return accountsByEmail.get(email);
    },
    setAccount(email, account) {
      accountsByEmail.set(email, account);
    },

    // -- Email challenges ---------------------------------------------------
    getEmailChallenge(key) {
      return emailChallenges.get(key);
    },
    setEmailChallenge(key, challenge) {
      emailChallenges.set(key, challenge);
    },
    deleteEmailChallenge(key) {
      emailChallenges.delete(key);
    },

    // -- Passkeys -----------------------------------------------------------
    getPasskeys(email) {
      return passkeys.get(email) ?? [];
    },
    addPasskey(email, credential) {
      const list = passkeys.get(email) ?? [];
      list.push(credential);
      passkeys.set(email, list);
    },

    // -- Sessions -----------------------------------------------------------
    getSession(token) {
      return sessions.get(token);
    },
    setSession(token, session) {
      sessions.set(token, session);
    },
    deleteSession(token) {
      sessions.delete(token);
    },
    listSessionsByEmail(email) {
      const result: Array<{ token: string; session: SessionRecord }> = [];
      for (const [token, session] of sessions.entries()) {
        if (session.email === email) result.push({ token, session });
      }
      return result;
    },

    // -- Communities --------------------------------------------------------
    getCommunity(id) {
      return communities.get(id);
    },
    setCommunity(community) {
      communities.set(community.id, community);
    },
    deleteCommunity(id) {
      communities.delete(id);
    },
    listCommunitiesForAccount(accountId) {
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
    getMemberships(communityId) {
      return memberships.get(communityId) ?? [];
    },
    getMembership(communityId, accountId) {
      return (memberships.get(communityId) ?? []).find((m) => m.accountId === accountId);
    },
    addMembership(communityId, membership) {
      const list = memberships.get(communityId) ?? [];
      list.push(membership);
      memberships.set(communityId, list);
    },
    removeMembership(communityId, accountId) {
      const list = memberships.get(communityId) ?? [];
      const index = list.findIndex((m) => m.accountId === accountId);
      if (index >= 0) list.splice(index, 1);
      if (list.length === 0) {
        memberships.delete(communityId);
      } else {
        memberships.set(communityId, list);
      }
    },
    clearMemberships(communityId) {
      memberships.delete(communityId);
    },

    // -- Channels -----------------------------------------------------------
    getChannelsByCommunity(communityId) {
      return channelsByCommunity.get(communityId) ?? [];
    },
    addChannel(channel) {
      const list = channelsByCommunity.get(channel.communityId) ?? [];
      list.push(channel);
      channelsByCommunity.set(channel.communityId, list);
    },
    clearChannels(communityId) {
      channelsByCommunity.delete(communityId);
    },
    findChannelById(channelId) {
      for (const channels of channelsByCommunity.values()) {
        const channel = channels.find((c) => c.id === channelId);
        if (channel) return channel;
      }
      return undefined;
    },

    // -- Roles --------------------------------------------------------------
    getRolesByCommunity(communityId) {
      return rolesByCommunity.get(communityId) ?? [];
    },
    addRole(role) {
      const list = rolesByCommunity.get(role.communityId) ?? [];
      list.push(role);
      rolesByCommunity.set(role.communityId, list);
    },
    updateRole(communityId, roleId, updatedRole) {
      const list = rolesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((r) => r.id === roleId);
      if (index >= 0) list[index] = updatedRole;
    },
    deleteRole(communityId, roleId) {
      const list = rolesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((r) => r.id === roleId);
      if (index >= 0) list.splice(index, 1);
    },
    clearRoles(communityId) {
      rolesByCommunity.delete(communityId);
    },

    // -- Role assignments ---------------------------------------------------
    assignRoleToMember(communityId, memberId, roleId) {
      const membership = (memberships.get(communityId) ?? []).find((m) => m.accountId === memberId);
      if (!membership) return false;
      if (!membership.roleIds.includes(roleId)) {
        membership.roleIds.push(roleId);
        return true;
      }
      return false;
    },
    removeRoleFromMember(communityId, memberId, roleId) {
      const membership = (memberships.get(communityId) ?? []).find((m) => m.accountId === memberId);
      if (membership) {
        membership.roleIds = membership.roleIds.filter((id) => id !== roleId);
      }
    },
    removeRoleFromAllMembers(communityId, roleId) {
      for (const member of memberships.get(communityId) ?? []) {
        member.roleIds = member.roleIds.filter((id) => id !== roleId);
      }
    },

    // -- Invites ------------------------------------------------------------
    getInvitesByCommunity(communityId) {
      return invitesByCommunity.get(communityId) ?? [];
    },
    getInviteByCode(code) {
      return invitesByCode.get(code);
    },
    addInvite(invite) {
      const list = invitesByCommunity.get(invite.communityId) ?? [];
      list.push(invite);
      invitesByCommunity.set(invite.communityId, list);
      invitesByCode.set(invite.code, invite);
    },
    updateInvite(invite) {
      invitesByCode.set(invite.code, invite);
    },
    deleteInvite(communityId, inviteId) {
      const list = invitesByCommunity.get(communityId) ?? [];
      const index = list.findIndex((i) => i.id === inviteId);
      if (index >= 0) {
        const [removed] = list.splice(index, 1);
        if (removed) invitesByCode.delete(removed.code);
      }
    },
    deleteInviteByCode(code) {
      invitesByCode.delete(code);
    },
    clearInvites(communityId) {
      for (const invite of invitesByCommunity.get(communityId) ?? []) {
        invitesByCode.delete(invite.code);
      }
      invitesByCommunity.delete(communityId);
    },

    // -- Messages -----------------------------------------------------------
    getMessagesByChannel(channelId) {
      return messages.filter((m) => m.channelId === channelId);
    },
    addMessage(message) {
      messages.push(message);
    },
    getIdempotentMessage(key) {
      return idempotency.get(key);
    },
    setIdempotentMessage(key, message) {
      idempotency.set(key, message);
    },
  };
}
