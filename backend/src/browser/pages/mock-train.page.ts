import { BasePage } from './base.page';

export type MockSearchInput = {
  source: string;
  destination: string;
  journeyDate: string;
  trainNumber?: string;
};

export type MockPassengerInput = {
  name: string;
  age: number;
};

export class MockTrainPage extends BasePage {
  readonly sourceInput = this.locator('[data-testid="source"]');
  readonly destinationInput = this.locator('[data-testid="destination"]');
  readonly dateInput = this.locator('[data-testid="journey-date"]');
  readonly trainNumberInput = this.locator('[data-testid="train-number"]');
  readonly searchButton = this.locator('[data-testid="search"]');
  readonly results = this.locator('[data-testid="result-row"]');
  readonly availability = this.locator('[data-testid="availability"]');
  readonly passengerName = this.locator('[data-testid="passenger-name"]');
  readonly passengerAge = this.locator('[data-testid="passenger-age"]');
  readonly confirmButton = this.locator('[data-testid="confirm"]');
  readonly bookingReference = this.locator('[data-testid="booking-reference"]');

  async search(input: MockSearchInput): Promise<void> {
    await this.sourceInput.fill(input.source);
    await this.destinationInput.fill(input.destination);
    await this.dateInput.fill(input.journeyDate);
    if (input.trainNumber) {
      await this.trainNumberInput.fill(input.trainNumber);
    }
    await this.searchButton.click();
    await this.results.first().waitFor({ state: 'visible' });
  }

  async selectTrain(trainNumber: string): Promise<void> {
    await this.locator(`[data-testid="select-train-${trainNumber}"]`).click();
    await this.availability.waitFor({ state: 'visible' });
  }

  async checkAvailability(): Promise<{ class: string; status: string; seats: string }> {
    return {
      class: (await this.locator('[data-testid="availability-class"]').innerText()).trim(),
      status: (await this.locator('[data-testid="availability-status"]').innerText()).trim(),
      seats: (await this.locator('[data-testid="availability-seats"]').innerText()).trim(),
    };
  }

  async enterPassenger(input: MockPassengerInput): Promise<void> {
    await this.passengerName.fill(input.name);
    await this.passengerAge.fill(String(input.age));
  }

  async confirm(): Promise<string> {
    await this.confirmButton.click();
    await this.bookingReference.waitFor({ state: 'visible' });
    return (await this.bookingReference.innerText()).trim();
  }
}
