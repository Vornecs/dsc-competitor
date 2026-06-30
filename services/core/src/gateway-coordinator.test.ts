import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryGatewayCoordinator } from './memory-gateway-coordinator.js';
import type { GatewayCoordinator } from './gateway-coordinator.js';

async function createRedisCoordinator(): Promise<GatewayCoordinator | undefined> {
  if (!process.env.REDIS_URL) return undefined;
  try {
    const { createRedisGatewayCoordinator } = await import('./redis-gateway-coordinator.js');
    return await createRedisGatewayCoordinator(process.env.REDIS_URL);
  } catch {
    return undefined;
  }
}

function coordinatorTests(
  label: string,
  factory: () => Promise<GatewayCoordinator>,
  options: { shared: boolean } = { shared: false },
) {
  describe(label, () => {
    it('starts sequence at 0 and increments monotonically', async () => {
      const c = await factory();
      expect(await c.currentSequence()).toBe(0);
      expect(await c.nextSequence()).toBe(1);
      expect(await c.nextSequence()).toBe(2);
      expect(await c.currentSequence()).toBe(2);
      await c.disconnect();
    });

    it('delivers published envelopes to subscribers', async () => {
      const c = await factory();
      const received: string[] = [];
      await c.subscribe((envelope) => received.push(envelope));
      await c.publish('hello');
      await c.publish('world');
      expect(received).toEqual(['hello', 'world']);
      await c.disconnect();
    });

    it('removes a subscriber when unsubscribe is called', async () => {
      const c = await factory();
      const received: string[] = [];
      const unsubscribe = await c.subscribe((envelope) => received.push(envelope));
      await c.publish('before');
      await unsubscribe();
      await c.publish('after');
      expect(received).toEqual(['before']);
      await c.disconnect();
    });

    it('stores, retrieves, and deletes resume state', async () => {
      const c = await factory();
      const state = {
        sequence: 42,
        communityIds: ['c1', 'c2'],
        updatedAt: new Date().toISOString(),
      };
      await c.setResumeState('acct-1', state);
      const retrieved = await c.getResumeState('acct-1');
      expect(retrieved).toEqual(state);
      await c.deleteResumeState('acct-1');
      expect(await c.getResumeState('acct-1')).toBeUndefined();
      await c.disconnect();
    });

    it('returns undefined for missing resume state', async () => {
      const c = await factory();
      expect(await c.getResumeState('does-not-exist')).toBeUndefined();
      await c.disconnect();
    });

    if (options.shared) {
      it('shares envelopes across coordinator instances', async () => {
        const a = await factory();
        const b = await factory();
        const aReceived: string[] = [];
        const bReceived: string[] = [];
        await a.subscribe((envelope) => aReceived.push(envelope));
        await b.subscribe((envelope) => bReceived.push(envelope));
        await a.publish('from-a');
        await b.publish('from-b');
        expect(aReceived).toContain('from-a');
        expect(aReceived).toContain('from-b');
        expect(bReceived).toContain('from-a');
        expect(bReceived).toContain('from-b');
        await a.disconnect();
        await b.disconnect();
      });
    }
  });
}

coordinatorTests('MemoryGatewayCoordinator', async () => createMemoryGatewayCoordinator());

if (process.env.REDIS_URL) {
  beforeAll(async () => {
    const c = await createRedisCoordinator();
    if (!c) return;
    // Clear test-owned keys so sequence assertions are deterministic.
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    await client.del('cove:gateway:sequence');
    await client.quit();
    await c.disconnect();
  });

  coordinatorTests(
    'RedisGatewayCoordinator',
    async () => {
      const c = await createRedisCoordinator();
      if (!c) throw new Error('REDIS_URL is set but Redis coordinator failed to connect');
      return c;
    },
    { shared: true },
  );
}
