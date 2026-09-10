import { Locator, Page } from 'playwright';
import { getBrowserConfig } from '../browser-config';

export class BasePage {
  constructor(protected readonly page: Page) {}

  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: getBrowserConfig().navigationTimeoutMs,
    });
  }
}
