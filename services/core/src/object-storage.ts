/**
 * ObjectStorage — thin abstraction over binary blob persistence.
 *
 * Memory implementation is used in tests and when no storage env is set.
 * Local-disk implementation is used for single-node dev without S3.
 * An S3-compatible implementation can be wired by injecting a compatible
 * instance when OBJECT_STORAGE_URL is configured.
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ObjectStorage {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | undefined>;
  delete(key: string): Promise<void>;
}

export function createMemoryObjectStorage(): ObjectStorage {
  const store = new Map<string, Buffer>();
  return {
    async put(key, data) {
      store.set(key, Buffer.from(data));
    },
    async get(key) {
      return store.get(key);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export async function createLocalObjectStorage(dir: string): Promise<ObjectStorage> {
  await mkdir(dir, { recursive: true });
  return {
    async put(key, data) {
      await writeFile(join(dir, key), data);
    },
    async get(key) {
      try {
        return await readFile(join(dir, key));
      } catch {
        return undefined;
      }
    },
    async delete(key) {
      try {
        await unlink(join(dir, key));
      } catch {
        // ignore missing file
      }
    },
  };
}
