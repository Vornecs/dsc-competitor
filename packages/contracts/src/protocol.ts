import { z } from 'zod';

export const channelPrivacyModeSchema = z.enum(['managed', 'sealed']);
export type ChannelPrivacyMode = z.infer<typeof channelPrivacyModeSchema>;

export const contentAvailabilitySchema = z.enum(['plaintext', 'ciphertext', 'deleted']);
export type ContentAvailability = z.infer<typeof contentAvailabilitySchema>;

export const channelPrivacyPolicySchema = z
  .object({
    mode: channelPrivacyModeSchema,
    searchableByServer: z.boolean(),
    appsMayReadContent: z.boolean(),
    deletedContentRecoveryDays: z.number().int().min(0).max(30),
    evidenceRetentionDays: z.number().int().min(0).max(365),
  })
  .superRefine((policy, context) => {
    if (policy.mode === 'sealed' && (policy.searchableByServer || policy.appsMayReadContent)) {
      context.addIssue({
        code: 'custom',
        message: 'Sealed channels cannot enable server search or app content access.',
      });
    }
  });
export type ChannelPrivacyPolicy = z.infer<typeof channelPrivacyPolicySchema>;

export const accountSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(2).max(32),
  displayName: z.string().min(1).max(64),
  initials: z.string().min(1).max(3),
  status: z.enum(['online', 'idle', 'do-not-disturb', 'offline']),
});
export type Account = z.infer<typeof accountSchema>;

export const presenceUpdateSchema = z.object({
  accountId: z.string().min(1),
  status: z.enum(['online', 'idle', 'do-not-disturb', 'offline']),
});
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

export const participantSchema = accountSchema.pick({
  id: true,
  displayName: true,
  initials: true,
  status: true,
});
export type Participant = z.infer<typeof participantSchema>;

export const stageConfigSchema = z.object({
  broadcastKeybind: z.string().max(32).optional(),
});
export type StageConfig = z.infer<typeof stageConfigSchema>;

export const channelSchema = z.object({
  id: z.string().min(1),
  communityId: z.string().min(1),
  name: z.string().min(1).max(80),
  kind: z.enum(['text', 'voice', 'stage']),
  category: z.string().min(1).max(80),
  topic: z.string().max(240),
  privacy: channelPrivacyPolicySchema,
  parentChannelId: z.string().min(1).optional(),
  stageConfig: stageConfigSchema.optional(),
  participants: z.array(participantSchema).default([]),
});
export type Channel = z.infer<typeof channelSchema>;

export const communitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  mark: z.string().min(1).max(3),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  memberCount: z.number().int().nonnegative(),
});
export type Community = z.infer<typeof communitySchema>;

export const messageAuthorSchema = accountSchema.pick({
  id: true,
  displayName: true,
  initials: true,
  status: true,
});

export const attachmentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1).max(256),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().nonnegative(),
  quarantineStatus: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string().datetime(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const initiateUploadRequestSchema = z.object({
  filename: z.string().min(1).max(256),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().min(1).max(26_214_400),
});
export type InitiateUploadRequest = z.infer<typeof initiateUploadRequestSchema>;

export const messageReplyPreviewSchema = z.object({
  id: z.string().min(1),
  content: z.string().max(4_000),
  authorDisplayName: z.string().min(1).max(64),
  availability: contentAvailabilitySchema,
});
export type MessageReplyPreview = z.infer<typeof messageReplyPreviewSchema>;

export const messageSchema = z.object({
  id: z.string().min(1),
  channelId: z.string().min(1),
  author: messageAuthorSchema,
  availability: contentAvailabilitySchema,
  content: z.string().max(4_000),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  reactions: z.array(
    z.object({
      emoji: z.string().min(1).max(32),
      count: z.number().int().positive(),
      reacted: z.boolean(),
    }),
  ),
  attachments: z.array(attachmentSchema).default([]),
  replyToId: z.string().min(1).optional(),
  replyPreview: messageReplyPreviewSchema.optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const attentionItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['mention', 'reply', 'moderation', 'followed']),
  title: z.string().min(1).max(120),
  detail: z.string().max(240),
  createdAt: z.string().datetime(),
  unread: z.boolean(),
  communityId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const bootstrapStateSchema = z.object({
  account: accountSchema,
  communities: z.array(communitySchema),
  activeCommunityId: z.string().min(1),
  activeChannelId: z.string().min(1),
  channels: z.array(channelSchema),
  messages: z.array(messageSchema),
  attention: z.array(attentionItemSchema),
});
export type BootstrapState = z.infer<typeof bootstrapStateSchema>;

export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
  clientNonce: z.string().min(8).max(128),
  attachmentIds: z.array(z.string().min(1)).max(10).optional(),
  replyToId: z.string().min(1).optional(),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const editMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
});
export type EditMessageRequest = z.infer<typeof editMessageRequestSchema>;

export const messageReactionRequestSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});
export type MessageReactionRequest = z.infer<typeof messageReactionRequestSchema>;

export const messageReactionUpdateSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(32),
  count: z.number().int().nonnegative(),
  actorId: z.string().min(1),
  reacted: z.boolean(),
});
export type MessageReactionUpdate = z.infer<typeof messageReactionUpdateSchema>;

export const updateChannelReadStateRequestSchema = z.object({
  lastReadMessageId: z.string().min(1),
});
export type UpdateChannelReadStateRequest = z.infer<typeof updateChannelReadStateRequestSchema>;

export const channelReadStateSchema = z.object({
  channelId: z.string().min(1),
  accountId: z.string().min(1),
  lastReadMessageId: z.string().min(1),
  updatedAt: z.string().datetime(),
});
export type ChannelReadState = z.infer<typeof channelReadStateSchema>;

export const auditEventSchema = z.object({
  id: z.string().min(1),
  communityId: z.string().min(1),
  actorId: z.string().min(1),
  action: z.enum([
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
    'invite.used',
  ]),
  targetType: z.enum(['message', 'member', 'channel', 'role', 'invite']),
  targetId: z.string().min(1),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  createdAt: z.string().datetime(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const communityStatsSchema = z.object({
  memberCount: z.number().int().nonnegative(),
  channelCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative(),
});
export type CommunityStats = z.infer<typeof communityStatsSchema>;

export const eventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  type: z.string().min(1),
  occurredAt: z.string().datetime(),
  communityId: z.string().optional(),
  actorId: z.string().optional(),
  data: z.unknown(),
});
export type EventEnvelope<T = unknown> = Omit<z.infer<typeof eventEnvelopeSchema>, 'data'> & {
  data: T;
};

export const gatewayServerFrameSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('READY'),
    data: z.object({
      sequence: z.number().int().nonnegative(),
      resumeToken: z.string().min(1),
      bootstrap: bootstrapStateSchema,
    }),
  }),
  z.object({ op: z.literal('EVENT'), data: eventEnvelopeSchema }),
  z.object({
    op: z.literal('ACK'),
    data: z.object({ commandId: z.string().min(1), sequence: z.number().int().nonnegative() }),
  }),
  z.object({
    op: z.literal('HEARTBEAT_ACK'),
    data: z.object({ at: z.string().datetime(), sequence: z.number().int().nonnegative() }),
  }),
  z.object({
    op: z.literal('RESYNC_REQUIRED'),
    data: z.object({ reason: z.string().min(1) }),
  }),
]);
export type GatewayServerFrame = z.infer<typeof gatewayServerFrameSchema>;

export const gatewayClientFrameSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('HEARTBEAT'),
    data: z.object({ sequence: z.number().int().nonnegative() }),
  }),
]);
export type GatewayClientFrame = z.infer<typeof gatewayClientFrameSchema>;

export const emailLoginRequestSchema = z.object({
  email: z.string().email(),
});
export type EmailLoginRequest = z.infer<typeof emailLoginRequestSchema>;

export const emailLoginResponseSchema = z.object({
  success: z.boolean(),
  challengeId: z.string().min(1),
});
export type EmailLoginResponse = z.infer<typeof emailLoginResponseSchema>;

export const emailVerifyRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  challengeId: z.string().min(1),
});
export type EmailVerifyRequest = z.infer<typeof emailVerifyRequestSchema>;

export const authResponseSchema = z.object({
  sessionToken: z.string().min(1),
  account: accountSchema,
  isNewUser: z.boolean(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const passkeyRegisterOptionsResponseSchema = z.object({
  challenge: z.string().min(1),
  rp: z.object({
    name: z.string(),
    id: z.string(),
  }),
  user: z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
  }),
  pubKeyCredParams: z.array(
    z.object({
      type: z.literal('public-key'),
      alg: z.number().int(),
    }),
  ),
});
export type PasskeyRegisterOptionsResponse = z.infer<typeof passkeyRegisterOptionsResponseSchema>;

export const passkeyRegisterVerifySchema = z.object({
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  rawId: z.string().min(1),
  attestationObject: z.string().min(1),
  clientDataJSON: z.string().min(1),
});
export type PasskeyRegisterVerify = z.infer<typeof passkeyRegisterVerifySchema>;

export const passkeyLoginOptionsResponseSchema = z.object({
  challenge: z.string().min(1),
  rpId: z.string(),
  allowCredentials: z
    .array(
      z.object({
        type: z.literal('public-key'),
        id: z.string(),
      }),
    )
    .optional(),
});
export type PasskeyLoginOptionsResponse = z.infer<typeof passkeyLoginOptionsResponseSchema>;

export const passkeyLoginVerifySchema = z.object({
  email: z.string().email(),
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  authenticatorData: z.string().min(1),
  clientDataJSON: z.string().min(1),
  signature: z.string().min(1),
  userHandle: z.string().optional(),
});
export type PasskeyLoginVerify = z.infer<typeof passkeyLoginVerifySchema>;

export const createCommunityRequestSchema = z.object({
  name: z.string().min(1).max(80),
  mark: z.string().min(1).max(3).optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type CreateCommunityRequest = z.infer<typeof createCommunityRequestSchema>;

export const createChannelRequestSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(['text', 'voice', 'stage']),
  category: z.string().min(1).max(80),
  topic: z.string().max(240).optional(),
  privacy: channelPrivacyPolicySchema.optional(),
});
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;

export const voiceSessionSchema = z.object({
  token: z.string().min(1),
  url: z.string().min(1),
  roomName: z.string().min(1),
  participantId: z.string().min(1),
});
export type VoiceSession = z.infer<typeof voiceSessionSchema>;

export const rolePermissionSchema = z.object({
  permission: z.string().trim().min(1).max(64),
  effect: z.enum(['allow', 'deny']),
});
export type RolePermission = z.infer<typeof rolePermissionSchema>;

export const roleSchema = z.object({
  id: z.string().min(1),
  communityId: z.string().min(1),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  managed: z.boolean().default(false),
  permissions: z.array(rolePermissionSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Role = z.infer<typeof roleSchema>;

export const createRoleRequestSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().max(256).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(rolePermissionSchema).max(64).optional(),
});
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

export const updateRoleRequestSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().max(256).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(rolePermissionSchema).max(64).optional(),
});
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

export const inviteSchema = z.object({
  id: z.string().min(1),
  communityId: z.string().min(1),
  code: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  maxUses: z.number().int().positive().nullable(),
  uses: z.number().int().nonnegative(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const createInviteRequestSchema = z.object({
  maxUses: z.number().int().min(1).max(1_000).optional(),
  expiresInSeconds: z
    .number()
    .int()
    .min(300)
    .max(30 * 24 * 60 * 60)
    .optional(),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

export const inviteResponseSchema = z.object({
  invite: inviteSchema,
  url: z.string().min(1),
});
export type InviteResponse = z.infer<typeof inviteResponseSchema>;

export const permissionRuleSchema = z.object({
  subject: z.enum(['base', 'role', 'member']),
  subjectId: z.string().optional(),
  permission: z.string().min(1),
  effect: z.enum(['allow', 'deny']),
});
export type PermissionRuleInput = z.infer<typeof permissionRuleSchema>;

export const permissionSimulatorRequestSchema = z.object({
  permission: z.string().min(1),
  memberId: z.string().min(1),
  roleIds: z.array(z.string().min(1)),
  isOwner: z.boolean(),
  isAdministrator: z.boolean(),
  rules: z.array(permissionRuleSchema),
  ownerOnly: z.boolean().optional(),
  administratorBypassAllowed: z.boolean().optional(),
});
export type PermissionSimulatorRequest = z.infer<typeof permissionSimulatorRequestSchema>;

export const permissionDecisionSchema = z.object({
  allowed: z.boolean(),
  source: z.string().min(1),
  explanation: z.string().min(1),
});
export type PermissionDecisionResult = z.infer<typeof permissionDecisionSchema>;

export const deviceSessionSchema = z.object({
  id: z.string().min(1),
  deviceName: z.string().min(1),
  ipAddress: z.string(),
  lastActiveAt: z.string().datetime(),
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof deviceSessionSchema>;

export const deviceSessionsListSchema = z.object({
  sessions: z.array(deviceSessionSchema),
});
export type DeviceSessionsList = z.infer<typeof deviceSessionsListSchema>;

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export const banSchema = z.object({
  communityId: z.string().min(1),
  accountId: z.string().min(1),
  reason: z.string().max(512).optional(),
  actorId: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Ban = z.infer<typeof banSchema>;

export const banMemberRequestSchema = z.object({
  accountId: z.string().min(1),
  reason: z.string().max(512).optional(),
});
export type BanMemberRequest = z.infer<typeof banMemberRequestSchema>;
