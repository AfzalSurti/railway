import { BrowserSession } from '../../browser/browser-session';
import { MockTrainPage } from '../../browser/pages/mock-train.page';
import { BrowserProviderAdapter } from './browser-provider-adapter';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingResult,
  ProviderPassenger,
  SearchRequest,
  SearchResult,
} from '../provider.types';

export class MockTrainBrowserAdapter implements BrowserProviderAdapter {
  private readonly pageObject: MockTrainPage;

  constructor(
    private readonly session: BrowserSession,
    private readonly pageUrl: string,
  ) {
    this.pageObject = new MockTrainPage(session.getPage());
  }

  async openProvider(): Promise<void> {
    await this.pageObject.goto(this.pageUrl);
  }

  async search(request: SearchRequest): Promise<SearchResult> {
    await this.pageObject.search({
      source: request.source,
      destination: request.destination,
      journeyDate: request.journeyDate,
      trainNumber: request.trainNumber,
    });
    const rows = await this.pageObject.results.all();
    const journeys = await Promise.all(
      rows.map(async (row) => ({
        providerTrainId: (await row.getAttribute('data-train-id')) ?? 'mock-local',
        trainNumber: ((await row.getAttribute('data-train-number')) ?? '').trim(),
        trainName: ((await row.getAttribute('data-train-name')) ?? '').trim(),
        source: request.source,
        destination: request.destination,
        departureTime: ((await row.getAttribute('data-departure')) ?? '').trim(),
        arrivalTime: ((await row.getAttribute('data-arrival')) ?? '').trim(),
        classes: ['3A'],
      })),
    );
    return { found: journeys.length > 0, journeys };
  }

  async checkAvailability(_request: AvailabilityRequest): Promise<AvailabilityResult> {
    const availability = await this.pageObject.checkAvailability();
    const seats = Number.parseInt(availability.seats, 10);
    return {
      available: availability.status === 'AVAILABLE',
      options: [
        {
          class: availability.class,
          status: availability.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNKNOWN',
          seats: Number.isNaN(seats) ? null : seats,
        },
      ],
    };
  }

  async selectJourney(providerTrainId: string): Promise<void> {
    const trainNumber = providerTrainId.split('-')[0] ?? providerTrainId;
    await this.pageObject.selectTrain(trainNumber);
  }

  async enterPassengerDetails(passengers: ProviderPassenger[]): Promise<void> {
    const first = passengers[0];
    if (!first) {
      return;
    }
    await this.pageObject.enterPassenger({ name: first.name, age: first.age });
  }

  async confirm(): Promise<BookingResult> {
    const reference = await this.pageObject.confirm();
    return {
      status: 'SUCCESS',
      providerBookingReference: reference,
      message: 'Booking confirmed',
    };
  }
}
