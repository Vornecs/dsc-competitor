import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type Channel, type VoiceSession } from '@cove/contracts';
import VoicePanel from './VoicePanel';

const mockVoiceChannel: Channel = {
  id: 'ch-voice',
  communityId: 'comm-1',
  name: 'General Voice',
  kind: 'voice',
  category: 'Voice Channels',
  topic: 'Chatting with voice',
  participants: [],
  privacy: {
    mode: 'managed',
    searchableByServer: true,
    appsMayReadContent: true,
    deletedContentRecoveryDays: 7,
    evidenceRetentionDays: 30,
  },
};

const mockStageChannel: Channel = {
  id: 'ch-stage',
  communityId: 'comm-1',
  name: 'Town Hall',
  kind: 'stage',
  category: 'Stage Channels',
  topic: 'Q&A session',
  participants: [
    {
      id: 'user-1',
      displayName: 'Alice',
      initials: 'A',
      status: 'online',
      participantRole: 'speaker',
    },
  ],
  privacy: {
    mode: 'managed',
    searchableByServer: true,
    appsMayReadContent: true,
    deletedContentRecoveryDays: 7,
    evidenceRetentionDays: 30,
  },
};

const mockVoiceSession: VoiceSession = {
  token: 'token-123',
  url: 'wss://livekit.cove.chat',
  roomName: 'room-town-hall',
  participantId: 'user-1',
  participantRole: 'speaker',
  canPublish: true,
};

describe('VoicePanel', () => {
  it('renders quiet state and basic details for voice channel', () => {
    render(
      <VoicePanel
        channel={mockVoiceChannel}
        activeVoiceChannelId={null}
        voiceSession={null}
        isSpeaking={false}
        onJoinVoice={vi.fn()}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'General Voice' })).toBeInTheDocument();
    expect(screen.getByText('This room is quiet right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Voice' })).toBeInTheDocument();
    expect(screen.getByText('E2EE · Device check before joining · No cloud recording')).toBeInTheDocument();
  });

  it('renders status message when friends are present', () => {
    render(
      <VoicePanel
        channel={mockStageChannel}
        activeVoiceChannelId={null}
        voiceSession={null}
        isSpeaking={false}
        onJoinVoice={vi.fn()}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    expect(screen.getByText('1 friend is already here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Stage' })).toBeInTheDocument();
  });

  it('calls onJoinVoice when join button is clicked', async () => {
    const onJoinVoice = vi.fn();
    const user = userEvent.setup();

    render(
      <VoicePanel
        channel={mockVoiceChannel}
        activeVoiceChannelId={null}
        voiceSession={null}
        isSpeaking={false}
        onJoinVoice={onJoinVoice}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    const joinBtn = screen.getByRole('button', { name: 'Join Voice' });
    await user.click(joinBtn);
    expect(onJoinVoice).toHaveBeenCalledWith('ch-voice');
  });

  it('renders leave button when already joined', async () => {
    const onLeaveVoice = vi.fn();
    const user = userEvent.setup();

    render(
      <VoicePanel
        channel={mockVoiceChannel}
        activeVoiceChannelId="ch-voice"
        voiceSession={null}
        isSpeaking={false}
        onJoinVoice={vi.fn()}
        onLeaveVoice={onLeaveVoice}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    const leaveBtn = screen.getByRole('button', { name: 'Leave Voice' });
    expect(leaveBtn).toBeInTheDocument();
    await user.click(leaveBtn);
    expect(onLeaveVoice).toHaveBeenCalledWith('ch-voice');
  });

  it('displays session and PTT controls for stage channel when connected', () => {
    render(
      <VoicePanel
        channel={mockStageChannel}
        activeVoiceChannelId="ch-stage"
        voiceSession={mockVoiceSession}
        isSpeaking={false}
        onJoinVoice={vi.fn()}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    expect(screen.getByText('Connected · Room: room-town-hall')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PRESS & HOLD TO SPEAK' })).toBeInTheDocument();
  });

  it('triggers set stage speaking callbacks on mouse and touch events', () => {
    const onSetStageSpeaking = vi.fn();
    render(
      <VoicePanel
        channel={mockStageChannel}
        activeVoiceChannelId="ch-stage"
        voiceSession={mockVoiceSession}
        isSpeaking={false}
        onJoinVoice={vi.fn()}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={onSetStageSpeaking}
      />,
    );

    const pttBtn = screen.getByRole('button', { name: 'PRESS & HOLD TO SPEAK' });

    // Mouse events
    fireEvent.mouseDown(pttBtn);
    expect(onSetStageSpeaking).toHaveBeenLastCalledWith(true);

    fireEvent.mouseUp(pttBtn);
    expect(onSetStageSpeaking).toHaveBeenLastCalledWith(false);

    fireEvent.mouseDown(pttBtn);
    fireEvent.mouseLeave(pttBtn);
    expect(onSetStageSpeaking).toHaveBeenLastCalledWith(false);

    // Touch events
    fireEvent.touchStart(pttBtn);
    expect(onSetStageSpeaking).toHaveBeenLastCalledWith(true);

    fireEvent.touchEnd(pttBtn);
    expect(onSetStageSpeaking).toHaveBeenLastCalledWith(false);
  });

  it('reflects active speaking state in class name and text', () => {
    render(
      <VoicePanel
        channel={mockStageChannel}
        activeVoiceChannelId="ch-stage"
        voiceSession={mockVoiceSession}
        isSpeaking={true}
        onJoinVoice={vi.fn()}
        onLeaveVoice={vi.fn()}
        onSetStageSpeaking={vi.fn()}
      />,
    );

    const transmittingBtn = screen.getByRole('button', { name: 'TRANSMITTING' });
    expect(transmittingBtn).toBeInTheDocument();
    expect(transmittingBtn).toHaveClass('is-speaking');
  });
});
