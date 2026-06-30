import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { demoBootstrap } from '@cove/contracts';
import {
  App,
  dismissAttentionItem,
  markAllAttentionRead,
  reconcileAttentionItem,
  reconcileAuditLog,
  reconcileMessageUpdate,
  reconcileParticipantRole,
  reconcileReactionUpdate,
  reconcileSavedMessage,
  reconcileVoiceJoin,
  reconcileVoiceLeave,
} from './App';

describe('application shell', () => {
  it('renders the four-region community experience', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Spaces' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'campfire' })).toBeInTheDocument();
    expect(screen.getByLabelText('Channel privacy')).toHaveTextContent('Managed conversation');
    expect(screen.getByRole('button', { name: 'Close context panel' })).toBeInTheDocument();
  });

  it('switches channels and explains sealed-mode limits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /backstage/i }));
    expect(screen.getByLabelText('Channel privacy')).toHaveTextContent('Sealed conversation');
    expect(screen.getByText(/reviewed MLS adapter/i)).toBeInTheDocument();
  });

  it('exposes density and theme controls with accessible names', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Density'), 'compact');
    await user.selectOptions(screen.getByLabelText('Theme'), 'contrast');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.theme).toBe('contrast');
  });

  it('reconciles an optimistic send without duplicating a gateway event', () => {
    const saved = demoBootstrap.messages[0]!;
    const optimistic = { ...saved, id: 'optimistic-1' };

    expect(reconcileSavedMessage([optimistic], optimistic.id, saved)).toEqual([saved]);
    expect(reconcileSavedMessage([optimistic, saved], optimistic.id, saved)).toEqual([saved]);
  });

  it('reconciles edited, deleted, and reaction gateway updates', () => {
    const original = demoBootstrap.messages[0]!;
    const edited = { ...original, content: 'Updated', editedAt: new Date().toISOString() };
    expect(reconcileMessageUpdate([original], edited)[0]?.content).toBe('Updated');

    const reacted = reconcileReactionUpdate(
      [{ ...original, reactions: [] }],
      { messageId: original.id, emoji: '✓', count: 1, actorId: 'account-you', reacted: true },
      'account-you',
    );
    expect(reacted[0]?.reactions).toEqual([{ emoji: '✓', count: 1, reacted: true }]);

    const removed = reconcileReactionUpdate(
      reacted,
      { messageId: original.id, emoji: '✓', count: 0, actorId: 'account-you', reacted: false },
      'account-you',
    );
    expect(removed[0]?.reactions).toEqual([]);
  });

  it('puts reply attention first without duplicating replayed events', () => {
    const existing = demoBootstrap.attention[0]!;
    const reply = {
      id: 'reply-message-1',
      kind: 'reply' as const,
      title: 'Ren replied to you',
      detail: 'Ready when you are.',
      createdAt: new Date().toISOString(),
      unread: true,
      communityId: 'community-ember',
      channelId: 'channel-campfire',
      messageId: 'message-1',
    };

    expect(reconcileAttentionItem([existing], reply)).toEqual([reply, existing]);
    expect(reconcileAttentionItem([reply, existing], reply)).toEqual([reply, existing]);
  });

  it('renders the audit log toggle button in the community nav', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Open audit log' })).toBeInTheDocument();
  });

  it('shows the audit log panel when toggled open', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open audit log' }));
    expect(screen.getByRole('region', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByText('No audit events yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close audit log' })).toBeInTheDocument();
  });

  it('merges audit event pages without duplicating entries', () => {
    const baseEvent = {
      id: 'audit-1',
      communityId: 'community-ember',
      actorId: 'account-mara',
      action: 'channel.created' as const,
      targetType: 'channel' as const,
      targetId: 'channel-campfire',
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    const secondEvent = { ...baseEvent, id: 'audit-2', action: 'member.joined' as const };

    expect(reconcileAuditLog([baseEvent], [baseEvent, secondEvent])).toHaveLength(2);
    expect(reconcileAuditLog([baseEvent], [secondEvent])).toEqual([baseEvent, secondEvent]);
    expect(reconcileAuditLog([], [baseEvent, baseEvent])).toEqual([baseEvent]);
    expect(reconcileAuditLog([], [])).toEqual([]);
  });

  it('reconciles voice participant join and leave events', () => {
    const channel = demoBootstrap.channels.find((c) => c.kind === 'voice')!;
    const participant = {
      id: 'account-newcomer',
      displayName: 'Nova',
      initials: 'N',
      status: 'online' as const,
    };

    const afterJoin = reconcileVoiceJoin(demoBootstrap.channels, channel.id, participant);
    const joined = afterJoin.find((c) => c.id === channel.id)!;
    expect(joined.participants.some((p) => p.id === 'account-newcomer')).toBe(true);

    // Idempotent: joining again does not duplicate
    const afterJoinAgain = reconcileVoiceJoin(afterJoin, channel.id, participant);
    expect(
      afterJoinAgain
        .find((c) => c.id === channel.id)!
        .participants.filter((p) => p.id === 'account-newcomer'),
    ).toHaveLength(1);

    const afterLeave = reconcileVoiceLeave(afterJoin, channel.id, 'account-newcomer');
    const left = afterLeave.find((c) => c.id === channel.id)!;
    expect(left.participants.some((p) => p.id === 'account-newcomer')).toBe(false);

    // Other channels are unaffected
    const textChannel = demoBootstrap.channels.find((c) => c.kind === 'text')!;
    expect(afterLeave.find((c) => c.id === textChannel.id)).toEqual(textChannel);
  });

  it('renders the stage channel focus view with hold-to-speak control', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Main Stage/i }));
    // Both intro (h1) and focus (h2) show channel name; at least one heading must be present
    expect(screen.getAllByRole('heading', { name: /Main Stage/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText(/PRESS & HOLD TO SPEAK|Join Stage/i)).toBeInTheDocument();
  });

  it('renders subchannels nested under their parent stage channel in the nav', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Squad Alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Squad Bravo/i })).toBeInTheDocument();
  });

  it('updates participant role when reconcileParticipantRole is called', () => {
    const stageChannel = demoBootstrap.channels.find((c) => c.kind === 'stage')!;
    const speaker = stageChannel.participants[0]!;

    const asListener = reconcileParticipantRole(
      demoBootstrap.channels,
      stageChannel.id,
      speaker.id,
      'listener',
    );
    const updated = asListener.find((c) => c.id === stageChannel.id)!;
    expect(updated.participants.find((p) => p.id === speaker.id)?.participantRole).toBe('listener');

    // Other channels are unaffected
    const textChannel = demoBootstrap.channels.find((c) => c.kind === 'text')!;
    expect(asListener.find((c) => c.id === textChannel.id)).toEqual(textChannel);
  });

  it('dismisses a single attention item by id', () => {
    const a = demoBootstrap.attention[0]!;
    const b = { ...a, id: 'item-b' };
    expect(dismissAttentionItem([a, b], a.id)).toEqual([b]);
    expect(dismissAttentionItem([a, b], 'unknown')).toEqual([a, b]);
    expect(dismissAttentionItem([], a.id)).toEqual([]);
  });

  it('marks all attention items as read', () => {
    const unread = { ...demoBootstrap.attention[0]!, unread: true, id: 'item-u1' };
    const alreadyRead = { ...demoBootstrap.attention[0]!, unread: false, id: 'item-u2' };
    const result = markAllAttentionRead([unread, alreadyRead]);
    expect(result.every((i) => !i.unread)).toBe(true);
    expect(result).toHaveLength(2);
    // Identity is preserved for items already read
    expect(result[1]).toBe(alreadyRead);
  });
});
