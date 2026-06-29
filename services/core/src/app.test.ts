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

describe('community API', () => {
  async function getAuth(app: Awaited<ReturnType<typeof buildApp>>) {
    const email = `user-${crypto.randomUUID()}@test.cove.chat`;
    const sendRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    const { challengeId } = sendRes.json();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId },
    });
    const data = verifyRes.json();
    return {
      token: data.sessionToken as string,
      account: data.account as { id: string; handle: string },
    };
  }

  it('creates a community and lists it', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    expect(createRes.statusCode).toBe(201);
    const community = createRes.json();
    expect(community.name).toBe('Test Guild');
    expect(community.mark).toBe('TE');
    expect(community.accent).toBe('#6f8cff');
    expect(community.memberCount).toBe(1);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { communities } = listRes.json();
    expect(communities.length).toBe(1);
    expect(communities[0].id).toBe(community.id);

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${community.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().name).toBe('Test Guild');
  });

  it('rejects community access without membership', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: otherToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Private Space' },
    });
    const communityId = createRes.json().id;

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(getRes.statusCode).toBe(403);
  });

  it('joins and leaves a community', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Open Space' },
    });
    const communityId = createRes.json().id;

    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(listRes.json().communities.length).toBe(1);

    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/members/me`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(leaveRes.statusCode).toBe(204);
  });

  it('prevents owner from leaving without transfer', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken, account } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Solo Space' },
    });
    const communityId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/members/${account.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(leaveRes.statusCode).toBe(409);
    expect(leaveRes.json().detail).toContain('Transfer ownership');
  });
});

describe('channel API', () => {
  async function getAuth(app: Awaited<ReturnType<typeof buildApp>>) {
    const email = `user-${crypto.randomUUID()}@test.cove.chat`;
    const sendRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    const { challengeId } = sendRes.json();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId },
    });
    const data = verifyRes.json();
    return {
      token: data.sessionToken as string,
      account: data.account as { id: string; handle: string },
    };
  }

  it('creates and lists channels for a community', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Guild' },
    });
    const communityId = createRes.json().id;

    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });
    expect(channelRes.statusCode).toBe(201);
    const channel = channelRes.json();
    expect(channel.name).toBe('general');
    expect(channel.communityId).toBe(communityId);

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { channels } = listRes.json();
    expect(channels.length).toBe(1);
    expect(channels[0].id).toBe(channel.id);
  });

  it('rejects channel creation by non-admin members', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Restricted' },
    });
    const communityId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });
    expect(channelRes.statusCode).toBe(403);
  });
});

describe('permission simulator', () => {
  it('evaluates permission rules with precedence', async () => {
    const app = await buildApp();
    apps.push(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/permissions/simulate',
      payload: {
        permission: 'channel.create',
        memberId: 'user-1',
        roleIds: ['role-admin'],
        isOwner: false,
        isAdministrator: true,
        rules: [
          { subject: 'base', permission: 'channel.create', effect: 'deny' },
          {
            subject: 'role',
            subjectId: 'role-admin',
            permission: 'channel.create',
            effect: 'allow',
          },
        ],
        administratorBypassAllowed: false,
      },
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json();
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe('role-allow');
  });

  it('respects owner-only and explicit deny rules', async () => {
    const app = await buildApp();
    apps.push(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/permissions/simulate',
      payload: {
        permission: 'community.delete',
        memberId: 'user-1',
        roleIds: [],
        isOwner: false,
        isAdministrator: true,
        rules: [],
        ownerOnly: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json();
    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe('default-deny');
  });
});
