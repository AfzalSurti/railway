import { providerFactory } from '../providers';
import { AppError } from '../utils/AppError';
import { ProviderUnsupportedError } from '../providers/provider-errors';

export const providerService = {
  list() {
    return providerFactory.list();
  },

  getByName(name: string) {
    try {
      return providerFactory.getMetadata(name);
    } catch (error) {
      if (error instanceof ProviderUnsupportedError) {
        throw AppError.notFound(`Provider ${name} was not found`);
      }
      throw error;
    }
  },
};
