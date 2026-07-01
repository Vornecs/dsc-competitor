import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChannelSidebar from './ChannelSidebar';
import { type Channel } from '@cove/contracts';

const mockChannels: Channel[] = [
  {
    id: 'chan-1',
    communityId: 'comm-1',
    name: 'general',
    kind: 'text',
    category: 'TEXT CHANNELS',
    topic: 'General discussion',
    privacy: { mode: 'managed', searchableByServer: false, appsMayReadContent: false, deletedContentRecoveryDays: 0, evidenceRetentionDays: 0 },
    participants: [],
  },
  {
    id: 'chan-2',
    communityId: 'comm-1',
    name: 'gaming',
    kind: 'text',
    category: 'TEXT CHANNELS',
    topic: 'Gaming chat',
    privacy: { mode: 'managed', searchableByServer: false, appsMayReadContent: false, deletedContentRecoveryDays: 0, evidenceRetentionDays: 0 },
    participants: [],
  },
  {
    id: 'chan-3',
    communityId: 'comm-1',
    name: 'Voice Lounge',
    kind: 'voice',
    category: 'VOICE CHANNELS',
    topic: '',
    privacy: { mode: 'managed', searchableByServer: false, appsMayReadContent: false, deletedContentRecoveryDays: 0, evidenceRetentionDays: 0 },
    participants: [
      { id: 'user-1', displayName: 'Alice Smith', initials: 'AS', status: 'online', participantRole: 'speaker' },
      { id: 'user-2', displayName: 'Bob Jones', initials: 'BJ', status: 'idle', participantRole: 'listener' },
    ],
  },
  {
    id: 'chan-4',
    communityId: 'comm-1',
    name: 'Stage Show',
    kind: 'stage',
    category: 'VOICE CHANNELS',
    topic: '',
    privacy: { mode: 'managed', searchableByServer: false, appsMayReadContent: false, deletedContentRecoveryDays: 0, evidenceRetentionDays: 0 },
    participants: [],
  },
  {
    id: 'chan-5',
    communityId: 'comm-1',
    name: 'stage-backstage',
    kind: 'voice',
    category: 'VOICE CHANNELS',
    parentChannelId: 'chan-4',
    topic: '',
    privacy: { mode: 'managed', searchableByServer: false, appsMayReadContent: false, deletedContentRecoveryDays: 0, evidenceRetentionDays: 0 },
    participants: [],
  },
];

describe('ChannelSidebar', () => {
  it('renders channels grouped by categories correctly', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={() => {}}
        mutedChannelIds={new Set(['chan-2'])}
        onToggleMute={() => {}}
      />
    );

    expect(screen.getByText('TEXT CHANNELS')).toBeInTheDocument();
    expect(screen.getByText('VOICE CHANNELS')).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('gaming')).toBeInTheDocument();
    expect(screen.getByText('Voice Lounge')).toBeInTheDocument();
  });

  it('handles select channel click', async () => {
    const onSelectChannel = vi.fn();
    const user = userEvent.setup();

    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={onSelectChannel}
        mutedChannelIds={new Set()}
        onToggleMute={() => {}}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /^Voice Lounge/ });
    await user.click(voiceBtn);

    expect(onSelectChannel).toHaveBeenCalledWith('chan-3');
  });

  it('handles toggle mute click', async () => {
    const onToggleMute = vi.fn();
    const user = userEvent.setup();

    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={() => {}}
        mutedChannelIds={new Set()}
        onToggleMute={onToggleMute}
      />
    );

    const muteBtn = screen.getByRole('button', { name: 'Mute general' });
    await user.click(muteBtn);

    expect(onToggleMute).toHaveBeenCalledWith('chan-1');
  });

  it('renders voice participants and badges correctly', () => {
    const screenShares = {
      'chan-3': [{ participantId: 'user-1' }],
    };

    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={() => {}}
        mutedChannelIds={new Set()}
        onToggleMute={() => {}}
        channelScreenShares={screenShares}
      />
    );

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();

    expect(screen.getByText('Speaker')).toBeInTheDocument();
    expect(screen.getByText('Listener')).toBeInTheDocument();
    expect(screen.getByTitle('Sharing screen')).toBeInTheDocument();
  });

  it('renders subchannels for stage channel correctly', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={() => {}}
        mutedChannelIds={new Set()}
        onToggleMute={() => {}}
      />
    );

    expect(screen.getByText('stage-backstage')).toBeInTheDocument();
  });

  it('triggers mouse hover callbacks when provided', async () => {
    const onMouseEnterChannel = vi.fn();
    const onMouseLeaveChannel = vi.fn();
    const user = userEvent.setup();

    render(
      <ChannelSidebar
        channels={mockChannels}
        activeChannelId="chan-1"
        onSelectChannel={() => {}}
        mutedChannelIds={new Set()}
        onToggleMute={() => {}}
        onMouseEnterChannel={onMouseEnterChannel}
        onMouseLeaveChannel={onMouseLeaveChannel}
      />
    );

    const generalBtn = screen.getByRole('button', { name: 'general' });
    await user.hover(generalBtn);
    expect(onMouseEnterChannel).toHaveBeenCalled();

    await user.unhover(generalBtn);
    expect(onMouseLeaveChannel).toHaveBeenCalled();
  });
});
