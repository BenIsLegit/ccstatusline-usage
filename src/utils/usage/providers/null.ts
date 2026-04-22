import type { UsageData } from '../../usage-types';
import type { UsageProvider } from '../types';

export const nullProvider: UsageProvider = {
    name: 'null',
    fetchUsage(): Promise<UsageData> {
        return Promise.resolve({ provider: null });
    }
};
