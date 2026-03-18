import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getUsageErrorMessage,
    makePendulumBar,
    resolveWeeklyUsageWindow
} from '../utils/usage';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';
import { makeModifierText } from './shared/editor-display';

const MOBILE_THRESHOLD = 80;

type PaceDisplayMode = 'text' | 'pendulum';

function getPaceDisplayMode(item: WidgetItem): PaceDisplayMode {
    return item.metadata?.display === 'pendulum' ? 'pendulum' : 'text';
}

function computePace(actualPercent: number, expectedPercent: number) {
    const delta = actualPercent - expectedPercent;
    const dayOfWeek = Math.max(1, Math.min(7, Math.ceil(expectedPercent * 7 / 100)));

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

    return { delta, dayOfWeek, status };
}

export class WeeklyPaceWidget implements Widget {
    getDefaultColor(): string { return 'brightYellow'; }
    getDescription(): string { return 'Shows if weekly usage pace is on track, overcooking, or underutilized'; }
    getDisplayName(): string { return 'Weekly Pace'; }
    getCategory(): string { return 'Usage'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const mode = getPaceDisplayMode(item);
        const modifiers: string[] = [];

        if (mode === 'pendulum') {
            modifiers.push('pendulum bar');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: makeModifierText(modifiers)
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action !== 'toggle-pendulum') {
            return null;
        }

        const currentMode = getPaceDisplayMode(item);
        const nextMode: PaceDisplayMode = currentMode === 'text' ? 'pendulum' : 'text';

        return {
            ...item,
            metadata: {
                ...(item.metadata ?? {}),
                display: nextMode
            }
        };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const displayMode = getPaceDisplayMode(item);

        if (context.isPreview) {
            if (displayMode === 'pendulum') {
                // Preview: delta +10, day 4/7
                const barDisplay = `${makePendulumBar(10)} D4/7 +10%`;
                return formatRawOrLabeledValue(item, 'Pace: ', barDisplay);
            }
            return formatRawOrLabeledValue(item, '', 'D4/7: On Pace');
        }

        const data = context.usageData;
        if (!data) return null;
        if (data.error) return getUsageErrorMessage(data.error);
        if (data.weeklyUsage === undefined) return null;

        const window = resolveWeeklyUsageWindow(data);
        if (!window) return null;

        const actualPercent = Math.max(0, Math.min(100, data.weeklyUsage));
        const { delta, dayOfWeek, status } = computePace(actualPercent, window.elapsedPercent);

        const mobile = (context.terminalWidth ?? 0) > 0 && (context.terminalWidth ?? 0) < MOBILE_THRESHOLD;

        if (displayMode === 'pendulum' && !mobile) {
            const sign = delta >= 0 ? '+' : '';
            const barDisplay = `${makePendulumBar(delta)} D${dayOfWeek}/7 ${sign}${Math.round(delta)}%`;
            return formatRawOrLabeledValue(item, 'Pace: ', barDisplay);
        }

        return formatRawOrLabeledValue(item, '', `D${dayOfWeek}/7: ${status}`);
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'p', label: '(p)endulum toggle', action: 'toggle-pendulum' }
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
