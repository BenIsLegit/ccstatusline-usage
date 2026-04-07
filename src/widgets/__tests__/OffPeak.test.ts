import {
    describe,
    expect,
    it
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import {
    isOffPeak,
    isPeakHour,
    isWeekend,
    minutesUntilFlip,
    OffPeakWidget
} from '../OffPeak';

const item: WidgetItem = { id: 'off-peak', type: 'off-peak' };

function d(iso: string): Date {
    return new Date(iso);
}

describe('isWeekend', () => {
    it('returns true for Sunday', () => {
        expect(isWeekend(d('2026-04-05T12:00:00Z'))).toBe(true);
    });
    it('returns true for Saturday', () => {
        expect(isWeekend(d('2026-04-04T12:00:00Z'))).toBe(true);
    });
    it('returns false for Monday', () => {
        expect(isWeekend(d('2026-04-06T12:00:00Z'))).toBe(false);
    });
    it('returns false for Friday', () => {
        expect(isWeekend(d('2026-04-03T12:00:00Z'))).toBe(false);
    });
});

describe('isPeakHour', () => {
    it('returns true at 12:00 UTC', () => {
        expect(isPeakHour(d('2026-04-07T12:00:00Z'))).toBe(true);
    });
    it('returns true at 17:59 UTC', () => {
        expect(isPeakHour(d('2026-04-07T17:59:00Z'))).toBe(true);
    });
    it('returns false at 18:00 UTC', () => {
        expect(isPeakHour(d('2026-04-07T18:00:00Z'))).toBe(false);
    });
    it('returns false at 11:59 UTC', () => {
        expect(isPeakHour(d('2026-04-07T11:59:00Z'))).toBe(false);
    });
});

describe('isOffPeak', () => {
    it('weekday during peak is not off-peak', () => {
        expect(isOffPeak(d('2026-04-07T14:00:00Z'))).toBe(false);
    });
    it('weekday before peak is off-peak', () => {
        expect(isOffPeak(d('2026-04-07T06:00:00Z'))).toBe(true);
    });
    it('weekday evening is off-peak', () => {
        expect(isOffPeak(d('2026-04-07T20:00:00Z'))).toBe(true);
    });
    it('Saturday is off-peak', () => {
        expect(isOffPeak(d('2026-04-04T14:00:00Z'))).toBe(true);
    });
    it('Sunday is off-peak', () => {
        expect(isOffPeak(d('2026-04-05T14:00:00Z'))).toBe(true);
    });
});

describe('minutesUntilFlip', () => {
    describe('weekday peak → counts to end of peak', () => {
        it('Mon 17:00 UTC — 60 min until 18:00', () => {
            expect(minutesUntilFlip(d('2026-04-06T17:00:00Z'))).toBe(60);
        });

        it('Mon 12:00 UTC — 360 min until 18:00', () => {
            expect(minutesUntilFlip(d('2026-04-06T12:00:00Z'))).toBe(360);
        });
    });

    describe('weekday off-peak morning → counts to peak start', () => {
        it('Mon 06:00 UTC — 360 min until 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-06T06:00:00Z'))).toBe(360);
        });
    });

    describe('weekday off-peak evening → counts to next morning peak', () => {
        it('Mon 20:00 UTC — 960 min until Tue 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-06T20:00:00Z'))).toBe(960);
        });
    });

    describe('Friday evening → counts to Monday peak (not Saturday)', () => {
        it('Fri 18:00 UTC — 3960 min (66h) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-03T18:00:00Z'))).toBe(3960);
        });

        it('Fri 20:00 UTC — 3840 min (64h) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-03T20:00:00Z'))).toBe(3840);
        });

        it('Fri 23:59 UTC — 3601 min (60h 1m) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-03T23:59:00Z'))).toBe(3601);
        });
    });

    describe('weekend → counts to Monday peak', () => {
        it('Sat 00:00 UTC — 3600 min (60h) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-04T00:00:00Z'))).toBe(3600);
        });

        it('Sat 08:00 UTC — 3120 min (52h) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-04T08:00:00Z'))).toBe(3120);
        });

        it('Sun 20:00 UTC — 960 min (16h) until Mon 12:00', () => {
            expect(minutesUntilFlip(d('2026-04-05T20:00:00Z'))).toBe(960);
        });
    });
});

describe('OffPeakWidget', () => {
    const widget = new OffPeakWidget();

    function render(ctx: RenderContext = {}): string | null {
        return widget.render(item, ctx, DEFAULT_SETTINGS);
    }

    it('renders preview', () => {
        expect(render({ isPreview: true })).toBe('Off-peak (3:42 hr)');
    });

    it('renders compact label when terminal width < 134', () => {
        const result = widget.render(item, { terminalWidth: 60 }, DEFAULT_SETTINGS);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^(OffPk|Peak)/);
    });

    it('renders full label when terminal width >= 134', () => {
        const result = widget.render(item, { terminalWidth: 140 }, DEFAULT_SETTINGS);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^(Off-peak|Peak)/);
    });
});