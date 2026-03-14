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

function render(context: RenderContext = {}): string | null {
    return new WeeklyPaceWidget().render(BASE_ITEM, context, DEFAULT_SETTINGS);
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

    // --- Preview ---

    it('returns preview string', () => {
        expect(render({ isPreview: true })).toBe('D4/7: On Pace');
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

    // --- Clamping ---

    it('clamps weeklyUsage above 100 to 100', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: 120 } })).toMatch(/Overcooking \+50%/);
    });

    it('clamps weeklyUsage below 0 to 0', () => {
        mockResolveWeeklyUsageWindow.mockReturnValue(makeWindow(50));
        expect(render({ usageData: { weeklyUsage: -10 } })).toMatch(/Underusing -50%/);
    });
});
