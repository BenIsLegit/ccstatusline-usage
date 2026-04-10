import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getUsageErrorMessage } from '../utils/usage';

const MOBILE_THRESHOLD = 134;
const MEDIUM_THRESHOLD = 178;
const MOBILE_BAR_WIDTH = 4;
const MEDIUM_BAR_WIDTH = 8;
const DEFAULT_BAR_WIDTH = 15;

type DisplaySize = 'mobile' | 'medium' | 'full';

function getDisplaySize(context: RenderContext): DisplaySize {
    const w = context.terminalWidth ?? 0;
    if (w > 0 && w < MOBILE_THRESHOLD)
        return 'mobile';
    if (w >= MOBILE_THRESHOLD && w < MEDIUM_THRESHOLD)
        return 'medium';
    return 'full';
}

function getBarWidth(size: DisplaySize): number {
    if (size === 'mobile')
        return MOBILE_BAR_WIDTH;
    if (size === 'medium')
        return MEDIUM_BAR_WIDTH;
    return DEFAULT_BAR_WIDTH;
}

function makeProgressBar(percent: number, width = DEFAULT_BAR_WIDTH): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

function formatUsageBar(label: string, shortLabel: string, percent: number, size: DisplaySize): string {
    const bar = makeProgressBar(percent, getBarWidth(size));
    return `${size === 'mobile' ? shortLabel : label}: ${bar} ${percent.toFixed(1)}%`;
}

function getCurrencySymbol(): string {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.startsWith('Europe/'))
            return '€';
    } catch {
        // Fall through to default
    }
    return '$';
}

function formatCents(cents: number): string {
    const symbol = getCurrencySymbol();
    return `${symbol}${(cents / 100).toFixed(2)}`;
}

// Session Usage Widget
export class SessionUsageWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return 'Shows daily/session API usage percentage'; }
    getDisplayName(): string { return 'Session Usage'; }
    getCategory(): string { return 'API Usage'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return 'Session: [███░░░░░░░░░░░░] 20%';

        const data = context.usageData ?? {};
        if (data.error)
            return getUsageErrorMessage(data.error);
        if (data.sessionUsage === undefined)
            return null;

        return formatUsageBar('Session', 'S', data.sessionUsage, getDisplaySize(context));
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}

// Weekly Usage Widget
export class WeeklyUsageWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return 'Shows weekly API usage percentage'; }
    getDisplayName(): string { return 'Weekly Usage'; }
    getCategory(): string { return 'API Usage'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return 'Weekly: [██░░░░░░░░░░░░░] 12%';

        const data = context.usageData ?? {};
        if (data.error)
            return getUsageErrorMessage(data.error);
        if (data.weeklyUsage === undefined)
            return null;

        return formatUsageBar('Weekly', 'W', data.weeklyUsage, getDisplaySize(context));
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}

// Reset Timer Widget — shows extra usage spending when weekly limit is reached, otherwise reset timer
export class ResetTimerWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return 'Shows extra usage spending or time until limit reset'; }
    getDisplayName(): string { return 'Reset Timer'; }
    getCategory(): string { return 'API Usage'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview)
            return '4:30 hr';

        const data = context.usageData ?? {};
        if (data.error)
            return getUsageErrorMessage(data.error);

        // Determine if the current model charges extra usage (Sonnet [1m] does, Opus [1m] does not)
        const model = context.data?.model;
        const modelId = (typeof model === 'string' ? model : model?.id) ?? '';
        const is1mModel = modelId.includes('[1m]');
        const isOpus = modelId.includes('opus');
        const isChargedModel = is1mModel && !isOpus;

        // Show extra usage spending when: weekly limit reached (100%) OR session limit reached (100%) OR using a charged [1m] model (e.g. Sonnet [1m])
        if (data.extraUsageEnabled && data.extraUsageUsed !== undefined && data.extraUsageLimit !== undefined
            && ((data.weeklyUsage !== undefined && data.weeklyUsage >= 100)
                || (data.sessionUsage !== undefined && data.sessionUsage >= 100)
                || isChargedModel)) {
            const used = formatCents(data.extraUsageUsed);
            const displayLimit = settings.extraUsageBalance ?? data.extraUsageLimit;
            const limit = formatCents(displayLimit);
            return `Extra: ${used}/${limit}`;
        }

        if (!data.sessionResetAt)
            return null;

        try {
            const resetTime = new Date(data.sessionResetAt).getTime();
            const now = Date.now();
            const diffMs = resetTime - now;

            if (diffMs <= 0)
                return '0:00 hr';

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}:${minutes.toString().padStart(2, '0')} hr`;
        } catch {
            return null;
        }
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}

// Context Bar Widget (enhanced context display)
export class ContextBarWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows context usage as a progress bar'; }
    getDisplayName(): string { return 'Context Bar'; }
    getCategory(): string { return 'API Usage'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return 'Context: [████░░░░░░░░░░░] 50k/200k (25%)';

        const cw = context.data?.context_window;
        if (!cw)
            return null;

        const total = Number(cw.context_window_size) || 200000;

        // current_usage can be a number or an object with token breakdown
        let used = 0;
        if (typeof cw.current_usage === 'number') {
            used = cw.current_usage;
        } else if (cw.current_usage && typeof cw.current_usage === 'object') {
            const u = cw.current_usage;
            used = (Number(u.input_tokens) || 0)
                + (Number(u.output_tokens) || 0)
                + (Number(u.cache_creation_input_tokens) || 0)
                + (Number(u.cache_read_input_tokens) || 0);
        }

        if (isNaN(total) || isNaN(used))
            return null;

        const percent = total > 0 ? (used / total) * 100 : 0;

        const usedK = Math.round(used / 1000);
        const totalStr = total >= 1000000 ? `${Math.round(total / 1000000)}M` : `${Math.round(total / 1000)}k`;

        const size = getDisplaySize(context);
        const bar = makeProgressBar(percent, getBarWidth(size));
        const label = size === 'mobile' ? 'C' : 'Context';
        const suffix = size === 'mobile' ? '' : ` (${Math.round(percent)}%)`;
        return `${label}: ${bar} ${usedK}k/${totalStr}${suffix}`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}