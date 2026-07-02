import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NewChannelModal from './NewChannelModal';

describe('NewChannelModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <NewChannelModal
        open={false}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal controls and fields when open is true', () => {
    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Channel' })).toBeInTheDocument();
    expect(screen.getByLabelText('CHANNEL NAME')).toBeInTheDocument();
    expect(screen.getByLabelText('CATEGORY')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What is this channel about?')).toBeInTheDocument();
  });

  it('displays error message if error prop is provided', () => {
    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error="Something went wrong"
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Something went wrong');
  });

  it('calls onClose when close button or Cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={onClose}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: 'Close modal' });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('formats text channel names automatically', async () => {
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );

    const nameInput = screen.getByLabelText('CHANNEL NAME');
    await user.type(nameInput, 'My New Channel!');
    expect(nameInput).toHaveValue('my-new-channel-');
  });

  it('updates category defaults when channel kind changes', async () => {
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );

    const categoryInput = screen.getByLabelText('CATEGORY');
    expect(categoryInput).toHaveValue('Text Channels');

    const voiceRadio = screen.getByText('Voice');
    await user.click(voiceRadio);
    expect(categoryInput).toHaveValue('Voice Channels');

    const stageRadio = screen.getByText('Stage');
    await user.click(stageRadio);
    expect(categoryInput).toHaveValue('Stage Channels');
  });

  it('renders parent channels dropdown if provided', () => {
    const parentChannels = [
      { id: 'ch-1', name: 'main-stage' },
      { id: 'ch-2', name: 'secondary-stage' },
    ];

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
        parentChannels={parentChannels}
      />,
    );

    expect(screen.getByLabelText('PARENT STAGE CHANNEL (FOR SUBCHANNELS)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'None (Stand-alone channel)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'main-stage' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'secondary-stage' })).toBeInTheDocument();
  });

  it('renders broadcast keybind only when stage channel is selected', async () => {
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
        error={null}
      />,
    );

    expect(screen.queryByLabelText('BROADCAST KEYBIND (OPTIONAL)')).not.toBeInTheDocument();

    const stageRadio = screen.getByText('Stage');
    await user.click(stageRadio);
    expect(screen.getByLabelText('BROADCAST KEYBIND (OPTIONAL)')).toBeInTheDocument();
  });

  it('submits correct payload with standard settings', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={onCreate}
        loading={false}
        error={null}
      />,
    );

    const nameInput = screen.getByLabelText('CHANNEL NAME');
    await user.type(nameInput, 'test-channel');

    const topicInput = screen.getByPlaceholderText('What is this channel about?');
    await user.type(topicInput, 'Let us talk about testing');

    const submitBtn = screen.getByRole('button', { name: 'Create Channel' });
    await user.click(submitBtn);

    expect(onCreate).toHaveBeenCalledWith({
      name: 'test-channel',
      kind: 'text',
      category: 'Text Channels',
      topic: 'Let us talk about testing',
    });
  });

  it('disables submit button and form controls when loading is true', () => {
    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        loading={true}
        error={null}
      />,
    );

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('handles advanced privacy configuration', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <NewChannelModal
        open={true}
        onClose={vi.fn()}
        onCreate={onCreate}
        loading={false}
        error={null}
      />,
    );

    const advancedCheckbox = screen.getByLabelText('Configure advanced privacy & encryption policies');
    await user.click(advancedCheckbox);

    // Advanced fields should now be visible
    expect(screen.getByText('PRIVACY MODE')).toBeInTheDocument();
    
    // Choose Sealed mode
    const sealedBtn = screen.getByRole('button', { name: 'Sealed 🔒' });
    await user.click(sealedBtn);

    // Assert checkboxes are disabled under Sealed mode
    const searchableCheckbox = screen.getByLabelText('Searchable by server index');
    const appsCheckbox = screen.getByLabelText('Allow bots and applications to read messages');
    expect(searchableCheckbox).toBeDisabled();
    expect(appsCheckbox).toBeDisabled();
    expect(searchableCheckbox).not.toBeChecked();
    expect(appsCheckbox).not.toBeChecked();

    const nameInput = screen.getByLabelText('CHANNEL NAME');
    await user.type(nameInput, 'secure-chat');

    const submitBtn = screen.getByRole('button', { name: 'Create Channel' });
    await user.click(submitBtn);

    expect(onCreate).toHaveBeenCalledWith({
      name: 'secure-chat',
      kind: 'text',
      category: 'Text Channels',
      privacy: {
        mode: 'sealed',
        searchableByServer: false,
        appsMayReadContent: false,
        deletedContentRecoveryDays: 7,
        evidenceRetentionDays: 30,
      },
    });
  });
});
