import { Browser, chromium } from 'playwright';
import { getBrowserConfig } from './browser-config';
import { BrowserSession, createBrowserSession } from './browser-session';

export class BrowserManager {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }
    if (this.launching) {
      return this.launching;
    }
    this.launching = chromium.launch({
      headless: getBrowserConfig().headless,
    });
    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  async createSession(bookingTaskId: string): Promise<BrowserSession> {
    const browser = await this.getBrowser();
    return createBrowserSession(browser, bookingTaskId);
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

export const browserManager = new BrowserManager();
