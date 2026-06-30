import type { VoiceSession } from '@cove/contracts';

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
  private apiKey: string;
  private apiSecret: string;
  private hostUrl: string;

  constructor() {
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST_URL;

    if (!key || !secret || !url) {
      throw new Error(
        'LiveKit media provider is blocked: missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL.',
      );
    }
    this.apiKey = key;
    this.apiSecret = secret;
    this.hostUrl = url;
  }

  async createJoinToken(
    channelId: string,
    accountId: string,
    displayName: string,
    options: { canPublish?: boolean } = {},
  ): Promise<VoiceSession> {
    // In a future cycle when credentials are unblocked, we would use the livekit-server-sdk
    // to sign a real token here. For now, since the constructor throws when credentials
    // are missing, this path is blocked.
    throw new Error('LiveKit media provider is blocked: credentials unavailable.');
  }

  async setPublishPermission(
    channelId: string,
    accountId: string,
    displayName: string,
    canPublish: boolean,
  ): Promise<VoiceSession> {
    throw new Error('LiveKit media provider is blocked: credentials unavailable.');
  }
}
