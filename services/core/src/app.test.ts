import { bootstrapStateSchema, gatewayServerFrameSchema, messageSchema } from '@cove/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from './app.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('core HTTP API', () => {
  it('returns health and a contract-valid bootstrap', async () => {
    const app = await buildApp();
    apps.push(app);

    const health = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: 'ok', service: 'cove-core' });

    const bootstrap = await app.inject({ method: 'GET', url: '/v1/bootstrap' });
    expect(bootstrap.statusCode).toBe(200);
    expect(bootstrapStateSchema.safeParse(bootstrap.json()).success).toBe(true);
  });

  it('requires idempotency and replays the original message', async () => {
    const app = await buildApp();
    apps.push(app);

    const missingKey = await app.inject({
      method: 'POST',
      url: '/v1/channels/channel-campfire/messages',
      payload: { content: 'hello', clientNonce: 'client-nonce-1' },
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.headers['content-type']).toContain('application/problem+json');

    const request = {
      method: 'POST' as const,
      url: '/v1/channels/channel-campfire/messages',
      headers: { 'idempotency-key': 'message-attempt-1' },
      payload: { content: 'A retry-safe message', clientNonce: 'client-nonce-1' },
    };
    const created = await app.inject(request);
    const replayed = await app.inject(request);
    expect(created.statusCode).toBe(201);
    expect(replayed.statusCode).toBe(200);
    expect(messageSchema.parse(created.json()).id).toBe(messageSchema.parse(replayed.json()).id);
  });
});

describe('realtime gateway', () => {
  it('sends READY and acknowledges heartbeats', async () => {
    const app = await buildApp();
    apps.push(app);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test address');

    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/v1/gateway`);
    const frames: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Gateway test timed out')), 3_000);
      socket.on('message', (raw) => {
        const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
        frames.push(frame);
        if (frame.op === 'READY') {
          socket.send(JSON.stringify({ op: 'HEARTBEAT', data: { sequence: frame.data.sequence } }));
        }
        if (frame.op === 'HEARTBEAT_ACK') {
          clearTimeout(timeout);
          socket.close();
          resolve();
        }
      });
      socket.on('error', reject);
    });

    expect(frames.map((frame) => (frame as { op: string }).op)).toEqual(['READY', 'HEARTBEAT_ACK']);
  });
});

describe('authentication API', () => {
  it('performs email login flow and manages device sessions', async () => {
    const app = await buildApp();
    apps.push(app);

    const email = 'alex@test.cove.chat';
    const requestResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    expect(requestResponse.statusCode).toBe(200);
    const { success, challengeId } = requestResponse.json();
    expect(success).toBe(true);
    expect(challengeId).toBeDefined();

    const verifyFail = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '000000', challengeId },
    });
    expect(verifyFail.statusCode).toBe(400);

    const verifySuccess = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId },
    });
    expect(verifySuccess.statusCode).toBe(200);
    const authData = verifySuccess.json();
    expect(authData.sessionToken).toBeDefined();
    expect(authData.account.handle).toBe('alex');
    expect(authData.isNewUser).toBe(true);

    const token = authData.sessionToken;

    const sessionsList = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sessionsList.statusCode).toBe(200);
    const { sessions } = sessionsList.json();
    expect(sessions.length).toBe(1);
    expect(sessions[0].current).toBe(true);

    const sessionId = sessions[0].id;

    const regOptions = await app.inject({
      method: 'GET',
      url: '/v1/auth/passkey/register/options',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(regOptions.statusCode).toBe(200);
    const { challenge: regChallenge } = regOptions.json();
    expect(regChallenge).toBeDefined();

    const regVerify = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        challenge: regChallenge,
        credentialId: 'cred-123',
        rawId: 'cred-123',
        attestationObject: 'mock-attestation',
        clientDataJSON: 'mock-client-data',
      },
    });
    expect(regVerify.statusCode).toBe(200);
    expect(regVerify.json()).toEqual({ success: true });

    const loginOptions = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: { email },
    });
    expect(loginOptions.statusCode).toBe(200);
    const { challenge: loginChallenge, allowCredentials } = loginOptions.json();
    expect(loginChallenge).toBeDefined();
    expect(allowCredentials).toEqual([{ type: 'public-key', id: 'cred-123' }]);

    const loginVerify = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/verify',
      payload: {
        email,
        challenge: loginChallenge,
        credentialId: 'cred-123',
        authenticatorData: 'mock-auth-data',
        clientDataJSON: 'mock-client-data',
        signature: 'mock-sig',
      },
    });
    expect(loginVerify.statusCode).toBe(200);
    const loginAuth = loginVerify.json();
    expect(loginAuth.sessionToken).toBeDefined();
    expect(loginAuth.account.id).toBe(authData.account.id);
    expect(loginAuth.isNewUser).toBe(false);

    const revokeResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revokeResponse.statusCode).toBe(204);

    const sessionsListAfter = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sessionsListAfter.statusCode).toBe(401);
  });
});
