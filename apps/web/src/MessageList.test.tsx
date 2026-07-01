import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MessageList from './MessageList';
import { type Message } from '@cove/contracts';

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    channelId: 'chan-1',
    content: 'Hello world!',
    createdAt: '2026-07-01T12:00:00Z',
    availability: 'plaintext',
    author: {
      id: 'user-1',
      displayName: 'Alice Smith',
      initials: 'AS',
      status: 'online',
    },
    reactions: [],
    editedAt: null,
    attachments: [],
  },
  {
    id: 'msg-2',
    channelId: 'chan-1',
    content: 'Another message from Alice',
    createdAt: '2026-07-01T12:01:00Z',
    availability: 'plaintext',
    author: {
      id: 'user-1',
      displayName: 'Alice Smith',
      initials: 'AS',
      status: 'online',
    },
    reactions: [{ emoji: '👍', count: 2, reacted: true }],
    editedAt: null,
    attachments: [],
  },
  {
    id: 'msg-3',
    channelId: 'chan-1',
    content: 'Hi Alice, I am Bob',
    createdAt: '2026-07-01T12:02:00Z',
    availability: 'plaintext',
    author: {
      id: 'user-2',
      displayName: 'Bob Jones',
      initials: 'BJ',
      status: 'idle',
    },
    reactions: [],
    editedAt: null,
    attachments: [],
  },
  {
    id: 'msg-4',
    channelId: 'chan-1',
    content: 'This message was deleted',
    createdAt: '2026-07-01T12:03:00Z',
    availability: 'deleted',
    author: {
      id: 'user-2',
      displayName: 'Bob Jones',
      initials: 'BJ',
      status: 'idle',
    },
    reactions: [],
    editedAt: null,
    attachments: [],
  },
];

describe('MessageList', () => {
  it('renders messages correctly', () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onEmojiPickerOpen = vi.fn();

    render(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId={null}
      />,
    );

    // Displays content for visible messages
    expect(screen.getByText('Hello world!')).toBeInTheDocument();
    expect(screen.getByText('Another message from Alice')).toBeInTheDocument();
    expect(screen.getByText('Hi Alice, I am Bob')).toBeInTheDocument();

    // Displays alternative text for deleted messages
    expect(screen.getByText('Message deleted')).toBeInTheDocument();

    // Display author names for non-grouped messages
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('groups consecutive messages from the same author', () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onEmojiPickerOpen = vi.fn();

    const { container } = render(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId={null}
      />,
    );

    const articles = container.querySelectorAll('article.message');
    expect(articles).toHaveLength(4);

    // First message from Alice is NOT grouped
    expect(articles[0]).not.toHaveClass('message--grouped');

    // Second message from Alice IS grouped
    expect(articles[1]).toHaveClass('message--grouped');

    // First message from Bob is NOT grouped
    expect(articles[2]).not.toHaveClass('message--grouped');

    // Second message from Bob IS grouped
    expect(articles[3]).toHaveClass('message--grouped');
  });

  it('handles reaction clicking', async () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onEmojiPickerOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId={null}
      />,
    );

    const reactionBtn = screen.getByRole('button', { name: '👍 2' });
    expect(reactionBtn).toBeInTheDocument();
    expect(reactionBtn).toHaveClass('is-reacted');

    await user.click(reactionBtn);
    expect(onReact).toHaveBeenCalledWith('msg-2', '👍', true);
  });

  it('opens emoji picker on click and selects emoji', async () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onEmojiPickerOpen = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId={null}
      />,
    );

    // Find and click the react action button on msg-1
    const reactActionButtons = screen.getAllByRole('button', { name: 'React' });
    await user.click(reactActionButtons[0]!);
    expect(onEmojiPickerOpen).toHaveBeenCalledWith('msg-1');

    // Rerender with emoji picker open on msg-1
    rerender(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId="msg-1"
      />,
    );

    const picker = screen.getByRole('dialog', { name: 'Pick a reaction' });
    expect(picker).toBeInTheDocument();

    const fireEmoji = screen.getByRole('button', { name: '🔥' });
    await user.click(fireEmoji);

    expect(onEmojiPickerOpen).toHaveBeenCalledWith(null);
    expect(onReact).toHaveBeenCalledWith('msg-1', '🔥', false);
  });

  it('triggers reply event when reply button is clicked', async () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onEmojiPickerOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageList
        messages={mockMessages}
        currentUserId="user-2"
        onReact={onReact}
        onReply={onReply}
        onEmojiPickerOpen={onEmojiPickerOpen}
        emojiPickerMessageId={null}
      />,
    );

    const replyButtons = screen.getAllByRole('button', { name: 'Reply' });
    await user.click(replyButtons[0]!);

    expect(onReply).toHaveBeenCalledWith('msg-1', 'Hello world!');
  });
});
