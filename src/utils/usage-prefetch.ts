import type { StatusJSON } from '../types/StatusJSON';
import type { WidgetItem } from '../types/Widget';

import type { UsageData } from './usage';
import { fetchUsageData } from './usage';

const USAGE_WIDGET_TYPES = new Set<string>([
    'session-usage',
    'weekly-usage',
    'block-timer',
    'reset-timer',
    'weekly-reset-timer',
    'weekly-pace'
]);

export function hasUsageDependentWidgets(lines: WidgetItem[][]): boolean {
    return lines.some(line => line.some(item => USAGE_WIDGET_TYPES.has(item.type)));
}

function epochSecondsToIsoString(epochSeconds: number | null | undefined): string | undefined {
    if (epochSeconds === null || epochSeconds === undefined || !Number.isFinite(epochSeconds)) {
        return undefined;
    }
    return new Date(epochSeconds * 1000).toISOString();
}

export function extractUsageDataFromRateLimits(rateLimits: StatusJSON['rate_limits']): UsageData | null {
    if (!rateLimits) {
        return null;
    }

    const sessionUsage = rateLimits.five_hour?.used_percentage ?? undefined;
    const sessionResetAt = epochSecondsToIsoString(rateLimits.five_hour?.resets_at);
    const weeklyUsage = rateLimits.seven_day?.used_percentage ?? undefined;
    const weeklyResetAt = epochSecondsToIsoString(rateLimits.seven_day?.resets_at);

    if (sessionUsage === undefined && weeklyUsage === undefined) {
        return null;
    }

    // Note: rate_limits does not include extra_usage data (extraUsageEnabled, etc.).
    // Those fields are only available via the API fetch path.
    return { sessionUsage, sessionResetAt, weeklyUsage, weeklyResetAt };
}

function hasCompleteRateLimitsUsageData(usageData: UsageData | null): usageData is UsageData & {
    sessionUsage: number;
    sessionResetAt: string;
    weeklyUsage: number;
    weeklyResetAt: string;
} {
    return usageData?.sessionUsage !== undefined
        && usageData.sessionResetAt !== undefined
        && usageData.weeklyUsage !== undefined
        && usageData.weeklyResetAt !== undefined;
}

function hasExtraUsageDependentWidgets(lines: WidgetItem[][]): boolean {
    return lines.some(line => line.some(item => item.type === 'reset-timer'));
}

export async function prefetchUsageDataIfNeeded(lines: WidgetItem[][], data?: StatusJSON): Promise<UsageData | null> {
    if (!hasUsageDependentWidgets(lines)) {
        return null;
    }

    const rateLimitsData = extractUsageDataFromRateLimits(data?.rate_limits);
    if (hasCompleteRateLimitsUsageData(rateLimitsData)) {
        // rate_limits lacks extraUsage fields — supplement via API for reset-timer
        if (hasExtraUsageDependentWidgets(lines)) {
            const apiData = await fetchUsageData();
            if (apiData.error === undefined) {
                return { ...rateLimitsData, extraUsageEnabled: apiData.extraUsageEnabled, extraUsageLimit: apiData.extraUsageLimit, extraUsageUsed: apiData.extraUsageUsed, extraUsageUtilization: apiData.extraUsageUtilization };
            }
        }
        return rateLimitsData;
    }

    return fetchUsageData();
}
