import React from 'react';
import { IconButton } from '@cove/ui';
import { LockKeyhole, Plus, Smile, SendHorizontal } from 'lucide-react';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  replyTo: { id: string; preview: string } | null;
  onCancelReply: () => void;
  disabled?: boolean;
  placeholder?: string;
  isSealed?: boolean;
}

export function Composer({
  value,
  onChange,
  onSend,
  replyTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Message...',
  isSealed = false,
}: ComposerProps) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim() && !disabled) {
      onSend();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit} data-testid="composer-form">
      {replyTo && (
        <div className="reply-bar" data-testid="reply-bar">
          <span>Replying to: {replyTo.preview}</span>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
          >
            ×
          </button>
        </div>
      )}
      {isSealed ? (
        <div className="sealed-placeholder">
          <LockKeyhole size={17} /> Sealed messaging enters after the reviewed MLS adapter.
        </div>
      ) : (
        <>
          <IconButton label="Add attachment" disabled={disabled}>
            <Plus size={19} />
          </IconButton>
          <label>
            <span className="sr-only">{placeholder}</span>
            <textarea
              rows={1}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
            />
          </label>
          <IconButton label="Choose emoji" disabled={disabled}>
            <Smile size={19} />
          </IconButton>
          <IconButton
            label="Send message"
            className="send-button"
            disabled={disabled || !value.trim()}
            type="submit"
          >
            <SendHorizontal size={18} />
          </IconButton>
        </>
      )}
    </form>
  );
}

export default Composer;
