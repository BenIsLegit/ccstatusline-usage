import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import * as usage from '../../utils/usage';
import type { UsageWindowMetrics } from '../../utils/usage-types';
import { WeeklyPaceWidget } from '../WeeklyPace';

const BASE_ITEM: WidgetItem = { id: 'pace', type: 'weekly-pace' };
const PENDULUM_ITEM: WidgetItem = { ...BASE_ITEM, metadata: { display: 'pendulum' } };
const SHOW_PERCENT_ITEM: WidgetItem = { ...BASE_ITEM, metadata: { showPercent: 'true' } };

function render(context: RenderContext = {}, item: WidgetItem = BASE_ITEM): string | null {
    return new WeeklyPaceWidget().render(item, context, DEFAULT_SETTINGS);
}

function makeWindow(elapsedPercent: number): UsageWindowMetrics {
    const durationMs = 7 * 24 * 60 * 60 * 1000;
    const elapsedMs = (elapsedPercent / 100) * durationMs;
    return {
        sessionDurationMs: durationMs,
        elapsedMs,
        remainingMs: durationMs - elapsedMs,
        elapsedPercent,
        remainingPercent: 100 - elapsedPercent
    };
}

describe('WeeklyPaceWidget', () => {
    let mockResolveWeeklyUsageWindow: { mockReturnValue: (value: UsageWindowMetrics | null) => void };
    let mockGetUsageErrorMessage: { mockReturnValue: (value: string) => void };

    beforeEach(() => {
        vi.restoreAllMocks();
        mockResolveWeeklyUsageWindow = vi.spyOn(usage, 'resolveWeeklyUsageWindow');
        mockGetUsageErrorMessage = vi.spyOn(usage, 'getUsageErrorMessage');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // --- Metadata ---

    it('has category Usage', () => {
        expect(new WeeklyPaceWidget().getCategory()).toBe('Usage');
    });

    it('supports raw value', () => {
        expect(new WeeklyPaceWidget().supportsRawValue()).toBe(true);
    });

    // --- Preview ---

    it('returns preview string in text mode', () => {
        expect(render({ isPreview: true })).toBe('D4/7: On Pace');
    });

    it('returns pendulum bar preview in pendulum mode', () => {
        const result = render({ isPreview: true }, PENDULUM_ITEM);
        expect(result).toBe('Pace: [░░░░░░░|█░░░░░░] D4/7 +10%');
    });

    it('omits label in pendulum preview when rawValue is true', () => {
        const rawItem: WidgetItem = { ...PENDULUM_ITEM, rawValue: true };
        const result = render({ isPreview: true }, rawItem);
        expect(result).toBe('[░░░░░░░|█░░░░░░] D4/7 +10%');
    });

    // --- Null / error guards ---

    it('returns null when usageData is missing', () => {
        expect(render({})).toBeNull();
    });

    it('returns null when usageData is null', () => {
        expect(render({ usageData: null })).toBeNull();
    });

    it('returns error message when usageData has error', () => {
        mockGetUsageErrorMessage.mockReturnValue('[Timeout]');
        expect(render({ usageData: { error: 'timeout' } })).toBe('[Timeout]');
    });

    it('returns null when weeklyUsage is undefined', () => {
        expect(render({ usageData: {} })).toBeNull();
    });

    it('returns null when weekly window cannot be resolved', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(null);
        expect(render({ usageData: { weeklyUsage: 50 } })).toBeNull();
    });

    // --- Day calculation ---

    it('shows D1 at the start of the window', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(0));
        expect(render({ usageData: { weeklyUsage: 0 } })).toMatch(/^D1\/7:/);
    });

    it('shows D4 at ~50% elapsed', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 50 } })).toMatch(/^D4\/7:/);
    });

    it('shows D7 at 100% elapsed', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(100));
        expect(render({ usageData: { weeklyUsage: 100 } })).toMatch(/^D7\/7:/);
    });

    it('shows D7 at 99% elapsed', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(99));
        expect(render({ usageData: { weeklyUsage: 99 } })).toMatch(/^D7\/7:/);
    });

    // --- Pace labels ---

    it('shows On Pace when delta is within ±5%', () => {
        // Day 4/7 ≈ 57.1% elapsed, usage at 60% → delta ≈ +2.9%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(57.14));
        expect(render({ usageData: { weeklyUsage: 60 } })).toBe('D4/7: On Pace');
    });

    it('shows Warm when delta is +6 to +15%', () => {
        // 30% elapsed, 40% usage → delta = +10%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        expect(render({ usageData: { weeklyUsage: 40 } })).toBe('D3/7: Warm +10%');
    });

    it('shows Overcooking when delta exceeds +15%', () => {
        // Day 2/7 ≈ 28.6% elapsed, usage at 50% → delta ≈ +21.4%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(28.57));
        expect(render({ usageData: { weeklyUsage: 50 } })).toBe('D2/7: Overcooking +21%');
    });

    it('shows Cool when delta is -6 to -15%', () => {
        // 50% elapsed, 40% usage → delta = -10%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 40 } })).toBe('D4/7: Cool -10%');
    });

    it('shows Underusing when delta is below -15%', () => {
        // 85.7% elapsed (day 6/7), usage at 40% → delta ≈ -45.7%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(85.71));
        expect(render({ usageData: { weeklyUsage: 40 } })).toBe('D6/7: Underusing -46%');
    });

    // --- Boundary thresholds ---

    it('shows On Pace at exactly +5% delta', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 55 } })).toBe('D4/7: On Pace');
    });

    it('shows Warm at just over +5% delta', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 55.1 } })).toMatch(/^D4\/7: Warm \+5%$/);
    });

    it('shows Warm at exactly +15% delta', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 65 } })).toBe('D4/7: Warm +15%');
    });

    it('shows Overcooking at just over +15% delta', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 65.1 } })).toMatch(/^D4\/7: Overcooking \+15%$/);
    });

    // --- showPercent metadata ---

    it('shows On Pace with percentage when showPercent is true', () => {
        // 57.14% elapsed, 60% usage → delta ≈ +2.9%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(57.14));
        expect(render({ usageData: { weeklyUsage: 60 } }, SHOW_PERCENT_ITEM)).toBe('D4/7: On Pace +3%');
    });

    it('shows On Pace with negative percentage when showPercent is true', () => {
        // 50% elapsed, 47% usage → delta = -3%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 47 } }, SHOW_PERCENT_ITEM)).toBe('D4/7: On Pace -3%');
    });

    it('shows On Pace +0% when exactly on pace with showPercent', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 50 } }, SHOW_PERCENT_ITEM)).toBe('D4/7: On Pace +0%');
    });

    it('does not affect non-On Pace labels when showPercent is true', () => {
        // 30% elapsed, 40% usage → delta = +10% → Warm
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        expect(render({ usageData: { weeklyUsage: 40 } }, SHOW_PERCENT_ITEM)).toBe('D3/7: Warm +10%');
    });

    // --- Decimal precision ---

    it('shows 1 decimal place when decimals is 1', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '1' } };
        expect(render({ usageData: { weeklyUsage: 40 } }, item)).toBe('D3/7: Warm +10.0%');
    });

    it('shows 2 decimal places when decimals is 2', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '2' } };
        expect(render({ usageData: { weeklyUsage: 40 } }, item)).toBe('D3/7: Warm +10.00%');
    });

    it('shows 3 decimal places when decimals is 3', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '3' } };
        expect(render({ usageData: { weeklyUsage: 40 } }, item)).toBe('D3/7: Warm +10.000%');
    });

    it('shows fractional delta with decimal precision', () => {
        // 57.14% elapsed, 60% usage → delta ≈ +2.86%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(57.14));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '2' } };
        expect(render({ usageData: { weeklyUsage: 60 } }, item)).toBe('D4/7: On Pace');
    });

    it('shows fractional delta with decimals and showPercent combined', () => {
        // 57.14% elapsed, 60% usage → delta ≈ +2.86%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(57.14));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { showPercent: 'true', decimals: '2' } };
        expect(render({ usageData: { weeklyUsage: 60 } }, item)).toBe('D4/7: On Pace +2.86%');
    });

    it('applies decimal precision to pendulum bar display', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        const item: WidgetItem = { ...BASE_ITEM, metadata: { display: 'pendulum', decimals: '1' } };
        const result = render({ usageData: { weeklyUsage: 50 } }, item);
        expect(result).toContain('+20.0%');
    });

    // --- Clamping ---

    it('clamps weeklyUsage above 100 to 100', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 120 } })).toMatch(/Overcooking \+50%/);
    });

    it('clamps weeklyUsage below 0 to 0', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: -10 } })).toMatch(/Underusing -50%/);
    });

    // --- rawValue support ---

    it('omits label prefix in text mode when rawValue is true', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        const rawItem: WidgetItem = { ...BASE_ITEM, rawValue: true };
        expect(render({ usageData: { weeklyUsage: 50 } }, rawItem)).toBe('D4/7: On Pace');
    });

    it('omits Pace: prefix in pendulum mode when rawValue is true', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        const rawItem: WidgetItem = { ...PENDULUM_ITEM, rawValue: true };
        const result = render({ usageData: { weeklyUsage: 60 } }, rawItem);
        expect(result).not.toMatch(/^Pace:/);
        expect(result).toMatch(/^\[/);
    });

    it('includes Pace: prefix in pendulum mode when rawValue is false', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        const result = render({ usageData: { weeklyUsage: 60 } }, PENDULUM_ITEM);
        expect(result).toMatch(/^Pace: \[/);
    });

    // --- Pendulum bar rendering ---

    it('renders pendulum bar with positive delta (ahead of pace)', () => {
        // 30% elapsed, 50% usage → delta = +20%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(30));
        const result = render({ usageData: { weeklyUsage: 50 } }, PENDULUM_ITEM);
        expect(result).toMatch(/\[░+\|█+░*\]/);
        expect(result).toContain('D3/7 +20%');
    });

    it('renders pendulum bar with negative delta (behind pace)', () => {
        // 50% elapsed, 30% usage → delta = -20%
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        const result = render({ usageData: { weeklyUsage: 30 } }, PENDULUM_ITEM);
        expect(result).toMatch(/\[░*█+\|░+\]/);
        expect(result).toContain('D4/7 -20%');
    });

    it('renders pendulum bar on pace (delta near zero)', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        const result = render({ usageData: { weeklyUsage: 50 } }, PENDULUM_ITEM);
        expect(result).toContain('[░░░░░░░|░░░░░░░]');
        expect(result).toContain('D4/7 +0%');
    });

    // --- Pendulum preview ---

    it('shows pendulum bar in preview with positive delta', () => {
        const result = render({ isPreview: true }, PENDULUM_ITEM);
        expect(result).toMatch(/\[░+\|█+░*\]/);
        expect(result).toContain('D4/7 +10%');
    });

    // --- Display mode toggle ---

    it('toggles from text to pendulum mode', () => {
        const widget = new WeeklyPaceWidget();
        const result = widget.handleEditorAction('toggle-pendulum', BASE_ITEM);
        expect(result?.metadata?.display).toBe('pendulum');
    });

    it('toggles from pendulum back to text mode', () => {
        const widget = new WeeklyPaceWidget();
        const result = widget.handleEditorAction('toggle-pendulum', PENDULUM_ITEM);
        expect(result?.metadata?.display).toBe('text');
    });

    it('toggles showPercent on', () => {
        const widget = new WeeklyPaceWidget();
        const result = widget.handleEditorAction('toggle-show-percent', BASE_ITEM);
        expect(result?.metadata?.showPercent).toBe('true');
    });

    it('toggles showPercent off', () => {
        const widget = new WeeklyPaceWidget();
        const result = widget.handleEditorAction('toggle-show-percent', SHOW_PERCENT_ITEM);
        expect(result?.metadata?.showPercent).toBe('false');
    });

    it('cycles decimals from 0 to 1', () => {
        const widget = new WeeklyPaceWidget();
        const result = widget.handleEditorAction('cycle-decimals', BASE_ITEM);
        expect(result?.metadata?.decimals).toBe('1');
    });

    it('cycles decimals from 1 to 2', () => {
        const widget = new WeeklyPaceWidget();
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '1' } };
        const result = widget.handleEditorAction('cycle-decimals', item);
        expect(result?.metadata?.decimals).toBe('2');
    });

    it('cycles decimals from 3 back to 0', () => {
        const widget = new WeeklyPaceWidget();
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '3' } };
        const result = widget.handleEditorAction('cycle-decimals', item);
        expect(result?.metadata?.decimals).toBe('0');
    });

    it('returns null for unknown editor action', () => {
        const widget = new WeeklyPaceWidget();
        expect(widget.handleEditorAction('unknown', BASE_ITEM)).toBeNull();
    });

    // --- Custom keybinds ---

    it('exposes all custom keybinds', () => {
        const widget = new WeeklyPaceWidget();
        const keybinds = widget.getCustomKeybinds();
        expect(keybinds).toEqual([
            { key: 'p', label: '(p)endulum toggle', action: 'toggle-pendulum' },
            { key: '%', label: '(%) always show percent', action: 'toggle-show-percent' },
            { key: '.', label: '(.) decimal precision', action: 'cycle-decimals' }
        ]);
    });

    // --- Editor display ---

    it('shows no modifier text in text mode', () => {
        const widget = new WeeklyPaceWidget();
        const display = widget.getEditorDisplay(BASE_ITEM);
        expect(display.displayText).toBe('Weekly Pace');
        expect(display.modifierText).toBeUndefined();
    });

    it('shows (pendulum bar) modifier text in pendulum mode', () => {
        const widget = new WeeklyPaceWidget();
        const display = widget.getEditorDisplay(PENDULUM_ITEM);
        expect(display.displayText).toBe('Weekly Pace');
        expect(display.modifierText).toBe('(pendulum bar)');
    });

    it('shows (always %) modifier text when showPercent is true', () => {
        const widget = new WeeklyPaceWidget();
        const display = widget.getEditorDisplay(SHOW_PERCENT_ITEM);
        expect(display.displayText).toBe('Weekly Pace');
        expect(display.modifierText).toBe('(always %)');
    });

    it('shows both modifiers when pendulum and showPercent are active', () => {
        const widget = new WeeklyPaceWidget();
        const bothItem: WidgetItem = { ...BASE_ITEM, metadata: { display: 'pendulum', showPercent: 'true' } };
        const display = widget.getEditorDisplay(bothItem);
        expect(display.displayText).toBe('Weekly Pace');
        expect(display.modifierText).toBe('(pendulum bar, always %)');
    });

    it('shows decimal modifier text when decimals is set', () => {
        const widget = new WeeklyPaceWidget();
        const item: WidgetItem = { ...BASE_ITEM, metadata: { decimals: '2' } };
        const display = widget.getEditorDisplay(item);
        expect(display.modifierText).toBe('(.00)');
    });

    it('shows all modifiers combined', () => {
        const widget = new WeeklyPaceWidget();
        const item: WidgetItem = { ...BASE_ITEM, metadata: { display: 'pendulum', showPercent: 'true', decimals: '1' } };
        const display = widget.getEditorDisplay(item);
        expect(display.modifierText).toBe('(pendulum bar, always %, .0)');
    });
});
