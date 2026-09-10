import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getBrowserConfig } from './browser-config';

export type ArtifactKind = 'screenshot' | 'trace' | 'html' | 'log';

export type BrowserArtifactManifest = {
  artifactId: string;
  bookingTaskId: string;
  createdAt: string;
  files: Array<{ kind: ArtifactKind; relativePath: string }>;
};

export function createArtifactId(): string {
  return randomUUID();
}

export function bookingArtifactDir(bookingTaskId: string): string {
  const safeId = bookingTaskId.replace(/[^a-zA-Z0-9-_]/g, '');
  return path.join(getBrowserConfig().artifactDir, `booking-${safeId}`);
}

export async function ensureArtifactLayout(bookingTaskId: string): Promise<{
  root: string;
  screenshots: string;
  traces: string;
  logs: string;
}> {
  const root = bookingArtifactDir(bookingTaskId);
  const screenshots = path.join(root, 'screenshots');
  const traces = path.join(root, 'traces');
  const logs = path.join(root, 'logs');
  await fs.mkdir(screenshots, { recursive: true });
  await fs.mkdir(traces, { recursive: true });
  await fs.mkdir(logs, { recursive: true });
  return { root, screenshots, traces, logs };
}

export async function writeArtifactLog(
  bookingTaskId: string,
  filename: string,
  contents: string,
): Promise<string> {
  const { logs } = await ensureArtifactLayout(bookingTaskId);
  const target = path.join(logs, filename);
  await fs.writeFile(target, contents, 'utf8');
  return target;
}

export async function writeArtifactManifest(
  bookingTaskId: string,
  manifest: BrowserArtifactManifest,
): Promise<void> {
  const { root } = await ensureArtifactLayout(bookingTaskId);
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}
