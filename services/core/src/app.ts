import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import crypto from 'node:crypto';
import {
  bootstrapStateSchema,
  demoBootstrap,
  gatewayClientFrameSchema,
  auditEventSchema,
  attentionItemSchema,
  channelReadStateSchema,
  editMessageRequestSchema,
  messageSchema,
  messageReactionRequestSchema,
  sendMessageRequestSchema,
  updateChannelReadStateRequestSchema,
  initiateUploadRequestSchema,
  emailLoginRequestSchema,
  emailVerifyRequestSchema,
  passkeyRegisterVerifySchema,
  passkeyLoginVerifySchema,
  createCommunityRequestSchema,
  createChannelRequestSchema,
  createRoleRequestSchema,
  updateRoleRequestSchema,
  createInviteRequestSchema,
  permissionSimulatorRequestSchema,
  resolvePermission,
  type Attachment,
  type AttentionItem,
  type BootstrapState,
  type EventEnvelope,
  type GatewayServerFrame,
  type Message,
  type MessageReplyPreview,
  type ProblemDetail,
  type Account,
  type AuditEvent,
  type DeviceSession,
  type Community,
  type Channel,
  type PermissionQuery,
  type PermissionDecision,
  type Role,
  type Invite,
} from '@cove/contracts';
import type { ObjectStorage } from './object-storage.js';
import { createMemoryObjectStorage } from './object-storage.js';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import type { Membership, Repository } from './repository.js';
import { createMemoryRepository } from './memory-repository.js';
import type { GatewayCoordinator } from './gateway-coordinator.js';
import { createMemoryGatewayCoordinator } from './memory-gateway-coordinator.js';

const account = demoBootstrap.account;

function problem(
  reply: FastifyReply,
  status: number,
  title: string,
  detail: string,
  instance?: string,
) {
  const body: ProblemDetail = {
    type: `https://cove.invalid/problems/${title.toLowerCase().replaceAll(' ', '-')}`,
    title,
    status,
    detail,
    ...(instance ? { instance } : {}),
  };
  return reply.type('application/problem+json').code(status).send(body);
}

interface RoutedEnvelope {
  audience?: string[];
  frame: string;
}

class GatewayHub {
  private readonly clients = new Map<
    WebSocket,
    { accountId?: string; communityIds: Set<string> }
  >();
  private unsubscribe?: () => Promise<void>;

  constructor(
    private readonly publicCommunityIds: ReadonlySet<string>,
    private readonly coordinator: GatewayCoordinator,
  ) {
    void this.subscribe();
  }

  private async subscribe() {
    this.unsubscribe = await this.coordinator.subscribe((raw) => {
      let routed: RoutedEnvelope;
      try {
        routed = JSON.parse(raw) as RoutedEnvelope;
      } catch {
        return;
      }
      const frame = JSON.parse(routed.frame) as { data: EventEnvelope<unknown> };
      const { communityId, actorId } = frame.data;
      for (const [client, access] of this.clients) {
        if (client.readyState !== client.OPEN) continue;
        const canAccessCommunity =
          !communityId ||
          this.publicCommunityIds.has(communityId) ||
          access.communityIds.has(communityId);
        const isInAudience =
          !routed.audience || (access.accountId && routed.audience.includes(access.accountId));
        if (canAccessCommunity && isInAudience) {
          client.send(routed.frame);
        }
      }
    });
  }

  async connect(
    socket: WebSocket,
    bootstrap: BootstrapState,
    accountId: string | undefined,
    communityIds: ReadonlySet<string>,
  ) {
    const sequence = await this.coordinator.currentSequence();
    this.clients.set(socket, {
      ...(accountId ? { accountId } : {}),
      communityIds: new Set(communityIds),
    });
    if (accountId) {
      await this.coordinator.setResumeState(accountId, {
        sequence,
        communityIds: Array.from(communityIds),
        updatedAt: new Date().toISOString(),
      });
    }
    const frame: GatewayServerFrame = {
      op: 'READY',
      data: {
        sequence,
        resumeToken: `local-${sequence}`,
        bootstrap,
      },
    };
    socket.send(JSON.stringify(frame));
    socket.on('close', () => {
      this.clients.delete(socket);
      if (accountId) void this.coordinator.deleteResumeState(accountId);
    });
  }

  grantCommunityAccess(accountId: string, communityId: string) {
    for (const access of this.clients.values()) {
      if (access.accountId === accountId) access.communityIds.add(communityId);
    }
  }

  revokeCommunityAccess(accountId: string, communityId: string) {
    for (const access of this.clients.values()) {
      if (access.accountId === accountId) access.communityIds.delete(communityId);
    }
  }

  async heartbeat(socket: WebSocket) {
    const sequence = await this.coordinator.currentSequence();
    const frame: GatewayServerFrame = {
      op: 'HEARTBEAT_ACK',
      data: { at: new Date().toISOString(), sequence },
    };
    socket.send(JSON.stringify(frame));
  }

  async publish<T>(
    type: string,
    data: T,
    communityId?: string,
    actorId?: string,
    audience?: ReadonlySet<string>,
  ) {
    const sequence = await this.coordinator.nextSequence();
    const envelope: EventEnvelope<T> = {
      eventId: crypto.randomUUID(),
      sequence,
      type,
      occurredAt: new Date().toISOString(),
      ...(communityId ? { communityId } : {}),
      ...(actorId ? { actorId } : {}),
      data,
    };
    const frame: GatewayServerFrame = { op: 'EVENT', data: envelope };
    const routed: RoutedEnvelope = {
      ...(audience ? { audience: Array.from(audience) } : {}),
      frame: JSON.stringify(frame),
    };
    await this.coordinator.publish(JSON.stringify(routed));
    return envelope;
  }

  async disconnect() {
    if (this.unsubscribe) {
      await this.unsubscribe();
    }
  }
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'application/pdf',
  'application/zip',
  'text/plain',
]);
const MAX_ATTACHMENT_BYTES = 26_214_400; // 25 MB

export interface BuildAppOptions {
  repo?: Repository;
  coordinator?: GatewayCoordinator;
  storage?: ObjectStorage;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const repo = opts.repo ?? createMemoryRepository();
  const coordinator = opts.coordinator ?? createMemoryGatewayCoordinator();
  const storage = opts.storage ?? createMemoryObjectStorage();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    disableRequestLogging: process.env.NODE_ENV === 'test',
  });
  const demoCommunityIds = new Set(demoBootstrap.communities.map((community) => community.id));
  const demoChannelIds = new Set(demoBootstrap.channels.map((channel) => channel.id));
  const hub = new GatewayHub(demoCommunityIds, coordinator);

  // Seed demo messages into repository
  for (const msg of structuredClone(demoBootstrap.messages)) {
    await repo.addMessage(msg);
  }

  // Pre-populate with our demo account
  await repo.setAccount('nightshift@cove.chat', demoBootstrap.account);

  async function findDynamicChannel(channelId: string): Promise<Channel | undefined> {
    return repo.findChannelById(channelId);
  }

  async function resolveMemberPermission(
    communityId: string,
    membership: Membership,
    memberId: string,
    permission: string,
  ): Promise<PermissionDecision> {
    const roles = await repo.getRolesByCommunity(communityId);
    const everyoneRole = roles.find((role) => role.managed && role.name === '@everyone');
    const assignedRoles = roles.filter((role) => membership.roleIds.includes(role.id));
    const rules = [
      ...(everyoneRole?.permissions.map((rule) => ({
        subject: 'base' as const,
        permission: rule.permission,
        effect: rule.effect,
      })) ?? []),
      ...assignedRoles.flatMap((role) =>
        role.permissions.map((rule) => ({
          subject: 'role' as const,
          subjectId: role.id,
          permission: rule.permission,
          effect: rule.effect,
        })),
      ),
    ];

    return resolvePermission({
      permission,
      memberId,
      roleIds: membership.roleIds,
      isOwner: membership.role === 'owner',
      isAdministrator: membership.role === 'admin',
      rules,
    });
  }

  async function requirePermission(
    reply: FastifyReply,
    communityId: string,
    membership: Membership,
    memberId: string,
    permission: string,
    requestUrl: string,
  ): Promise<PermissionDecision | false> {
    const decision = await resolveMemberPermission(communityId, membership, memberId, permission);
    if (!decision.allowed) {
      problem(reply, 403, 'Permission denied', decision.explanation, requestUrl);
      return false;
    }
    return decision;
  }

  async function messageAudience(
    communityId: string,
    permission: string,
  ): Promise<ReadonlySet<string>> {
    const audience = new Set<string>();
    for (const membership of await repo.getMemberships(communityId)) {
      if (
        (await resolveMemberPermission(communityId, membership, membership.accountId, permission))
          .allowed
      ) {
        audience.add(membership.accountId);
      }
    }
    return audience;
  }

  async function materializeMessage(message: Message, viewerAccountId?: string): Promise<Message> {
    const reactionRecords = await repo.getMessageReactions(message.id);
    if (reactionRecords.length === 0) return message;

    const grouped = new Map<string, { count: number; reacted: boolean }>();
    for (const reaction of reactionRecords) {
      const current = grouped.get(reaction.emoji) ?? { count: 0, reacted: false };
      current.count += 1;
      current.reacted ||= reaction.accountId === viewerAccountId;
      grouped.set(reaction.emoji, current);
    }
    return messageSchema.parse({
      ...message,
      reactions: Array.from(grouped, ([emoji, state]) => ({ emoji, ...state })),
    });
  }

  async function recordMessageAudit(
    communityId: string,
    actorId: string,
    action: AuditEvent['action'],
    messageId: string,
    metadata: AuditEvent['metadata'],
  ): Promise<void> {
    const event = auditEventSchema.parse({
      id: `audit-${crypto.randomUUID()}`,
      communityId,
      actorId,
      action,
      targetType: 'message',
      targetId: messageId,
      metadata,
      createdAt: new Date().toISOString(),
    });
    await repo.addAuditEvent(event);
  }

  async function requireManagedChannelAccess(
    request: any,
    reply: FastifyReply,
    permission: string,
  ): Promise<{ channel: Channel; actor: Account; membership: Membership } | false> {
    const ok = await requireAuth(request, reply);
    if (!ok) return false;
    const { account: actor } = request.user as { account: Account };
    const channel = await findDynamicChannel(request.params.channelId);
    if (!channel || channel.kind !== 'text') {
      problem(
        reply,
        404,
        'Channel not found',
        'The requested managed text channel does not exist.',
        request.url,
      );
      return false;
    }
    if (channel.privacy.mode !== 'managed') {
      problem(
        reply,
        409,
        'Managed channel required',
        'This operation is only available for managed channels.',
        request.url,
      );
      return false;
    }
    const membership = await requireMembership(reply, channel.communityId, actor.id, request.url);
    if (!membership) return false;
    const decision = await requirePermission(
      reply,
      channel.communityId,
      membership,
      actor.id,
      permission,
      request.url,
    );
    if (!decision) return false;
    return { channel, actor, membership };
  }

  async function getMembership(
    communityId: string,
    accountId: string,
  ): Promise<Membership | undefined> {
    return repo.getMembership(communityId, accountId);
  }

  async function requireMembership(
    reply: FastifyReply,
    communityId: string,
    accountId: string,
    requestUrl: string,
  ): Promise<Membership | false> {
    const membership = await getMembership(communityId, accountId);
    if (!membership) {
      problem(reply, 403, 'Not a member', 'You are not a member of this community.', requestUrl);
      return false;
    }
    return membership;
  }

  async function requireAuth(request: any, reply: FastifyReply): Promise<boolean> {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      problem(
        reply,
        401,
        'Unauthorized',
        'Authentication token is missing or invalid.',
        request.url,
      );
      return false;
    }
    const token = authHeader.substring(7);
    const session = await repo.getSession(token);
    if (!session) {
      problem(reply, 401, 'Unauthorized', 'Session is invalid or has expired.', request.url);
      return false;
    }

    // Update activity
    session.lastActiveAt = new Date().toISOString();

    // Resolve user account
    const account = await repo.getAccountByEmail(session.email);
    if (!account) {
      problem(reply, 401, 'Unauthorized', 'User account not found.', request.url);
      return false;
    }

    request.user = { account, session, token };
    return true;
  }

  await app.register(cors, { origin: true, credentials: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(websocket);

  // Binary content type parsers for raw file uploads
  for (const mimeType of ALLOWED_MIME_TYPES) {
    app.addContentTypeParser(mimeType, { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });
  }
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  const currentBootstrap = async (): Promise<BootstrapState> => {
    const bootstrapMessages: Message[] = [];
    for (const channelId of demoChannelIds) {
      bootstrapMessages.push(...(await repo.getMessagesByChannel(channelId)));
    }
    return bootstrapStateSchema.parse({
      ...demoBootstrap,
      messages: bootstrapMessages,
    });
  };

  app.get('/v1/health', async () => ({
    status: 'ok',
    service: 'cove-core',
    version: '0.0.0',
    time: new Date().toISOString(),
  }));

  app.get('/v1/bootstrap', async () => currentBootstrap());

  app.post('/v1/auth/email/send-code', async (request, reply) => {
    const parsed = emailLoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const { email } = parsed.data;
    const code = email.endsWith('@test.cove.chat')
      ? '123456'
      : Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = crypto.randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await repo.setEmailChallenge(email, { code, challengeId, expiresAt });
    app.log.info(`[AUTH] Sent code ${code} to ${email} (challenge: ${challengeId})`);

    return reply.code(200).send({ success: true, challengeId });
  });

  app.post('/v1/auth/email/verify', async (request, reply) => {
    const parsed = emailVerifyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const { email, code, challengeId } = parsed.data;
    const challenge = await repo.getEmailChallenge(email);
    if (!challenge || challenge.challengeId !== challengeId || challenge.expiresAt < Date.now()) {
      return problem(
        reply,
        400,
        'Invalid challenge',
        'The verification challenge has expired or is invalid.',
        request.url,
      );
    }

    if (challenge.code !== code) {
      return problem(reply, 400, 'Invalid code', 'The code provided is incorrect.', request.url);
    }

    await repo.deleteEmailChallenge(email);

    let account = await repo.getAccountByEmail(email);
    let isNewUser = false;
    if (!account) {
      isNewUser = true;
      const localPart = email.split('@')[0] || 'user';
      const handle = localPart.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      const displayName = handle.charAt(0).toUpperCase() + handle.slice(1);
      account = {
        id: `account-${crypto.randomUUID()}`,
        handle,
        displayName: displayName || 'User',
        initials: (displayName || 'US').substring(0, 2).toUpperCase(),
        status: 'online',
      };
      await repo.setAccount(email, account);
    }

    const sessionToken = `sess-${crypto.randomUUID()}`;
    const sessionId = `sid-${crypto.randomUUID()}`;
    const deviceName = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = request.ip || '127.0.0.1';

    await repo.setSession(sessionToken, {
      sessionId,
      email,
      deviceName,
      ipAddress,
      lastActiveAt: new Date().toISOString(),
    });

    return reply.code(200).send({
      sessionToken,
      account,
      isNewUser,
    });
  });

  app.get('/v1/auth/passkey/register/options', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const { account } = (request as any).user;
    const challenge = crypto.randomBytes(32).toString('base64url');

    const userSession = (request as any).user.session;
    userSession.registrationChallenge = challenge;

    return reply.code(200).send({
      challenge,
      rp: {
        name: 'Cove',
        id: 'localhost',
      },
      user: {
        id: account.id,
        name: account.handle,
        displayName: account.displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
    });
  });

  app.post('/v1/auth/passkey/register/verify', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const parsed = passkeyRegisterVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const userSession = (request as any).user.session;
    const { challenge, credentialId, rawId, attestationObject, clientDataJSON } = parsed.data;

    if (!userSession.registrationChallenge || userSession.registrationChallenge !== challenge) {
      return problem(
        reply,
        400,
        'Invalid challenge',
        'The registration challenge does not match or has expired.',
        request.url,
      );
    }

    delete userSession.registrationChallenge;

    const email = userSession.email;
    await repo.addPasskey(email, { credentialId, rawId, attestationObject, clientDataJSON });

    return reply.code(200).send({ success: true });
  });

  app.post('/v1/auth/passkey/login/options', async (request, reply) => {
    const parsed = emailLoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const { email } = parsed.data;
    const credentials = await repo.getPasskeys(email);

    const challenge = crypto.randomBytes(32).toString('base64url');
    await repo.setEmailChallenge(`passkey-login-${email}`, {
      code: challenge,
      challengeId: challenge,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return reply.code(200).send({
      challenge,
      rpId: 'localhost',
      allowCredentials: credentials.map((cred) => ({
        type: 'public-key',
        id: cred.credentialId,
      })),
    });
  });

  app.post('/v1/auth/passkey/login/verify', async (request, reply) => {
    const parsed = passkeyLoginVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const { email, challenge, credentialId, authenticatorData, clientDataJSON, signature } =
      parsed.data;
    const stored = await repo.getEmailChallenge(`passkey-login-${email}`);
    if (!stored || stored.challengeId !== challenge || stored.expiresAt < Date.now()) {
      return problem(
        reply,
        400,
        'Invalid challenge',
        'The login challenge has expired or is invalid.',
        request.url,
      );
    }

    await repo.deleteEmailChallenge(`passkey-login-${email}`);

    const credentials = await repo.getPasskeys(email);
    const cred = credentials.find((c) => c.credentialId === credentialId);
    if (!cred) {
      return problem(
        reply,
        400,
        'Invalid credential',
        'The credential is not registered to this account.',
        request.url,
      );
    }

    if (!signature || !authenticatorData || !clientDataJSON) {
      return problem(
        reply,
        400,
        'Invalid signature',
        'Signature verification failed.',
        request.url,
      );
    }

    const account = await repo.getAccountByEmail(email);
    if (!account) {
      return problem(reply, 404, 'Account not found', 'Account not found.', request.url);
    }

    const sessionToken = `sess-${crypto.randomUUID()}`;
    const sessionId = `sid-${crypto.randomUUID()}`;
    const deviceName = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = request.ip || '127.0.0.1';

    await repo.setSession(sessionToken, {
      sessionId,
      email,
      deviceName,
      ipAddress,
      lastActiveAt: new Date().toISOString(),
    });

    return reply.code(200).send({
      sessionToken,
      account,
      isNewUser: false,
    });
  });

  app.get('/v1/auth/sessions', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const { session: currentSession, token: currentToken } = (request as any).user;
    const email = currentSession.email;

    const userSessions: DeviceSession[] = [];
    for (const { token, session: sess } of await repo.listSessionsByEmail(email)) {
      userSessions.push({
        id: sess.sessionId,
        deviceName: sess.deviceName,
        ipAddress: sess.ipAddress,
        lastActiveAt: sess.lastActiveAt,
        current: token === currentToken,
      });
    }

    return reply.code(200).send({ sessions: userSessions });
  });

  app.delete<{ Params: { sessionId: string } }>(
    '/v1/auth/sessions/:sessionId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { session: currentSession } = (request as any).user;
      const { sessionId } = request.params;

      let found = false;
      for (const { token, session: sess } of await repo.listSessionsByEmail(currentSession.email)) {
        if (sess.sessionId === sessionId) {
          await repo.deleteSession(token);
          found = true;
        }
      }

      if (!found) {
        return problem(
          reply,
          404,
          'Session not found',
          'The specified session was not found or belongs to another user.',
          request.url,
        );
      }

      return reply.code(204).send();
    },
  );

  app.get<{ Params: { channelId: string } }>(
    '/v1/channels/:channelId/messages',
    async (request, reply) => {
      const demoChannel = demoBootstrap.channels.find(
        (candidate) => candidate.id === request.params.channelId,
      );
      const dynamicChannel = await findDynamicChannel(request.params.channelId);
      const channel = demoChannel ?? dynamicChannel;
      if (!channel || channel.kind !== 'text') {
        return problem(
          reply,
          404,
          'Channel not found',
          'The requested text channel does not exist.',
          request.url,
        );
      }

      let viewerAccountId: string | undefined;
      if (dynamicChannel) {
        const ok = await requireAuth(request, reply);
        if (!ok) return;
        const { account: authenticatedAccount } = (request as any).user;
        viewerAccountId = authenticatedAccount.id;
        const membership = await requireMembership(
          reply,
          dynamicChannel.communityId,
          authenticatedAccount.id,
          request.url,
        );
        if (!membership) return;
        const permission = await requirePermission(
          reply,
          dynamicChannel.communityId,
          membership,
          authenticatedAccount.id,
          'message.read',
          request.url,
        );
        if (!permission) return;
      }

      const messages = await repo.getMessagesByChannel(channel.id);
      return reply.code(200).send({
        items: await Promise.all(
          messages.map((message) => materializeMessage(message, viewerAccountId)),
        ),
        nextCursor: null,
      });
    },
  );

  app.post<{ Params: { channelId: string } }>(
    '/v1/channels/:channelId/messages',
    async (request, reply) => {
      const idempotencyKey = request.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
        return problem(
          reply,
          400,
          'Invalid idempotency key',
          'A retry-safe message mutation requires an Idempotency-Key header of at least 8 characters.',
          request.url,
        );
      }

      const parsed = sendMessageRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid message',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const demoChannel = demoBootstrap.channels.find(
        (candidate) => candidate.id === request.params.channelId,
      );
      const dynamicChannel = await findDynamicChannel(request.params.channelId);
      const channel = demoChannel ?? dynamicChannel;
      if (!channel || channel.kind !== 'text') {
        return problem(
          reply,
          404,
          'Channel not found',
          'The requested text channel does not exist.',
          request.url,
        );
      }
      let messageAuthor = account;
      if (dynamicChannel) {
        const ok = await requireAuth(request, reply);
        if (!ok) return;
        const { account: authenticatedAccount } = (request as any).user;
        const membership = await requireMembership(
          reply,
          dynamicChannel.communityId,
          authenticatedAccount.id,
          request.url,
        );
        if (!membership) return;
        const permission = await requirePermission(
          reply,
          dynamicChannel.communityId,
          membership,
          authenticatedAccount.id,
          'message.send',
          request.url,
        );
        if (!permission) return;
        messageAuthor = authenticatedAccount;
      }

      if (channel.privacy.mode === 'sealed') {
        return problem(
          reply,
          409,
          'Sealed transport required',
          'Plaintext messages cannot be submitted to a sealed channel.',
          request.url,
        );
      }

      const scopedIdempotencyKey = `${messageAuthor.id}:${channel.id}:${idempotencyKey}`;
      const existing = await repo.getIdempotentMessage(scopedIdempotencyKey);
      if (existing) return reply.code(200).send(existing);

      // Resolve attachment IDs to approved attachment objects
      const attachmentIds = parsed.data.attachmentIds ?? [];
      let resolvedAttachments: Attachment[] = [];
      if (attachmentIds.length > 0) {
        const records = await repo.getAttachmentsByIds(attachmentIds);
        const missing = attachmentIds.filter((id) => !records.find((r) => r.id === id));
        if (missing.length > 0) {
          return problem(
            reply,
            400,
            'Invalid attachment',
            `Attachment(s) not found: ${missing.join(', ')}`,
            request.url,
          );
        }
        const notApproved = records.filter((r) => r.quarantineStatus !== 'approved');
        if (notApproved.length > 0) {
          return problem(
            reply,
            400,
            'Attachment not ready',
            'One or more attachments have not been uploaded or are pending review.',
            request.url,
          );
        }
        const wrongChannel = records.filter((r) => r.channelId !== channel.id);
        if (wrongChannel.length > 0) {
          return problem(
            reply,
            400,
            'Invalid attachment',
            'Attachments must belong to the target channel.',
            request.url,
          );
        }
        resolvedAttachments = records.map((r) => ({
          id: r.id,
          filename: r.filename,
          mimeType: r.mimeType,
          size: r.size,
          quarantineStatus: r.quarantineStatus,
          createdAt: r.createdAt,
        }));
      }

      let replyPreview: MessageReplyPreview | undefined;
      let replyRecipientId: string | undefined;
      if (parsed.data.replyToId) {
        const parent = await repo.getMessage(parsed.data.replyToId);
        if (!parent || parent.channelId !== channel.id) {
          return problem(
            reply,
            400,
            'Invalid reply target',
            'The reply target message does not exist in this channel.',
            request.url,
          );
        }
        replyPreview = {
          id: parent.id,
          content: parent.content,
          authorDisplayName: parent.author.displayName,
          availability: parent.availability,
        };
        if (parent.author.id !== messageAuthor.id) replyRecipientId = parent.author.id;
      }

      const message = messageSchema.parse({
        id: crypto.randomUUID(),
        channelId: channel.id,
        author: messageAuthor,
        availability: 'plaintext',
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
        attachments: resolvedAttachments,
        replyToId: parsed.data.replyToId,
        replyPreview,
      });
      await repo.addMessage(message);
      await repo.setIdempotentMessage(scopedIdempotencyKey, message);
      const audience = dynamicChannel
        ? await messageAudience(channel.communityId, 'message.read')
        : undefined;
      await hub.publish(
        'message.created',
        message,
        channel.communityId,
        messageAuthor.id,
        audience,
      );
      if (replyRecipientId && audience?.has(replyRecipientId)) {
        const attentionItem: AttentionItem = attentionItemSchema.parse({
          id: `reply-${message.id}`,
          kind: 'reply',
          title: `${messageAuthor.displayName} replied to you`,
          detail: message.content.slice(0, 240),
          createdAt: message.createdAt,
          unread: true,
          communityId: channel.communityId,
          channelId: channel.id,
          messageId: message.id,
        });
        await hub.publish(
          'attention.item.created',
          attentionItem,
          channel.communityId,
          messageAuthor.id,
          new Set([replyRecipientId]),
        );
      }
      return reply.code(201).send(message);
    },
  );

  app.patch<{ Params: { channelId: string; messageId: string } }>(
    '/v1/channels/:channelId/messages/:messageId',
    async (request, reply) => {
      const access = await requireManagedChannelAccess(request, reply, 'message.read');
      if (!access) return;
      const parsed = editMessageRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid message',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }
      const message = await repo.getMessage(request.params.messageId);
      if (!message || message.channelId !== access.channel.id) {
        return problem(
          reply,
          404,
          'Message not found',
          'The requested message does not exist.',
          request.url,
        );
      }
      if (message.author.id !== access.actor.id) {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only the message author can edit message content.',
          request.url,
        );
      }
      if (message.availability !== 'plaintext') {
        return problem(
          reply,
          409,
          'Message unavailable',
          'Deleted messages cannot be edited.',
          request.url,
        );
      }

      const updated = messageSchema.parse({
        ...message,
        content: parsed.data.content,
        editedAt: new Date().toISOString(),
      });
      await repo.updateMessage(updated);
      await recordMessageAudit(
        access.channel.communityId,
        access.actor.id,
        'message.edited',
        message.id,
        { channelId: access.channel.id },
      );
      await hub.publish(
        'message.updated',
        await materializeMessage(updated),
        access.channel.communityId,
        access.actor.id,
        await messageAudience(access.channel.communityId, 'message.read'),
      );
      return reply.code(200).send(await materializeMessage(updated, access.actor.id));
    },
  );

  app.delete<{ Params: { channelId: string; messageId: string } }>(
    '/v1/channels/:channelId/messages/:messageId',
    async (request, reply) => {
      const access = await requireManagedChannelAccess(request, reply, 'message.read');
      if (!access) return;
      const message = await repo.getMessage(request.params.messageId);
      if (!message || message.channelId !== access.channel.id) {
        return problem(
          reply,
          404,
          'Message not found',
          'The requested message does not exist.',
          request.url,
        );
      }
      if (message.author.id !== access.actor.id) {
        const decision = await requirePermission(
          reply,
          access.channel.communityId,
          access.membership,
          access.actor.id,
          'message.manage',
          request.url,
        );
        if (!decision) return;
      }
      if (message.availability === 'deleted') {
        return reply.code(200).send(message);
      }

      const deleted = messageSchema.parse({
        ...message,
        availability: 'deleted',
        content: '',
        reactions: [],
        attachments: [],
      });
      await repo.clearMessageReactions(message.id);
      await repo.updateMessage(deleted);
      await recordMessageAudit(
        access.channel.communityId,
        access.actor.id,
        'message.deleted',
        message.id,
        { channelId: access.channel.id, authorId: message.author.id },
      );
      await hub.publish(
        'message.deleted',
        deleted,
        access.channel.communityId,
        access.actor.id,
        await messageAudience(access.channel.communityId, 'message.read'),
      );
      return reply.code(200).send(deleted);
    },
  );

  app.put<{ Params: { channelId: string; messageId: string } }>(
    '/v1/channels/:channelId/messages/:messageId/reactions',
    async (request, reply) => {
      const access = await requireManagedChannelAccess(request, reply, 'message.react');
      if (!access) return;
      const parsed = messageReactionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid reaction',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }
      const message = await repo.getMessage(request.params.messageId);
      if (!message || message.channelId !== access.channel.id) {
        return problem(
          reply,
          404,
          'Message not found',
          'The requested message does not exist.',
          request.url,
        );
      }
      if (message.availability !== 'plaintext') {
        return problem(
          reply,
          409,
          'Message unavailable',
          'Deleted messages cannot be reacted to.',
          request.url,
        );
      }
      const added = await repo.addMessageReaction({
        messageId: message.id,
        accountId: access.actor.id,
        emoji: parsed.data.emoji,
        createdAt: new Date().toISOString(),
      });
      const materialized = await materializeMessage(message, access.actor.id);
      if (added) {
        const reaction = materialized.reactions.find((item) => item.emoji === parsed.data.emoji);
        await recordMessageAudit(
          access.channel.communityId,
          access.actor.id,
          'message.reaction.added',
          message.id,
          { channelId: access.channel.id, emoji: parsed.data.emoji },
        );
        await hub.publish(
          'message.reaction.updated',
          {
            messageId: message.id,
            emoji: parsed.data.emoji,
            count: reaction?.count ?? 0,
            actorId: access.actor.id,
            reacted: true,
          },
          access.channel.communityId,
          access.actor.id,
          await messageAudience(access.channel.communityId, 'message.read'),
        );
      }
      return reply.code(200).send(materialized);
    },
  );

  app.delete<{ Params: { channelId: string; messageId: string } }>(
    '/v1/channels/:channelId/messages/:messageId/reactions',
    async (request, reply) => {
      // Removing one's own reaction remains available after message.react is revoked.
      const access = await requireManagedChannelAccess(request, reply, 'message.read');
      if (!access) return;
      const parsed = messageReactionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid reaction',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }
      const message = await repo.getMessage(request.params.messageId);
      if (!message || message.channelId !== access.channel.id) {
        return problem(
          reply,
          404,
          'Message not found',
          'The requested message does not exist.',
          request.url,
        );
      }
      const removed = await repo.removeMessageReaction(
        message.id,
        access.actor.id,
        parsed.data.emoji,
      );
      const materialized = await materializeMessage(message, access.actor.id);
      if (removed) {
        const reaction = materialized.reactions.find((item) => item.emoji === parsed.data.emoji);
        await recordMessageAudit(
          access.channel.communityId,
          access.actor.id,
          'message.reaction.removed',
          message.id,
          { channelId: access.channel.id, emoji: parsed.data.emoji },
        );
        await hub.publish(
          'message.reaction.updated',
          {
            messageId: message.id,
            emoji: parsed.data.emoji,
            count: reaction?.count ?? 0,
            actorId: access.actor.id,
            reacted: false,
          },
          access.channel.communityId,
          access.actor.id,
          await messageAudience(access.channel.communityId, 'message.read'),
        );
      }
      return reply.code(200).send(materialized);
    },
  );

  app.get<{ Params: { channelId: string } }>(
    '/v1/channels/:channelId/read-state',
    async (request, reply) => {
      const access = await requireManagedChannelAccess(request, reply, 'message.read');
      if (!access) return;
      const state = await repo.getChannelReadState(access.channel.id, access.actor.id);
      return reply.code(200).send({ state: state ?? null });
    },
  );

  app.put<{ Params: { channelId: string } }>(
    '/v1/channels/:channelId/read-state',
    async (request, reply) => {
      const access = await requireManagedChannelAccess(request, reply, 'message.read');
      if (!access) return;
      const parsed = updateChannelReadStateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid read state',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }
      const message = await repo.getMessage(parsed.data.lastReadMessageId);
      if (!message || message.channelId !== access.channel.id) {
        return problem(
          reply,
          400,
          'Invalid read state',
          'The last-read message must belong to the target channel.',
          request.url,
        );
      }
      const state = channelReadStateSchema.parse({
        channelId: access.channel.id,
        accountId: access.actor.id,
        lastReadMessageId: message.id,
        updatedAt: new Date().toISOString(),
      });
      await repo.setChannelReadState(state);
      await hub.publish(
        'channel.read-state.updated',
        state,
        access.channel.communityId,
        access.actor.id,
        new Set([access.actor.id]),
      );
      return reply.code(200).send(state);
    },
  );

  // Attachments
  app.post<{ Params: { channelId: string } }>(
    '/v1/channels/:channelId/attachments/initiate',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const parsed = initiateUploadRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid request',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const { filename, mimeType, size } = parsed.data;

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return problem(
          reply,
          415,
          'Unsupported media type',
          `The MIME type "${mimeType}" is not permitted. Allowed types: images, video/mp4, video/webm, audio, application/pdf, application/zip, text/plain.`,
          request.url,
        );
      }

      if (size > MAX_ATTACHMENT_BYTES) {
        return problem(
          reply,
          413,
          'Payload too large',
          `File size ${size} exceeds the 25 MB limit.`,
          request.url,
        );
      }

      const { account: actor } = (request as any).user;
      const channel = await repo.findChannelById(request.params.channelId);
      if (!channel) {
        return problem(
          reply,
          404,
          'Channel not found',
          'The requested channel does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, channel.communityId, actor.id, request.url);
      if (!membership) return;
      const permission = await requirePermission(
        reply,
        channel.communityId,
        membership,
        actor.id,
        'message.send',
        request.url,
      );
      if (!permission) return;

      const attachmentId = `att-${crypto.randomUUID()}`;
      const storageKey = `${channel.communityId}/${request.params.channelId}/${attachmentId}`;
      const now = new Date().toISOString();
      await repo.addAttachment({
        id: attachmentId,
        channelId: request.params.channelId,
        uploaderAccountId: actor.id,
        filename,
        mimeType,
        size,
        storageKey,
        quarantineStatus: 'pending',
        createdAt: now,
      });

      return reply.code(201).send({ attachmentId });
    },
  );

  app.put<{ Params: { channelId: string; attachmentId: string } }>(
    '/v1/channels/:channelId/attachments/:attachmentId/upload',
    { config: { rawBody: true } },
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account: actor } = (request as any).user;
      const attachment = await repo.getAttachment(request.params.attachmentId);
      if (!attachment) {
        return problem(
          reply,
          404,
          'Attachment not found',
          'Attachment record not found.',
          request.url,
        );
      }
      if (attachment.channelId !== request.params.channelId) {
        return problem(
          reply,
          404,
          'Attachment not found',
          'Attachment does not belong to this channel.',
          request.url,
        );
      }
      if (attachment.uploaderAccountId !== actor.id) {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only the original uploader may upload this attachment.',
          request.url,
        );
      }
      if (attachment.uploadedAt) {
        return problem(
          reply,
          409,
          'Already uploaded',
          'This attachment has already been uploaded.',
          request.url,
        );
      }

      const body = request.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return problem(
          reply,
          400,
          'Empty body',
          'Upload body must be non-empty binary content.',
          request.url,
        );
      }
      if (body.length > MAX_ATTACHMENT_BYTES) {
        return problem(
          reply,
          413,
          'Payload too large',
          `Upload exceeds the 25 MB limit.`,
          request.url,
        );
      }

      await storage.put(attachment.storageKey, body, attachment.mimeType);
      const uploadedAt = new Date().toISOString();
      await repo.updateAttachmentStatus(attachment.id, 'approved', uploadedAt);

      return reply.code(204).send();
    },
  );

  app.get<{ Params: { attachmentId: string } }>(
    '/v1/attachments/:attachmentId/content',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const attachment = await repo.getAttachment(request.params.attachmentId);
      if (!attachment) {
        return problem(reply, 404, 'Attachment not found', 'Attachment not found.', request.url);
      }
      if (attachment.quarantineStatus !== 'approved') {
        return problem(
          reply,
          451,
          'Unavailable for legal reasons',
          'This attachment is not available.',
          request.url,
        );
      }

      const { account: actor } = (request as any).user;
      const channel = await repo.findChannelById(attachment.channelId);
      if (!channel) {
        return problem(reply, 404, 'Channel not found', 'Channel not found.', request.url);
      }
      const membership = await requireMembership(reply, channel.communityId, actor.id, request.url);
      if (!membership) return;

      const data = await storage.get(attachment.storageKey);
      if (!data) {
        return problem(
          reply,
          404,
          'Content not found',
          'Attachment content is missing from storage.',
          request.url,
        );
      }

      return reply
        .header('content-type', attachment.mimeType)
        .header('content-disposition', `inline; filename="${attachment.filename}"`)
        .code(200)
        .send(data);
    },
  );

  // Communities
  app.post('/v1/communities', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const parsed = createCommunityRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const { account } = (request as any).user;
    const { name, mark, accent } = parsed.data;
    const communityId = `community-${crypto.randomUUID()}`;
    const community: Community = {
      id: communityId,
      name,
      mark: mark ?? name.slice(0, 2).toUpperCase(),
      accent: accent ?? '#6f8cff',
      memberCount: 1,
    };
    await repo.setCommunity(community);
    await repo.addMembership(communityId, { accountId: account.id, role: 'owner', roleIds: [] });

    // Create default @everyone role
    const everyoneRole: Role = {
      id: `role-${crypto.randomUUID()}`,
      communityId,
      name: '@everyone',
      description: 'Default role for all members',
      color: '#6f8cff',
      hoist: false,
      mentionable: false,
      managed: true,
      permissions: [
        { permission: 'message.send', effect: 'allow' },
        { permission: 'message.read', effect: 'allow' },
        { permission: 'message.react', effect: 'allow' },
      ],
      createdAt: new Date().toISOString(),
    };
    await repo.addRole(everyoneRole);
    hub.grantCommunityAccess(account.id, communityId);

    app.log.info(`[COMMUNITY] Created ${communityId} by ${account.id}`);
    return reply.code(201).send(community);
  });

  app.get('/v1/communities', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const { account } = (request as any).user;
    const userCommunities = await repo.listCommunitiesForAccount(account.id);
    return reply.code(200).send({ communities: userCommunities });
  });

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      return reply.code(200).send(community);
    },
  );

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/audit-events',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;
      const { account: actor } = (request as any).user as { account: Account };
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, actor.id, request.url);
      if (!membership) return;
      const decision = await requirePermission(
        reply,
        community.id,
        membership,
        actor.id,
        'audit.read',
        request.url,
      );
      if (!decision) return;
      const events = await repo.getAuditEventsByCommunity(community.id);
      return reply.code(200).send({ items: events.slice(0, 100), nextCursor: null });
    },
  );

  app.post<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/join',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }

      const existingMembership = await repo.getMembership(community.id, account.id);
      if (existingMembership) {
        return problem(
          reply,
          409,
          'Already a member',
          'You are already a member of this community.',
          request.url,
        );
      }

      await repo.addMembership(community.id, {
        accountId: account.id,
        role: 'member',
        roleIds: [],
      });
      community.memberCount = (await repo.getMemberships(community.id)).length;
      hub.grantCommunityAccess(account.id, community.id);
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { communityId: string; memberId: string } }>(
    '/v1/communities/:communityId/members/:memberId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }

      const targetMemberId =
        request.params.memberId === 'me' ? account.id : request.params.memberId;
      const members = await repo.getMemberships(community.id);
      const target = members.find((m) => m.accountId === targetMemberId);
      if (!target) {
        return problem(
          reply,
          404,
          'Member not found',
          'The specified member is not part of this community.',
          request.url,
        );
      }

      const selfMembership = await repo.getMembership(community.id, account.id);
      const selfRole = selfMembership?.role ?? null;
      const isSelf = targetMemberId === account.id;
      const isOwner = selfRole === 'owner';

      if (!isSelf && !isOwner) {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners can remove other members.',
          request.url,
        );
      }

      if (isSelf && isOwner && members.length > 1) {
        return problem(
          reply,
          409,
          'Transfer ownership',
          'Transfer ownership before leaving the community.',
          request.url,
        );
      }

      await repo.removeMembership(community.id, targetMemberId);
      hub.revokeCommunityAccess(targetMemberId, community.id);
      const remaining = await repo.getMemberships(community.id);
      if (remaining.length === 0) {
        await repo.clearInvites(community.id);
        await repo.clearMemberships(community.id);
        await repo.deleteCommunity(community.id);
        await repo.clearChannels(community.id);
        await repo.clearRoles(community.id);
      } else {
        community.memberCount = remaining.length;
      }
      return reply.code(204).send();
    },
  );

  // Channels
  app.post<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/channels',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role === 'member') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can create channels.',
          request.url,
        );
      }

      const parsed = createChannelRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid request',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const { name, kind, category, topic, privacy } = parsed.data;
      const channelId = `channel-${crypto.randomUUID()}`;
      const channel: Channel = {
        id: channelId,
        communityId: community.id,
        name,
        kind,
        category,
        topic: topic ?? '',
        privacy: privacy ?? {
          mode: 'managed',
          searchableByServer: true,
          appsMayReadContent: false,
          deletedContentRecoveryDays: 7,
          evidenceRetentionDays: 90,
        },
        participants: [],
      };
      await repo.addChannel(channel);
      hub.publish('channel.created', channel, community.id, account.id);
      return reply.code(201).send(channel);
    },
  );

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/channels',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;

      const list = await repo.getChannelsByCommunity(community.id);
      return reply.code(200).send({ channels: list });
    },
  );

  // Roles
  app.post<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/roles',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can create roles.',
          request.url,
        );
      }

      const parsed = createRoleRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid request',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const { name, description, color, hoist, mentionable, permissions } = parsed.data;
      const roleId = `role-${crypto.randomUUID()}`;
      const role: Role = {
        id: roleId,
        communityId: community.id,
        name,
        description,
        color: color ?? '#6f8cff',
        hoist: hoist ?? false,
        mentionable: mentionable ?? false,
        managed: false,
        permissions: permissions ?? [],
        createdAt: new Date().toISOString(),
      };
      await repo.addRole(role);
      hub.publish('role.created', role, community.id, account.id);
      return reply.code(201).send(role);
    },
  );

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/roles',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;

      const roles = await repo.getRolesByCommunity(community.id);
      return reply.code(200).send({ roles });
    },
  );

  app.get<{ Params: { communityId: string; roleId: string } }>(
    '/v1/communities/:communityId/roles/:roleId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;

      const roles = await repo.getRolesByCommunity(community.id);
      const role = roles.find((r) => r.id === request.params.roleId);
      if (!role) {
        return problem(
          reply,
          404,
          'Role not found',
          'The requested role does not exist.',
          request.url,
        );
      }
      return reply.code(200).send(role);
    },
  );

  app.patch<{ Params: { communityId: string; roleId: string } }>(
    '/v1/communities/:communityId/roles/:roleId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can edit roles.',
          request.url,
        );
      }

      const parsed = updateRoleRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid request',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const roles = await repo.getRolesByCommunity(community.id);
      const roleIndex = roles.findIndex((r) => r.id === request.params.roleId);
      if (roleIndex === -1) {
        return problem(
          reply,
          404,
          'Role not found',
          'The requested role does not exist.',
          request.url,
        );
      }

      const existingRole = roles[roleIndex]!;
      if (existingRole.managed) {
        return problem(reply, 403, 'Forbidden', 'Managed roles cannot be edited.', request.url);
      }

      const updatedRole: Role = {
        ...existingRole,
        name: parsed.data.name ?? existingRole.name,
        ...(parsed.data.description === undefined
          ? {}
          : parsed.data.description === null
            ? { description: undefined }
            : { description: parsed.data.description }),
        ...(parsed.data.color === undefined
          ? {}
          : parsed.data.color === null
            ? { color: undefined }
            : { color: parsed.data.color }),
        hoist: parsed.data.hoist ?? existingRole.hoist,
        mentionable: parsed.data.mentionable ?? existingRole.mentionable,
        permissions: parsed.data.permissions ?? existingRole.permissions,
        managed: false,
        createdAt: existingRole.createdAt,
      };
      await repo.updateRole(community.id, request.params.roleId, updatedRole);
      hub.publish('role.updated', updatedRole, community.id, account.id);
      return reply.code(200).send(updatedRole);
    },
  );

  app.delete<{ Params: { communityId: string; roleId: string } }>(
    '/v1/communities/:communityId/roles/:roleId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners can delete roles.',
          request.url,
        );
      }

      const roles = await repo.getRolesByCommunity(community.id);
      const roleIndex = roles.findIndex((r) => r.id === request.params.roleId);
      if (roleIndex === -1) {
        return problem(
          reply,
          404,
          'Role not found',
          'The requested role does not exist.',
          request.url,
        );
      }

      const role = roles[roleIndex]!;
      if (role.managed) {
        return problem(reply, 403, 'Forbidden', 'Managed roles cannot be deleted.', request.url);
      }

      await repo.deleteRole(community.id, role.id);
      await repo.removeRoleFromAllMembers(community.id, role.id);
      hub.publish(
        'role.deleted',
        { roleId: role.id, communityId: community.id },
        community.id,
        account.id,
      );
      return reply.code(204).send();
    },
  );

  app.put<{ Params: { communityId: string; memberId: string; roleId: string } }>(
    '/v1/communities/:communityId/members/:memberId/roles/:roleId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const actorMembership = await requireMembership(reply, community.id, account.id, request.url);
      if (!actorMembership) return;
      if (actorMembership.role !== 'owner' && actorMembership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can assign roles.',
          request.url,
        );
      }

      const targetMembership = await getMembership(community.id, request.params.memberId);
      if (!targetMembership) {
        return problem(
          reply,
          404,
          'Member not found',
          'The specified member is not part of this community.',
          request.url,
        );
      }
      const roles = await repo.getRolesByCommunity(community.id);
      const role = roles.find((candidate) => candidate.id === request.params.roleId);
      if (!role) {
        return problem(
          reply,
          404,
          'Role not found',
          'The requested role does not exist.',
          request.url,
        );
      }
      if (role.managed) {
        return problem(
          reply,
          409,
          'Managed role',
          'The managed @everyone role applies automatically and cannot be assigned.',
          request.url,
        );
      }

      if (await repo.assignRoleToMember(community.id, request.params.memberId, role.id)) {
        hub.publish(
          'member.role_assigned',
          { communityId: community.id, memberId: request.params.memberId, roleId: role.id },
          community.id,
          account.id,
        );
      }
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { communityId: string; memberId: string; roleId: string } }>(
    '/v1/communities/:communityId/members/:memberId/roles/:roleId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const actorMembership = await requireMembership(reply, community.id, account.id, request.url);
      if (!actorMembership) return;
      if (actorMembership.role !== 'owner' && actorMembership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can remove roles.',
          request.url,
        );
      }

      const targetMembership = await getMembership(community.id, request.params.memberId);
      if (!targetMembership) {
        return problem(
          reply,
          404,
          'Member not found',
          'The specified member is not part of this community.',
          request.url,
        );
      }
      const roles = await repo.getRolesByCommunity(community.id);
      const role = roles.find((candidate) => candidate.id === request.params.roleId);
      if (!role) {
        return problem(
          reply,
          404,
          'Role not found',
          'The requested role does not exist.',
          request.url,
        );
      }

      await repo.removeRoleFromMember(community.id, request.params.memberId, role.id);
      hub.publish(
        'member.role_removed',
        { communityId: community.id, memberId: request.params.memberId, roleId: role.id },
        community.id,
        account.id,
      );
      return reply.code(204).send();
    },
  );

  // Invites
  app.post<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/invites',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can create invites.',
          request.url,
        );
      }

      const parsed = createInviteRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return problem(
          reply,
          400,
          'Invalid request',
          parsed.error.issues.map((issue) => issue.message).join('; '),
          request.url,
        );
      }

      const { maxUses, expiresInSeconds } = parsed.data;
      const inviteId = `invite-${crypto.randomUUID()}`;
      const code = crypto.randomBytes(6).toString('base64url').substring(0, 8);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + (expiresInSeconds ?? 7 * 24 * 60 * 60) * 1_000,
      ).toISOString();

      const invite: Invite = {
        id: inviteId,
        communityId: community.id,
        code,
        createdBy: account.id,
        createdAt: now.toISOString(),
        expiresAt,
        maxUses: maxUses ?? null,
        uses: 0,
      };

      await repo.addInvite(invite);

      const url = `https://cove.chat/invite/${code}`;

      hub.publish(
        'invite.created',
        { id: invite.id, communityId: invite.communityId, expiresAt: invite.expiresAt },
        community.id,
        account.id,
      );
      return reply.code(201).send({ invite, url });
    },
  );

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/invites',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can list invites.',
          request.url,
        );
      }

      const allInvites = await repo.getInvitesByCommunity(community.id);
      const invites = allInvites.filter(
        (invite) =>
          new Date(invite.expiresAt).getTime() > Date.now() &&
          (invite.maxUses === null || invite.uses < invite.maxUses),
      );
      return reply.code(200).send({ invites });
    },
  );

  app.delete<{ Params: { communityId: string; inviteId: string } }>(
    '/v1/communities/:communityId/invites/:inviteId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = await repo.getCommunity(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = await requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return problem(
          reply,
          403,
          'Forbidden',
          'Only community owners and admins can revoke invites.',
          request.url,
        );
      }

      const invites = await repo.getInvitesByCommunity(community.id);
      const inviteMatch = invites.find((invite) => invite.id === request.params.inviteId);
      if (!inviteMatch) {
        return problem(
          reply,
          404,
          'Invite not found',
          'The requested invite does not exist.',
          request.url,
        );
      }
      await repo.deleteInvite(community.id, request.params.inviteId);
      hub.publish(
        'invite.revoked',
        { communityId: community.id, inviteId: request.params.inviteId },
        community.id,
        account.id,
      );
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { code: string } }>('/v1/invites/:code', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const { account } = (request as any).user;
    const invite = await repo.getInviteByCode(request.params.code);
    if (!invite) {
      return problem(
        reply,
        404,
        'Invite not found',
        'The invite code is invalid or has expired.',
        request.url,
      );
    }

    const community = await repo.getCommunity(invite.communityId);
    if (!community) {
      return problem(
        reply,
        404,
        'Community not found',
        'The community for this invite no longer exists.',
        request.url,
      );
    }

    // Check if already a member
    const existingMember = await repo.getMembership(community.id, account.id);
    if (existingMember) {
      return problem(
        reply,
        409,
        'Already a member',
        'You are already a member of this community.',
        request.url,
      );
    }

    // Check if invite is expired
    if (new Date(invite.expiresAt) < new Date()) {
      return problem(reply, 410, 'Invite expired', 'This invite has expired.', request.url);
    }

    // Check if invite has reached max uses
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return problem(
        reply,
        429,
        'Invite exhausted',
        'This invite has reached its maximum number of uses.',
        request.url,
      );
    }

    // Add member
    await repo.addMembership(community.id, { accountId: account.id, role: 'member', roleIds: [] });
    community.memberCount = (await repo.getMemberships(community.id)).length;
    hub.grantCommunityAccess(account.id, community.id);

    // Update invite uses
    invite.uses += 1;
    await repo.updateInvite(invite);

    hub.publish(
      'member.joined',
      { accountId: account.id, communityId: community.id },
      community.id,
      account.id,
    );
    return reply.code(204).send();
  });

  // Permission simulator
  app.post('/v1/permissions/simulate', async (request, reply) => {
    const parsed = permissionSimulatorRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return problem(
        reply,
        400,
        'Invalid request',
        parsed.error.issues.map((issue) => issue.message).join('; '),
        request.url,
      );
    }

    const {
      permission,
      memberId,
      roleIds,
      isOwner,
      isAdministrator,
      rules,
      ownerOnly,
      administratorBypassAllowed,
    } = parsed.data;
    const query: PermissionQuery = {
      permission,
      memberId,
      roleIds,
      isOwner,
      isAdministrator,
      rules: rules.map((rule) => ({
        subject: rule.subject,
        permission: rule.permission,
        effect: rule.effect,
        ...(rule.subjectId ? { subjectId: rule.subjectId } : {}),
      })),
      ...(ownerOnly !== undefined ? { ownerOnly } : {}),
      ...(administratorBypassAllowed !== undefined ? { administratorBypassAllowed } : {}),
    };
    const decision = resolvePermission(query);
    return reply.code(200).send(decision);
  });

  app.get('/v1/gateway', { websocket: true }, async (socket, request) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const queryToken = requestUrl.searchParams.get('token');
    const authorization = request.headers.authorization;
    const headerToken = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : undefined;
    const session = await repo.getSession(queryToken ?? headerToken ?? '');
    const gatewayAccount = session ? await repo.getAccountByEmail(session.email) : undefined;
    const accessibleCommunityIds = new Set<string>();
    if (gatewayAccount) {
      for (const community of await repo.listCommunitiesForAccount(gatewayAccount.id)) {
        accessibleCommunityIds.add(community.id);
      }
    }
    await hub.connect(socket, await currentBootstrap(), gatewayAccount?.id, accessibleCommunityIds);
    socket.on('message', async (raw) => {
      let decoded: unknown;
      try {
        decoded = JSON.parse(raw.toString());
      } catch {
        socket.close(1003, 'Malformed JSON');
        return;
      }
      const frame = gatewayClientFrameSchema.safeParse(decoded);
      if (!frame.success) {
        socket.close(1008, 'Unsupported gateway frame');
        return;
      }
      if (frame.data.op === 'HEARTBEAT') await hub.heartbeat(socket);
    });
  });

  app.addHook('onClose', async () => {
    await hub.disconnect();
  });

  app.setNotFoundHandler((request, reply) =>
    problem(reply, 404, 'Route not found', 'The requested API route does not exist.', request.url),
  );

  return app;
}
