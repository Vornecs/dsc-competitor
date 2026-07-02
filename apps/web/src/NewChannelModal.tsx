import React, { useState, useEffect } from 'react';
import type { CreateChannelRequest } from '@cove/contracts';

export interface NewChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateChannelRequest) => Promise<void>;
  loading: boolean;
  error: string | null;
  parentChannels?: { id: string; name: string }[];
}

export default function NewChannelModal({
  open,
  onClose,
  onCreate,
  loading,
  error,
  parentChannels = [],
}: NewChannelModalProps) {
  const [kind, setKind] = useState<'text' | 'voice' | 'stage'>('text');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Text Channels');
  const [topic, setTopic] = useState('');
  
  // Stage Config
  const [broadcastKeybind, setBroadcastKeybind] = useState('');
  
  // Privacy Settings
  const [showAdvancedPrivacy, setShowAdvancedPrivacy] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<'managed' | 'sealed'>('managed');
  const [searchableByServer, setSearchableByServer] = useState(true);
  const [appsMayReadContent, setAppsMayReadContent] = useState(false);
  const [deletedContentRecoveryDays, setDeletedContentRecoveryDays] = useState(7);
  const [evidenceRetentionDays, setEvidenceRetentionDays] = useState(30);

  // Subchannel options (parentChannelId)
  const [parentChannelId, setParentChannelId] = useState<string>('');

  const [animate, setAnimate] = useState(false);

  // Sync category defaults when kind changes
  useEffect(() => {
    if (!category || category === 'Text Channels' || category === 'Voice Channels' || category === 'Stage Channels') {
      if (kind === 'text') {
        setCategory('Text Channels');
      } else if (kind === 'voice') {
        setCategory('Voice Channels');
      } else {
        setCategory('Stage Channels');
      }
    }
  }, [kind]);

  // Adjust privacy options if mode is 'sealed' (validation rule: sealed mode must have searchable=false, appsMayRead=false)
  useEffect(() => {
    if (privacyMode === 'sealed') {
      setSearchableByServer(false);
      setAppsMayReadContent(false);
    }
  }, [privacyMode]);

  // Animation on mount
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setAnimate(true), 20);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [open]);

  if (!open) return null;

  const handleNameChange = (val: string) => {
    // For text channels, apply Discord-style formatting: lowercase, spaces to hyphens
    if (kind === 'text') {
      const formatted = val.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
      setName(formatted);
    } else {
      setName(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: CreateChannelRequest = {
      name: name.trim(),
      kind,
      category: category.trim(),
    };

    if (topic.trim()) {
      payload.topic = topic.trim();
    }

    if (kind === 'stage' && broadcastKeybind.trim()) {
      payload.stageConfig = {
        broadcastKeybind: broadcastKeybind.trim(),
      };
    }

    if (parentChannelId) {
      payload.parentChannelId = parentChannelId;
    }

    if (showAdvancedPrivacy) {
      payload.privacy = {
        mode: privacyMode,
        searchableByServer,
        appsMayReadContent,
        deletedContentRecoveryDays,
        evidenceRetentionDays,
      };
    }

    void onCreate(payload);
  };

  return (
    <div
      className="login-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-channel-title"
      style={{
        opacity: animate ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
        display: 'grid',
        placeItems: 'center',
        overflowY: 'auto',
        padding: '24px 16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="login-modal"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          transform: animate ? 'scale(1)' : 'scale(0.96)',
          opacity: animate ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="new-channel-title" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
            Create Channel
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div
            className="login-error"
            role="alert"
            style={{
              padding: '10px 12px',
              background: 'rgba(255, 119, 89, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: '6px',
              color: 'var(--danger)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Channel Kind Selection */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}
            >
              CHANNEL TYPE
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Text Card */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: kind === 'text' ? 'var(--accent-soft)' : 'var(--surface)',
                  border: kind === 'text' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="channel-kind"
                  value="text"
                  checked={kind === 'text'}
                  onChange={() => setKind('text')}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '24px', color: kind === 'text' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  #
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Text</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Post messages, images, opinions, and puns
                  </div>
                </div>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: kind === 'text' ? '5px solid var(--accent)' : '2px solid var(--border)',
                    background: '#fff',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                  }}
                />
              </label>

              {/* Voice Card */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: kind === 'voice' ? 'var(--accent-soft)' : 'var(--surface)',
                  border: kind === 'voice' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="channel-kind"
                  value="voice"
                  checked={kind === 'voice'}
                  onChange={() => setKind('voice')}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '20px', color: kind === 'voice' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  🔊
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Voice</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hang out together with voice and video
                  </div>
                </div>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: kind === 'voice' ? '5px solid var(--accent)' : '2px solid var(--border)',
                    background: '#fff',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                  }}
                />
              </label>

              {/* Stage Card */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: kind === 'stage' ? 'var(--accent-soft)' : 'var(--surface)',
                  border: kind === 'stage' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="channel-kind"
                  value="stage"
                  checked={kind === 'stage'}
                  onChange={() => setKind('stage')}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '20px', color: kind === 'stage' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  📢
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Stage</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Host events with speakers and an audience
                  </div>
                </div>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: kind === 'stage' ? '5px solid var(--accent)' : '2px solid var(--border)',
                    background: '#fff',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                  }}
                />
              </label>
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label
              htmlFor="channel-name"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}
            >
              CHANNEL NAME
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  fontSize: '16px',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              >
                {kind === 'text' ? '#' : kind === 'voice' ? '🔊' : '📢'}
              </span>
              <input
                id="channel-name"
                autoFocus
                type="text"
                placeholder={kind === 'text' ? 'new-channel' : 'New Channel'}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={80}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px 10px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="channel-category"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}
            >
              CATEGORY
            </label>
            <input
              id="channel-category"
              type="text"
              placeholder="e.g. Text Channels"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Topic */}
          <div>
            <label
              htmlFor="channel-topic"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.5px',
              }}
            >
              <span>TOPIC (OPTIONAL)</span>
              <span style={{ fontWeight: 400 }}>{topic.length}/240</span>
            </label>
            <textarea
              id="channel-topic"
              placeholder="What is this channel about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={240}
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '14px',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Subchannel selection (Only if parent channels are provided) */}
          {parentChannels.length > 0 && kind !== 'stage' && (
            <div>
              <label
                htmlFor="parent-channel"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.5px',
                }}
              >
                PARENT STAGE CHANNEL (FOR SUBCHANNELS)
              </label>
              <select
                id="parent-channel"
                value={parentChannelId}
                onChange={(e) => setParentChannelId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              >
                <option value="">None (Stand-alone channel)</option>
                {parentChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stage Config (Only if kind is stage) */}
          {kind === 'stage' && (
            <div>
              <label
                htmlFor="broadcast-keybind"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.5px',
                }}
              >
                BROADCAST KEYBIND (OPTIONAL)
              </label>
              <input
                id="broadcast-keybind"
                type="text"
                placeholder="e.g. Space"
                value={broadcastKeybind}
                onChange={(e) => setBroadcastKeybind(e.target.value)}
                maxLength={32}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              />
            </div>
          )}

          {/* Advanced Privacy policy settings */}
          <div style={{ marginTop: '4px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={showAdvancedPrivacy}
                onChange={(e) => setShowAdvancedPrivacy(e.target.checked)}
                style={{
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              Configure advanced privacy & encryption policies
            </label>

            {showAdvancedPrivacy && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Privacy Mode Selector */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                    }}
                  >
                    PRIVACY MODE
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPrivacyMode('managed')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: privacyMode === 'managed' ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: privacyMode === 'managed' ? 'var(--accent-soft)' : 'transparent',
                        color: privacyMode === 'managed' ? 'var(--accent)' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Managed
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivacyMode('sealed')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: privacyMode === 'sealed' ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: privacyMode === 'sealed' ? 'var(--accent-soft)' : 'transparent',
                        color: privacyMode === 'sealed' ? 'var(--accent)' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Sealed 🔒
                    </button>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                    {privacyMode === 'managed'
                      ? 'Standard channel: Server roles govern access and the server stores messages plaintext.'
                      : 'End-to-end encrypted: Only participants hold keys. Server search and bots/apps are blocked.'}
                  </p>
                </div>

                {/* Searchable By Server */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: privacyMode === 'sealed' ? 'var(--text-muted)' : 'var(--text)',
                    cursor: privacyMode === 'sealed' ? 'not-allowed' : 'pointer',
                    opacity: privacyMode === 'sealed' ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={searchableByServer}
                    disabled={privacyMode === 'sealed'}
                    onChange={(e) => setSearchableByServer(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Searchable by server index
                </label>

                {/* Apps May Read Content */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: privacyMode === 'sealed' ? 'var(--text-muted)' : 'var(--text)',
                    cursor: privacyMode === 'sealed' ? 'not-allowed' : 'pointer',
                    opacity: privacyMode === 'sealed' ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={appsMayReadContent}
                    disabled={privacyMode === 'sealed'}
                    onChange={(e) => setAppsMayReadContent(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Allow bots and applications to read messages
                </label>

                {/* Numbers: recovery days & evidence retention */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="recovery-days"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                      }}
                    >
                      RECOVERY (0-30 DAYS)
                    </label>
                    <input
                      id="recovery-days"
                      type="number"
                      min={0}
                      max={30}
                      value={deletedContentRecoveryDays}
                      onChange={(e) => setDeletedContentRecoveryDays(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text)',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="retention-days"
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                      }}
                    >
                      RETENTION (0-365 DAYS)
                    </label>
                    <input
                      id="retention-days"
                      type="number"
                      min={0}
                      max={365}
                      value={evidenceRetentionDays}
                      onChange={(e) => setEvidenceRetentionDays(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text)',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                flex: 1,
                padding: '10px',
                border: 0,
                borderRadius: '6px',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                opacity: loading || !name.trim() ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Creating…' : 'Create Channel'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'border-color 0.2s, color 0.2s',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
