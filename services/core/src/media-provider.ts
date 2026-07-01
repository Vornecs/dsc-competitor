import type { VoiceSession } from '@cove/contracts';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export interface MediaProvider {
  createJoinToken(
    channelId: string,
    accountId: string,
    displayName: string,
    options?: { canPublish?: boolean },
  ): Promise<VoiceSession>;
  setPublishPermission(
    channelId: string,
    accountId: string,
    displayName: string,
    canPublish: boolean,
  ): Promise<VoiceSession>;
}

export class FakeMediaProvider implements MediaProvider {
  async createJoinToken(
    channelId: string,
    accountId: string,
    displayName: string,
    options: { canPublish?: boolean } = {},
  ): Promise<VoiceSession> {
    return {
      token: `fake-token-${channelId}-${accountId}`,
      url: 'ws://localhost:7880',
      roomName: `room-${channelId}`,
      participantId: accountId,
      canPublish: options.canPublish ?? true,
    };
  }

  async setPublishPermission(
    channelId: string,
    accountId: string,
    displayName: string,
    canPublish: boolean,
  ): Promise<VoiceSession> {
    return this.createJoinToken(channelId, accountId, displayName, { canPublish });
  }
}

export class LiveKitMediaProvider implements MediaProvider {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly hostUrl: string;
  private readonly roomService: Pick<RoomServiceClient, 'updateParticipant'>;

  constructor(
    config: { apiKey: string; apiSecret: string; url: string },
    roomService?: Pick<RoomServiceClient, 'updateParticipant'>,
  ) {
    const url = new URL(config.url);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new Error('LIVEKIT_URL must use ws:// or wss://.');
    }
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.hostUrl = url.toString().replace(/\/$/, '');
    const serviceUrl = new URL(this.hostUrl);
    serviceUrl.protocol = serviceUrl.protocol === 'wss:' ? 'https:' : 'http:';
    this.roomService =
      roomService ?? new RoomServiceClient(serviceUrl.toString(), config.apiKey, config.apiSecret);
  }

  async createJoinToken(
    channelId: string,
    accountId: string,
    displayName: string,
    options: { canPublish?: boolean } = {},
  ): Promise<VoiceSession> {
    const roomName = `room-${channelId}`;
    const canPublish = options.canPublish ?? true;
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity: accountId,
      name: displayName,
      ttl: '10m',
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublish,
      canPublishData: canPublish,
    });
    return {
      token: await accessToken.toJwt(),
      url: this.hostUrl,
      roomName,
      participantId: accountId,
      canPublish,
    };
  }

  async setPublishPermission(
    channelId: string,
    accountId: string,
    displayName: string,
    canPublish: boolean,
  ): Promise<VoiceSession> {
    await this.roomService.updateParticipant(`room-${channelId}`, accountId, {
      name: displayName,
      permission: {
        canSubscribe: true,
        canPublish,
        canPublishData: canPublish,
      },
    });
    return this.createJoinToken(channelId, accountId, displayName, { canPublish });
  }
}

export function createMediaProviderFromEnv(env: NodeJS.ProcessEnv = process.env): MediaProvider {
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const url = env.LIVEKIT_URL ?? env.LIVEKIT_HOST_URL;
  const configured = [apiKey, apiSecret, url].filter(Boolean).length;
  if (configured === 0) return new FakeMediaProvider();
  if (!apiKey || !apiSecret || !url) {
    throw new Error(
      'LiveKit configuration is incomplete: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL are required together.',
    );
  }
  return new LiveKitMediaProvider({ apiKey, apiSecret, url });
}
