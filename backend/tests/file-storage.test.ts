import { afterAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { LocalFileStorage } from '../src/storage/file-storage';

const tmpDir = path.join(os.tmpdir(), `ticket-store-${Date.now()}`);
const storage = new LocalFileStorage(tmpDir);

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('LocalFileStorage', () => {
  it('round-trips bytes under an opaque key', async () => {
    const key = await storage.put(Buffer.from('%PDF-1.4 hello'), 'pdf');
    expect(key).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.get(key)).toString('utf8')).toContain('%PDF-1.4');
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('rejects path-traversal keys', async () => {
    await expect(storage.get('../../../etc/passwd')).rejects.toThrow();
    await expect(storage.get('..%2f..%2fsecret.pdf')).rejects.toThrow();
    await expect(storage.get('nested/dir/file.pdf')).rejects.toThrow();
  });
});
