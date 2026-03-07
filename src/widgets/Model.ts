import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

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

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'ansi256:124'; }
    getDescription(): string { return 'Displays the Claude model name (e.g., Claude 3.5 Sonnet)'; }
    getDisplayName(): string { return 'Model'; }
    getCategory(): string { return 'Core'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'Claude' : 'Model: Claude';
        }

        const model = context.data?.model;
        const modelId = typeof model === 'string' ? model : model?.id;
        const modelDisplayName = typeof model === 'string'
            ? model
            : (model?.display_name ?? model?.id);

        if (!modelDisplayName)
            return null;

        const mobile = (context.terminalWidth ?? 0) > 0 && (context.terminalWidth ?? 0) < MOBILE_THRESHOLD;
        if (mobile && modelId) {
            return `M: ${compactModelName(modelId)}`;
        }

        return item.rawValue ? modelDisplayName : `Model: ${modelDisplayName}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}