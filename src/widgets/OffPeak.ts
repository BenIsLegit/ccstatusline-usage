import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

// Promotion: March 13, 2026 00:00 PT through March 28, 2026 23:59 PT
// PT = PDT = UTC-7 in March (DST started March 8)
const PROMO_START_MS = Date.UTC(2026, 2, 13, 7, 0, 0);   // March 13 00:00 PDT = 07:00 UTC
const PROMO_END_MS   = Date.UTC(2026, 2, 29, 6, 59, 0);   // March 28 23:59 PDT = March 29 06:59 UTC

// Peak hours on weekdays: 8 AM–2 PM EDT (UTC-4), March 2026 is already on EDT
// Peak = 12:00–18:00 UTC
const PEAK_START_UTC_HOUR = 12;
const PEAK_END_UTC_HOUR   = 18;

function isOffPeak(now: Date): boolean | null {
    const ms = now.getTime();
    if (ms < PROMO_START_MS || ms >= PROMO_END_MS) {
        return null; // outside promotion window — hide widget
    }

    // getUTCDay(): 0 = Sunday, 6 = Saturday
    const dayOfWeek = now.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend)
        return true;

    const utcHour = now.getUTCHours();
    const isPeak = utcHour >= PEAK_START_UTC_HOUR && utcHour < PEAK_END_UTC_HOUR;
    return !isPeak;
}

// Returns minutes until the window flips, or null if weekend (all-day off-peak, no flip today)
function minutesUntilFlip(now: Date): number | null {
    const dayOfWeek = now.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend)
        return null;

    const utcHour = now.getUTCHours();
    const isPeak = utcHour >= PEAK_START_UTC_HOUR && utcHour < PEAK_END_UTC_HOUR;

    const flipHour = isPeak ? PEAK_END_UTC_HOUR : PEAK_START_UTC_HOUR;
    const target = new Date(now);

    if (!isPeak && utcHour >= PEAK_END_UTC_HOUR) {
        // Off-peak evening — flip is tomorrow morning
        target.setUTCDate(now.getUTCDate() + 1);
    }
    target.setUTCHours(flipHour, 0, 0, 0);

    return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}

function formatCountdown(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

export class OffPeakWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows peak / off-peak 2x status during the March 2026 Anthropic usage promotion'; }
    getDisplayName(): string { return 'Off Peak'; }
    getCategory(): string { return 'Usage'; }
    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'Off-peak 2x (3:42)' : 'Off-peak 2x (3:42)';
        }

        const now = new Date();
        const offPeak = isOffPeak(now);
        if (offPeak === null)
            return null;

        const mins = minutesUntilFlip(now);
        const countdown = mins !== null ? ` (${formatCountdown(mins)} hr)` : '';
        const mobile = (context.terminalWidth ?? 0) > 0 && (context.terminalWidth ?? 0) < 80;

        if (offPeak) {
            return mobile ? `2x${countdown}` : `Off-peak 2x${countdown}`;
        }

        return `Peak${countdown}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}