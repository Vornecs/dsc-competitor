import React from 'react';
import { type Channel, type VoiceSession } from '@cove/contracts';
import { Mic, Volume2 } from 'lucide-react';

export interface VoicePanelProps {
  channel: Channel;
  activeVoiceChannelId: string | null;
  voiceSession: VoiceSession | null;
  isSpeaking: boolean;
  onJoinVoice: (channelId: string) => Promise<void> | void;
  onLeaveVoice: (channelId: string) => Promise<void> | void;
  onSetStageSpeaking: (active: boolean) => Promise<void> | void;
}

export function VoicePanel({
  channel,
  activeVoiceChannelId,
  voiceSession,
  isSpeaking,
  onJoinVoice,
  onLeaveVoice,
  onSetStageSpeaking,
}: VoicePanelProps) {
  const isConnected = activeVoiceChannelId === channel.id;

  return (
    <section className="voice-focus" data-testid="voice-panel">
      <span className="voice-orbit">
        {channel.kind === 'stage' ? <Mic size={31} /> : <Volume2 size={31} />}
      </span>
      <h2>{channel.name}</h2>
      {channel.kind === 'stage' && (
        <p className="stage-subtitle">Stage Broadcast Channel</p>
      )}
      {channel.parentChannelId && (
        <p className="stage-subtitle">Stage Subchannel</p>
      )}
      <p>
        {channel.participants.length
          ? `${channel.participants.length} ${channel.participants.length === 1 ? 'friend is' : 'friends are'} already here.`
          : 'This room is quiet right now.'}
      </p>
      <div className="voice-focus-actions">
        {isConnected ? (
          <button
            type="button"
            className="leave-btn"
            onClick={() => void onLeaveVoice(channel.id)}
          >
            Leave {channel.kind === 'stage' ? 'Stage' : 'Voice'}
          </button>
        ) : (
          <button
            type="button"
            className="join-btn"
            onClick={() => void onJoinVoice(channel.id)}
          >
            Join {channel.kind === 'stage' ? 'Stage' : 'Voice'}
          </button>
        )}
      </div>
      {voiceSession && isConnected && (
        <div className="voice-session-container">
          <small className="voice-session-info">
            Connected · Room: {voiceSession.roomName}
          </small>
          {(channel.kind === 'stage' || channel.parentChannelId) && (
            <div className="stage-ptt-controls">
              <button
                type="button"
                className={`ptt-speak-btn ${isSpeaking ? 'is-speaking' : ''}`}
                onMouseDown={() => void onSetStageSpeaking(true)}
                onMouseUp={() => void onSetStageSpeaking(false)}
                onMouseLeave={() => void onSetStageSpeaking(false)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  void onSetStageSpeaking(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  void onSetStageSpeaking(false);
                }}
              >
                {isSpeaking ? 'TRANSMITTING' : 'PRESS & HOLD TO SPEAK'}
              </button>
              <p className="ptt-help-text">
                Or press <kbd>Space</kbd> / <kbd>F9</kbd> in browser, or use Global{' '}
                <kbd>F9</kbd> in Desktop
              </p>
            </div>
          )}
        </div>
      )}
      <small className="security-notice">
        E2EE · Device check before joining · No cloud recording
      </small>
    </section>
  );
}

export default VoicePanel;
