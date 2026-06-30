import {
  attentionItemSchema,
  bootstrapStateSchema,
  gatewayServerFrameSchema,
  messageSchema,
} from '@cove/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from './app.js';
import { createMemoryRepository } from './memory-repository.js';

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
  });

  it('returns a customized bootstrap for authenticated requests', async () => {
    const app = await buildApp();
    apps.push(app);

    const email = 'custom-user@test.cove.chat';
    const challengeRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    expect(challengeRes.statusCode).toBe(200);
    const challengeId = challengeRes.json().challengeId;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId },
    });
    expect(verifyRes.statusCode).toBe(200);
    const token = verifyRes.json().sessionToken;

    const authBootstrapRes = await app.inject({
      method: 'GET',
      url: '/v1/bootstrap',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authBootstrapRes.statusCode).toBe(200);
    const authBootstrap = authBootstrapRes.json();
    expect(bootstrapStateSchema.safeParse(authBootstrap).success).toBe(true);
    expect(authBootstrap.account.handle).toBe('customuser');
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

  it('routes community events only to authenticated members', async () => {
    const app = await buildApp();
    apps.push(app);
    const email = `gateway-${crypto.randomUUID()}@test.cove.chat`;
    const sendRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId: sendRes.json().challengeId },
    });
    const token = verifyRes.json().sessionToken as string;

    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test address');

    const publicSocket = new WebSocket(`ws://127.0.0.1:${address.port}/v1/gateway`);
    const memberSocket = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(token)}`,
    );
    const publicFrames: { op: string }[] = [];
    const waitForReady = (socket: WebSocket, frames?: { op: string }[]) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gateway READY timed out')), 3_000);
        socket.on('message', (raw) => {
          const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
          frames?.push(frame);
          if (frame.op === 'READY') {
            clearTimeout(timeout);
            resolve();
          }
        });
        socket.on('error', reject);
      });
    await Promise.all([waitForReady(publicSocket, publicFrames), waitForReady(memberSocket)]);

    const eventPromise = new Promise<{ op: string; data: { type?: string } }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Member event timed out')), 3_000);
      memberSocket.on('message', (raw) => {
        const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
        if (frame.op === 'EVENT') {
          clearTimeout(timeout);
          resolve(frame);
        }
      });
    });
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Gateway Privacy' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityRes.json().id}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'private', kind: 'text', category: 'Chat' },
    });

    const memberEvent = await eventPromise;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(memberEvent.data.type).toBe('channel.created');
    expect(publicFrames.map((frame) => frame.op)).toEqual(['READY']);
    publicSocket.close();
    memberSocket.close();
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

describe('role API', () => {
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

  it('creates a role and lists roles', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    const communityId = createRes.json().id;

    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Moderator', color: '#ff0000', hoist: true },
    });
    expect(roleRes.statusCode).toBe(201);
    const role = roleRes.json();
    expect(role.name).toBe('Moderator');
    expect(role.color).toBe('#ff0000');
    expect(role.hoist).toBe(true);
    expect(role.communityId).toBe(communityId);

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { roles } = listRes.json();
    expect(roles.length).toBe(2); // @everyone + Moderator
    expect(roles.some((r: any) => r.name === '@everyone')).toBe(true);
    expect(roles.some((r: any) => r.name === 'Moderator')).toBe(true);
  });

  it('gets a specific role', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    const communityId = createRes.json().id;

    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'VIP', description: 'Special members' },
    });
    const role = roleRes.json();

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/roles/${role.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().name).toBe('VIP');
    expect(getRes.json().description).toBe('Special members');
  });

  it('updates a role', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    const communityId = createRes.json().id;

    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Moderator' },
    });
    const role = roleRes.json();

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/v1/communities/${communityId}/roles/${role.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Senior Moderator', color: '#00ff00' },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedRole = updateRes.json();
    expect(updatedRole.name).toBe('Senior Moderator');
    expect(updatedRole.color).toBe('#00ff00');
  });

  it('deletes a role', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    const communityId = createRes.json().id;

    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Temp Role' },
    });
    const role = roleRes.json();

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/roles/${role.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${token}` },
    });
    const { roles } = listRes.json();
    expect(roles.length).toBe(1); // Only @everyone remains
    expect(roles[0].name).toBe('@everyone');
  });

  it('rejects role creation by non-admin members', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Restricted Guild' },
    });
    const communityId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'Test Role' },
    });
    expect(roleRes.statusCode).toBe(403);
  });

  it('assigns and removes a role from a community member', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken, account: memberAccount } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Role Assignment Guild' },
    });
    const communityId = communityRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Muted',
        permissions: [{ permission: 'message.send', effect: 'deny' }],
      },
    });
    const roleId = roleRes.json().id;

    const assignRes = await app.inject({
      method: 'PUT',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(assignRes.statusCode).toBe(204);

    const memberAssignRes = await app.inject({
      method: 'PUT',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(memberAssignRes.statusCode).toBe(403);

    const removeRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(removeRes.statusCode).toBe(204);
  });
});

describe('permission-dependent community messages', () => {
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

  it('enforces assigned role permissions when reading and sending messages', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken, account: memberAccount } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Permission Guild' },
    });
    const communityId = communityRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });
    const channelId = channelRes.json().id;
    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Restricted',
        permissions: [
          { permission: 'message.send', effect: 'deny' },
          { permission: 'message.read', effect: 'deny' },
        ],
      },
    });
    const roleId = roleRes.json().id;
    await app.inject({
      method: 'PUT',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    const deniedSend = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'idempotency-key': 'restricted-attempt-1',
      },
      payload: { content: 'This must not be stored.', clientNonce: 'restricted-1' },
    });
    expect(deniedSend.statusCode).toBe(403);
    expect(deniedSend.json().detail).toContain('Denied by role');

    const deniedRead = await app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/messages`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(deniedRead.statusCode).toBe(403);

    await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const allowedSend = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'idempotency-key': 'allowed-attempt-0001',
      },
      payload: { content: 'Permission restored.', clientNonce: 'allowed-1' },
    });
    expect(allowedSend.statusCode).toBe(201);
    expect(allowedSend.json().author.id).toBe(memberAccount.id);

    const allowedRead = await app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/messages`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(allowedRead.statusCode).toBe(200);
    expect(allowedRead.json().items).toHaveLength(1);
  });

  it('requires authentication for community-channel messages', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Private Messages' },
    });
    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityRes.json().id}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelRes.json().id}/messages`,
      headers: { 'idempotency-key': 'unauthenticated-1' },
      payload: { content: 'No access.', clientNonce: 'unauthenticated-1' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('invite API', () => {
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

  it('creates an invite and lists invites', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Guild' },
    });
    const communityId = createRes.json().id;

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${token}` },
      payload: { maxUses: 5 },
    });
    expect(inviteRes.statusCode).toBe(201);
    const { invite, url } = inviteRes.json();
    expect(invite.communityId).toBe(communityId);
    expect(invite.code).toBeDefined();
    expect(invite.code.length).toBe(8);
    expect(url).toContain(invite.code);

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { invites } = listRes.json();
    expect(invites.length).toBe(1);
    expect(invites[0].id).toBe(invite.id);
  });

  it('joins a community via invite', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Invite Guild' },
    });
    const communityId = createRes.json().id;

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    const { invite } = inviteRes.json();

    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/invites/${invite.code}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(listRes.json().communities.length).toBe(1);
    expect(listRes.json().communities[0].id).toBe(communityId);
  });

  it('rejects invite reuse after max uses', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken1 } = await getAuth(app);
    const { token: memberToken2 } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Limited Guild' },
    });
    const communityId = createRes.json().id;

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { maxUses: 1 },
    });
    const { invite } = inviteRes.json();

    await app.inject({
      method: 'POST',
      url: `/v1/invites/${invite.code}`,
      headers: { authorization: `Bearer ${memberToken1}` },
    });

    const joinRes2 = await app.inject({
      method: 'POST',
      url: `/v1/invites/${invite.code}`,
      headers: { authorization: `Bearer ${memberToken2}` },
    });
    expect(joinRes2.statusCode).toBe(429);
  });

  it('rejects invite creation by non-admin members', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Restricted Guild' },
    });
    const communityId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {},
    });
    expect(inviteRes.statusCode).toBe(403);
  });

  it('hides invite codes from members and supports revocation', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);
    const { token: outsiderToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Revocable Invites' },
    });
    const communityId = communityRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expiresInSeconds: 300 },
    });
    const { invite } = inviteRes.json();

    const memberList = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(memberList.statusCode).toBe(403);

    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/invites/${invite.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(revokeRes.statusCode).toBe(204);

    const acceptRes = await app.inject({
      method: 'POST',
      url: `/v1/invites/${invite.code}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(acceptRes.statusCode).toBe(404);
  });
});

describe('attachment pipeline', () => {
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
    return { token: verifyRes.json().sessionToken as string };
  }

  async function setupChannelAndAuth(app: Awaited<ReturnType<typeof buildApp>>) {
    const { token } = await getAuth(app);
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Media Guild' },
    });
    const communityId = communityRes.json().id;
    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'media', kind: 'text', category: 'Files' },
    });
    return { token, communityId, channelId: channelRes.json().id as string };
  }

  it('initiates an upload, uploads content, and serves the file', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, channelId } = await setupChannelAndAuth(app);

    const initiateRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/attachments/initiate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { filename: 'image.png', mimeType: 'image/png', size: 1024 },
    });
    expect(initiateRes.statusCode).toBe(201);
    const { attachmentId } = initiateRes.json();
    expect(attachmentId).toBeDefined();

    const fileContent = Buffer.from('fake-png-bytes');
    const uploadRes = await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/attachments/${attachmentId}/upload`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: fileContent,
    });
    expect(uploadRes.statusCode).toBe(204);

    const serveRes = await app.inject({
      method: 'GET',
      url: `/v1/attachments/${attachmentId}/content`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(serveRes.statusCode).toBe(200);
    expect(serveRes.headers['content-type']).toContain('image/png');
    expect(serveRes.rawPayload).toEqual(fileContent);
  });

  it('rejects upload initiation for unsupported MIME type', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, channelId } = await setupChannelAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/attachments/initiate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { filename: 'malware.exe', mimeType: 'application/x-msdownload', size: 512 },
    });
    expect(res.statusCode).toBe(415);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects upload initiation when file size exceeds 25 MB', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, channelId } = await setupChannelAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/attachments/initiate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { filename: 'huge.mp4', mimeType: 'video/mp4', size: 30_000_000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects duplicate upload of the same attachment', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, channelId } = await setupChannelAndAuth(app);

    const { attachmentId } = (
      await app.inject({
        method: 'POST',
        url: `/v1/channels/${channelId}/attachments/initiate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { filename: 'doc.pdf', mimeType: 'application/pdf', size: 256 },
      })
    ).json();

    const body = Buffer.from('pdf-content');
    await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/attachments/${attachmentId}/upload`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body,
    });

    const dup = await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/attachments/${attachmentId}/upload`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body,
    });
    expect(dup.statusCode).toBe(409);
  });

  it('sends a message with an attachment and returns resolved attachment metadata', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, channelId } = await setupChannelAndAuth(app);

    const { attachmentId } = (
      await app.inject({
        method: 'POST',
        url: `/v1/channels/${channelId}/attachments/initiate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { filename: 'screenshot.png', mimeType: 'image/png', size: 2048 },
      })
    ).json();

    await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/attachments/${attachmentId}/upload`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: Buffer.from('png-data'),
    });

    const msgRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'att-msg-001' },
      payload: {
        content: 'Here is my screenshot',
        clientNonce: 'nonce-att-001',
        attachmentIds: [attachmentId],
      },
    });
    expect(msgRes.statusCode).toBe(201);
    const msg = msgRes.json();
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].id).toBe(attachmentId);
    expect(msg.attachments[0].filename).toBe('screenshot.png');
    expect(msg.attachments[0].quarantineStatus).toBe('approved');
  });
});

describe('managed message lifecycle', () => {
  async function authenticate(app: Awaited<ReturnType<typeof buildApp>>) {
    const email = `lifecycle-${crypto.randomUUID()}@test.cove.chat`;
    const send = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email },
    });
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email, code: '123456', challengeId: send.json().challengeId },
    });
    return {
      token: verify.json().sessionToken as string,
      account: verify.json().account as { id: string },
    };
  }

  async function setup(app: Awaited<ReturnType<typeof buildApp>>) {
    const owner = await authenticate(app);
    const member = await authenticate(app);
    const community = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'Lifecycle Guild' },
    });
    const communityId = community.json().id as string;
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    const channel = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });
    return { owner, member, communityId, channelId: channel.json().id as string };
  }

  async function sendMessage(
    app: Awaited<ReturnType<typeof buildApp>>,
    channelId: string,
    token: string,
    content: string,
  ) {
    return app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `lifecycle-${crypto.randomUUID()}`,
      },
      payload: { content, clientNonce: `nonce-${crypto.randomUUID()}` },
    });
  }

  it('allows author edits, moderator deletes, and exposes content-free audit events', async () => {
    const app = await buildApp();
    apps.push(app);
    const { owner, member, communityId, channelId } = await setup(app);
    const created = await sendMessage(app, channelId, member.token, 'Original private wording');
    const messageId = created.json().id as string;

    const forbiddenEdit = await app.inject({
      method: 'PATCH',
      url: `/v1/channels/${channelId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { content: 'Moderator rewrite' },
    });
    expect(forbiddenEdit.statusCode).toBe(403);

    const edited = await app.inject({
      method: 'PATCH',
      url: `/v1/channels/${channelId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { content: 'Revised private wording' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().content).toBe('Revised private wording');
    expect(edited.json().editedAt).not.toBeNull();

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/channels/${channelId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ availability: 'deleted', content: '', attachments: [] });

    const memberAudit = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/audit-events`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect(memberAudit.statusCode).toBe(403);

    const ownerAudit = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/audit-events`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerAudit.statusCode).toBe(200);
    const auditActions = ownerAudit.json().items.map((event: { action: string }) => event.action);
    expect(auditActions).toContain('message.deleted');
    expect(auditActions).toContain('message.edited');
    expect(JSON.stringify(ownerAudit.json())).not.toContain('private wording');
  });

  it('makes reactions idempotent, permission-gated, and removable', async () => {
    const app = await buildApp();
    apps.push(app);
    const { owner, member, communityId, channelId } = await setup(app);
    const created = await sendMessage(app, channelId, owner.token, 'React here');
    const messageId = created.json().id as string;
    const request = {
      method: 'PUT' as const,
      url: `/v1/channels/${channelId}/messages/${messageId}/reactions`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { emoji: '✓' },
    };
    const added = await app.inject(request);
    const duplicate = await app.inject(request);
    expect(added.statusCode).toBe(200);
    expect(added.json().reactions).toEqual([{ emoji: '✓', count: 1, reacted: true }]);
    expect(duplicate.json().reactions).toEqual([{ emoji: '✓', count: 1, reacted: true }]);

    const role = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        name: 'No reactions',
        permissions: [{ permission: 'message.react', effect: 'deny' }],
      },
    });
    await app.inject({
      method: 'PUT',
      url: `/v1/communities/${communityId}/members/${member.account.id}/roles/${role.json().id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const denied = await app.inject({ ...request, payload: { emoji: '＋1' } });
    expect(denied.statusCode).toBe(403);

    const removed = await app.inject({ ...request, method: 'DELETE' });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().reactions).toEqual([]);

    await app.inject({
      method: 'DELETE',
      url: `/v1/channels/${channelId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const deletedReaction = await app.inject(request);
    expect(deletedReaction.statusCode).toBe(403);
  });

  it('stores private per-account read state and rejects cross-channel cursors', async () => {
    const app = await buildApp();
    apps.push(app);
    const { owner, member, communityId, channelId } = await setup(app);
    const created = await sendMessage(app, channelId, owner.token, 'Read through here');
    const messageId = created.json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/read-state`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { lastReadMessageId: messageId },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      channelId,
      accountId: member.account.id,
      lastReadMessageId: messageId,
    });

    const ownerState = await app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/read-state`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(ownerState.json()).toEqual({ state: null });

    const otherChannel = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'other', kind: 'text', category: 'Chat' },
    });
    const otherMessage = await sendMessage(app, otherChannel.json().id, owner.token, 'Elsewhere');
    const rejected = await app.inject({
      method: 'PUT',
      url: `/v1/channels/${channelId}/read-state`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { lastReadMessageId: otherMessage.json().id },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it('creates a reply with parent preview and enforces same-channel constraint', async () => {
    const app = await buildApp();
    apps.push(app);
    const { owner, communityId, channelId } = await setup(app);

    const parentResp = await sendMessage(app, channelId, owner.token, 'Parent message content');
    expect(parentResp.statusCode).toBe(201);
    const parentId = parentResp.json().id as string;

    // Send a reply
    const replyResp = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `reply-${crypto.randomUUID()}`,
      },
      payload: {
        content: 'This is a reply',
        clientNonce: `nonce-${crypto.randomUUID()}`,
        replyToId: parentId,
      },
    });
    expect(replyResp.statusCode).toBe(201);
    const replyMsg = replyResp.json();
    expect(replyMsg.replyToId).toBe(parentId);
    expect(replyMsg.replyPreview).toMatchObject({
      id: parentId,
      content: 'Parent message content',
      authorDisplayName: expect.any(String),
      availability: 'plaintext',
    });

    // Reply appears in channel message list with its preview intact
    const listResp = await app.inject({
      method: 'GET',
      url: `/v1/channels/${channelId}/messages`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const found = (listResp.json().items as any[]).find((m: any) => m.id === replyMsg.id);
    expect(found?.replyToId).toBe(parentId);
    expect(found?.replyPreview?.id).toBe(parentId);

    // Reply to nonexistent message returns 400
    const badReply = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `reply-bad-${crypto.randomUUID()}`,
      },
      payload: {
        content: 'Bad reply',
        clientNonce: `nonce-${crypto.randomUUID()}`,
        replyToId: 'nonexistent-message-id',
      },
    });
    expect(badReply.statusCode).toBe(400);
    expect(badReply.headers['content-type']).toContain('application/problem+json');

    // Reply to a message in a different channel returns 400
    const otherChannel = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { name: 'other-chat', kind: 'text', category: 'Chat' },
    });
    const crossChannelReply = await app.inject({
      method: 'POST',
      url: `/v1/channels/${otherChannel.json().id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `reply-cross-${crypto.randomUUID()}`,
      },
      payload: {
        content: 'Cross-channel reply',
        clientNonce: `nonce-${crypto.randomUUID()}`,
        replyToId: parentId,
      },
    });
    expect(crossChannelReply.statusCode).toBe(400);
  });

  it('fans reply attention only to the original author', async () => {
    const app = await buildApp();
    apps.push(app);
    const { owner, member, communityId, channelId } = await setup(app);
    const parent = await sendMessage(app, channelId, owner.token, 'Original author message');

    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test address');

    const ownerSocket = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(owner.token)}`,
    );
    const memberSocket = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(member.token)}`,
    );
    const memberEventTypes: string[] = [];
    memberSocket.on('message', (raw) => {
      const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
      if (frame.op === 'EVENT') memberEventTypes.push(frame.data.type);
    });

    const waitForReady = (socket: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gateway READY timed out')), 3_000);
        socket.on('message', (raw) => {
          const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
          if (frame.op === 'READY') {
            clearTimeout(timeout);
            resolve();
          }
        });
        socket.on('error', reject);
      });
    await Promise.all([waitForReady(ownerSocket), waitForReady(memberSocket)]);

    const attentionPromise = new Promise<ReturnType<typeof attentionItemSchema.parse>>(
      (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reply attention timed out')), 3_000);
        ownerSocket.on('message', (raw) => {
          const frame = gatewayServerFrameSchema.parse(JSON.parse(raw.toString()));
          if (frame.op === 'EVENT' && frame.data.type === 'attention.item.created') {
            clearTimeout(timeout);
            resolve(attentionItemSchema.parse(frame.data.data));
          }
        });
      },
    );
    const response = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelId}/messages`,
      headers: {
        authorization: `Bearer ${member.token}`,
        'idempotency-key': `reply-attention-${crypto.randomUUID()}`,
      },
      payload: {
        content: 'A targeted reply notification',
        clientNonce: `nonce-${crypto.randomUUID()}`,
        replyToId: parent.json().id,
      },
    });
    expect(response.statusCode).toBe(201);
    await expect(attentionPromise).resolves.toMatchObject({
      kind: 'reply',
      title: expect.stringContaining('replied to you'),
      detail: 'A targeted reply notification',
      unread: true,
      communityId,
      channelId,
      messageId: response.json().id,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(memberEventTypes).toContain('message.created');
    expect(memberEventTypes).not.toContain('attention.item.created');

    ownerSocket.close();
    memberSocket.close();
  });

  it('updates member presence online/offline with multi-session-safe transitions and gateway fanout', async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repo });
    apps.push(app);

    const email1 = `p1-${crypto.randomUUID()}@test.cove.chat`;
    const email2 = `p2-${crypto.randomUUID()}@test.cove.chat`;

    const getSession = async (email: string) => {
      const sendRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/email/send-code',
        payload: { email },
      });
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/v1/auth/email/verify',
        payload: { email, code: '123456', challengeId: sendRes.json().challengeId },
      });
      return {
        token: verifyRes.json().sessionToken as string,
        accountId: verifyRes.json().account.id as string,
      };
    };

    const user1 = await getSession(email1);
    const user2 = await getSession(email2);

    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test address');

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${user1.token}` },
      payload: { name: 'Presence Community' },
    });
    const communityId = communityRes.json().id;

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${user1.token}` },
      payload: {},
    });
    const inviteCode = inviteRes.json().invite.code;

    await app.inject({
      method: 'POST',
      url: `/v1/invites/${inviteCode}`,
      headers: { authorization: `Bearer ${user2.token}` },
    });

    const acct1 = await repo.getAccountByEmail(email1);
    if (acct1) {
      await repo.setAccount(email1, { ...acct1, status: 'offline' });
    }

    const socket2 = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(user2.token)}`,
    );

    const waitForReady = (socket: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gateway READY timed out')), 3_000);
        socket.on('message', (raw) => {
          const frame = JSON.parse(raw.toString());
          if (frame.op === 'READY') {
            clearTimeout(timeout);
            resolve();
          }
        });
        socket.on('error', reject);
      });

    await waitForReady(socket2);

    const presenceUpdates: any[] = [];
    socket2.on('message', (raw) => {
      const frame = JSON.parse(raw.toString());
      if (frame.op === 'EVENT' && frame.data.type === 'presence.updated') {
        presenceUpdates.push(frame.data.data);
      }
    });

    const socket1a = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(user1.token)}`,
    );
    await waitForReady(socket1a);

    let check1 = await repo.getAccountByEmail(email1);
    expect(check1?.status).toBe('online');

    const socket1b = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/gateway?token=${encodeURIComponent(user1.token)}`,
    );
    await waitForReady(socket1b);

    await new Promise<void>((resolve) => {
      socket1a.on('close', () => resolve());
      socket1a.close();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    let check2 = await repo.getAccountByEmail(email1);
    expect(check2?.status).toBe('online');

    await new Promise<void>((resolve) => {
      socket1b.on('close', () => resolve());
      socket1b.close();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    let check3 = await repo.getAccountByEmail(email1);
    expect(check3?.status).toBe('offline');

    await new Promise<void>((resolve) => {
      socket2.on('close', () => resolve());
      socket2.close();
    });

    expect(presenceUpdates).toEqual([
      { accountId: user1.accountId, status: 'online' },
      { accountId: user1.accountId, status: 'offline' },
    ]);
  });
});

describe('community stats API', () => {
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
    return { token: data.sessionToken as string, account: data.account as { id: string } };
  }

  it('returns member count, channel count, message count, and online count', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Stats Community' },
    });
    const communityId = communityRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'general', kind: 'text', category: 'Chat' },
    });

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    const inviteList = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const code = inviteList.json().invites[0].code as string;

    await app.inject({
      method: 'POST',
      url: `/v1/invites/${code}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const statsRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/stats`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(statsRes.statusCode).toBe(200);
    const stats = statsRes.json();
    expect(stats.memberCount).toBe(2);
    expect(stats.channelCount).toBe(1);
    expect(stats.messageCount).toBe(0);
    expect(typeof stats.onlineCount).toBe('number');
  });

  it('rejects stats for non-members', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: outsiderToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Private' },
    });
    const communityId = communityRes.json().id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/stats`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('operator audit log', () => {
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
    return { token: data.sessionToken as string, account: data.account as { id: string } };
  }

  it('records member.joined and channel.created audit events', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Audit Community' },
    });
    const communityId = communityRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'announce', kind: 'text', category: 'Info' },
    });

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const repo = createMemoryRepository();
    const appWithRepo = await buildApp({ repo });
    apps.push(appWithRepo);

    const auditRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/audit-events`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const { items } = auditRes.json() as { items: Array<{ action: string; targetType: string }> };
    const actions = items.map((e) => e.action);
    expect(actions).toContain('channel.created');
    expect(actions).toContain('member.joined');
  });

  it('paginates audit events with cursor', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Paginate Community' },
    });
    const communityId = communityRes.json().id;

    // Create 3 channels to generate 3 audit events
    for (const name of ['alpha', 'beta', 'gamma']) {
      await app.inject({
        method: 'POST',
        url: `/v1/communities/${communityId}/channels`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name, kind: 'text', category: 'Chat' },
      });
    }

    const page1Res = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/audit-events?limit=2`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page1Res.statusCode).toBe(200);
    const page1 = page1Res.json() as { items: unknown[]; nextCursor: string | null };
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2Res = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/audit-events?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page2Res.statusCode).toBe(200);
    const page2 = page2Res.json() as { items: unknown[]; nextCursor: string | null };
    expect(page2.items.length).toBe(1);
    expect(page2.nextCursor).toBeNull();
  });

  it('supports community bans, listing, unbanning, and join prevention', async () => {
    const app = await buildApp();
    apps.push(app);

    // Create owner
    const emailOwner = `owner-${crypto.randomUUID()}@test.cove.chat`;
    const sendOwner = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email: emailOwner },
    });
    const verifyOwner = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email: emailOwner, code: '123456', challengeId: sendOwner.json().challengeId },
    });
    const tokenOwner = verifyOwner.json().sessionToken as string;

    // Create community
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${tokenOwner}` },
      payload: { name: 'Ban Test Community' },
    });
    const communityId = communityRes.json().id;

    // Create target member
    const emailMember = `member-${crypto.randomUUID()}@test.cove.chat`;
    const sendMember = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email: emailMember },
    });
    const verifyMember = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email: emailMember, code: '123456', challengeId: sendMember.json().challengeId },
    });
    const tokenMember = verifyMember.json().sessionToken as string;
    const memberId = verifyMember.json().account.id;

    // Join community
    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${tokenMember}` },
    });
    expect(joinRes.statusCode).toBe(204);

    // Non-admin tries to ban: should be forbidden
    const failBan = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/bans`,
      headers: { authorization: `Bearer ${tokenMember}` },
      payload: { accountId: memberId, reason: 'unauthorized ban' },
    });
    expect(failBan.statusCode).toBe(403);

    // Owner bans member
    const banRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/bans`,
      headers: { authorization: `Bearer ${tokenOwner}` },
      payload: { accountId: memberId, reason: 'Toxic behavior' },
    });
    expect(banRes.statusCode).toBe(201);
    expect(banRes.json()).toMatchObject({
      communityId,
      accountId: memberId,
      reason: 'Toxic behavior',
    });

    // Banned member tries to join: should be forbidden
    const joinResBanned = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${tokenMember}` },
    });
    expect(joinResBanned.statusCode).toBe(403);

    // Banned member tries to use invite: should be forbidden
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/invites`,
      headers: { authorization: `Bearer ${tokenOwner}` },
      payload: { maxUses: 5, expiresAt: new Date(Date.now() + 86400000).toISOString() },
    });
    const inviteCode = inviteRes.json().invite.code;

    const useInviteBanned = await app.inject({
      method: 'POST',
      url: `/v1/invites/${inviteCode}`,
      headers: { authorization: `Bearer ${tokenMember}` },
    });
    expect(useInviteBanned.statusCode).toBe(403);

    // List bans
    const listBans = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/bans`,
      headers: { authorization: `Bearer ${tokenOwner}` },
    });
    expect(listBans.statusCode).toBe(200);
    expect(listBans.json()).toHaveLength(1);
    expect(listBans.json()[0].accountId).toBe(memberId);

    // Owner unbans member
    const unbanRes = await app.inject({
      method: 'DELETE',
      url: `/v1/communities/${communityId}/bans/${memberId}`,
      headers: { authorization: `Bearer ${tokenOwner}` },
    });
    expect(unbanRes.statusCode).toBe(204);

    // Member joins again successfully
    const joinAgain = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${tokenMember}` },
    });
    expect(joinAgain.statusCode).toBe(204);
  });

  it('supports operator backup and restore drill', async () => {
    const app = await buildApp();
    apps.push(app);

    // Perform backup of current state
    const backupRes1 = await app.inject({
      method: 'POST',
      url: '/v1/operator/backup',
      headers: { 'x-operator-key': 'dev-operator-key-42' },
    });
    expect(backupRes1.statusCode).toBe(200);
    const backupData1 = backupRes1.body;

    // Create a new user and community
    const emailTest = `backup-test-${crypto.randomUUID()}@test.cove.chat`;
    const sendRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/send-code',
      payload: { email: emailTest },
    });
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/verify',
      payload: { email: emailTest, code: '123456', challengeId: sendRes.json().challengeId },
    });
    const tokenTest = verifyRes.json().sessionToken as string;

    const commRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${tokenTest}` },
      payload: { name: 'State 2 Community' },
    });
    expect(commRes.statusCode).toBe(201);
    const state2CommunityId = commRes.json().id;

    // Backup state 2
    const backupRes2 = await app.inject({
      method: 'POST',
      url: '/v1/operator/backup',
      headers: { 'x-operator-key': 'dev-operator-key-42' },
    });
    expect(backupRes2.statusCode).toBe(200);
    const backupData2 = backupRes2.body;

    // Restore back to state 1
    const restoreRes1 = await app.inject({
      method: 'POST',
      url: '/v1/operator/restore',
      headers: { 'x-operator-key': 'dev-operator-key-42', 'content-type': 'application/json' },
      payload: backupData1,
    });
    expect(restoreRes1.statusCode).toBe(204);

    // Verify community from state 2 is gone (returns 401 because auth session is also gone!)
    const getCommRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${state2CommunityId}`,
      headers: { authorization: `Bearer ${tokenTest}` },
    });
    expect(getCommRes.statusCode).toBe(401);

    // Restore to state 2
    const restoreRes2 = await app.inject({
      method: 'POST',
      url: '/v1/operator/restore',
      headers: { 'x-operator-key': 'dev-operator-key-42', 'content-type': 'application/json' },
      payload: backupData2,
    });
    expect(restoreRes2.statusCode).toBe(204);

    // Verify community is restored and session is active
    const getCommRes2 = await app.inject({
      method: 'GET',
      url: `/v1/communities/${state2CommunityId}/stats`,
      headers: { authorization: `Bearer ${tokenTest}` },
    });
    expect(getCommRes2.statusCode).toBe(200);
  });
});

describe('voice room API', () => {
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

  it('allows a member to join and leave a voice channel with credentials', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, account } = await getAuth(app);

    // Create community
    const createCommRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Voice Guild' },
    });
    const communityId = createCommRes.json().id;

    // Create voice channel
    const createChanRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lobby', kind: 'voice', category: 'Voice Channels' },
    });
    expect(createChanRes.statusCode).toBe(201);
    const channel = createChanRes.json();
    expect(channel.kind).toBe('voice');

    // Join voice channel
    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel.id}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(joinRes.statusCode).toBe(200);
    const session = joinRes.json();
    expect(session.token).toContain(channel.id);
    expect(session.roomName).toBe(`room-${channel.id}`);
    expect(session.participantId).toBe(account.id);

    // Get channel to verify participant is added
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
    });
    const updatedChannel = listRes.json().channels.find((c: any) => c.id === channel.id);
    expect(updatedChannel.participants.length).toBe(1);
    expect(updatedChannel.participants[0].id).toBe(account.id);

    // Leave voice channel
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel.id}/voice/leave`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(leaveRes.statusCode).toBe(200);
    expect(leaveRes.json().success).toBe(true);

    // Verify participant is removed
    const listRes2 = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
    });
    const leftChannel = listRes2.json().channels.find((c: any) => c.id === channel.id);
    expect(leftChannel.participants.length).toBe(0);
  });

  it('moves user when joining a different voice channel in the same community', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, account } = await getAuth(app);

    const createCommRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Voice Guild 2' },
    });
    const communityId = createCommRes.json().id;

    // Create voice channel 1
    const createChan1Res = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lobby 1', kind: 'voice', category: 'Voice Channels' },
    });
    const channel1 = createChan1Res.json();

    // Create voice channel 2
    const createChan2Res = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lobby 2', kind: 'voice', category: 'Voice Channels' },
    });
    const channel2 = createChan2Res.json();

    // Join channel 1
    await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel1.id}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Join channel 2
    await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel2.id}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Verify user is in channel 2 but not channel 1
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
    });
    const updatedChannel1 = listRes.json().channels.find((c: any) => c.id === channel1.id);
    const updatedChannel2 = listRes.json().channels.find((c: any) => c.id === channel2.id);

    expect(updatedChannel1.participants.length).toBe(0);
    expect(updatedChannel2.participants.length).toBe(1);
    expect(updatedChannel2.participants[0].id).toBe(account.id);
  });

  it('enforces permission gating for joining voice channels', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken, account: memberAccount } = await getAuth(app);

    const createCommRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Perm Guild' },
    });
    const communityId = createCommRes.json().id;

    // Create voice channel
    const createChanRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Quiet Room', kind: 'voice', category: 'Voice Channels' },
    });
    const channel = createChanRes.json();

    // Member joins community
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    // Create a custom role that denies voice.join
    const roleRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'No Voice',
        permissions: [{ permission: 'voice.join', effect: 'deny' }],
      },
    });
    const roleId = roleRes.json().id;

    // Assign the role to the member
    await app.inject({
      method: 'PUT',
      url: `/v1/communities/${communityId}/members/${memberAccount.id}/roles/${roleId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    // Verify member is denied join access
    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channel.id}/voice/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(joinRes.statusCode).toBe(403);
  });
});

describe('community data export', () => {
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
    return { token: data.sessionToken as string, account: data.account as { id: string } };
  }

  it('allows the community owner to export community data', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Export Test Community' },
    });
    const communityId = communityRes.json().id as string;

    const channelRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'general', kind: 'text', category: 'Text' },
    });
    const messageRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${channelRes.json().id}/messages`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': 'community-export-message-1',
      },
      payload: { content: 'Portable community history', clientNonce: 'community-export-message-1' },
    });
    expect(messageRes.statusCode).toBe(201);

    const exportRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(exportRes.statusCode, exportRes.body).toBe(200);
    expect(exportRes.headers['content-disposition']).toContain('attachment');
    expect(exportRes.headers['content-type']).toContain('application/json');

    const body = exportRes.json() as {
      version: number;
      community: { id: string };
      channels: Array<{ name: string }>;
      memberCount: number;
      messages: Array<{ content: string }>;
      inviteCount: number;
    };
    expect(body.version).toBe(1);
    expect(body.community.id).toBe(communityId);
    expect(body.channels.some((c) => c.name === 'general')).toBe(true);
    expect(typeof body.memberCount).toBe('number');
    expect(body.messages.map((message) => message.content)).toContain('Portable community history');
    expect(typeof body.inviteCount).toBe('number');
  });

  it('denies non-owner members from exporting community data', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token: ownerToken } = await getAuth(app);
    const { token: memberToken } = await getAuth(app);

    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Export Guard Community' },
    });
    const communityId = communityRes.json().id as string;

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const exportRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/export`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(exportRes.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated export requests', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token } = await getAuth(app);
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Auth Guard Community' },
    });
    const communityId = communityRes.json().id as string;

    const exportRes = await app.inject({
      method: 'GET',
      url: `/v1/communities/${communityId}/export`,
    });
    expect(exportRes.statusCode).toBe(401);
  });
});

describe('stage broadcast subchannels and screen share', () => {
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
    return { token: data.sessionToken as string, account: data.account as { id: string } };
  }

  async function setup(app: Awaited<ReturnType<typeof buildApp>>) {
    const { token } = await getAuth(app);
    const communityRes = await app.inject({
      method: 'POST',
      url: '/v1/communities',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Stage Guild' },
    });
    const communityId = communityRes.json().id as string;
    const stageRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Main Stage',
        kind: 'stage',
        category: 'Voice',
        stageConfig: { broadcastKeybind: 'Ctrl+Shift+V' },
      },
    });
    const stageChannelId = stageRes.json().id as string;
    return { token, communityId, stageChannelId };
  }

  it('creates a subchannel under a stage channel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId, stageChannelId } = await setup(app);

    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Squad Alpha',
        kind: 'voice',
        category: 'Voice',
        parentChannelId: stageChannelId,
      },
    });
    expect(subRes.statusCode).toBe(201);
    const sub = subRes.json();
    expect(sub.parentChannelId).toBe(stageChannelId);
    expect(sub.kind).toBe('voice');
  });

  it('rejects subchannel creation under a non-stage channel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId } = await setup(app);

    const textRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'general', kind: 'text', category: 'Text' },
    });
    const textChannelId = textRes.json().id as string;

    const badRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad Sub',
        kind: 'voice',
        category: 'Voice',
        parentChannelId: textChannelId,
      },
    });
    expect(badRes.statusCode).toBe(422);
  });

  it('rejects nested subchannels (subchannel of a subchannel)', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId, stageChannelId } = await setup(app);

    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Sub 1', kind: 'voice', category: 'Voice', parentChannelId: stageChannelId },
    });
    const subId = subRes.json().id as string;

    const nestedRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Nested', kind: 'voice', category: 'Voice', parentChannelId: subId },
    });
    expect(nestedRes.statusCode).toBe(422);
  });

  it('lists subchannels of a stage channel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId, stageChannelId } = await setup(app);

    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Sub A', kind: 'voice', category: 'Voice', parentChannelId: stageChannelId },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Sub B', kind: 'voice', category: 'Voice', parentChannelId: stageChannelId },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/channels/${stageChannelId}/subchannels`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    const { subchannels } = listRes.json();
    expect(subchannels).toHaveLength(2);
    expect(subchannels.every((c: any) => c.parentChannelId === stageChannelId)).toBe(true);
  });

  it('returns stage peek with speakers and listeners', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId, stageChannelId } = await setup(app);

    // Join the stage channel as a speaker
    await app.inject({
      method: 'POST',
      url: `/v1/channels/${stageChannelId}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Create and join a subchannel as a listener
    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Sub A', kind: 'voice', category: 'Voice', parentChannelId: stageChannelId },
    });
    const subId = subRes.json().id as string;
    const { token: memberToken } = await getAuth(app);
    await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/channels/${subId}/voice/join`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const peekRes = await app.inject({
      method: 'GET',
      url: `/v1/channels/${stageChannelId}/stage/peek`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(peekRes.statusCode).toBe(200);
    const peek = peekRes.json();
    expect(peek.channelId).toBe(stageChannelId);
    expect(peek.speakers.length).toBeGreaterThan(0);
    expect(peek.listeners.length).toBeGreaterThan(0);
    expect(Array.isArray(peek.screenShares)).toBe(true);
  });

  it('returns participantRole=speaker when joining a stage channel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, stageChannelId } = await setup(app);

    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${stageChannelId}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().participantRole).toBe('speaker');
  });

  it('returns participantRole=listener when joining a stage subchannel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId, stageChannelId } = await setup(app);

    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Sub A', kind: 'voice', category: 'Voice', parentChannelId: stageChannelId },
    });
    const subId = subRes.json().id as string;

    const joinRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${subId}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().participantRole).toBe('listener');
  });

  it('starts and stops a screen share in a voice channel', async () => {
    const app = await buildApp();
    apps.push(app);
    const { token, communityId } = await setup(app);

    // Create a regular voice channel
    const voiceRes = await app.inject({
      method: 'POST',
      url: `/v1/communities/${communityId}/channels`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Gaming', kind: 'voice', category: 'Voice' },
    });
    const voiceChannelId = voiceRes.json().id as string;

    // Must join before screen sharing
    const notInRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/screen/start`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notInRes.statusCode).toBe(409);

    // Join the channel, then start screen share
    await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/voice/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    const startRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/screen/start`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(startRes.statusCode).toBe(200);
    const share = startRes.json();
    expect(share.channelId).toBe(voiceChannelId);
    expect(typeof share.trackId).toBe('string');
    expect(share.active).toBe(true);

    // Duplicate start is rejected
    const dupRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/screen/start`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(dupRes.statusCode).toBe(409);

    // Stop screen share
    const stopRes = await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/screen/stop`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stopRes.statusCode).toBe(200);

    // Can start again after stopping
    const restart = await app.inject({
      method: 'POST',
      url: `/v1/channels/${voiceChannelId}/screen/start`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(restart.statusCode).toBe(200);
  });
});
