import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getUsageErrorMessage,
    getWeeklyUsageWindowFromResetAt
} from '../utils/usage';

export class WeeklyPaceWidget implements Widget {
    getDefaultColor(): string { return 'brightYellow'; }
    getDescription(): string { return 'Shows if weekly usage pace is on track, overcooking, or underutilized'; }
    getDisplayName(): string { return 'Weekly Pace'; }
    getCategory(): string { return 'API Usage'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return 'D4/7: On Pace';
        }

        const data = context.usageData;
        if (!data) return null;
        if (data.error) return getUsageErrorMessage(data.error);
        if (data.weeklyUsage === undefined) return null;

        const window = getWeeklyUsageWindowFromResetAt(data.weeklyResetAt);
        if (!window) return null;

        const actualPercent = Math.max(0, Math.min(100, data.weeklyUsage));
        const expectedPercent = window.elapsedPercent;
        const delta = actualPercent - expectedPercent;

        // Day 1-7 within the weekly window
        const dayOfWeek = Math.min(7, Math.floor(window.elapsedPercent * 7 / 100) + 1);

        let status: string;
        if (delta > 15) {
            status = `Overcooking +${Math.round(delta)}%`;
        } else if (delta > 5) {
            status = `Warm +${Math.round(delta)}%`;
        } else if (delta < -15) {
            status = `Underusing ${Math.round(delta)}%`;
        } else if (delta < -5) {
            status = `Cool ${Math.round(delta)}%`;
        } else {
            status = 'On Pace';
        }

        return `D${dayOfWeek}/7: ${status}`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
