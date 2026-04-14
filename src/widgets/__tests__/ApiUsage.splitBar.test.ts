/**
 * Tests for the split-bar rendering in ApiUsage.tsx's SessionUsageWidget
 * and WeeklyUsageWidget. The split bar replaces the normal progress bar
 * when a usage window reaches 100% and extra-usage spending data is
 * available. The right half is wrapped in a dark-red ANSI escape so the
 * user can see how much of their extra spend has been used.
 *
 * The widget inherits auto-scaling from `getDisplaySize(context)`:
 * mobile = 4 chars wide (halfWidth 1), medium = 8 (halfWidth 3), full
 * = 15 (halfWidth 7). Labels shrink to `S:` / `W:` at mobile size.
 *
 * Normal bars clamp display percentage to 100% max — values above 100
 * (e.g. 101% from the API) must never be shown.
 *
 * settings.extraUsageBalance = ceiling in cents (spent + balance at config
 * time, e.g. €153.23 spent + €56.06 balance → set 20929). Stable: unlike
 * (extraUsed + balance), this doesn't drift as spending continues.
 */

import {
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import type { Settings } from '../../types/Settings';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import {
    SessionUsageWidget,
    WeeklyUsageWidget
} from '../ApiUsage';

const DARK_RED_OPEN = '\x1b[38;2;204;0;0m';
const DARK_RED_CLOSE = '\x1b[39m';

const BASE_ITEM: WidgetItem = { id: 'test', type: 'test' };

function makeContext(
    usageData: RenderContext['usageData'],
    terminalWidth: number
): RenderContext {
    return {
        usageData,
        terminalWidth,
        isPreview: false
    };
}

describe('WeeklyUsageWidget — split bar at 100% with extra usage', () => {
    let widget: WeeklyUsageWidget;

    beforeEach(() => {
        widget = new WeeklyUsageWidget();
    });

    it('renders split bar at full size (terminalWidth=200, halfWidth=7)', () => {
        const context = makeContext({
            weeklyUsage: 100,
            sessionUsage: 50,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const expected = `Weekly: [███████|${DARK_RED_OPEN}█░░░░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('renders split bar at medium size (terminalWidth=150, halfWidth=3)', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 50,
            extraUsageLimit: 100
        }, 150);
        // medium width=8, halfWidth=floor((8-1)/2)=3, fill=round(0.5*3)=2
        const expected = `Weekly: [███|${DARK_RED_OPEN}██░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('falls back to normal bar at mobile size (split skipped because too cramped)', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 50,
            extraUsageLimit: 100
        }, 100);
        // mobile width=4, 100% → all 4 filled, normal bar, short label W:
        const expected = 'W: [████] 100.0%';

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('monthly cap applies when ceiling > monthly limit', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 50,
            extraUsageLimit: 100  // monthly limit
        }, 200);
        const settings: Settings = { ...DEFAULT_SETTINGS, extraUsageBalance: 200 };
        // ceiling=200 > limit=100 → effectiveTotal=min(200,100)=100
        // extraPercent = 50/100*100 = 50%, halfWidth=7, fill=round(0.50*7)=4 (round(3.5)=4)
        const expected = `Weekly: [███████|${DARK_RED_OPEN}████░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, settings)).toBe(expected);
    });

    it('ceiling cap applies when ceiling < monthly limit', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 50,
            extraUsageLimit: 300  // monthly limit higher than ceiling
        }, 200);
        const settings: Settings = { ...DEFAULT_SETTINGS, extraUsageBalance: 200 };
        // ceiling=200 < limit=300 → effectiveTotal=min(200,300)=200
        // extraPercent = 50/200*100 = 25%, halfWidth=7, fill=round(0.25*7)=2 (round(1.75)=2)
        const expected = `Weekly: [███████|${DARK_RED_OPEN}██░░░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, settings)).toBe(expected);
    });

    it('renders normal bar when weekly=99 (gate not met)', () => {
        const context = makeContext({
            weeklyUsage: 99,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).not.toContain('|');
        expect(result).not.toContain(DARK_RED_OPEN);
        expect(result).toContain('99.0%');
    });

    it('renders normal bar when extra usage is disabled', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: false,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).not.toContain('|');
        expect(result).not.toContain(DARK_RED_OPEN);
        expect(result).toContain('100.0%');
    });

    it('renders normal bar when extraUsageUsed is undefined', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageLimit: 100
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).not.toContain('|');
        expect(result).not.toContain(DARK_RED_OPEN);
    });

    it('clamps extraPercent when used exceeds ceiling', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 200,
            extraUsageLimit: 100
        }, 200);
        const expected = `Weekly: [███████|${DARK_RED_OPEN}███████${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('handles zero extra usage (right half all empty)', () => {
        const context = makeContext({
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 0,
            extraUsageLimit: 100
        }, 200);
        const expected = `Weekly: [███████|${DARK_RED_OPEN}░░░░░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('clamps displayed percentage to 100% when API returns > 100', () => {
        const context = makeContext({
            weeklyUsage: 101,
            extraUsageEnabled: false
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).toContain('100.0%');
        expect(result).not.toContain('101');
    });
});

describe('SessionUsageWidget — split bar at 100% with extra usage', () => {
    let widget: SessionUsageWidget;

    beforeEach(() => {
        widget = new SessionUsageWidget();
    });

    it('renders split bar when session=100 and weekly<100', () => {
        const context = makeContext({
            sessionUsage: 100,
            weeklyUsage: 50,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const expected = `Session: [███████|${DARK_RED_OPEN}█░░░░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('does NOT render split bar when both session and weekly are 100 (weekly priority)', () => {
        const context = makeContext({
            sessionUsage: 100,
            weeklyUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).not.toContain('|');
        expect(result).not.toContain(DARK_RED_OPEN);
        expect(result).toContain('100.0%');
    });

    it('renders split bar when session=100 and weeklyUsage is undefined', () => {
        const context = makeContext({
            sessionUsage: 100,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const expected = `Session: [███████|${DARK_RED_OPEN}█░░░░░░${DARK_RED_CLOSE}] 100.0%`;

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('falls back to normal bar at mobile size (split skipped because too cramped)', () => {
        const context = makeContext({
            sessionUsage: 100,
            weeklyUsage: 50,
            extraUsageEnabled: true,
            extraUsageUsed: 50,
            extraUsageLimit: 100
        }, 100);
        const expected = 'S: [████] 100.0%';

        expect(widget.render(BASE_ITEM, context, DEFAULT_SETTINGS)).toBe(expected);
    });

    it('renders normal bar when session=99 (gate not met)', () => {
        const context = makeContext({
            sessionUsage: 99,
            extraUsageEnabled: true,
            extraUsageUsed: 14,
            extraUsageLimit: 100
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).not.toContain('|');
        expect(result).not.toContain(DARK_RED_OPEN);
    });

    it('clamps displayed percentage to 100% when API returns > 100', () => {
        const context = makeContext({
            sessionUsage: 101,
            weeklyUsage: 50,
            extraUsageEnabled: false
        }, 200);
        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        expect(result).toContain('100.0%');
        expect(result).not.toContain('101');
    });
});