import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import {
  bootstrapStateSchema,
  demoBootstrap,
  gatewayClientFrameSchema,
  messageSchema,
  sendMessageRequestSchema,
  type BootstrapState,
  type EventEnvelope,
  type GatewayServerFrame,
  type Message,
  type ProblemDetail,
} from '@competitor/contracts';
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
    type: `https://competitor.invalid/problems/${title.toLowerCase().replaceAll(' ', '-')}`,
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

  await app.register(cors, { origin: true, credentials: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(websocket);

  const currentBootstrap = (): BootstrapState =>
    bootstrapStateSchema.parse({ ...demoBootstrap, messages });

  app.get('/v1/health', async () => ({
    status: 'ok',
    service: 'competitor-core',
    version: '0.0.0',
    time: new Date().toISOString(),
  }));

  app.get('/v1/bootstrap', async () => currentBootstrap());

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
