import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';

import { getColorLevelString } from '../types/ColorLevel';
import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getChalkColor } from '../utils/colors';

const MOBILE_THRESHOLD = 80;

// Parse model ID into compact form: claude-opus-4-6 → o4.6, claude-sonnet-4-5-20250929 → s4.5
function compactModelName(name: string): string {
    // Strip claude- prefix
    const stripped = name.replace(/^claude-/, '');
    // Match: {model-name}-{major}-{minor}[-optional-date-suffix]
    const match = /^([a-z]+)-(\d+)-(\d+)/.exec(stripped);
    if (match) {
        const letter = match[1]?.charAt(0) ?? '';
        return `${letter}${match[2]}.${match[3]}`;
    }
    return stripped;
}

// Read CC effort level: env var > ~/.claude/settings.json > default "high"
// CC stores effortLevel in userSettings only when non-default (default = "high")
function getEffortLevel(): string {
    const envLevel = process.env.CLAUDE_CODE_EFFORT_LEVEL;
    if (envLevel)
        return envLevel.toLowerCase();

    try {
        const configDir = (process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'));
        const settingsPath = path.join(configDir, 'settings.json');
        const content = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(content) as { effortLevel?: string };
        if (settings.effortLevel)
            return settings.effortLevel.toLowerCase();
    } catch {
        // Settings not readable
    }

    return 'high';
}

// Map effort level to 1-3 bars
function effortToLevel(effort: string): number {
    switch (effort) {
        case 'low': return 1;
        case 'medium': return 2;
        default: return 3;
    }
}

// Render ▌▌▌ with individual coloring matching CC's own UI style:
// active bars = red, inactive bars = brightBlack (gray)
function renderThinkingBars(level: number, settings: Settings): string {
    if (level <= 0)
        return '';
    const colorLevel = getColorLevelString(settings.colorLevel);
    const activeChalk = getChalkColor('red', colorLevel);
    const dimChalk = getChalkColor('brightBlack', colorLevel);
    const bars = ['▌', '▌', '▌'];
    return ' ' + bars.map((bar, i) => {
        if (i < level) {
            return activeChalk ? activeChalk(bar) : bar;
        }
        return dimChalk ? dimChalk(bar) : bar;
    }).join('');
}

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'ansi256:124'; }
    getDescription(): string { return 'Displays the Claude model name (e.g., Claude 3.5 Sonnet)'; }
    getDisplayName(): string { return 'Model'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            const bars = renderThinkingBars(3, settings);
            return item.rawValue ? `Claude${bars}` : `Model: Claude${bars}`;
        }

        const model = context.data?.model;
        const modelId = typeof model === 'string' ? model : model?.id;
        const modelDisplayName = typeof model === 'string'
            ? model
            : (model?.display_name ?? model?.id);

        if (!modelDisplayName)
            return null;

        const level = effortToLevel(getEffortLevel());
        const bars = renderThinkingBars(level, settings);

        const mobile = (context.terminalWidth ?? 0) > 0 && (context.terminalWidth ?? 0) < MOBILE_THRESHOLD;
        if (mobile && modelId) {
            return `M: ${compactModelName(modelId)}${bars}`;
        }

        return item.rawValue ? `${modelDisplayName}${bars}` : `Model: ${modelDisplayName}${bars}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}