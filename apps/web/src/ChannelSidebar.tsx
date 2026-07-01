import React, { useMemo } from 'react';
import { type Channel } from '@cove/contracts';
import { Avatar } from '@cove/ui';
import { Hash, Volume2, Mic, LockKeyhole, Plus, Monitor, Bell, BellOff } from 'lucide-react';

export interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  mutedChannelIds: Set<string>;
  onToggleMute: (channelId: string) => void;
  channelScreenShares?: Record<string, { participantId: string }[]>;
  onMouseEnterChannel?: (event: React.MouseEvent<HTMLButtonElement>, channel: Channel) => void;
  onMouseLeaveChannel?: () => void;
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel.kind === 'stage') return <Mic size={16} />;
  if (channel.kind === 'voice') return <Volume2 size={16} />;
  if (channel.privacy.mode === 'sealed') return <LockKeyhole size={15} />;
  return <Hash size={16} />;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  mutedChannelIds,
  onToggleMute,
  channelScreenShares = {},
  onMouseEnterChannel,
  onMouseLeaveChannel,
}: ChannelSidebarProps) {
  const categories = useMemo(
    () => [...new Set(channels.map((channel) => channel.category))],
    [channels],
  );

  return (
    <div className="channel-scroll" data-testid="channel-sidebar">
      {categories.map((category) => (
        <section className="channel-category" key={category}>
          <header>
            <span>{category}</span>
            <button aria-label={`Add channel to ${category}`} type="button">
              <Plus size={14} />
            </button>
          </header>
          {channels
            .filter((channel) => channel.category === category && !channel.parentChannelId)
            .map((channel) => {
              const isMuted = mutedChannelIds.has(channel.id);
              const isVoiceOrStage = channel.kind === 'voice' || channel.kind === 'stage';
              return (
                <div key={channel.id}>
                  <div
                    className="channel-button-wrapper"
                    style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
                  >
                    <button
                      className={`channel-button ${channel.id === activeChannelId ? 'is-active' : ''} ${isMuted ? 'is-muted' : ''}`}
                      onClick={() => onSelectChannel(channel.id)}
                      onMouseEnter={(e) => onMouseEnterChannel?.(e, channel)}
                      onMouseLeave={onMouseLeaveChannel}
                      type="button"
                      style={{ flex: 1, textDecoration: isMuted ? 'line-through' : 'none' }}
                    >
                      <ChannelIcon channel={channel} />
                      <span style={{ opacity: isMuted ? 0.5 : 1 }}>{channel.name}</span>
                      {channel.participants.length > 0 && <b>{channel.participants.length}</b>}
                    </button>
                    <button
                      className="channel-mute-toggle"
                      aria-label={isMuted ? `Unmute ${channel.name}` : `Mute ${channel.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMute(channel.id);
                      }}
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px',
                        opacity: isMuted ? 0.8 : 0.4,
                      }}
                    >
                      {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                    </button>
                  </div>

                  {isVoiceOrStage && channel.participants.length > 0 && (
                    <div className="voice-members">
                      {channel.participants.map((person) => {
                        const hasScreenShare = (channelScreenShares[channel.id] || []).some(
                          (s) => s.participantId === person.id,
                        );
                        const isSpeaker = person.participantRole === 'speaker';
                        return (
                          <div key={person.id}>
                            <Avatar
                              initials={person.initials}
                              status={person.status}
                              size="small"
                            />
                            <span>{person.displayName}</span>
                            {isSpeaker && <span className="speaking-bars" aria-label="Speaking" />}
                            {person.participantRole && (
                              <span
                                className={`role-badge role-badge--${person.participantRole}`}
                                title={person.participantRole}
                              >
                                {person.participantRole === 'speaker' ? 'Speaker' : 'Listener'}
                              </span>
                            )}
                            {hasScreenShare && (
                              <span className="screen-share-badge" title="Sharing screen">
                                <Monitor size={10} style={{ marginRight: '3px' }} /> Screen
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {channel.kind === 'stage' && (
                    <div
                      className="subchannels-list"
                      style={{ marginLeft: '16px', paddingLeft: '8px' }}
                    >
                      {channels
                        .filter((sub) => sub.parentChannelId === channel.id)
                        .map((sub) => {
                          const subActive = sub.id === activeChannelId;
                          const subMuted = mutedChannelIds.has(sub.id);
                          return (
                            <div key={sub.id} className="subchannel-container">
                              <div
                                className="channel-button-wrapper"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  position: 'relative',
                                }}
                              >
                                <button
                                  className={`channel-button channel-button--sub ${subActive ? 'is-active' : ''} ${subMuted ? 'is-muted' : ''}`}
                                  onClick={() => onSelectChannel(sub.id)}
                                  type="button"
                                  style={{
                                    flex: 1,
                                    textDecoration: subMuted ? 'line-through' : 'none',
                                  }}
                                >
                                  <ChannelIcon channel={sub} />
                                  <span style={{ opacity: subMuted ? 0.5 : 1 }}>{sub.name}</span>
                                  {sub.participants.length > 0 && <b>{sub.participants.length}</b>}
                                </button>
                                <button
                                  className="channel-mute-toggle"
                                  aria-label={subMuted ? `Unmute ${sub.name}` : `Mute ${sub.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleMute(sub.id);
                                  }}
                                  type="button"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: '8px',
                                    opacity: subMuted ? 0.8 : 0.4,
                                  }}
                                >
                                  {subMuted ? <BellOff size={13} /> : <Bell size={13} />}
                                </button>
                              </div>

                              {sub.participants.length > 0 && (
                                <div className="voice-members" style={{ paddingLeft: '16px' }}>
                                  {sub.participants.map((person) => {
                                    const hasScreenShare = (channelScreenShares[sub.id] || []).some(
                                      (s) => s.participantId === person.id,
                                    );
                                    const isSpeaker = person.participantRole === 'speaker';
                                    return (
                                      <div key={person.id}>
                                        <Avatar
                                          initials={person.initials}
                                          status={person.status}
                                          size="small"
                                        />
                                        <span>{person.displayName}</span>
                                        {isSpeaker && (
                                          <span className="speaking-bars" aria-label="Speaking" />
                                        )}
                                        {person.participantRole && (
                                          <span
                                            className={`role-badge role-badge--${person.participantRole}`}
                                            title={person.participantRole}
                                          >
                                            {person.participantRole === 'speaker'
                                              ? 'Speaker'
                                              : 'Listener'}
                                          </span>
                                        )}
                                        {hasScreenShare && (
                                          <span
                                            className="screen-share-badge"
                                            title="Sharing screen"
                                          >
                                            <Monitor size={10} style={{ marginRight: '3px' }} />{' '}
                                            Screen
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}

export default ChannelSidebar;
