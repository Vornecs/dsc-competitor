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
  screenShareStartedSchema,
  screenShareEndedSchema,
  stageSpeakingStateSchema,
  type AuditEvent,
  type BootstrapState,
  type AttentionItem,
  type Channel,
  type CommunityStats,
  type Message,
  type Participant,
  type VoiceSession,
  type StageParticipants,
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
  Monitor,
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
  MicOff,
  VolumeX,
  BellOff,
  X,
} from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
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

export function dismissAttentionItem(current: AttentionItem[], id: string): AttentionItem[] {
  return current.filter((item) => item.id !== id);
}

export function markAllAttentionRead(current: AttentionItem[]): AttentionItem[] {
  return current.map((item) => (item.unread ? { ...item, unread: false } : item));
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

export function reconcileParticipantRole(
  channels: Channel[],
  channelId: string,
  participantId: string,
  role: 'speaker' | 'listener',
): Channel[] {
  return channels.map((ch) => {
    if (ch.id !== channelId) return ch;
    return {
      ...ch,
      participants: ch.participants.map((p) =>
        p.id === participantId ? { ...p, participantRole: role } : p,
      ),
    };
  });
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
  if (channel.kind === 'stage') return <Mic size={16} />;
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

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [channelScreenShares, setChannelScreenShares] = useState<
    Record<string, { participantId: string; trackId: string }[]>
  >({});
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [peekParticipants, setPeekParticipants] = useState<StageParticipants | null>(null);

  const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(() => {
    if (import.meta.env.MODE === 'test') return new Set();
    try {
      const stored = localStorage.getItem('cove_muted_channels');
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginChallengeId, setLoginChallengeId] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyPreviewContent, setReplyPreviewContent] = useState<string | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [wsConnectSignal, setWsConnectSignal] = useState(0);
  const wsReconnectAttemptRef = useRef(0);

  function showToast(message: string) {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  function handleSignOut() {
    localStorage.removeItem('cove_session_token');
    setSessionToken(null);
    setBootstrap(demoBootstrap);
    setMessages(demoBootstrap.messages);
    setConnection('preview');
  }

  async function fetchChannelMessages(channelId: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
    try {
      const res = await fetch(`${API_BASE}/v1/channels/${channelId}/messages`, { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Message[] };
      if (!Array.isArray(data?.items)) return;
      const parsed = data.items.map((m) => messageSchema.safeParse(m)).filter((r) => r.success).map((r) => r.data!);
      setMessages((current) => {
        const others = current.filter((m) => m.channelId !== channelId);
        return [...others, ...parsed];
      });
    } catch {
      // Network error — silently skip, existing messages stay
    }
  }

  async function toggleReaction(messageId: string, channelId: string, emoji: string, reacted: boolean) {
    if (!sessionToken) {
      showToast('Sign in to react to messages');
      return;
    }
    const method = reacted ? 'DELETE' : 'PUT';
    try {
      const res = await fetch(`${API_BASE}/v1/channels/${channelId}/messages/${messageId}/reactions`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error('Reaction rejected');
    } catch {
      showToast('Failed to update reaction');
    }
  }

  async function switchCommunity(communityId: string) {
    setBootstrap((prev) => ({ ...prev, activeCommunityId: communityId }));
    const firstTextChannel = bootstrap.channels.find(
      (ch) => ch.communityId === communityId && ch.kind === 'text',
    );
    if (firstTextChannel) {
      setActiveChannelId(firstTextChannel.id);
      await fetchChannelMessages(firstTextChannel.id);
    }
  }

  function toggleChannelMute(channelId: string) {
    setMutedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      try {
        localStorage.setItem('cove_muted_channels', JSON.stringify([...next]));
      } catch {}
      return next;
    });
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

  async function setStageSpeaking(active: boolean) {
    if (!activeVoiceChannelId) return;
    const joinedChannel = bootstrap.channels.find((c) => c.id === activeVoiceChannelId);
    if (!joinedChannel) return;
    let stageId = '';
    if (joinedChannel.kind === 'stage') {
      stageId = joinedChannel.id;
    } else if (joinedChannel.parentChannelId) {
      const parent = bootstrap.channels.find((c) => c.id === joinedChannel.parentChannelId);
      if (parent?.kind === 'stage') {
        stageId = parent.id;
      }
    }
    if (!stageId) return;

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      const response = await fetch(`${API_BASE}/v1/channels/${stageId}/stage/speaking`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ active }),
      });
      if (response.ok) {
        setIsSpeaking(active);
      }
    } catch (err) {
      console.error('Failed to update stage speaking state:', err);
    }
  }

  async function handleMouseEnter(event: React.MouseEvent<HTMLButtonElement>, channel: Channel) {
    if (channel.kind !== 'stage') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredChannel({
      id: channel.id,
      name: channel.name,
      x: rect.right + 10,
      y: rect.top,
    });

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      const response = await fetch(`${API_BASE}/v1/channels/${channel.id}/stage/peek`, { headers });
      if (response.ok) {
        const data = (await response.json()) as StageParticipants;
        setChannelScreenShares((prev) => ({
          ...prev,
          [channel.id]: data.screenShares,
        }));
      }
    } catch (err) {
      console.error('Failed to peek stage channel:', err);
    }
  }

  function handleMouseLeave() {
    setHoveredChannel(null);
  }

  const computedSpeakers = useMemo(() => {
    if (!hoveredChannel) return [];
    const chan = bootstrap.channels.find((c) => c.id === hoveredChannel.id);
    return chan?.participants || [];
  }, [bootstrap.channels, hoveredChannel]);

  const computedListeners = useMemo(() => {
    if (!hoveredChannel) return [];
    const subs = bootstrap.channels.filter((c) => c.parentChannelId === hoveredChannel.id);
    return subs.flatMap((s) => s.participants);
  }, [bootstrap.channels, hoveredChannel]);

  const computedScreenShares = useMemo(() => {
    if (!hoveredChannel) return [];
    return channelScreenShares[hoveredChannel.id] || [];
  }, [channelScreenShares, hoveredChannel]);

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
  const activePeople = useMemo(() => {
    const list = communityChannels.flatMap((channel) => channel.participants);
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [communityChannels]);

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
        wsReconnectAttemptRef.current = 0;
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
          if (item.data.channelId && mutedChannelIds.has(item.data.channelId)) return;
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
      if (frame.op === 'EVENT' && frame.data.type === 'stage.speaking.updated') {
        const event = stageSpeakingStateSchema.safeParse(frame.data.data);
        if (event.success) {
          const { channelId, participantId, participantRole, active, mediaSession } = event.data;
          setBootstrap((current) => ({
            ...current,
            channels: reconcileParticipantRole(
              current.channels,
              channelId,
              participantId,
              participantRole,
            ),
          }));
          if (participantId === bootstrap.account.id) {
            setIsSpeaking(active);
            setVoiceSession(mediaSession);
          }
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'screen.share.started') {
        const event = screenShareStartedSchema.safeParse(frame.data.data);
        if (event.success) {
          const { channelId, participantId, trackId } = event.data;
          setChannelScreenShares((prev) => {
            const current = prev[channelId] || [];
            if (current.some((s) => s.participantId === participantId)) return prev;
            return {
              ...prev,
              [channelId]: [...current, { participantId, trackId }],
            };
          });
        }
      }
      if (frame.op === 'EVENT' && frame.data.type === 'screen.share.ended') {
        const event = screenShareEndedSchema.safeParse(frame.data.data);
        if (event.success) {
          const { channelId, participantId } = event.data;
          setChannelScreenShares((prev) => {
            const current = prev[channelId] || [];
            return {
              ...prev,
              [channelId]: current.filter((s) => s.participantId !== participantId),
            };
          });
        }
      }
    });
    socket.addEventListener('close', () => {
      setConnection('preview');
      const attempt = wsReconnectAttemptRef.current;
      wsReconnectAttemptRef.current = attempt + 1;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
      setTimeout(() => setWsConnectSignal((s) => s + 1), delay);
    });
    socket.addEventListener('error', () => {
      // 'close' fires after 'error', reconnect is handled there
      setConnection('preview');
    });
    return () => {
      if (heartbeat) window.clearInterval(heartbeat);
      socket.close();
    };
  }, [sessionToken, bootstrap.account.id, wsConnectSignal]);

  // Web PTT Keybind Listener
  useEffect(() => {
    if (!activeVoiceChannelId) return;
    const joinedChannel = bootstrap.channels.find((c) => c.id === activeVoiceChannelId);
    if (!joinedChannel) return;
    const isStageOrSub =
      joinedChannel.kind === 'stage' ||
      (joinedChannel.parentChannelId &&
        bootstrap.channels.find((c) => c.id === joinedChannel.parentChannelId)?.kind === 'stage');
    if (!isStageOrSub) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      if (event.code === 'Space' || event.key === 'F9') {
        if (event.code === 'Space') {
          event.preventDefault();
        }
        if (!isSpeaking) {
          void setStageSpeaking(true);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      if (event.code === 'Space' || event.key === 'F9') {
        void setStageSpeaking(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeVoiceChannelId, isSpeaking, bootstrap.channels]);

  // Desktop native PTT IPC listener
  useEffect(() => {
    const desktopGate = (window as any).desktopGate;
    if (!desktopGate || !activeVoiceChannelId) return;
    const joinedChannel = bootstrap.channels.find((c) => c.id === activeVoiceChannelId);
    if (!joinedChannel) return;
    const isStageOrSub =
      joinedChannel.kind === 'stage' ||
      (joinedChannel.parentChannelId &&
        bootstrap.channels.find((c) => c.id === joinedChannel.parentChannelId)?.kind === 'stage');
    if (!isStageOrSub) return;

    let cleanupPtt: (() => void) | null = null;

    desktopGate.registerPttKey(67).then((registered: boolean) => {
      if (registered) {
        cleanupPtt = desktopGate.onPttEvent((event: { type: 'pressed' | 'released' }) => {
          if (event.type === 'pressed') {
            void setStageSpeaking(true);
          } else if (event.type === 'released') {
            void setStageSpeaking(false);
          }
        });
      }
    });

    return () => {
      if (cleanupPtt) cleanupPtt();
      void desktopGate.unregisterPttKey();
    };
  }, [activeVoiceChannelId, bootstrap.channels]);

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
    if (import.meta.env.MODE === 'test') return;
    void fetchChannelMessages(activeChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

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
    const currentReplyToId = replyToId;
    setReplyToId(null);
    setReplyPreviewContent(null);
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
      replyToId: currentReplyToId ?? undefined,
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
      const body: Record<string, unknown> = { content, clientNonce };
      if (currentReplyToId) body['replyToId'] = currentReplyToId;
      const response = await fetch(`${API_BASE}/v1/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Message rejected');
      const saved = messageSchema.parse(await response.json());
      setMessages((current) => reconcileSavedMessage(current, optimistic.id, saved));
    } catch {
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      showToast('Failed to send message — please try again');
    }
  }

  const isCurrentlySharingScreen = useMemo(() => {
    if (!activeVoiceChannelId) return false;
    const shares = channelScreenShares[activeVoiceChannelId] || [];
    return shares.some((s) => s.participantId === bootstrap.account.id);
  }, [channelScreenShares, activeVoiceChannelId, bootstrap.account.id]);

  async function toggleScreenShare() {
    if (!activeVoiceChannelId) return;
    const isFake = voiceSession?.token.startsWith('fake-token-');

    if (isCurrentlySharingScreen) {
      try {
        if (!isFake && roomRef.current) {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        }
        const headers: Record<string, string> = {};
        if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
        await fetch(`${API_BASE}/v1/channels/${activeVoiceChannelId}/screen/stop`, {
          method: 'POST',
          headers,
        });
      } catch (err) {
        console.error('Failed to stop screen share:', err);
      }
    } else {
      try {
        if (!isFake && roomRef.current) {
          await roomRef.current.localParticipant.setScreenShareEnabled(true);
        }
        const headers: Record<string, string> = {};
        if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
        const response = await fetch(
          `${API_BASE}/v1/channels/${activeVoiceChannelId}/screen/start`,
          {
            method: 'POST',
            headers,
          },
        );
        if (!response.ok) {
          if (!isFake && roomRef.current) {
            await roomRef.current.localParticipant.setScreenShareEnabled(false);
          }
        }
      } catch (err) {
        console.error('Failed to start screen share:', err);
        if (!isFake && roomRef.current) {
          try {
            await roomRef.current.localParticipant.setScreenShareEnabled(false);
          } catch {}
        }
      }
    }
  }

  // Manage LiveKit Room connection based on voiceSession
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;

    if (!voiceSession) {
      if (roomRef.current) {
        const room = roomRef.current;
        roomRef.current = null;
        room.disconnect().catch(console.error);
      }
      return;
    }

    // Skip fake provider path to keep it deterministic for tests
    if (voiceSession.token.startsWith('fake-token-')) {
      if (roomRef.current) {
        const room = roomRef.current;
        roomRef.current = null;
        room.disconnect().catch(console.error);
      }
      return;
    }

    // If already connected to the current session room, do not reconnect
    if (roomRef.current && roomRef.current.name === voiceSession.roomName) {
      return;
    }

    // Disconnect old room if any
    if (roomRef.current) {
      const room = roomRef.current;
      roomRef.current = null;
      room.disconnect().catch(console.error);
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    // Track subscription handlers to attach/detach audio elements
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.muted = isDeafened;
        document.body.appendChild(element);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((el) => el.remove());
      }
    });

    room
      .connect(voiceSession.url, voiceSession.token)
      .then(() => {
        console.log('Connected to LiveKit room:', voiceSession.roomName);
        const shouldPublishMicrophone = !!voiceSession.canPublish && !isMuted;
        return room.localParticipant.setMicrophoneEnabled(shouldPublishMicrophone);
      })
      .catch((err) => {
        console.error('LiveKit connection error:', err);
      });

    return () => {
      // Clean up room connection if session is cleared or changes
    };
  }, [voiceSession?.roomName, voiceSession?.url]);

  // Synchronize microphone publication with permissions and mute state
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const room = roomRef.current;
    if (!room || !voiceSession) return;
    if (voiceSession.token.startsWith('fake-token-')) return;

    const shouldPublishMicrophone = !!voiceSession.canPublish && !isMuted;
    room.localParticipant.setMicrophoneEnabled(shouldPublishMicrophone).catch((err) => {
      console.error('Failed to sync microphone state:', err);
    });
  }, [voiceSession?.canPublish, isMuted, voiceSession]);

  // Synchronize deafen state with remote audio elements
  useEffect(() => {
    const audios = document.querySelectorAll('audio');
    audios.forEach((audio) => {
      audio.muted = isDeafened;
    });
  }, [isDeafened]);

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
      const isFake = voiceSession?.token.startsWith('fake-token-');
      if (!isFake && roomRef.current) {
        try {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        } catch {}
      }
      if (isCurrentlySharingScreen) {
        const headers: Record<string, string> = {};
        if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
        await fetch(`${API_BASE}/v1/channels/${channelId}/screen/stop`, {
          method: 'POST',
          headers,
        }).catch(console.error);
      }
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      await fetch(`${API_BASE}/v1/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers,
      });
    } finally {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(console.error);
        roomRef.current = null;
      }
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
            type="button"
            onClick={() => void switchCommunity(community.id)}
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
                .filter((channel) => channel.category === category && !channel.parentChannelId)
                .map((channel) => (
                  <div key={channel.id}>
                    <button
                      className={`channel-button ${channel.id === activeChannel.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveChannelId(channel.id);
                        setMobileNavOpen(false);
                      }}
                      onMouseEnter={(e) => void handleMouseEnter(e, channel)}
                      onMouseLeave={handleMouseLeave}
                      type="button"
                    >
                      <ChannelIcon channel={channel} />
                      <span>{channel.name}</span>
                      {channel.participants.length > 0 && <b>{channel.participants.length}</b>}
                    </button>
                    {(channel.kind === 'voice' || channel.kind === 'stage') &&
                      channel.participants.length > 0 && (
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
                                {isSpeaker && (
                                  <span className="speaking-bars" aria-label="Speaking" />
                                )}
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
                        {communityChannels
                          .filter((sub) => sub.parentChannelId === channel.id)
                          .map((sub) => {
                            const subActive = sub.id === activeChannel.id;
                            return (
                              <div key={sub.id} className="subchannel-container">
                                <button
                                  className={`channel-button channel-button--sub ${subActive ? 'is-active' : ''}`}
                                  onClick={() => {
                                    setActiveChannelId(sub.id);
                                    setMobileNavOpen(false);
                                  }}
                                  type="button"
                                >
                                  <ChannelIcon channel={sub} />
                                  <span>{sub.name}</span>
                                  {sub.participants.length > 0 && <b>{sub.participants.length}</b>}
                                </button>
                                {sub.participants.length > 0 && (
                                  <div className="voice-members" style={{ paddingLeft: '16px' }}>
                                    {sub.participants.map((person) => {
                                      const hasScreenShare = (
                                        channelScreenShares[sub.id] || []
                                      ).some((s) => s.participantId === person.id);
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
            <>
              <IconButton label="Leave voice" onClick={() => leaveVoice(activeVoiceChannelId)}>
                <Volume2 size={17} />
              </IconButton>
              <IconButton
                label={isCurrentlySharingScreen ? 'Stop sharing screen' : 'Share screen'}
                onClick={toggleScreenShare}
              >
                <Monitor
                  size={17}
                  style={{ color: isCurrentlySharingScreen ? 'var(--accent)' : 'inherit' }}
                />
              </IconButton>
            </>
          )}
          <IconButton
            label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            onClick={() => setIsMuted((m) => !m)}
          >
            {isMuted ? (
              <MicOff size={17} style={{ color: 'var(--status-danger, #ef4444)' }} />
            ) : (
              <Mic size={17} />
            )}
          </IconButton>
          <IconButton
            label={isDeafened ? 'Undeafen' : 'Deafen'}
            onClick={() => setIsDeafened((d) => !d)}
          >
            {isDeafened ? (
              <VolumeX size={17} style={{ color: 'var(--status-danger, #ef4444)' }} />
            ) : (
              <Headphones size={17} />
            )}
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
            {activeChannel.kind === 'voice' || activeChannel.kind === 'stage' ? (
              <section className="voice-focus">
                <span className="voice-orbit">
                  {activeChannel.kind === 'stage' ? <Mic size={31} /> : <Volume2 size={31} />}
                </span>
                <h2>{activeChannel.name}</h2>
                {activeChannel.kind === 'stage' && (
                  <p className="stage-subtitle">Stage Broadcast Channel</p>
                )}
                {activeChannel.parentChannelId && (
                  <p className="stage-subtitle">Stage Subchannel</p>
                )}
                <p>
                  {activeChannel.participants.length
                    ? `${activeChannel.participants.length} ${activeChannel.participants.length === 1 ? 'friend is' : 'friends are'} already here.`
                    : 'This room is quiet right now.'}
                </p>
                <div className="voice-focus-actions">
                  {activeVoiceChannelId === activeChannel.id ? (
                    <button
                      type="button"
                      className="leave-btn"
                      onClick={() => leaveVoice(activeChannel.id)}
                    >
                      Leave {activeChannel.kind === 'stage' ? 'Stage' : 'Voice'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="join-btn"
                      onClick={() => joinVoice(activeChannel.id)}
                    >
                      Join {activeChannel.kind === 'stage' ? 'Stage' : 'Voice'}
                    </button>
                  )}
                </div>
                {voiceSession && activeVoiceChannelId === activeChannel.id && (
                  <div className="voice-session-container">
                    <small className="voice-session-info">
                      Connected · Room: {voiceSession.roomName}
                    </small>
                    {(activeChannel.kind === 'stage' || activeChannel.parentChannelId) && (
                      <div className="stage-ptt-controls">
                        <button
                          type="button"
                          className={`ptt-speak-btn ${isSpeaking ? 'is-speaking' : ''}`}
                          onMouseDown={() => void setStageSpeaking(true)}
                          onMouseUp={() => void setStageSpeaking(false)}
                          onMouseLeave={() => void setStageSpeaking(false)}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            void setStageSpeaking(true);
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            void setStageSpeaking(false);
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
                              onClick={() =>
                                void toggleReaction(
                                  message.id,
                                  message.channelId,
                                  reaction.emoji,
                                  reaction.reacted,
                                )
                              }
                            >
                              {reaction.emoji} <span>{reaction.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {emojiPickerMessageId === message.id && (
                        <div className="emoji-picker" role="dialog" aria-label="Pick a reaction">
                          {['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '👎'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setEmojiPickerMessageId(null);
                                void toggleReaction(message.id, message.channelId, emoji, false);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="message-actions" aria-label="Message actions">
                      <IconButton
                        label="React"
                        onClick={() =>
                          setEmojiPickerMessageId((id) => (id === message.id ? null : message.id))
                        }
                      >
                        <Smile size={15} />
                      </IconButton>
                      <IconButton
                        label="Reply"
                        onClick={() => {
                          setReplyToId(message.id);
                          setReplyPreviewContent(
                            message.content.length > 80
                              ? message.content.slice(0, 80) + '…'
                              : message.content,
                          );
                        }}
                      >
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
            {replyToId && (
              <div className="reply-bar">
                <span>Replying to: {replyPreviewContent}</span>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  onClick={() => {
                    setReplyToId(null);
                    setReplyPreviewContent(null);
                  }}
                >
                  ×
                </button>
              </div>
            )}
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
                  <button
                    type="button"
                    aria-label="Mark all as read"
                    title="Mark all as read"
                    disabled={!bootstrap.attention.some((a) => a.unread)}
                    onClick={() =>
                      setBootstrap((current) => ({
                        ...current,
                        attention: markAllAttentionRead(current.attention),
                      }))
                    }
                  >
                    Mark all read
                  </button>
                </header>
                {bootstrap.attention.map((item) => (
                  <div className={`attention-item ${item.unread ? 'is-unread' : ''}`} key={item.id}>
                    <button className="attention-item-body" type="button">
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
                    <span className="attention-item-actions">
                      {item.channelId && (
                        <button
                          type="button"
                          aria-label={
                            mutedChannelIds.has(item.channelId) ? `Unmute channel` : `Mute channel`
                          }
                          title={
                            mutedChannelIds.has(item.channelId) ? 'Unmute channel' : 'Mute channel'
                          }
                          className={
                            mutedChannelIds.has(item.channelId)
                              ? 'attention-action is-muted'
                              : 'attention-action'
                          }
                          onClick={() => toggleChannelMute(item.channelId!)}
                        >
                          <BellOff size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Dismiss"
                        title="Dismiss"
                        className="attention-action"
                        onClick={() =>
                          setBootstrap((current) => ({
                            ...current,
                            attention: dismissAttentionItem(current.attention, item.id),
                          }))
                        }
                      >
                        <X size={13} />
                      </button>
                    </span>
                  </div>
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
      {hoveredChannel && (
        <div
          className="stage-peek-popover"
          style={{
            position: 'fixed',
            left: `${hoveredChannel.x}px`,
            top: `${hoveredChannel.y}px`,
            zIndex: 1000,
          }}
        >
          <header className="peek-header">
            <span className="peek-tag">Live Stage Peek</span>
            <h3>{hoveredChannel.name}</h3>
          </header>
          <div className="peek-body">
            <div className="peek-section">
              <h4>Speakers ({computedSpeakers.length})</h4>
              {computedSpeakers.length === 0 ? (
                <p className="peek-empty">No speakers on stage</p>
              ) : (
                <div className="peek-users">
                  {computedSpeakers.map((speaker) => {
                    const isSharing = computedScreenShares.some(
                      (s) => s.participantId === speaker.id,
                    );
                    return (
                      <div key={speaker.id} className="peek-user-row">
                        <Avatar size="small" initials={speaker.initials} status={speaker.status} />
                        <span>{speaker.displayName}</span>
                        <span className="peek-badge peek-badge--speaker" title="Speaker">
                          <Mic size={11} />
                        </span>
                        {isSharing && (
                          <span className="peek-badge peek-badge--screen" title="Sharing screen">
                            <Monitor size={11} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="peek-section">
              <h4>Listeners ({computedListeners.length})</h4>
              {computedListeners.length === 0 ? (
                <p className="peek-empty">No listeners</p>
              ) : (
                <div className="peek-users">
                  {computedListeners.map((listener) => {
                    const isSharing = computedScreenShares.some(
                      (s) => s.participantId === listener.id,
                    );
                    return (
                      <div key={listener.id} className="peek-user-row">
                        <Avatar
                          size="small"
                          initials={listener.initials}
                          status={listener.status}
                        />
                        <span>{listener.displayName}</span>
                        <span className="peek-badge peek-badge--listener" title="Listener">
                          <Headphones size={11} />
                        </span>
                        {isSharing && (
                          <span className="peek-badge peek-badge--screen" title="Sharing screen">
                            <Monitor size={11} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                background: 'var(--danger, #e3342f)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(0,0,0,.35)',
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
      {connection !== 'live' && sessionToken && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: connection === 'connecting' ? 'var(--accent, #5865f2)' : '#e3342f',
            color: '#fff',
            textAlign: 'center',
            fontSize: 12,
            padding: '4px 0',
            zIndex: 9998,
          }}
        >
          {connection === 'connecting'
            ? 'Connecting…'
            : 'Disconnected — reconnecting automatically'}
        </div>
      )}
    </main>
  );
}
