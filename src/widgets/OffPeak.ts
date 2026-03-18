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
    if (isWeekend) return true;

    const utcHour = now.getUTCHours();
    const isPeak = utcHour >= PEAK_START_UTC_HOUR && utcHour < PEAK_END_UTC_HOUR;
    return !isPeak;
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
            return item.rawValue ? 'Off-peak 2x' : 'Off peak: Off-peak 2x';
        }

        const result = isOffPeak(new Date());
        if (result === null) return null;

        const value = result ? 'Off-peak 2x' : 'Peak';
        const mobile = (context.terminalWidth ?? 0) > 0 && (context.terminalWidth ?? 0) < 80;
        if (item.rawValue || mobile) return value;
        return `Off peak: ${value}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
