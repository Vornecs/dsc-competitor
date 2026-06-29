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

export const participantSchema = accountSchema.pick({
  id: true,
  displayName: true,
  initials: true,
  status: true,
});
export type Participant = z.infer<typeof participantSchema>;

export const channelSchema = z.object({
  id: z.string().min(1),
  communityId: z.string().min(1),
  name: z.string().min(1).max(80),
  kind: z.enum(['text', 'voice']),
  category: z.string().min(1).max(80),
  topic: z.string().max(240),
  privacy: channelPrivacyPolicySchema,
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
});
export type Message = z.infer<typeof messageSchema>;

export const attentionItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['mention', 'reply', 'moderation', 'followed']),
  title: z.string().min(1).max(120),
  detail: z.string().max(240),
  createdAt: z.string().datetime(),
  unread: z.boolean(),
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
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

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

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}
