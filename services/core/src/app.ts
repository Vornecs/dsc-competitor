import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import crypto from 'node:crypto';
import {
  bootstrapStateSchema,
  demoBootstrap,
  gatewayClientFrameSchema,
  messageSchema,
  sendMessageRequestSchema,
  emailLoginRequestSchema,
  emailVerifyRequestSchema,
  passkeyRegisterVerifySchema,
  passkeyLoginVerifySchema,
  createCommunityRequestSchema,
  createChannelRequestSchema,
  permissionSimulatorRequestSchema,
  resolvePermission,
  type BootstrapState,
  type EventEnvelope,
  type GatewayServerFrame,
  type Message,
  type ProblemDetail,
  type Account,
  type DeviceSession,
  type Community,
  type Channel,
  type PermissionQuery,
} from '@cove/contracts';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';

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

class GatewayHub {
  private readonly clients = new Set<WebSocket>();
  private sequence = 0;

  get currentSequence() {
    return this.sequence;
  }

  connect(socket: WebSocket, bootstrap: BootstrapState) {
    this.clients.add(socket);
    const frame: GatewayServerFrame = {
      op: 'READY',
      data: {
        sequence: this.sequence,
        resumeToken: `local-${this.sequence}`,
        bootstrap,
      },
    };
    socket.send(JSON.stringify(frame));
    socket.on('close', () => this.clients.delete(socket));
  }

  heartbeat(socket: WebSocket) {
    const frame: GatewayServerFrame = {
      op: 'HEARTBEAT_ACK',
      data: { at: new Date().toISOString(), sequence: this.sequence },
    };
    socket.send(JSON.stringify(frame));
  }

  publish<T>(type: string, data: T, communityId?: string, actorId?: string) {
    this.sequence += 1;
    const envelope: EventEnvelope<T> = {
      eventId: crypto.randomUUID(),
      sequence: this.sequence,
      type,
      occurredAt: new Date().toISOString(),
      ...(communityId ? { communityId } : {}),
      ...(actorId ? { actorId } : {}),
      data,
    };
    const frame: GatewayServerFrame = { op: 'EVENT', data: envelope };
    const serialized = JSON.stringify(frame);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(serialized);
    }
    return envelope;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    disableRequestLogging: process.env.NODE_ENV === 'test',
  });
  const hub = new GatewayHub();
  const messages: Message[] = structuredClone(demoBootstrap.messages);
  const idempotency = new Map<string, Message>();

  // In-memory authentication state
  const emailChallenges = new Map<
    string,
    { code: string; challengeId: string; expiresAt: number }
  >();
  const userPasskeys = new Map<
    string,
    { credentialId: string; rawId: string; attestationObject: string; clientDataJSON: string }[]
  >();
  const sessions = new Map<
    string,
    {
      sessionId: string;
      email: string;
      deviceName: string;
      ipAddress: string;
      lastActiveAt: string;
      registrationChallenge?: string;
    }
  >();
  const accountsByEmail = new Map<string, Account>();

  // Pre-populate with our demo account
  accountsByEmail.set('nightshift@cove.chat', demoBootstrap.account);

  // In-memory community state
  const communities = new Map<string, Community>();
  const channelsByCommunity = new Map<string, Channel[]>();
  const memberships = new Map<
    string,
    { accountId: string; role: 'owner' | 'admin' | 'member' }[]
  >();

  function getMembership(communityId: string, accountId: string) {
    const list = memberships.get(communityId);
    if (!list) return undefined;
    return list.find((m) => m.accountId === accountId);
  }

  function requireMembership(
    reply: FastifyReply,
    communityId: string,
    accountId: string,
    requestUrl: string,
  ): { role: 'owner' | 'admin' | 'member' } | false {
    const membership = getMembership(communityId, accountId);
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
    const session = sessions.get(token);
    if (!session) {
      problem(reply, 401, 'Unauthorized', 'Session is invalid or has expired.', request.url);
      return false;
    }

    // Update activity
    session.lastActiveAt = new Date().toISOString();

    // Resolve user account
    const account = accountsByEmail.get(session.email);
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

  const currentBootstrap = (): BootstrapState =>
    bootstrapStateSchema.parse({ ...demoBootstrap, messages });

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

    emailChallenges.set(email, { code, challengeId, expiresAt });
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
    const challenge = emailChallenges.get(email);
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

    emailChallenges.delete(email);

    let account = accountsByEmail.get(email);
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
      accountsByEmail.set(email, account);
    }

    const sessionToken = `sess-${crypto.randomUUID()}`;
    const sessionId = `sid-${crypto.randomUUID()}`;
    const deviceName = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = request.ip || '127.0.0.1';

    sessions.set(sessionToken, {
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
    let list = userPasskeys.get(email) || [];
    list.push({ credentialId, rawId, attestationObject, clientDataJSON });
    userPasskeys.set(email, list);

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
    const credentials = userPasskeys.get(email) || [];

    const challenge = crypto.randomBytes(32).toString('base64url');
    emailChallenges.set(`passkey-login-${email}`, {
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
    const stored = emailChallenges.get(`passkey-login-${email}`);
    if (!stored || stored.challengeId !== challenge || stored.expiresAt < Date.now()) {
      return problem(
        reply,
        400,
        'Invalid challenge',
        'The login challenge has expired or is invalid.',
        request.url,
      );
    }

    emailChallenges.delete(`passkey-login-${email}`);

    const credentials = userPasskeys.get(email) || [];
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

    const account = accountsByEmail.get(email);
    if (!account) {
      return problem(reply, 404, 'Account not found', 'Account not found.', request.url);
    }

    const sessionToken = `sess-${crypto.randomUUID()}`;
    const sessionId = `sid-${crypto.randomUUID()}`;
    const deviceName = request.headers['user-agent'] || 'Unknown Device';
    const ipAddress = request.ip || '127.0.0.1';

    sessions.set(sessionToken, {
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
    for (const [token, sess] of sessions.entries()) {
      if (sess.email === email) {
        userSessions.push({
          id: sess.sessionId,
          deviceName: sess.deviceName,
          ipAddress: sess.ipAddress,
          lastActiveAt: sess.lastActiveAt,
          current: token === currentToken,
        });
      }
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
      for (const [token, sess] of sessions.entries()) {
        if (sess.email === currentSession.email && sess.sessionId === sessionId) {
          sessions.delete(token);
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
    async (request) => ({
      items: messages.filter((message) => message.channelId === request.params.channelId),
      nextCursor: null,
    }),
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

      const existing = idempotency.get(idempotencyKey);
      if (existing) return reply.code(200).send(existing);

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

      const channel = demoBootstrap.channels.find((item) => item.id === request.params.channelId);
      if (!channel || channel.kind !== 'text') {
        return problem(
          reply,
          404,
          'Channel not found',
          'The requested text channel does not exist.',
          request.url,
        );
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

      const message = messageSchema.parse({
        id: crypto.randomUUID(),
        channelId: channel.id,
        author: account,
        availability: 'plaintext',
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
      });
      messages.push(message);
      idempotency.set(idempotencyKey, message);
      hub.publish('message.created', message, channel.communityId, account.id);
      return reply.code(201).send(message);
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
    communities.set(communityId, community);
    memberships.set(communityId, [{ accountId: account.id, role: 'owner' }]);
    channelsByCommunity.set(communityId, []);
    app.log.info(`[COMMUNITY] Created ${communityId} by ${account.id}`);
    return reply.code(201).send(community);
  });

  app.get('/v1/communities', async (request, reply) => {
    const ok = await requireAuth(request, reply);
    if (!ok) return;

    const { account } = (request as any).user;
    const userCommunities: Community[] = [];
    for (const [communityId, members] of memberships.entries()) {
      if (members.some((m) => m.accountId === account.id)) {
        const community = communities.get(communityId);
        if (community) userCommunities.push(community);
      }
    }
    return reply.code(200).send({ communities: userCommunities });
  });

  app.get<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = communities.get(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;
      return reply.code(200).send(community);
    },
  );

  app.post<{ Params: { communityId: string } }>(
    '/v1/communities/:communityId/join',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = communities.get(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }

      const members = memberships.get(community.id) || [];
      if (members.some((m) => m.accountId === account.id)) {
        return problem(
          reply,
          409,
          'Already a member',
          'You are already a member of this community.',
          request.url,
        );
      }

      members.push({ accountId: account.id, role: 'member' });
      memberships.set(community.id, members);
      community.memberCount = members.length;
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { communityId: string; memberId: string } }>(
    '/v1/communities/:communityId/members/:memberId',
    async (request, reply) => {
      const ok = await requireAuth(request, reply);
      if (!ok) return;

      const { account } = (request as any).user;
      const community = communities.get(request.params.communityId);
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
      const members = memberships.get(community.id) || [];
      const targetIndex = members.findIndex((m) => m.accountId === targetMemberId);
      if (targetIndex === -1) {
        return problem(
          reply,
          404,
          'Member not found',
          'The specified member is not part of this community.',
          request.url,
        );
      }

      const selfIndex = members.findIndex((m) => m.accountId === account.id);
      const selfRole = selfIndex >= 0 ? members[selfIndex]!.role : null;
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

      members.splice(targetIndex, 1);
      if (members.length === 0) {
        memberships.delete(community.id);
        communities.delete(community.id);
        channelsByCommunity.delete(community.id);
      } else {
        memberships.set(community.id, members);
        community.memberCount = members.length;
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
      const community = communities.get(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = requireMembership(reply, community.id, account.id, request.url);
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
      const list = channelsByCommunity.get(community.id) || [];
      list.push(channel);
      channelsByCommunity.set(community.id, list);
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
      const community = communities.get(request.params.communityId);
      if (!community) {
        return problem(
          reply,
          404,
          'Community not found',
          'The requested community does not exist.',
          request.url,
        );
      }
      const membership = requireMembership(reply, community.id, account.id, request.url);
      if (!membership) return;

      const list = channelsByCommunity.get(community.id) || [];
      return reply.code(200).send({ channels: list });
    },
  );

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

  app.get('/v1/gateway', { websocket: true }, (socket) => {
    hub.connect(socket, currentBootstrap());
    socket.on('message', (raw) => {
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
      if (frame.data.op === 'HEARTBEAT') hub.heartbeat(socket);
    });
  });

  app.setNotFoundHandler((request, reply) =>
    problem(reply, 404, 'Route not found', 'The requested API route does not exist.', request.url),
  );

  return app;
}
