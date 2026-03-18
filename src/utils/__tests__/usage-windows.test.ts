import {
    describe,
    expect,
    it
} from 'vitest';

import { getUsageErrorMessage, makePendulumBar } from '../usage-windows';

describe('getUsageErrorMessage', () => {
    it('returns the rate-limited label', () => {
        expect(getUsageErrorMessage('rate-limited')).toBe('[Rate limited]');
    });
});

describe('makePendulumBar', () => {
    it('shows empty bar with center marker at delta=0', () => {
        expect(makePendulumBar(0)).toBe('[░░░░░░░|░░░░░░░]');
    });

    it('fills right side for positive delta', () => {
        expect(makePendulumBar(50)).toBe('[░░░░░░░|████░░░]');
    });

    it('fills left side for negative delta', () => {
        expect(makePendulumBar(-50)).toBe('[░░░████|░░░░░░░]');
    });

    it('fills full right side at delta=100', () => {
        expect(makePendulumBar(100)).toBe('[░░░░░░░|███████]');
    });

    it('fills full left side at delta=-100', () => {
        expect(makePendulumBar(-100)).toBe('[███████|░░░░░░░]');
    });

    it('clamps delta above 100', () => {
        expect(makePendulumBar(200)).toBe(makePendulumBar(100));
    });

    it('clamps delta below -100', () => {
        expect(makePendulumBar(-200)).toBe(makePendulumBar(-100));
    });

    it('supports custom halfWidth', () => {
        expect(makePendulumBar(50, 4)).toBe('[░░░░|██░░]');
    });

    it('supports custom halfWidth with negative delta', () => {
        expect(makePendulumBar(-50, 4)).toBe('[░░██|░░░░]');
    });
});