import { describe, expect, it } from 'vitest';
import {
  channelPrivacyPolicySchema,
  createInviteRequestSchema,
  createRoleRequestSchema,
  demoBootstrap,
  gatewayServerFrameSchema,
  resolvePermission,
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
