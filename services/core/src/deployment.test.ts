import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { parseCorsAllowedOrigins, registerWebClient } from './deployment.js';

describe('deployment configuration', () => {
  it('disables cross-origin access unless exact origins are configured', () => {
    expect(parseCorsAllowedOrigins(undefined)).toBe(false);
    expect(parseCorsAllowedOrigins('https://cove.example,http://localhost:5173')).toEqual([
      'https://cove.example',
      'http://localhost:5173',
    ]);
    expect(() => parseCorsAllowedOrigins('*')).toThrow(/CORS origin/);
    expect(() => parseCorsAllowedOrigins('https://cove.example/path')).toThrow(/exact HTTP/);
  });

  it('serves a built web client with immutable fingerprinted assets', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cove-web-'));
    await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'index.html'), '<main>Cove</main>');
    await writeFile(path.join(root, 'assets', 'index-abc.js'), 'console.log("cove")');
    const app = Fastify();
    await registerWebClient(app, root);

    const page = await app.inject('/');
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.body).toContain('Cove');

    const asset = await app.inject('/assets/index-abc.js');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toContain('text/javascript');
    expect(asset.headers['cache-control']).toContain('immutable');
    await app.close();
  });
});
