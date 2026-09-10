import { test, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';
import { MockTrainPage } from '../../src/browser/pages/mock-train.page';

const pageUrl = pathToFileURL(path.join(__dirname, 'mock-provider.html')).href;

test('local mock provider books Vande Bharat 20902 for Rahul Jani', async ({ page }) => {
  const mockPage = new MockTrainPage(page);
  await mockPage.goto(pageUrl);
  await mockPage.search({
    source: 'BRC',
    destination: 'MMCT',
    journeyDate: '2026-08-28',
    trainNumber: '20902',
  });
  await mockPage.selectTrain('20902');
  const availability = await mockPage.checkAvailability();
  expect(availability.class).toBe('3A');
  expect(availability.status).toBe('AVAILABLE');
  expect(availability.seats).toBe('12');
  await mockPage.enterPassenger({ name: 'Rahul Jani', age: 30 });
  const reference = await mockPage.confirm();
  expect(reference).toMatch(/^MOCK-/);
});
