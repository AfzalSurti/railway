import { ServiceType } from '../provider.types';
import { MockInventoryProvider } from './mock-inventory-provider';

export class MockFlightProvider extends MockInventoryProvider {
  protected readonly kind: ServiceType = 'FLIGHT';
}
