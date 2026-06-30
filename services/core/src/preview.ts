import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDirectory, '../../../apps/web/dist');

app.get('/', async (_request, reply) => {
  const html = await readFile(path.join(webRoot, 'index.html'));
  return reply.type('text/html; charset=utf-8').send(html);
});

app.get<{ Params: { filename: string } }>('/assets/:filename', async (request, reply) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(request.params.filename)) {
    return reply.code(400).send({ error: 'Invalid asset path' });
  }

  const filename = request.params.filename;
  const content = await readFile(path.join(webRoot, 'assets', filename));
  const contentType = filename.endsWith('.css')
    ? 'text/css; charset=utf-8'
    : filename.endsWith('.js')
      ? 'text/javascript; charset=utf-8'
      : 'application/octet-stream';
  return reply.type(contentType).header('cache-control', 'no-store').send(content);
});

const port = Number(process.env.PORT ?? 8790);
await app.listen({ host: '127.0.0.1', port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}
