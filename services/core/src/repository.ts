/**
 * Repository interface — the storage abstraction for the Cove core service.
 *
 * All route handlers operate through this interface so the backing store
 * can be swapped between an in-memory adapter (deterministic tests) and
 * a PostgreSQL adapter (production) without changing application logic.
 */

import type {
  Account,
  AuditEvent,
  Channel,
  ChannelReadState,
  Community,
  CommunityStats,
  Invite,
  Message,
  Role,
} from '@cove/contracts';

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

export interface AttachmentRecord {
  id: string;
  channelId: string;
  uploaderAccountId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  quarantineStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  uploadedAt?: string;
}

export interface EmailChallenge {
  code: string;
  challengeId: string;
  expiresAt: number;
}

export interface MessageReactionRecord {
  messageId: string;
  accountId: string;
  emoji: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

export interface Repository {
  // -- Accounts -------------------------------------------------------------
  getAccountByEmail(email: string): Promise<Account | undefined>;
  setAccount(email: string, account: Account): Promise<void>;

  // -- Email challenges -----------------------------------------------------
  getEmailChallenge(key: string): Promise<EmailChallenge | undefined>;
  setEmailChallenge(key: string, challenge: EmailChallenge): Promise<void>;
  deleteEmailChallenge(key: string): Promise<void>;

  // -- Passkeys -------------------------------------------------------------
  getPasskeys(email: string): Promise<PasskeyCredential[]>;
  addPasskey(email: string, credential: PasskeyCredential): Promise<void>;

  // -- Sessions -------------------------------------------------------------
  getSession(token: string): Promise<SessionRecord | undefined>;
  setSession(token: string, session: SessionRecord): Promise<void>;
  deleteSession(token: string): Promise<void>;
  listSessionsByEmail(email: string): Promise<Array<{ token: string; session: SessionRecord }>>;

  // -- Communities ----------------------------------------------------------
  getCommunity(id: string): Promise<Community | undefined>;
  setCommunity(community: Community): Promise<void>;
  deleteCommunity(id: string): Promise<void>;
  listCommunitiesForAccount(accountId: string): Promise<Community[]>;

  // -- Memberships ----------------------------------------------------------
  getMemberships(communityId: string): Promise<Membership[]>;
  getMembership(communityId: string, accountId: string): Promise<Membership | undefined>;
  addMembership(communityId: string, membership: Membership): Promise<void>;
  removeMembership(communityId: string, accountId: string): Promise<void>;
  clearMemberships(communityId: string): Promise<void>;

  // -- Channels -------------------------------------------------------------
  getChannelsByCommunity(communityId: string): Promise<Channel[]>;
  addChannel(channel: Channel): Promise<void>;
  clearChannels(communityId: string): Promise<void>;
  findChannelById(channelId: string): Promise<Channel | undefined>;

  // -- Roles ----------------------------------------------------------------
  getRolesByCommunity(communityId: string): Promise<Role[]>;
  addRole(role: Role): Promise<void>;
  updateRole(communityId: string, roleId: string, updatedRole: Role): Promise<void>;
  deleteRole(communityId: string, roleId: string): Promise<void>;
  clearRoles(communityId: string): Promise<void>;

  // -- Role assignments (on memberships) ------------------------------------
  assignRoleToMember(communityId: string, memberId: string, roleId: string): Promise<boolean>;
  removeRoleFromMember(communityId: string, memberId: string, roleId: string): Promise<void>;
  removeRoleFromAllMembers(communityId: string, roleId: string): Promise<void>;

  // -- Invites --------------------------------------------------------------
  getInvitesByCommunity(communityId: string): Promise<Invite[]>;
  getInviteByCode(code: string): Promise<Invite | undefined>;
  addInvite(invite: Invite): Promise<void>;
  updateInvite(invite: Invite): Promise<void>;
  deleteInvite(communityId: string, inviteId: string): Promise<void>;
  deleteInviteByCode(code: string): Promise<void>;
  clearInvites(communityId: string): Promise<void>;

  // -- Messages -------------------------------------------------------------
  getMessagesByChannel(channelId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  addMessage(message: Message): Promise<void>;
  updateMessage(message: Message): Promise<void>;
  getIdempotentMessage(key: string): Promise<Message | undefined>;
  setIdempotentMessage(key: string, message: Message): Promise<void>;

  // -- Message reactions ---------------------------------------------------
  getMessageReactions(messageId: string): Promise<MessageReactionRecord[]>;
  addMessageReaction(reaction: MessageReactionRecord): Promise<boolean>;
  removeMessageReaction(messageId: string, accountId: string, emoji: string): Promise<boolean>;
  clearMessageReactions(messageId: string): Promise<void>;

  // -- Channel read state --------------------------------------------------
  getChannelReadState(channelId: string, accountId: string): Promise<ChannelReadState | undefined>;
  setChannelReadState(state: ChannelReadState): Promise<void>;

  // -- Audit events --------------------------------------------------------
  addAuditEvent(event: AuditEvent): Promise<void>;
  getAuditEventsByCommunity(
    communityId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<{ items: AuditEvent[]; nextCursor: string | null }>;

  // -- Community stats -------------------------------------------------------
  getCommunityStats(communityId: string): Promise<CommunityStats>;

  // -- Attachments ----------------------------------------------------------
  getAttachment(id: string): Promise<AttachmentRecord | undefined>;
  addAttachment(attachment: AttachmentRecord): Promise<void>;
  updateAttachmentStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    uploadedAt?: string,
  ): Promise<void>;
  getAttachmentsByIds(ids: string[]): Promise<AttachmentRecord[]>;
  deleteAttachment(id: string): Promise<void>;
}
