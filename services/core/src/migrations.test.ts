import { describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { runMigrations } from './migrations.js';

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

function makeMockPool(appliedFilenames: string[] = []) {
  const insertedMigrations: string[] = [];
  let rollbackCalled = false;
  let commitCalled = false;

  const client: Partial<PoolClient> = {
    query: async (sql: string, params?: unknown[]) => {
      const trimmed = typeof sql === 'string' ? sql.trim() : '';
      if (trimmed === 'ROLLBACK') rollbackCalled = true;
      if (trimmed === 'COMMIT') commitCalled = true;
      if (trimmed.includes('INSERT INTO schema_migrations')) {
        insertedMigrations.push((params as string[])[0]);
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
    },
    release: () => {},
  };

  const pool: Partial<Pool> = {
    query: async (sql: string, params?: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('SELECT filename FROM schema_migrations')) {
        return {
          rows: appliedFilenames.map((f) => ({ filename: f })),
          rowCount: appliedFilenames.length,
          command: '',
          oid: 0,
          fields: [],
        } as any;
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
    },
    connect: async () => client as PoolClient,
  };

  return {
    pool: pool as Pool,
    insertedMigrations,
    get rollbackCalled() {
      return rollbackCalled;
    },
    get commitCalled() {
      return commitCalled;
    },
  };
}

function makeFailingPool(appliedFilenames: string[] = []) {
  let rollbackCalled = false;

  const client: Partial<PoolClient> = {
    query: async (sql: string) => {
      const trimmed = typeof sql === 'string' ? sql.trim() : '';
      if (trimmed === 'ROLLBACK') {
        rollbackCalled = true;
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
      }
      if (trimmed === 'BEGIN' || trimmed === 'COMMIT')
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
      // Fail on actual migration SQL
      throw new Error('intentional SQL failure');
    },
    release: () => {},
  };

  const pool: Partial<Pool> = {
    query: async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('SELECT filename FROM schema_migrations')) {
        return {
          rows: appliedFilenames.map((f) => ({ filename: f })),
          rowCount: 0,
          command: '',
          oid: 0,
          fields: [],
        } as any;
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
    },
    connect: async () => client as PoolClient,
  };

  return {
    pool: pool as Pool,
    get rollbackCalled() {
      return rollbackCalled;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runMigrations', () => {
  it('creates the schema_migrations ledger table', async () => {
    const ledgerCreated: string[] = [];
    const client: Partial<PoolClient> = {
      query: async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }) as any,
      release: () => {},
    };
    const pool: Partial<Pool> = {
      query: async (sql: string) => {
        if (typeof sql === 'string') ledgerCreated.push(sql.trim());
        if (typeof sql === 'string' && sql.includes('SELECT filename FROM schema_migrations')) {
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
      },
      connect: async () => client as PoolClient,
    };
    await runMigrations(pool as Pool);
    expect(
      ledgerCreated.some((s) => s.includes('CREATE TABLE IF NOT EXISTS schema_migrations')),
    ).toBe(true);
  });

  it('runs all pending migrations in filename order', async () => {
    const { pool, insertedMigrations } = makeMockPool();
    await runMigrations(pool);
    expect(insertedMigrations).toEqual([
      '001_initial.sql',
      '002_attachments.sql',
      '003_message_lifecycle.sql',
      '004_replies.sql',
      '005_operator_diagnostics.sql',
    ]);
  });

  it('skips already-applied migrations', async () => {
    const { pool, insertedMigrations } = makeMockPool(['001_initial.sql', '002_attachments.sql']);
    await runMigrations(pool);
    expect(insertedMigrations).toEqual([
      '003_message_lifecycle.sql',
      '004_replies.sql',
      '005_operator_diagnostics.sql',
    ]);
  });

  it('is idempotent when all migrations are applied', async () => {
    const { pool, insertedMigrations } = makeMockPool([
      '001_initial.sql',
      '002_attachments.sql',
      '003_message_lifecycle.sql',
      '004_replies.sql',
      '005_operator_diagnostics.sql',
    ]);
    await runMigrations(pool);
    expect(insertedMigrations).toHaveLength(0);
  });

  it('rolls back and throws on migration failure', async () => {
    const failing = makeFailingPool();
    await expect(runMigrations(failing.pool)).rejects.toThrow('Migration 001_initial.sql failed');
    expect(failing.rollbackCalled).toBe(true);
  });
});
