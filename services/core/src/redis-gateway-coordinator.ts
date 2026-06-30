import type { GatewayCoordinator, ResumeState } from './gateway-coordinator.js';

const SEQUENCE_KEY = 'cove:gateway:sequence';
const EVENTS_CHANNEL = 'cove:gateway:events';
const RESUME_TTL_SECONDS = 24 * 60 * 60;

function resumeKey(accountId: string) {
  return `cove:resume:${accountId}`;
}

export async function createRedisGatewayCoordinator(url: string): Promise<GatewayCoordinator> {
  const { createClient } = await import('redis');

  const publisher = createClient({ url });
  const subscriber = createClient({ url });

  publisher.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis publisher error:', err);
  });
  subscriber.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis subscriber error:', err);
  });

  await publisher.connect();
  await subscriber.connect();

  return {
    async currentSequence() {
      const value = await publisher.get(SEQUENCE_KEY);
      return value === null ? 0 : Number.parseInt(value, 10);
    },

    async nextSequence() {
      return await publisher.incr(SEQUENCE_KEY);
    },

    async publish(envelope: string) {
      await publisher.publish(EVENTS_CHANNEL, envelope);
    },

    async subscribe(handler: (envelope: string) => void) {
      await subscriber.subscribe(EVENTS_CHANNEL, handler);
      return async () => {
        await subscriber.unsubscribe(EVENTS_CHANNEL);
      };
    },

    async setResumeState(accountId: string, state: ResumeState) {
      await publisher.setEx(resumeKey(accountId), RESUME_TTL_SECONDS, JSON.stringify(state));
    },

    async getResumeState(accountId: string) {
      const value = await publisher.get(resumeKey(accountId));
      if (value === null) return undefined;
      try {
        return JSON.parse(value) as ResumeState;
      } catch {
        return undefined;
      }
    },

    async deleteResumeState(accountId: string) {
      await publisher.del(resumeKey(accountId));
    },

    async disconnect() {
      await publisher.quit();
      await subscriber.quit();
    },
  };
}
