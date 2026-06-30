import { describe, expect, it } from 'vitest';
import {
  channelPrivacyPolicySchema,
  channelSchema,
  createInviteRequestSchema,
  createRoleRequestSchema,
  auditEventSchema,
  attentionItemSchema,
  channelReadStateSchema,
  demoBootstrap,
  editMessageRequestSchema,
  gatewayServerFrameSchema,
  messageReactionRequestSchema,
  resolvePermission,
  stageConfigSchema,
  presenceUpdateSchema,
} from './index.js';

describe('privacy contracts', () => {
  it('rejects server-readable features in sealed channels', () => {
    const result = channelPrivacyPolicySchema.safeParse({
      mode: 'sealed',
      searchableByServer: true,
      appsMayReadContent: false,
      deletedContentRecoveryDays: 0,
      evidenceRetentionDays: 0,
    });

    expect(result.success).toBe(false);
  });

  it('accepts the demo bootstrap in a READY frame', () => {
    const result = gatewayServerFrameSchema.safeParse({
      op: 'READY',
      data: { sequence: 0, resumeToken: 'demo-token', bootstrap: demoBootstrap },
    });

    expect(result.success).toBe(true);
  });
});

describe('permission precedence', () => {
  const rules = [
    { subject: 'base' as const, permission: 'message.send', effect: 'allow' as const },
    {
      subject: 'role' as const,
      subjectId: 'muted',
      permission: 'message.send',
      effect: 'deny' as const,
    },
    {
      subject: 'member' as const,
      subjectId: 'member-1',
      permission: 'message.send',
      effect: 'allow' as const,
    },
  ];

  it('lets an explicit member allow outrank a role deny', () => {
    const decision = resolvePermission({
      permission: 'message.send',
      memberId: 'member-1',
      roleIds: ['muted'],
      isOwner: false,
      isAdministrator: false,
      rules,
    });

    expect(decision).toMatchObject({ allowed: true, source: 'member-allow' });
  });

  it('does not let administrator bypass owner-only capabilities', () => {
    const decision = resolvePermission({
      permission: 'community.transfer',
      memberId: 'member-1',
      roleIds: ['admin'],
      isOwner: false,
      isAdministrator: true,
      ownerOnly: true,
      rules: [],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.explanation).toContain('owners');
  });
});

describe('role and invite contracts', () => {
  it('bounds role permissions and invite lifetime inputs', () => {
    expect(
      createRoleRequestSchema.safeParse({
        name: 'Muted',
        permissions: [{ permission: 'message.send', effect: 'deny' }],
      }).success,
    ).toBe(true);
    expect(createRoleRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createInviteRequestSchema.safeParse({ expiresInSeconds: 300 }).success).toBe(true);
    expect(createInviteRequestSchema.safeParse({ expiresInSeconds: 30 }).success).toBe(false);
    expect(createInviteRequestSchema.safeParse({ maxUses: 1_001 }).success).toBe(false);
  });
});

describe('managed message lifecycle contracts', () => {
  it('validates edits, reactions, read states, and metadata-only audit events', () => {
    expect(editMessageRequestSchema.safeParse({ content: ' revised ' }).success).toBe(true);
    expect(editMessageRequestSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(messageReactionRequestSchema.safeParse({ emoji: '✓' }).success).toBe(true);
    expect(messageReactionRequestSchema.safeParse({ emoji: '' }).success).toBe(false);
    expect(
      channelReadStateSchema.safeParse({
        channelId: 'channel-1',
        accountId: 'account-1',
        lastReadMessageId: 'message-1',
        updatedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(
      auditEventSchema.safeParse({
        id: 'audit-1',
        communityId: 'community-1',
        actorId: 'account-1',
        action: 'message.deleted',
        targetType: 'message',
        targetId: 'message-1',
        metadata: { channelId: 'channel-1' },
        createdAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});

describe('attention contracts', () => {
  it('validates navigable reply attention items', () => {
    expect(
      attentionItemSchema.safeParse({
        id: 'reply-message-1',
        kind: 'reply',
        title: 'Ren replied to you',
        detail: 'Ready when you are.',
        createdAt: new Date().toISOString(),
        unread: true,
        communityId: 'community-1',
        channelId: 'channel-1',
        messageId: 'message-1',
      }).success,
    ).toBe(true);
  });
});

describe('stage channels', () => {
  it('accepts a stage channel with broadcast keybind', () => {
    const result = channelSchema.safeParse({
      id: 'stage-1',
      communityId: 'community-ember',
      name: 'Main Stage',
      kind: 'stage',
      category: 'Voice',
      topic: 'Broadcast channel.',
      privacy: {
        mode: 'sealed',
        searchableByServer: false,
        appsMayReadContent: false,
        deletedContentRecoveryDays: 0,
        evidenceRetentionDays: 0,
      },
      stageConfig: { broadcastKeybind: 'Ctrl+Shift+V' },
      participants: [],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a stage channel without a keybind', () => {
    const result = channelSchema.safeParse({
      id: 'stage-2',
      communityId: 'community-ember',
      name: 'Open Mic',
      kind: 'stage',
      category: 'Voice',
      topic: 'Always-on broadcast.',
      privacy: {
        mode: 'managed',
        searchableByServer: true,
        appsMayReadContent: false,
        deletedContentRecoveryDays: 7,
        evidenceRetentionDays: 90,
      },
      participants: [],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a voice subchannel parented under a stage channel', () => {
    const result = channelSchema.safeParse({
      id: 'sub-1',
      communityId: 'community-ember',
      name: 'Squad Alpha',
      kind: 'voice',
      category: 'Voice',
      topic: 'Subchannel under Main Stage.',
      privacy: {
        mode: 'sealed',
        searchableByServer: false,
        appsMayReadContent: false,
        deletedContentRecoveryDays: 0,
        evidenceRetentionDays: 0,
      },
      parentChannelId: 'stage-1',
      participants: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a stage channel with an overly long keybind', () => {
    const result = stageConfigSchema.safeParse({
      broadcastKeybind: 'A'.repeat(33),
    });

    expect(result.success).toBe(false);
  });

  it('accepts stage config without a keybind', () => {
    const result = stageConfigSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

describe('presence contracts', () => {
  it('validates presence update payload shapes', () => {
    const valid = presenceUpdateSchema.safeParse({
      accountId: 'account-123',
      status: 'online',
    });
    expect(valid.success).toBe(true);

    const invalidStatus = presenceUpdateSchema.safeParse({
      accountId: 'account-123',
      status: 'unknown',
    });
    expect(invalidStatus.success).toBe(false);

    const missingFields = presenceUpdateSchema.safeParse({
      status: 'offline',
    });
    expect(missingFields.success).toBe(false);
  });
});
