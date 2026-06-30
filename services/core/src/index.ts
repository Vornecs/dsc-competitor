import { createMemoryRepository } from './memory-repository.js';
import { buildApp } from './app.js';
import type { Repository } from './repository.js';

let repo: Repository;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const { createPostgresRepository } = await import('./postgres-repository.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  repo = createPostgresRepository(pool);
} else {
  repo = createMemoryRepository();
}

const app = await buildApp({ repo });
const port = Number(process.env.PORT ?? 8790);
const host = process.env.HOST ?? '127.0.0.1';

await app.listen({ port, host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}
