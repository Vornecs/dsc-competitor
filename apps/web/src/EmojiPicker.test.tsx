import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmojiPicker from './EmojiPicker';

describe('EmojiPicker', () => {
  it('renders the 8 common emojis as buttons', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Pick a reaction' });
    expect(dialog).toBeInTheDocument();

    const expectedEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '👎'];
    expectedEmojis.forEach((emoji) => {
      expect(screen.getByRole('button', { name: emoji })).toBeInTheDocument();
    });
  });

  it('calls onSelect with the clicked emoji', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '🔥' }));
    expect(onSelect).toHaveBeenCalledWith('🔥');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the emoji picker', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <div>
        <button data-testid="outside-btn">Outside</button>
        <EmojiPicker onSelect={onSelect} onClose={onClose} />
      </div>,
    );

    // Clicking inside the picker shouldn't trigger onClose
    await user.click(screen.getByRole('button', { name: '👍' }));
    expect(onClose).not.toHaveBeenCalled();

    // Clicking outside the picker should trigger onClose
    await user.click(screen.getByTestId('outside-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
