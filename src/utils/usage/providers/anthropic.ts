import { fetchUsageData as fetchAnthropicUsage } from '../../usage-fetch';
import type { UsageData } from '../../usage-types';
import type { UsageProvider } from '../types';

export const anthropicProvider: UsageProvider = {
    name: 'anthropic',
    async fetchUsage(): Promise<UsageData> {
        const data = await fetchAnthropicUsage();
        return { ...data, provider: 'anthropic' };
    }
};
