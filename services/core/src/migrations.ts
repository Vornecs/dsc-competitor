import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import type { Pool } from 'pg';

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(SCHEMA_DIR)).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();

  const { rows } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  );
  const applied = new Set(rows.map((r) => r.filename));

  const client = await pool.connect();
  try {
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(SCHEMA_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrations] Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${String(err)}`);
      }
    }
  } finally {
    client.release();
  }
}
