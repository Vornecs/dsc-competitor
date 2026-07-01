import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AttentionItem } from '@cove/contracts';
import AttentionPanel from './AttentionPanel';

const mockItems: AttentionItem[] = [
  {
    id: 'attn-1',
    kind: 'mention',
    title: 'New mention in #general',
    detail: 'Alice mentioned you: "Hey @user!"',
    createdAt: '2026-07-01T12:00:00.000Z',
    unread: true,
    communityId: 'comm-1',
    channelId: 'chan-1',
    messageId: 'msg-1',
  },
  {
    id: 'attn-2',
    kind: 'reply',
    title: 'New reply to your message',
    detail: 'Bob replied to you in #lounge',
    createdAt: '2026-07-01T12:05:00.000Z',
    unread: false,
    communityId: 'comm-1',
    channelId: 'chan-2',
    messageId: 'msg-2',
  },
  {
    id: 'attn-3',
    kind: 'moderation',
    title: 'Post flagged',
    detail: 'Your post was flagged by system filters',
    createdAt: '2026-07-01T12:10:00.000Z',
    unread: false,
    communityId: 'comm-1',
  },
];

describe('AttentionPanel', () => {
  it('renders title and empty state correctly', () => {
    render(
      <AttentionPanel
        items={[]}
        mutedChannelIds={new Set()}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
        onToggleMute={() => {}}
      />,
    );

    expect(screen.getByText('Attention')).toBeInTheDocument();
    const markAllReadBtn = screen.getByRole('button', { name: 'Mark all as read' });
    expect(markAllReadBtn).toBeInTheDocument();
    expect(markAllReadBtn).toBeDisabled();
  });

  it('renders attention items with correct content and classes', () => {
    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={new Set()}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
        onToggleMute={() => {}}
      />,
    );

    expect(screen.getByText('New mention in #general')).toBeInTheDocument();
    expect(screen.getByText('Alice mentioned you: "Hey @user!"')).toBeInTheDocument();
    expect(screen.getByText('New reply to your message')).toBeInTheDocument();
    expect(screen.getByText('Bob replied to you in #lounge')).toBeInTheDocument();
    expect(screen.getByText('Post flagged')).toBeInTheDocument();

    const item1 = screen.getByTestId('attention-item-attn-1');
    const item2 = screen.getByTestId('attention-item-attn-2');
    const item3 = screen.getByTestId('attention-item-attn-3');

    expect(item1).toHaveClass('is-unread');
    expect(item2).not.toHaveClass('is-unread');
    expect(item3).not.toHaveClass('is-unread');
  });

  it('enables Mark all read button when there are unread items', () => {
    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={new Set()}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
        onToggleMute={() => {}}
      />,
    );

    const markAllReadBtn = screen.getByRole('button', { name: 'Mark all as read' });
    expect(markAllReadBtn).not.toBeDisabled();
  });

  it('calls onMarkAllRead when clicking Mark all read button', async () => {
    const onMarkAllRead = vi.fn();
    const user = userEvent.setup();

    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={new Set()}
        onMarkAllRead={onMarkAllRead}
        onDismiss={() => {}}
        onToggleMute={() => {}}
      />,
    );

    const markAllReadBtn = screen.getByRole('button', { name: 'Mark all as read' });
    await user.click(markAllReadBtn);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss with the item id when clicking dismiss button', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={new Set()}
        onMarkAllRead={() => {}}
        onDismiss={onDismiss}
        onToggleMute={() => {}}
      />,
    );

    const item1 = screen.getByTestId('attention-item-attn-1');
    const dismissBtn = item1.querySelector('button[title="Dismiss"]');
    expect(dismissBtn).toBeInTheDocument();

    await user.click(dismissBtn!);
    expect(onDismiss).toHaveBeenCalledWith('attn-1');
  });

  it('calls onToggleMute with channelId when clicking mute/unmute button', async () => {
    const onToggleMute = vi.fn();
    const user = userEvent.setup();

    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={new Set()}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
        onToggleMute={onToggleMute}
      />,
    );

    const item1 = screen.getByTestId('attention-item-attn-1');
    const muteBtn = item1.querySelector('button[title="Mute channel"]');
    expect(muteBtn).toBeInTheDocument();

    await user.click(muteBtn!);
    expect(onToggleMute).toHaveBeenCalledWith('chan-1');
  });

  it('renders correct mute visual states based on mutedChannelIds', () => {
    const mutedSet = new Set(['chan-1']);

    render(
      <AttentionPanel
        items={mockItems}
        mutedChannelIds={mutedSet}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
        onToggleMute={() => {}}
      />,
    );

    const item1 = screen.getByTestId('attention-item-attn-1');
    const muteBtn1 = item1.querySelector('button[title="Unmute channel"]');
    expect(muteBtn1).toBeInTheDocument();
    expect(muteBtn1).toHaveClass('is-muted');

    const item2 = screen.getByTestId('attention-item-attn-2');
    const muteBtn2 = item2.querySelector('button[title="Mute channel"]');
    expect(muteBtn2).toBeInTheDocument();
    expect(muteBtn2).not.toHaveClass('is-muted');

    // Item 3 has no channelId, so it should not render a mute button
    const item3 = screen.getByTestId('attention-item-attn-3');
    const muteBtn3 = item3.querySelector('button[title="Mute channel"]');
    const unmuteBtn3 = item3.querySelector('button[title="Unmute channel"]');
    expect(muteBtn3).not.toBeInTheDocument();
    expect(unmuteBtn3).not.toBeInTheDocument();
  });
});
