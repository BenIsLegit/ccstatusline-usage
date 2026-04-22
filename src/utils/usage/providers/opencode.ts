import type { UsageData } from '../../usage-types';
import type { UsageProvider } from '../types';

export const opencodeProvider: UsageProvider = {
    name: 'opencode',
    fetchUsage(): Promise<UsageData> {
        // No usage API available for OpenCode Go (OC-1: NOT FOUND).
        // Return empty data — widgets will show default state.
        return Promise.resolve({ provider: 'opencode' });
    }
};
