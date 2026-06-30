import { createMemoryRepository } from './memory-repository.js';
import { buildApp } from './app.js';
import type { Repository } from './repository.js';
import type { GatewayCoordinator } from './gateway-coordinator.js';
import { createMemoryGatewayCoordinator } from './memory-gateway-coordinator.js';
import { createRedisGatewayCoordinator } from './redis-gateway-coordinator.js';

let repo: Repository;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const { createPostgresRepository } = await import('./postgres-repository.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  repo = createPostgresRepository(pool);
} else {
  repo = createMemoryRepository();
}

let coordinator: GatewayCoordinator;

try {
  if (process.env.REDIS_URL) {
    coordinator = await createRedisGatewayCoordinator(process.env.REDIS_URL);
  } else {
    coordinator = createMemoryGatewayCoordinator();
  }
} catch (error) {
  console.warn('Redis coordinator unavailable, falling back to memory coordinator');
  coordinator = createMemoryGatewayCoordinator();
}

const app = await buildApp({ repo, coordinator });
const port = Number(process.env.PORT ?? 8790);
const host = process.env.HOST ?? '127.0.0.1';

await app.listen({ port, host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await coordinator.disconnect();
    process.exit(0);
  });
}
