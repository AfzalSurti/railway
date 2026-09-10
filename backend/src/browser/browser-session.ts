import { Browser, BrowserContext, ConsoleMessage, Page } from 'playwright';
import path from 'path';
import { getBrowserConfig } from './browser-config';
import {
  createArtifactId,
  ensureArtifactLayout,
  writeArtifactLog,
  writeArtifactManifest,
  type BrowserArtifactManifest,
} from './browser-artifacts';

export type ConsoleEntry = {
  type: string;
  text: string;
  timestamp: string;
};

export class BrowserSession {
  readonly artifactId: string;
  private readonly consoleEntries: ConsoleEntry[] = [];
  private tracingStarted = false;
  private closed = false;

  constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly bookingTaskId: string,
  ) {
    this.artifactId = createArtifactId();
    this.page.on('console', (message: ConsoleMessage) => {
      this.consoleEntries.push({
        type: message.type(),
        text: message.text(),
        timestamp: new Date().toISOString(),
      });
    });
    this.page.on('pageerror', (error) => {
      this.consoleEntries.push({
        type: 'pageerror',
        text: error.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  getPage(): Page {
    return this.page;
  }

  getContext(): BrowserContext {
    return this.context;
  }

  async startTracing(): Promise<void> {
    const config = getBrowserConfig();
    if (!config.tracingEnabled || this.tracingStarted) {
      return;
    }
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    this.tracingStarted = true;
  }

  async screenshot(label: string): Promise<string | null> {
    try {
      const { screenshots } = await ensureArtifactLayout(this.bookingTaskId);
      const filePath = path.join(screenshots, `${label}-${Date.now()}.png`);
      await this.page.screenshot({ path: filePath, fullPage: true });
      return filePath;
    } catch {
      return null;
    }
  }

  async saveHtml(label: string): Promise<string | null> {
    try {
      const { logs } = await ensureArtifactLayout(this.bookingTaskId);
      const filePath = path.join(logs, `${label}-${Date.now()}.html`);
      const html = await this.page.content();
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, html, 'utf8');
      return filePath;
    } catch {
      return null;
    }
  }

  async saveConsoleLog(): Promise<string | null> {
    if (this.consoleEntries.length === 0) {
      return null;
    }
    const safe = this.consoleEntries.map((entry) => ({
      type: entry.type,
      text: redact(entry.text),
      timestamp: entry.timestamp,
    }));
    try {
      return await writeArtifactLog(this.bookingTaskId, `console-${Date.now()}.json`, JSON.stringify(safe, null, 2));
    } catch {
      return null;
    }
  }

  async captureFailureArtifacts(): Promise<{ artifactId: string }> {
    await this.screenshot('failure');
    await this.saveHtml('failure');
    await this.saveConsoleLog();
    await this.stopTracing(true);
    await this.writeManifest();
    return { artifactId: this.artifactId };
  }

  async captureSuccessArtifacts(): Promise<{ artifactId: string }> {
    const config = getBrowserConfig();
    await this.saveConsoleLog();
    await this.stopTracing(config.saveTraceOnSuccess);
    await this.writeManifest();
    return { artifactId: this.artifactId };
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      if (this.tracingStarted) {
        await this.stopTracing(false);
      }
    } catch {
      // ignore
    }
    await this.context.close().catch(() => undefined);
  }

  private async stopTracing(save: boolean): Promise<void> {
    if (!this.tracingStarted) {
      return;
    }
    this.tracingStarted = false;
    if (!save) {
      await this.context.tracing.stop().catch(() => undefined);
      return;
    }
    const { traces } = await ensureArtifactLayout(this.bookingTaskId);
    const filePath = path.join(traces, `trace-${this.artifactId}.zip`);
    await this.context.tracing.stop({ path: filePath }).catch(() => undefined);
  }

  private async writeManifest(): Promise<void> {
    const manifest: BrowserArtifactManifest = {
      artifactId: this.artifactId,
      bookingTaskId: this.bookingTaskId,
      createdAt: new Date().toISOString(),
      files: [],
    };
    await writeArtifactManifest(this.bookingTaskId, manifest);
  }
}

function redact(text: string): string {
  return text
    .replace(/authorization:\s*\S+/gi, 'authorization:[redacted]')
    .replace(/cookie:\s*\S+/gi, 'cookie:[redacted]')
    .replace(/\b\d{12,19}\b/g, '[redacted-number]');
}

export async function createBrowserSession(
  browser: Browser,
  bookingTaskId: string,
): Promise<BrowserSession> {
  const config = getBrowserConfig();
  const context = await browser.newContext({
    acceptDownloads: false,
    javaScriptEnabled: true,
  });
  context.setDefaultTimeout(config.timeoutMs);
  context.setDefaultNavigationTimeout(config.navigationTimeoutMs);
  const page = await context.newPage();
  const session = new BrowserSession(context, page, bookingTaskId);
  await session.startTracing();
  return session;
}
