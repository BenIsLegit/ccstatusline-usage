import type { UsageData } from '../usage-types';

export type ProviderName = 'anthropic' | 'opencode' | 'null';

export interface UsageProvider {
    readonly name: ProviderName;
    fetchUsage(): Promise<UsageData>;
}
