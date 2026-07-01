import { createMemoryRepository } from './memory-repository.js';
import { buildApp } from './app.js';
import type { Repository } from './repository.js';
import type { GatewayCoordinator } from './gateway-coordinator.js';
import { createMemoryGatewayCoordinator } from './memory-gateway-coordinator.js';
import { createRedisGatewayCoordinator } from './redis-gateway-coordinator.js';
import { parseCorsAllowedOrigins, registerWebClient } from './deployment.js';
import { createMediaProviderFromEnv } from './media-provider.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

let repo: Repository;
let snapshotFile: string | null = null;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const { createPostgresRepository } = await import('./postgres-repository.js');
  const { runMigrations } = await import('./migrations.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  await runMigrations(pool);
  repo = createPostgresRepository(pool);
} else {
  repo = createMemoryRepository();
  snapshotFile = process.env.SNAPSHOT_FILE ?? null;
  if (snapshotFile && existsSync(snapshotFile)) {
    try {
      await repo.importBackup(readFileSync(snapshotFile, 'utf8'));
      console.log(`Restored state from ${snapshotFile}`);
    } catch (err) {
      console.warn(`Failed to restore snapshot from ${snapshotFile}:`, err);
    }
  } else if (!snapshotFile) {
    console.warn(
      'Running with in-memory storage — all data will be lost on restart. ' +
        'Set SNAPSHOT_FILE=.cove-data.json for local persistence or DATABASE_URL for production.',
    );
  }
}

await repo.reconcileVoiceParticipants();

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

const app = await buildApp({
  repo,
  coordinator,
  mediaProvider: createMediaProviderFromEnv(),
  corsAllowedOrigins: parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
});
if (process.env.WEB_DIST_DIR) {
  await registerWebClient(app, process.env.WEB_DIST_DIR);
}
const port = Number(process.env.PORT ?? 8790);
const host = process.env.HOST ?? '127.0.0.1';

await app.listen({ port, host });

async function saveSnapshot() {
  if (!snapshotFile) return;
  try {
    writeFileSync(snapshotFile, await repo.exportBackup(), 'utf8');
  } catch (err) {
    console.warn(`Failed to save snapshot to ${snapshotFile}:`, err);
  }
}

if (snapshotFile) {
  setInterval(() => void saveSnapshot(), 30_000);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await saveSnapshot();
    await app.close();
    await coordinator.disconnect();
    process.exit(0);
  });
}
