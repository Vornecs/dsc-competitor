import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Composer from './Composer';

describe('Composer', () => {
  it('renders standard layout correctly', () => {
    render(
      <Composer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        replyTo={null}
        onCancelReply={() => {}}
        placeholder="Message general"
      />
    );

    const textarea = screen.getByPlaceholderText('Message general');
    expect(textarea).toBeInTheDocument();
    expect(screen.queryByTestId('reply-bar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sealed messaging enters/)).not.toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Composer
        value=""
        onChange={onChange}
        onSend={() => {}}
        replyTo={null}
        onCancelReply={() => {}}
      />
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onSend when form is submitted via button', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(
      <Composer
        value="hello world"
        onChange={() => {}}
        onSend={onSend}
        replyTo={null}
        onCancelReply={() => {}}
      />
    );

    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    expect(sendBtn).not.toBeDisabled();
    await user.click(sendBtn);

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onSend when Enter is pressed (without Shift)', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(
      <Composer
        value="hello world"
        onChange={() => {}}
        onSend={onSend}
        replyTo={null}
        onCancelReply={() => {}}
      />
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '{enter}');

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSend when Enter+Shift is pressed', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(
      <Composer
        value="hello world"
        onChange={() => {}}
        onSend={onSend}
        replyTo={null}
        onCancelReply={() => {}}
      />
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '{shift>}{enter}{/shift}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('renders reply bar when replyTo is set and cancels it', async () => {
    const onCancelReply = vi.fn();
    const user = userEvent.setup();

    render(
      <Composer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        replyTo={{ id: 'msg-1', preview: 'hello world' }}
        onCancelReply={onCancelReply}
      />
    );

    expect(screen.getByTestId('reply-bar')).toBeInTheDocument();
    expect(screen.getByText('Replying to: hello world')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel reply' });
    await user.click(cancelBtn);

    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it('renders sealed placeholder and hides editor when isSealed is true', () => {
    render(
      <Composer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        replyTo={null}
        onCancelReply={() => {}}
        isSealed={true}
      />
    );

    expect(screen.getByText(/Sealed messaging enters after the reviewed MLS adapter/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('disables input controls when disabled is true', () => {
    render(
      <Composer
        value="hello"
        onChange={() => {}}
        onSend={() => {}}
        replyTo={null}
        onCancelReply={() => {}}
        disabled={true}
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();

    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    expect(sendBtn).toBeDisabled();
  });
});
