import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

/**
 * Storage abstraction for binary artifacts (currently ticket PDFs). A real
 * deployment would swap LocalFileStorage for an object-store adapter behind the
 * same interface. Clients never receive a storage key or a filesystem path —
 * only an opaque TicketArtifact id.
 */
export interface FileStorageProvider {
  /** Returns the storage key the bytes were written under. */
  put(data: Buffer, extension: string): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
}

const KEY_PATTERN = /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i;

export class LocalFileStorage implements FileStorageProvider {
  private readonly baseDir: string;

  constructor(baseDir: string = env.TICKET_STORAGE_DIR) {
    this.baseDir = path.resolve(process.cwd(), baseDir);
  }

  private resolveKey(storageKey: string): string {
    if (!KEY_PATTERN.test(storageKey)) {
      throw new Error('Invalid storage key');
    }
    const resolved = path.resolve(this.baseDir, storageKey);
    if (path.dirname(resolved) !== this.baseDir) {
      throw new Error('Resolved path escapes the storage directory');
    }
    return resolved;
  }

  async put(data: Buffer, extension: string): Promise<string> {
    const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const storageKey = `${randomUUID()}.${ext}`;
    const target = this.resolveKey(storageKey);
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(target, data);
    return storageKey;
  }

  async get(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await fs.rm(this.resolveKey(storageKey), { force: true });
  }
}

export const fileStorage: FileStorageProvider = new LocalFileStorage();
