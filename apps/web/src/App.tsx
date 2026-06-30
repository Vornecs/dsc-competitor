import {
  bootstrapStateSchema,
  attentionItemSchema,
  communityStatsSchema,
  demoBootstrap,
  gatewayServerFrameSchema,
  messageReactionUpdateSchema,
  messageSchema,
  presenceUpdateSchema,
  voiceParticipantJoinedSchema,
  voiceParticipantLeftSchema,
  voiceSessionSchema,
  type AuditEvent,
  type BootstrapState,
  type AttentionItem,
  type Channel,
  type CommunityStats,
  type Message,
  type Participant,
  type VoiceSession,
} from '@cove/contracts';
import { Avatar, IconButton, StatusPill } from '@cove/ui';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  Download,
  Hash,
  Headphones,
  Inbox,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Smile,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { resolveRuntimeConfig } from './runtime-config';

type ConnectionState = 'connecting' | 'live' | 'preview';
type Density = 'compact' | 'comfortable' | 'touch';

const runtimeConfig = resolveRuntimeConfig(
  {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_GATEWAY_URL: import.meta.env.VITE_GATEWAY_URL,
  },
  window.location.origin,
);
const API_BASE = runtimeConfig.apiBase;

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value),
  );
}

export function reconcileSavedMessage(current: Message[], optimisticId: string, saved: Message) {
  const withoutOptimistic = current.filter((item) => item.id !== optimisticId);
  return withoutOptimistic.some((item) => item.id === saved.id)
    ? withoutOptimistic
    : [...withoutOptimistic, saved];
}

export function reconcileMessageUpdate(current: Message[], updated: Message): Message[] {
  return current.map((message) => (message.id === updated.id ? updated : message));
}

export function reconcileReactionUpdate(
  current: Message[],
  update: ReturnType<typeof messageReactionUpdateSchema.parse>,
  accountId: string,
): Message[] {
  return current.map((message) => {
    if (message.id !== update.messageId) return message;
    const existing = message.reactions.find((reaction) => reaction.emoji === update.emoji);
    const reactions = message.reactions.filter((reaction) => reaction.emoji !== update.emoji);
    if (update.count > 0) {
      reactions.push({
        emoji: update.emoji,
        count: update.count,
        reacted: update.actorId === accountId ? update.reacted : (existing?.reacted ?? false),
      });
    }
    return { ...message, reactions };
  });
}

export function reconcileAttentionItem(
  current: AttentionItem[],
  incoming: AttentionItem,
): AttentionItem[] {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)];
}

export function reconcileVoiceJoin(
  channels: Channel[],
  channelId: string,
  participant: Participant,
): Channel[] {
  return channels.map((ch) => {
    if (ch.id !== channelId) return ch;
    if (ch.participants.some((p) => p.id === participant.id)) return ch;
    return { ...ch, participants: [...ch.participants, participant] };
  });
}

export function reconcileVoiceLeave(
  channels: Channel[],
  channelId: string,
  participantId: string,
): Channel[] {
  return channels.map((ch) => {
    if (ch.id !== channelId) return ch;
    return { ...ch, participants: ch.participants.filter((p) => p.id !== participantId) };
  });
}

export function reconcileAuditLog(current: AuditEvent[], incoming: AuditEvent[]): AuditEvent[] {
  const merged = [...current];
  const seen = new Set(current.map((event) => event.id));
  for (const event of incoming) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
  }
  return merged;
}

function AuditLogPanel({
  events,
  loading,
  error,
  hasMore,
  onLoadMore,
  onExport,
  communityId,
}: {
  events: AuditEvent[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onExport: () => void;
  communityId: string;
}) {
  return (
    <section className="audit-log-panel" aria-label="Audit log">
      <header>
        <span>Audit log</span>
        <button
          type="button"
          title="Export community data"
          aria-label="Export community data"
          onClick={onExport}
          data-community-id={communityId}
        >
          <Download size={15} />
        </button>
      </header>
      {error ? (
        <p className="audit-empty" role="status">
          {error}
        </p>
      ) : loading && events.length === 0 ? (
        <p className="audit-empty">Loading…</p>
      ) : events.length === 0 ? (
        <p className="audit-empty">No audit events yet.</p>
      ) : (
        <ol className="audit-events" aria-label="Audit events">
          {events.map((event) => (
            <li key={event.id} className="audit-event">
              <span>
                <strong className="audit-action">{event.action.replaceAll('.', ' ')}</strong>
                <small>
                  {event.targetType} · {event.targetId}
                </small>
              </span>
              <time className="audit-time" dateTime={event.createdAt}>
                {new Intl.DateTimeFormat(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(event.createdAt))}
              </time>
            </li>
          ))}
        </ol>
      )}
      {hasMore && (
        <button type="button" onClick={onLoadMore} disabled={loading}>
          Load more
        </button>
      )}
    </section>
  );
}

function PrivacyNotice({ channel }: { channel: Channel }) {
  const managed = channel.privacy.mode === 'managed';
  return (
    <section
      className={`privacy-card privacy-card--${channel.privacy.mode}`}
      aria-label="Channel privacy"
    >
      {managed ? <ShieldCheck size={17} /> : <LockKeyhole size={17} />}
      <div>
        <strong>{managed ? 'Managed conversation' : 'Sealed conversation'}</strong>
        <p>
          {managed
            ? `Searchable here. Deleted content can be recovered for ${channel.privacy.deletedContentRecoveryDays} days only through an audited case.`
            : 'Only participating devices hold content keys. Server search, previews, and content-reading apps are unavailable.'}
        </p>
      </div>
      <button type="button">Details</button>
    </section>
  );
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel.kind === 'voice') return <Volume2 size={16} />;
  if (channel.privacy.mode === 'sealed') return <LockKeyhole size={15} />;
  return <Hash size={16} />;
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState>(demoBootstrap);
  const [activeChannelId, setActiveChannelId] = useState(demoBootstrap.activeChannelId);
  const [messages, setMessages] = useState<Message[]>(demoBootstrap.messages);
  const [draft, setDraft] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [contextOpen, setContextOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [density, setDensity] = useState<Density>('comfortable');
  const [theme, setTheme] = useState<'dark' | 'light' | 'contrast'>('dark');
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [auditLogNextCursor, setAuditLogNextCursor] = useState<string | null>(null);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    if (import.meta.env.MODE === 'test') return null;
    return localStorage.getItem('cove_session_token');
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginChallengeId, setLoginChallengeId] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  function handleSignOut() {
    localStorage.removeItem('cove_session_token');
    setSessionToken(null);
    setBootstrap(demoBootstrap);
    setMessages(demoBootstrap.messages);
    setConnection('preview');
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setLoginLoading(true);
    setLoginError(null);
    setLoginSuccessMessage(null);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/email/send-code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      if (!res.ok) {
        throw new Error('Failed to send verification code');
      }
      const data = await res.json();
      setLoginChallengeId(data.challengeId);
      setLoginSuccessMessage('Verification code sent to your email.');
    } catch (err: any) {
      setLoginError(err.message || 'An error occurred.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!loginCode.trim() || !loginChallengeId) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/email/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          code: loginCode.trim(),
          challengeId: loginChallengeId,
        }),
      });
      if (!res.ok) {
        throw new Error('Verification failed. Please check the code.');
      }
      const data = await res.json();
      localStorage.setItem('cove_session_token', data.sessionToken);
      setSessionToken(data.sessionToken);
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginCode('');
      setLoginChallengeId(null);
      setLoginSuccessMessage(null);
    } catch (err: any) {
      setLoginError(err.message || 'An error occurred.');
    } finally {
      setLoginLoading(false);
    }
  }

  const endRef = useRef<HTMLDivElement>(null);

  const activeCommunity = bootstrap.communities.find(
    (community) => community.id === bootstrap.activeCommunityId,
  )!;
  const communityChannels = bootstrap.channels.filter(
    (channel) => channel.communityId === activeCommunity.id,
  );
  const activeChannel =
    communityChannels.find((channel) => channel.id === activeChannelId) ?? communityChannels[0]!;
  const channelMessages = messages.filter((message) => message.channelId === activeChannel.id);
  const categories = useMemo(
    () => [...new Set(communityChannels.map((channel) => channel.category))],
    [communityChannels],
  );
  const activePeople = communityChannels.flatMap((channel) => channel.participants);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, [density, theme]);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const controller = new AbortController();
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['authorization'] = `Bearer ${sessionToken}`;
    }
    void fetch(`${API_BASE}/v1/bootstrap`, { headers, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Core service unavailable');
        return response.json();
      })
      .then((data) => {
        const parsed = bootstrapStateSchema.parse(data);
        setBootstrap(parsed);
        setMessages(parsed.messages);
        setActiveChannelId(parsed.activeChannelId);
      })
      .catch(() => setConnection('preview'));
    return () => controller.abort();
  }, [sessionToken]);

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || typeof WebSocket === 'undefined') return;
    const url = sessionToken
      ? `${runtimeConfig.gatewayUrl}?token=${encodeURIComponent(sessionToken)}`
      : runtimeConfig.gatewayUrl;
    const socket = new WebSocket(url);
    let heartbeat: number | undefined;
    socket.addEventListener('open', () => setConnection('connecting'));
    socket.addEventListener('message', (event) => {
      const parsed = gatewayServerFrameSchema.safeParse(JSON.parse(String(event.data)));
      if (!parsed.success) return;
      const frame = parsed.data;
      if (frame.op === 'READY') {
        setConnection('live');
        heartbeat = window.setInterval(() => {
          socket.send(JSON.stringify({ op: 'HEARTBEAT', data: { sequence: frame.data.sequence } }));
        }, 20_000);
      }
      if (frame.op === 'EVENT' && frame.data.type === 'message.created') {
        const message = messageSchema.parse(frame.data.data);
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
      }
      if (
        frame.op === 'EVENT' &&
        (frame.data.type === 'message.updated' || frame.data.type === 'message.deleted')
      ) {
        const message = messageSchema.safeParse(frame.data.data);
        if (message.success) {
          setMessages((current) => reconcileMessageUpdate(current, message.data));
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'message.reaction.updated') {
        const update = messageReactionUpdateSchema.safeParse(frame.data.data);
        if (update.success) {
          setMessages((current) =>
            reconcileReactionUpdate(current, update.data, bootstrap.account.id),
          );
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'attention.item.created') {
        const item = attentionItemSchema.safeParse(frame.data.data);
        if (item.success) {
          setBootstrap((current) => ({
            ...current,
            attention: reconcileAttentionItem(current.attention, item.data),
          }));
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'presence.updated') {
        const update = presenceUpdateSchema.safeParse(frame.data.data);
        if (update.success) {
          const { accountId, status } = update.data;
          setBootstrap((current) => ({
            ...current,
            account:
              current.account.id === accountId ? { ...current.account, status } : current.account,
            channels: current.channels.map((chan) => ({
              ...chan,
              participants: chan.participants.map((p) =>
                p.id === accountId ? { ...p, status } : p,
              ),
            })),
          }));
          setMessages((current) =>
            current.map((msg) =>
              msg.author.id === accountId ? { ...msg, author: { ...msg.author, status } } : msg,
            ),
          );
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'voice.participant.joined') {
        const event = voiceParticipantJoinedSchema.safeParse(frame.data.data);
        if (event.success) {
          setBootstrap((current) => ({
            ...current,
            channels: reconcileVoiceJoin(
              current.channels,
              event.data.channelId,
              event.data.participant,
            ),
          }));
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'voice.participant.left') {
        const event = voiceParticipantLeftSchema.safeParse(frame.data.data);
        if (event.success) {
          setBootstrap((current) => ({
            ...current,
            channels: reconcileVoiceLeave(
              current.channels,
              event.data.channelId,
              event.data.participantId,
            ),
          }));
          setActiveVoiceChannelId((current) => (current === event.data.channelId ? null : current));
          setVoiceSession((current) =>
            current?.participantId === event.data.participantId ? null : current,
          );
        }
      }
    });
    socket.addEventListener('close', () => setConnection('preview'));
    socket.addEventListener('error', () => setConnection('preview'));
    return () => {
      if (heartbeat) window.clearInterval(heartbeat);
      socket.close();
    };
  }, [sessionToken, bootstrap.account.id]);

  useEffect(() => {
    if (!sessionToken || !bootstrap.activeCommunityId) return;
    const controller = new AbortController();
    void fetch(`${API_BASE}/v1/communities/${bootstrap.activeCommunityId}/stats`, {
      headers: { authorization: `Bearer ${sessionToken}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const parsed = communityStatsSchema.safeParse(data);
        if (parsed.success) setCommunityStats(parsed.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [sessionToken, bootstrap.activeCommunityId]);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [channelMessages.length]);

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || activeChannel.kind !== 'text' || activeChannel.privacy.mode === 'sealed')
      return;
    setDraft('');
    const clientNonce = crypto.randomUUID();
    const optimistic: Message = {
      id: `optimistic-${clientNonce}`,
      channelId: activeChannel.id,
      author: bootstrap.account,
      availability: 'plaintext',
      content,
      createdAt: new Date().toISOString(),
      editedAt: null,
      reactions: [],
      attachments: [],
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'idempotency-key': clientNonce,
      };
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }
      const response = await fetch(`${API_BASE}/v1/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, clientNonce }),
      });
      if (!response.ok) throw new Error('Message rejected');
      const saved = messageSchema.parse(await response.json());
      setMessages((current) => reconcileSavedMessage(current, optimistic.id, saved));
    } catch {
      setConnection('preview');
    }
  }

  async function joinVoice(channelId: string) {
    if (import.meta.env.MODE === 'test') return;
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      const response = await fetch(`${API_BASE}/v1/channels/${channelId}/voice/join`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) return;
      const session = voiceSessionSchema.parse(await response.json());
      setVoiceSession(session);
      setActiveVoiceChannelId(channelId);
    } catch {}
  }

  async function leaveVoice(channelId: string) {
    if (import.meta.env.MODE === 'test') return;
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      await fetch(`${API_BASE}/v1/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers,
      });
    } finally {
      setVoiceSession(null);
      setActiveVoiceChannelId(null);
    }
  }

  async function fetchAuditLog(cursor?: string) {
    if (import.meta.env.MODE === 'test') return;
    setAuditLogLoading(true);
    setAuditLogError(null);
    try {
      const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      const res = await fetch(
        `${API_BASE}/v1/communities/${activeCommunity.id}/audit-events${params}`,
        { headers },
      );
      if (!res.ok) {
        setAuditLogError(
          res.status === 403
            ? 'You do not have permission to view this log.'
            : 'Audit log unavailable.',
        );
        return;
      }
      const body = (await res.json()) as { items: AuditEvent[]; nextCursor: string | null };
      setAuditLog((current) => reconcileAuditLog(current, body.items));
      setAuditLogNextCursor(body.nextCursor);
    } catch {
      setAuditLogError('Audit log unavailable.');
    } finally {
      setAuditLogLoading(false);
    }
  }

  function toggleAuditLog() {
    const next = !auditLogOpen;
    setAuditLogOpen(next);
    if (next && auditLog.length === 0) {
      void fetchAuditLog();
    }
  }

  function exportCommunityData() {
    if (import.meta.env.MODE === 'test') return;
    const headers: Record<string, string> = {};
    if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
    fetch(`${API_BASE}/v1/communities/${activeCommunity.id}/export`, { headers })
      .then((res) => {
        if (!res.ok) return;
        return res.blob();
      })
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cove-export-${activeCommunity.id}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <main className={`app-shell ${contextOpen ? '' : 'app-shell--context-closed'}`}>
      <nav className="space-rail" aria-label="Spaces">
        <button className="brand-mark" aria-label="Home">
          <span>co</span>
        </button>
        <div className="rail-rule" />
        {bootstrap.communities.map((community) => (
          <button
            key={community.id}
            className={`space-button ${community.id === activeCommunity.id ? 'is-active' : ''}`}
            style={{ '--space-accent': community.accent } as React.CSSProperties}
            aria-label={community.name}
            title={community.name}
          >
            {community.mark}
          </button>
        ))}
        <IconButton label="Create or join a space" className="space-add">
          <Plus size={20} />
        </IconButton>
        <span className="rail-spacer" />
        <IconButton label="Open attention center">
          <Inbox size={19} />
          <i className="notification-dot" />
        </IconButton>
      </nav>

      <aside className={`community-nav ${mobileNavOpen ? 'is-mobile-open' : ''}`}>
        <header className="community-header">
          <div>
            <span>Private space</span>
            <strong>{activeCommunity.name}</strong>
            <span className="community-stats" aria-label="Community stats">
              {communityStats
                ? `${communityStats.memberCount} members · ${communityStats.onlineCount} online`
                : `${activeCommunity.memberCount} members`}
            </span>
          </div>
          <IconButton
            label={auditLogOpen ? 'Close audit log' : 'Open audit log'}
            onClick={toggleAuditLog}
          >
            <ClipboardList size={16} />
          </IconButton>
          <ChevronDown size={17} />
        </header>

        <button className="event-card" type="button">
          <span className="event-time">20:30</span>
          <span>
            <strong>Practice run</strong>
            <small>Tonight · 6 interested</small>
          </span>
          <span className="event-arrow">→</span>
        </button>

        <div className="channel-scroll">
          {categories.map((category) => (
            <section className="channel-category" key={category}>
              <header>
                <span>{category}</span>
                <button aria-label={`Add channel to ${category}`} type="button">
                  <Plus size={14} />
                </button>
              </header>
              {communityChannels
                .filter((channel) => channel.category === category)
                .map((channel) => (
                  <div key={channel.id}>
                    <button
                      className={`channel-button ${channel.id === activeChannel.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveChannelId(channel.id);
                        setMobileNavOpen(false);
                      }}
                      type="button"
                    >
                      <ChannelIcon channel={channel} />
                      <span>{channel.name}</span>
                      {channel.participants.length > 0 && <b>{channel.participants.length}</b>}
                    </button>
                    {channel.kind === 'voice' && channel.participants.length > 0 && (
                      <div className="voice-members">
                        {channel.participants.map((person) => (
                          <div key={person.id}>
                            <Avatar
                              initials={person.initials}
                              status={person.status}
                              size="small"
                            />
                            <span>{person.displayName}</span>
                            {person.id === 'account-mara' && (
                              <span className="speaking-bars" aria-label="Speaking" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </section>
          ))}
        </div>

        <footer className="user-dock">
          <Avatar initials={bootstrap.account.initials} status={bootstrap.account.status} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{bootstrap.account.displayName}</strong>
            {activeVoiceChannelId ? (
              <span className="voice-dock-status">
                <Volume2 size={11} />
                {communityChannels.find((c) => c.id === activeVoiceChannelId)?.name ?? 'Voice'}
              </span>
            ) : (
              <span>@{bootstrap.account.handle}</span>
            )}
          </div>
          {sessionToken ? (
            <IconButton label="Sign out" onClick={handleSignOut}>
              <LogOut size={17} />
            </IconButton>
          ) : (
            <button
              type="button"
              className="user-dock-signin-btn"
              onClick={() => setShowLoginModal(true)}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 0,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          )}
          {activeVoiceChannelId && (
            <IconButton label="Leave voice" onClick={() => leaveVoice(activeVoiceChannelId)}>
              <Volume2 size={17} />
            </IconButton>
          )}
          <IconButton label="Mute microphone">
            <Mic size={17} />
          </IconButton>
          <IconButton label="Deafen">
            <Headphones size={17} />
          </IconButton>
          <IconButton label="User settings">
            <Settings size={17} />
          </IconButton>
        </footer>
      </aside>

      <section className="conversation">
        <header className="conversation-header">
          <IconButton
            label="Open channel navigation"
            className="mobile-menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </IconButton>
          <ChannelIcon channel={activeChannel} />
          <div className="channel-heading">
            <strong>{activeChannel.name}</strong>
            <span>{activeChannel.topic}</span>
          </div>
          <span className="header-spacer" />
          <StatusPill tone={connection === 'live' ? 'good' : 'quiet'}>
            {connection === 'live'
              ? 'Live'
              : connection === 'connecting'
                ? 'Connecting'
                : 'Preview data'}
          </StatusPill>
          <label className="select-control">
            <span>Density</span>
            <select value={density} onChange={(event) => setDensity(event.target.value as Density)}>
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="touch">Touch</option>
            </select>
          </label>
          <label className="select-control">
            <span>Theme</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as typeof theme)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="contrast">Contrast</option>
            </select>
          </label>
          <IconButton label="Search">
            <Search size={19} />
          </IconButton>
          <IconButton
            label={contextOpen ? 'Close context panel' : 'Open context panel'}
            onClick={() => setContextOpen(!contextOpen)}
          >
            {contextOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
          </IconButton>
        </header>

        <div className="conversation-body">
          <div className="conversation-intro">
            <span className="intro-icon">
              <Hash size={26} />
            </span>
            <p>Welcome to</p>
            <h1>{activeChannel.name}</h1>
            <span>{activeChannel.topic}</span>
          </div>
          <PrivacyNotice channel={activeChannel} />
          <div className="date-divider">
            <span>Today</span>
          </div>
          <div className="message-list" aria-live="polite">
            {activeChannel.kind === 'voice' ? (
              <section className="voice-focus">
                <span className="voice-orbit">
                  <Volume2 size={31} />
                </span>
                <h2>{activeChannel.name}</h2>
                <p>
                  {activeChannel.participants.length
                    ? `${activeChannel.participants.length} ${activeChannel.participants.length === 1 ? 'friend is' : 'friends are'} already here.`
                    : 'This room is quiet right now.'}
                </p>
                {activeVoiceChannelId === activeChannel.id ? (
                  <button type="button" onClick={() => leaveVoice(activeChannel.id)}>
                    Leave voice
                  </button>
                ) : (
                  <button type="button" onClick={() => joinVoice(activeChannel.id)}>
                    Join voice
                  </button>
                )}
                {voiceSession && activeVoiceChannelId === activeChannel.id && (
                  <small className="voice-session-info">
                    Connected · Room: {voiceSession.roomName}
                  </small>
                )}
                <small>E2EE · Device check before joining · No cloud recording</small>
              </section>
            ) : (
              channelMessages.map((message, index) => {
                const previous = channelMessages[index - 1];
                const grouped = previous?.author.id === message.author.id;
                return (
                  <article
                    className={`message ${grouped ? 'message--grouped' : ''}`}
                    key={message.id}
                  >
                    {grouped ? (
                      <time>{timeLabel(message.createdAt)}</time>
                    ) : (
                      <Avatar initials={message.author.initials} status={message.author.status} />
                    )}
                    <div>
                      {!grouped && (
                        <header>
                          <strong>{message.author.displayName}</strong>
                          <time>{timeLabel(message.createdAt)}</time>
                        </header>
                      )}
                      <p>
                        {message.availability === 'deleted' ? 'Message deleted' : message.content}
                      </p>
                      {message.reactions.length > 0 && (
                        <div className="reactions">
                          {message.reactions.map((reaction) => (
                            <button
                              className={reaction.reacted ? 'is-reacted' : ''}
                              key={reaction.emoji}
                              type="button"
                            >
                              {reaction.emoji} <span>{reaction.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="message-actions" aria-label="Message actions">
                      <IconButton label="React">
                        <Smile size={15} />
                      </IconButton>
                      <IconButton label="Reply">
                        <MessageSquareText size={15} />
                      </IconButton>
                      <IconButton label="More actions">
                        <MoreHorizontal size={15} />
                      </IconButton>
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </div>

        {activeChannel.kind === 'text' && (
          <form className="composer" onSubmit={submitMessage}>
            {activeChannel.privacy.mode === 'sealed' ? (
              <div className="sealed-placeholder">
                <LockKeyhole size={17} /> Sealed messaging enters after the reviewed MLS adapter.
              </div>
            ) : (
              <>
                <IconButton label="Add attachment">
                  <Plus size={19} />
                </IconButton>
                <label>
                  <span className="sr-only">Message {activeChannel.name}</span>
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={`Message ${activeChannel.name}`}
                  />
                </label>
                <IconButton label="Choose emoji">
                  <Smile size={19} />
                </IconButton>
                <IconButton
                  label="Send message"
                  className="send-button"
                  disabled={!draft.trim()}
                  type="submit"
                >
                  <SendHorizontal size={18} />
                </IconButton>
              </>
            )}
          </form>
        )}
      </section>

      {contextOpen && (
        <aside className="context-panel">
          {auditLogOpen ? (
            <AuditLogPanel
              events={auditLog}
              loading={auditLogLoading}
              error={auditLogError}
              hasMore={auditLogNextCursor !== null}
              onLoadMore={() => {
                if (auditLogNextCursor) void fetchAuditLog(auditLogNextCursor);
              }}
              onExport={exportCommunityData}
              communityId={activeCommunity.id}
            />
          ) : (
            <>
              <section>
                <header>
                  <span>In voice now</span>
                  <small>{activePeople.length}</small>
                </header>
                {activePeople.map((person) => (
                  <button className="person-row" type="button" key={person.id}>
                    <Avatar initials={person.initials} status={person.status} />
                    <span>
                      <strong>{person.displayName}</strong>
                      <small>Ready Room</small>
                    </span>
                    <Volume2 size={15} />
                  </button>
                ))}
              </section>
              <section className="attention-preview">
                <header>
                  <span>Attention</span>
                  <button type="button">View all</button>
                </header>
                {bootstrap.attention.map((item) => (
                  <button className={item.unread ? 'is-unread' : ''} type="button" key={item.id}>
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
                ))}
              </section>
              <section className="space-health">
                <header>
                  <span>Space health</span>
                </header>
                <div>
                  <ShieldCheck size={18} />
                  <span>
                    <strong>Calm</strong>
                    <small>No unresolved reports</small>
                  </span>
                </div>
                <div>
                  <LockKeyhole size={18} />
                  <span>
                    <strong>Clear privacy</strong>
                    <small>2 managed · 3 sealed rooms</small>
                  </span>
                </div>
              </section>
            </>
          )}
        </aside>
      )}

      {showLoginModal && (
        <div
          className="login-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
        >
          <div className="login-modal">
            <h2 id="login-title">Sign in to Cove</h2>
            <p>Enter your email address to receive a secure 6-digit login code.</p>

            {loginError && (
              <p className="login-error" role="alert">
                {loginError}
              </p>
            )}
            {loginSuccessMessage && (
              <p className="login-success" role="status">
                {loginSuccessMessage}
              </p>
            )}

            {!loginChallengeId ? (
              <form onSubmit={handleSendCode}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  Email Address
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={loginLoading}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: 'var(--text)',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="submit"
                    disabled={loginLoading}
                    style={{
                      flex: 1,
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 0,
                      borderRadius: '6px',
                      padding: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {loginLoading ? 'Sending…' : 'Send Code'}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowLoginModal(false)}
                    disabled={loginLoading}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  Verification Code
                  <input
                    type="text"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    required
                    disabled={loginLoading}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: 'var(--text)',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="submit"
                    disabled={loginLoading}
                    style={{
                      flex: 1,
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 0,
                      borderRadius: '6px',
                      padding: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {loginLoading ? 'Verifying…' : 'Verify Code'}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setLoginChallengeId(null);
                      setLoginCode('');
                      setLoginSuccessMessage(null);
                    }}
                    disabled={loginLoading}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
