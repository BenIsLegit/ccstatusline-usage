import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    RenderContext,
    RenderUsageData
} from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import {
    ContextBarWidget,
    ResetTimerWidget,
    SessionUsageWidget,
    WeeklyUsageWidget
} from '../ApiUsage';

const BASE_ITEM: WidgetItem = { id: 'test', type: 'test' };

function makeContext(usageData: RenderUsageData | null, extra: Partial<RenderContext> = {}): RenderContext {
    return {
        usageData,
        terminalWidth: 200, // full display size — avoids mobile/medium abbreviation
        isPreview: false,
        ...extra
    };
}

describe('ApiUsage widgets with local models (fallback behavior)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Test for SessionUsageWidget with local model
    it('should show fallback values for local models (no Opus/Sonnet/Haiku)', () => {
        const widget = new SessionUsageWidget();

        // For local model (no charge), sessionUsage should show fallback
        const context = makeContext(
            { sessionUsage: 14.0 },
            { data: { model: { id: 'qwen3-coder:30b' } } }
        );

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show fallback values for local models
        expect(result).toBe('Session: [░░░░░░░░░░░░░░░] -.0%');
    });

    // Test for WeeklyUsageWidget with local model
    it('should show fallback values for local models (no Opus/Sonnet/Haiku)', () => {
        const widget = new WeeklyUsageWidget();

        // For local model (no charge), weeklyUsage should show fallback
        const context = makeContext(
            { weeklyUsage: 24.0 },
            { data: { model: { id: 'qwen3-coder:30b' } } }
        );

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show fallback values for local models
        expect(result).toBe('Weekly: [░░░░░░░░░░░░░░░] -.0%');
    });

    // Test for ResetTimerWidget with local model
    it('should show fallback values for local models (no Opus/Sonnet/Haiku)', () => {
        const widget = new ResetTimerWidget();

        // For local model (no charge), reset time should show fallback
        const context = makeContext(
            {
                sessionResetAt: new Date(Date.now() + 3600_000).toISOString(), // 1 hour in future
                weeklyResetAt: new Date(Date.now() + 86400_000).toISOString() // 1 day in future
            },
            { data: { model: { id: 'qwen3-coder:30b' } } }
        );

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show fallback values for local models
        expect(result).toBe('-:00 hr');
    });

    // Test for ContextBarWidget with Qwen local model (should show actual context)
    it('should show actual context for Qwen models', () => {
        const widget = new ContextBarWidget();

        // For Qwen model, context bar should show actual context usage
        const context: RenderContext = {
            data: {
                model: { id: 'qwen3-coder:30b' },
                context_window: {
                    context_window_size: 200000,
                    current_usage: 50000
                }
            },
            terminalWidth: 200
        };

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show actual context for Qwen models (bar should be 15 chars wide with 25% usage)
        expect(result).toBe('Context: [████░░░░░░░░░░░] 50k/200k (25%)');
    });

    // Test for ContextBarWidget with Qwen local model in mobile mode
    it('should show actual context for Qwen models in mobile mode', () => {
        const widget = new ContextBarWidget();

        // For Qwen model, context bar should show actual context in mobile mode
        const context: RenderContext = {
            data: {
                model: { id: 'qwen3-coder:30b' },
                context_window: {
                    context_window_size: 200000,
                    current_usage: 50000
                }
            },
            terminalWidth: 100 // mobile mode threshold
        };

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show actual context for Qwen models in mobile mode
        expect(result).toBe('C: [█░░░] 50k/200k');
    });

    // Test for ContextBarWidget with other local model (should show fallback)
    it('should show fallback values for non-Qwen local models', () => {
        const widget = new ContextBarWidget();

        // For other local model, context bar should show fallback
        const context: RenderContext = {
            data: {
                model: { id: 'llama3:8b' },
                context_window: {
                    context_window_size: 200000,
                    current_usage: 50000
                }
            },
            terminalWidth: 200
        };

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show fallback values for non-Qwen local models
        expect(result).toBe('Context: [░░░░░░░░░░░░░░░] -.0%');
    });

    // Test for SessionUsageWidget with charged model (should work normally)
    it('should work normally for charged models (Sonnet)', () => {
        const widget = new SessionUsageWidget();

        // For charged model, should work normally
        const context = makeContext(
            { sessionUsage: 14.0 },
            { data: { model: { id: 'claude-sonnet-4-5[1m]' } } }
        );

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show normal values for charged models
        expect(result).toBe('Session: [██░░░░░░░░░░░░░] 14.0%');
    });

    // Test for SessionUsageWidget with Opus model (should work normally)
    it('should work normally for Opus models (included in plan)', () => {
        const widget = new SessionUsageWidget();

        // For Opus model, should work normally (but not charged)
        const context = makeContext(
            { sessionUsage: 14.0 },
            { data: { model: { id: 'claude-opus-4-7[1m]' } } }
        );

        const result = widget.render(BASE_ITEM, context, DEFAULT_SETTINGS);

        // Should show normal values for Opus models
        expect(result).toBe('Session: [██░░░░░░░░░░░░░] 14.0%');
    });
});