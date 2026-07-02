import React from 'react';
import type { AttentionItem } from '@cove/contracts';
import { Bell, MessageSquareText, BellOff, X } from 'lucide-react';

export interface AttentionPanelProps {
  items: AttentionItem[];
  mutedChannelIds: Set<string>;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onToggleMute: (channelId: string) => void;
}

export function AttentionPanel({
  items,
  mutedChannelIds,
  onMarkAllRead,
  onDismiss,
  onToggleMute,
}: AttentionPanelProps) {
  const hasUnread = items.some((item) => item.unread);

  return (
    <section className="attention-preview" data-testid="attention-panel">
      <header>
        <span>Attention</span>
        <button
          type="button"
          aria-label="Mark all as read"
          title="Mark all as read"
          disabled={!hasUnread}
          onClick={onMarkAllRead}
        >
          Mark all read
        </button>
      </header>
      {items.map((item) => {
        const isMuted = item.channelId ? mutedChannelIds.has(item.channelId) : false;
        return (
          <div
            className={`attention-item ${item.unread ? 'is-unread' : ''}`}
            key={item.id}
            data-testid={`attention-item-${item.id}`}
          >
            <button className="attention-item-body" type="button">
              <span className="attention-icon">
                {item.kind === 'mention' ? (
                  <Bell size={16} />
                ) : (
                  <MessageSquareText size={16} />
                )}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
            <span className="attention-item-actions">
              {item.channelId && (
                <button
                  type="button"
                  aria-label={isMuted ? 'Unmute channel' : 'Mute channel'}
                  title={isMuted ? 'Unmute channel' : 'Mute channel'}
                  className={isMuted ? 'attention-action is-muted' : 'attention-action'}
                  onClick={() => onToggleMute(item.channelId!)}
                >
                  <BellOff size={13} />
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss"
                title="Dismiss"
                className="attention-action"
                onClick={() => onDismiss(item.id)}
              >
                <X size={13} />
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

export default AttentionPanel;
