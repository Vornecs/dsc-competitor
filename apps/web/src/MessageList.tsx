import React from 'react';
import { type Message } from '@cove/contracts';
import { Avatar, IconButton } from '@cove/ui';
import { Smile, MessageSquareText, MoreHorizontal } from 'lucide-react';

export interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string, reacted: boolean) => void;
  onReply: (messageId: string, content: string) => void;
  onEmojiPickerOpen: (messageId: string | null) => void;
  emojiPickerMessageId: string | null;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value),
  );
}

export function MessageList({
  messages,
  currentUserId,
  onReact,
  onReply,
  onEmojiPickerOpen,
  emojiPickerMessageId,
}: MessageListProps) {
  return (
    <>
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const grouped = previous?.author.id === message.author.id;
        return (
          <article className={`message ${grouped ? 'message--grouped' : ''}`} key={message.id}>
            {grouped ? (
              <time>{timeLabel(message.createdAt)}</time>
            ) : (
              <Avatar initials={message.author.initials} status={message.author.status} />
            )}
            <div>
              {!grouped && (
                <header>
                  <strong>{message.author.displayName}</strong>
                  <time>{timeLabel(message.createdAt)}</time>
                </header>
              )}
              <p>{message.availability === 'deleted' ? 'Message deleted' : message.content}</p>
              {message.reactions.length > 0 && (
                <div className="reactions">
                  {message.reactions.map((reaction) => (
                    <button
                      className={reaction.reacted ? 'is-reacted' : ''}
                      key={reaction.emoji}
                      type="button"
                      onClick={() => onReact(message.id, reaction.emoji, reaction.reacted)}
                    >
                      {reaction.emoji} <span>{reaction.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {emojiPickerMessageId === message.id && (
                <div className="emoji-picker" role="dialog" aria-label="Pick a reaction">
                  {['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '👎'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onEmojiPickerOpen(null);
                        onReact(message.id, emoji, false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="message-actions" aria-label="Message actions">
              <IconButton
                label="React"
                onClick={() =>
                  onEmojiPickerOpen(emojiPickerMessageId === message.id ? null : message.id)
                }
              >
                <Smile size={15} />
              </IconButton>
              <IconButton label="Reply" onClick={() => onReply(message.id, message.content)}>
                <MessageSquareText size={15} />
              </IconButton>
              <IconButton label="More actions">
                <MoreHorizontal size={15} />
              </IconButton>
            </div>
          </article>
        );
      })}
    </>
  );
}

export default MessageList;
