import fs from 'fs/promises';
import path from 'path';
import { getBrowserConfig } from './browser-config';

export async function cleanupExpiredArtifacts(now = new Date()): Promise<number> {
  const config = getBrowserConfig();
  const root = config.artifactDir;
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('booking-')) {
      continue;
    }
    const dir = path.join(root, entry.name);
    const stat = await fs.stat(dir);
    if (now.getTime() - stat.mtimeMs > retentionMs) {
      await fs.rm(dir, { recursive: true, force: true });
      removed += 1;
    }
  }

  return removed;
}
