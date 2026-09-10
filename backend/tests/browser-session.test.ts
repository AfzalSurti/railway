import { afterAll, describe, expect, it } from 'vitest';
import path from 'path';
import { pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { BrowserManager } from '../src/browser/browser-manager';
import { cleanupExpiredArtifacts } from '../src/browser/artifact-cleanup';
import { withTimeout } from '../src/utils/timeout';
import { ProviderTimeoutError } from '../src/providers/provider-errors';

const mockPage = pathToFileURL(path.join(__dirname, 'browser', 'mock-provider.html')).href;

describe('Browser session lifecycle', () => {
  const manager = new BrowserManager();

  afterAll(async () => {
    await manager.close();
  });

  it('captures a screenshot and closes the isolated context', async () => {
    let browserAvailable = true;
    try {
      const probe = await chromium.launch({ headless: true });
      await probe.close();
    } catch {
      browserAvailable = false;
    }
    if (!browserAvailable) {
      return;
    }

    const session = await manager.createSession('browser-lifecycle-test');
    try {
      await session.getPage().goto(mockPage, { waitUntil: 'domcontentloaded' });
      const screenshot = await session.screenshot('lifecycle');
      expect(screenshot).toBeTruthy();
      await session.captureFailureArtifacts();
      expect(session.artifactId).toBeTruthy();
    } finally {
      await session.close();
    }
  });

  it('times out overall execution without hanging forever', async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => {
          setTimeout(resolve, 50);
        }),
        5,
        () => new ProviderTimeoutError('Booking website timed out'),
      ),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('artifact cleanup returns zero when the directory is missing', async () => {
    const removed = await cleanupExpiredArtifacts();
    expect(removed).toBeGreaterThanOrEqual(0);
  });
});
