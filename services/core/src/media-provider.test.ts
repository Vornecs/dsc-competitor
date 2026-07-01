import { describe, expect, it } from 'vitest';
import { TokenVerifier } from 'livekit-server-sdk';
import {
  FakeMediaProvider,
  LiveKitMediaProvider,
  createMediaProviderFromEnv,
} from './media-provider.js';

const config = {
  apiKey: 'test-key',
  apiSecret: 'test-secret-with-at-least-thirty-two-bytes',
  url: 'wss://media.example.test/',
};

describe('LiveKitMediaProvider', () => {
  it('creates a scoped, subscribe-only stage token', async () => {
    const provider = new LiveKitMediaProvider(config);
    const session = await provider.createJoinToken('stage-1', 'account-1', 'Avery', {
      canPublish: false,
    });
    const claims = await new TokenVerifier(config.apiKey, config.apiSecret).verify(session.token);

    expect(session).toMatchObject({
      url: 'wss://media.example.test',
      roomName: 'room-stage-1',
      participantId: 'account-1',
      canPublish: false,
    });
    expect(claims.name).toBe('Avery');
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: 'room-stage-1',
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
    });
  });

  it('reissues publish-scoped credentials when speaking changes', async () => {
    const updates: unknown[][] = [];
    const provider = new LiveKitMediaProvider(config, {
      updateParticipant: async (...args: unknown[]) => {
        updates.push(args);
        return {} as never;
      },
    });
    const session = await provider.setPublishPermission('stage-1', 'account-1', 'Avery', true);
    const claims = await new TokenVerifier(config.apiKey, config.apiSecret).verify(session.token);

    expect(session.canPublish).toBe(true);
    expect(updates).toEqual([
      [
        'room-stage-1',
        'account-1',
        {
          name: 'Avery',
          permission: { canSubscribe: true, canPublish: true, canPublishData: true },
        },
      ],
    ]);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canPublishData).toBe(true);
  });

  it('uses the fake provider only when LiveKit is entirely unconfigured', () => {
    expect(createMediaProviderFromEnv({})).toBeInstanceOf(FakeMediaProvider);
    expect(() => createMediaProviderFromEnv({ LIVEKIT_API_KEY: 'partial' })).toThrow(
      'LiveKit configuration is incomplete',
    );
  });

  it('rejects non-WebSocket client URLs', () => {
    expect(
      () => new LiveKitMediaProvider({ ...config, url: 'https://media.example.test' }),
    ).toThrow('LIVEKIT_URL must use ws:// or wss://');
  });
});
