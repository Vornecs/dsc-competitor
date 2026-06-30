/**
 * Repository interface — the storage abstraction for the Cove core service.
 *
 * All route handlers operate through this interface so the backing store
 * can be swapped between an in-memory adapter (deterministic tests) and
 * a PostgreSQL adapter (production) without changing application logic.
 */

import type { Account, Channel, Community, Invite, Message, Role } from '@cove/contracts';

// ---------------------------------------------------------------------------
// Domain types that are internal to the service layer
// ---------------------------------------------------------------------------

export interface Membership {
  accountId: string;
  role: 'owner' | 'admin' | 'member';
  roleIds: string[];
}

export interface SessionRecord {
  sessionId: string;
  email: string;
  deviceName: string;
  ipAddress: string;
  lastActiveAt: string;
  registrationChallenge?: string;
}

export interface PasskeyCredential {
  credentialId: string;
  rawId: string;
  attestationObject: string;
  clientDataJSON: string;
}

export interface EmailChallenge {
  code: string;
  challengeId: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

export interface Repository {
  // -- Accounts -------------------------------------------------------------
  getAccountByEmail(email: string): Account | undefined;
  setAccount(email: string, account: Account): void;

  // -- Email challenges -----------------------------------------------------
  getEmailChallenge(key: string): EmailChallenge | undefined;
  setEmailChallenge(key: string, challenge: EmailChallenge): void;
  deleteEmailChallenge(key: string): void;

  // -- Passkeys -------------------------------------------------------------
  getPasskeys(email: string): PasskeyCredential[];
  addPasskey(email: string, credential: PasskeyCredential): void;

  // -- Sessions -------------------------------------------------------------
  getSession(token: string): SessionRecord | undefined;
  setSession(token: string, session: SessionRecord): void;
  deleteSession(token: string): void;
  listSessionsByEmail(email: string): Array<{ token: string; session: SessionRecord }>;

  // -- Communities ----------------------------------------------------------
  getCommunity(id: string): Community | undefined;
  setCommunity(community: Community): void;
  deleteCommunity(id: string): void;
  listCommunitiesForAccount(accountId: string): Community[];

  // -- Memberships ----------------------------------------------------------
  getMemberships(communityId: string): Membership[];
  getMembership(communityId: string, accountId: string): Membership | undefined;
  addMembership(communityId: string, membership: Membership): void;
  removeMembership(communityId: string, accountId: string): void;
  clearMemberships(communityId: string): void;

  // -- Channels -------------------------------------------------------------
  getChannelsByCommunity(communityId: string): Channel[];
  addChannel(channel: Channel): void;
  clearChannels(communityId: string): void;
  findChannelById(channelId: string): Channel | undefined;

  // -- Roles ----------------------------------------------------------------
  getRolesByCommunity(communityId: string): Role[];
  addRole(role: Role): void;
  updateRole(communityId: string, roleId: string, updatedRole: Role): void;
  deleteRole(communityId: string, roleId: string): void;
  clearRoles(communityId: string): void;

  // -- Role assignments (on memberships) ------------------------------------
  assignRoleToMember(communityId: string, memberId: string, roleId: string): boolean;
  removeRoleFromMember(communityId: string, memberId: string, roleId: string): void;
  removeRoleFromAllMembers(communityId: string, roleId: string): void;

  // -- Invites --------------------------------------------------------------
  getInvitesByCommunity(communityId: string): Invite[];
  getInviteByCode(code: string): Invite | undefined;
  addInvite(invite: Invite): void;
  updateInvite(invite: Invite): void;
  deleteInvite(communityId: string, inviteId: string): void;
  deleteInviteByCode(code: string): void;
  clearInvites(communityId: string): void;

  // -- Messages -------------------------------------------------------------
  getMessagesByChannel(channelId: string): Message[];
  addMessage(message: Message): void;
  getIdempotentMessage(key: string): Message | undefined;
  setIdempotentMessage(key: string, message: Message): void;
}
