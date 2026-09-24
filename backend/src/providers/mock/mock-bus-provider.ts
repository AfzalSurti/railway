import { ServiceType } from '../provider.types';
import { MockInventoryProvider } from './mock-inventory-provider';

export class MockBusProvider extends MockInventoryProvider {
  protected readonly kind: ServiceType = 'BUS';
}
