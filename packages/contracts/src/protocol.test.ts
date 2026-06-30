import { describe, expect, it } from 'vitest';
import {
  channelPrivacyPolicySchema,
  channelSchema,
  communityStatsSchema,
  communityExportSchema,
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
  voiceParticipantJoinedSchema,
  voiceParticipantLeftSchema,
  stageParticipantsSchema,
  screenShareStartedSchema,
  screenShareEndedSchema,
  stageSpeakingStateSchema,
  createChannelRequestSchema,
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

  it('validates expanded audit event actions and target types', () => {
    const memberJoin = auditEventSchema.safeParse({
      id: 'audit-2',
      communityId: 'community-1',
      actorId: 'account-1',
      action: 'member.joined',
      targetType: 'member',
      targetId: 'account-1',
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    expect(memberJoin.success).toBe(true);

    const roleCreated = auditEventSchema.safeParse({
      id: 'audit-3',
      communityId: 'community-1',
      actorId: 'account-1',
      action: 'role.created',
      targetType: 'role',
      targetId: 'role-1',
      metadata: { name: 'Moderator' },
      createdAt: new Date().toISOString(),
    });
    expect(roleCreated.success).toBe(true);

    const unknownAction = auditEventSchema.safeParse({
      id: 'audit-4',
      communityId: 'community-1',
      actorId: 'account-1',
      action: 'unknown.action',
      targetType: 'member',
      targetId: 'account-1',
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    expect(unknownAction.success).toBe(false);
  });
});

describe('community stats contracts', () => {
  it('validates community stats shape', () => {
    expect(
      communityStatsSchema.safeParse({
        memberCount: 42,
        channelCount: 5,
        messageCount: 1200,
        onlineCount: 7,
      }).success,
    ).toBe(true);

    expect(
      communityStatsSchema.safeParse({
        memberCount: -1,
        channelCount: 0,
        messageCount: 0,
        onlineCount: 0,
      }).success,
    ).toBe(false);
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

describe('community export contract', () => {
  it('validates a minimal community export bundle', () => {
    const channel = demoBootstrap.channels[0]!;
    const community = demoBootstrap.communities[0]!;
    const result = communityExportSchema.safeParse({
      version: 1,
      exportedAt: new Date().toISOString(),
      community,
      channels: [channel],
      roles: [],
      memberCount: 3,
      messages: [],
      inviteCount: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects export bundles with wrong version', () => {
    const community = demoBootstrap.communities[0]!;
    const result = communityExportSchema.safeParse({
      version: 2,
      exportedAt: new Date().toISOString(),
      community,
      channels: [],
      roles: [],
      memberCount: 0,
      messages: [],
      inviteCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('voice participant event contracts', () => {
  it('validates voice.participant.joined and voice.participant.left payloads', () => {
    const joined = voiceParticipantJoinedSchema.safeParse({
      channelId: 'channel-1',
      participant: {
        id: 'account-1',
        displayName: 'Ren',
        initials: 'R',
        status: 'online',
      },
    });
    expect(joined.success).toBe(true);

    expect(voiceParticipantJoinedSchema.safeParse({ channelId: '' }).success).toBe(false);

    const left = voiceParticipantLeftSchema.safeParse({
      channelId: 'channel-1',
      participantId: 'account-1',
    });
    expect(left.success).toBe(true);

    expect(voiceParticipantLeftSchema.safeParse({ channelId: 'channel-1' }).success).toBe(false);
  });

  it('accepts participant with optional participantRole', () => {
    const joined = voiceParticipantJoinedSchema.safeParse({
      channelId: 'channel-1',
      participant: {
        id: 'acc-1',
        displayName: 'Ren',
        initials: 'R',
        status: 'online',
        participantRole: 'speaker',
      },
    });
    expect(joined.success).toBe(true);

    const listener = voiceParticipantJoinedSchema.safeParse({
      channelId: 'sub-1',
      participant: {
        id: 'acc-2',
        displayName: 'Sam',
        initials: 'S',
        status: 'online',
        participantRole: 'listener',
      },
    });
    expect(listener.success).toBe(true);
  });
});

describe('stage and screen-share contracts', () => {
  it('validates keybind-gated stage speaking state', () => {
    const result = stageSpeakingStateSchema.safeParse({
      channelId: 'stage-1',
      participantId: 'acc-1',
      participantRole: 'speaker',
      active: true,
      mediaSession: {
        token: 'token',
        url: 'wss://media.example',
        roomName: 'room-stage-1',
        participantId: 'acc-1',
        canPublish: true,
      },
    });
    expect(result.success).toBe(true);
    expect(
      stageSpeakingStateSchema.safeParse({ channelId: 'stage-1', active: 'yes' }).success,
    ).toBe(false);
  });

  it('validates stageParticipantsSchema', () => {
    const result = stageParticipantsSchema.safeParse({
      channelId: 'stage-1',
      speakers: [
        {
          id: 'acc-1',
          displayName: 'Ren',
          initials: 'R',
          status: 'online',
          participantRole: 'speaker',
        },
      ],
      listeners: [
        {
          id: 'acc-2',
          displayName: 'Sam',
          initials: 'S',
          status: 'online',
          participantRole: 'listener',
        },
      ],
      screenShares: [{ participantId: 'acc-1', trackId: 'track-abc' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.speakers).toHaveLength(1);
    expect(result.data?.listeners).toHaveLength(1);
    expect(result.data?.screenShares).toHaveLength(1);
  });

  it('validates screenShareStartedSchema', () => {
    expect(
      screenShareStartedSchema.safeParse({
        channelId: 'ch-1',
        participantId: 'acc-1',
        trackId: 'track-1',
      }).success,
    ).toBe(true);
    expect(
      screenShareStartedSchema.safeParse({ channelId: 'ch-1', participantId: 'acc-1' }).success,
    ).toBe(false);
  });

  it('validates screenShareEndedSchema', () => {
    expect(
      screenShareEndedSchema.safeParse({ channelId: 'ch-1', participantId: 'acc-1' }).success,
    ).toBe(true);
    expect(screenShareEndedSchema.safeParse({ channelId: '' }).success).toBe(false);
  });

  it('accepts createChannelRequestSchema with parentChannelId and stageConfig', () => {
    const sub = createChannelRequestSchema.safeParse({
      name: 'Squad Alpha',
      kind: 'voice',
      category: 'Voice',
      parentChannelId: 'stage-1',
    });
    expect(sub.success).toBe(true);
    expect(sub.data?.parentChannelId).toBe('stage-1');

    const stage = createChannelRequestSchema.safeParse({
      name: 'Main Stage',
      kind: 'stage',
      category: 'Voice',
      stageConfig: { broadcastKeybind: 'Ctrl+Shift+V' },
    });
    expect(stage.success).toBe(true);
    expect(stage.data?.stageConfig?.broadcastKeybind).toBe('Ctrl+Shift+V');
  });
});
