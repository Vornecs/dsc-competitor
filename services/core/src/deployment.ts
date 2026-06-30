import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

export function parseCorsAllowedOrigins(value: string | undefined): string[] | false {
  if (!value?.trim()) return false;

  return value.split(',').map((entry) => {
    const candidate = entry.trim();
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`Invalid CORS origin: ${candidate}`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== candidate) {
      throw new Error(`CORS origin must be an exact HTTP(S) origin: ${candidate}`);
    }
    return candidate;
  });
}

export async function registerWebClient(app: FastifyInstance, webRoot: string): Promise<void> {
  const index = await readFile(path.join(webRoot, 'index.html'));

  app.get('/', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(index),
  );

  app.get<{ Params: { filename: string } }>('/assets/:filename', async (request, reply) => {
    const { filename } = request.params;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return reply.code(400).send({ error: 'Invalid asset path' });
    }

    const content = await readFile(path.join(webRoot, 'assets', filename));
    const contentType = filename.endsWith('.css')
      ? 'text/css; charset=utf-8'
      : filename.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream';
    return reply
      .type(contentType)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(content);
  });
}
