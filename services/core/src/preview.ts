import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRepository } from './memory-repository.js';
import { buildApp } from './app.js';
import type { Repository } from './repository.js';
import type { GatewayCoordinator } from './gateway-coordinator.js';
import { createMemoryGatewayCoordinator } from './memory-gateway-coordinator.js';
import { registerWebClient } from './deployment.js';

let repo: Repository;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const { createPostgresRepository } = await import('./postgres-repository.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  repo = createPostgresRepository(pool);
} else {
  repo = createMemoryRepository();
}

await repo.reconcileVoiceParticipants();

let coordinator: GatewayCoordinator;
if (process.env.REDIS_URL) {
  const { createRedisGatewayCoordinator } = await import('./redis-gateway-coordinator.js');
  coordinator = await createRedisGatewayCoordinator(process.env.REDIS_URL);
} else {
  coordinator = createMemoryGatewayCoordinator();
}

const app = await buildApp({ repo, coordinator });
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDirectory, '../../../apps/web/dist');
await registerWebClient(app, webRoot);

const port = Number(process.env.PORT ?? 8790);
await app.listen({ host: '127.0.0.1', port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .finally(() => coordinator.disconnect())
      .finally(() => process.exit(0));
  });
}
