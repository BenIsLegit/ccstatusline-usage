import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
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

        const is1m = modelId?.includes('[1m]') ?? false;
        const suffix = is1m ? '[1m]' : '';
        // Strip [1m] from displayName in case it fell back to model.id
        const cleanDisplayName = modelDisplayName.replace(/\[1m\]/gi, '').trim();

        const display = suffix ? `${cleanDisplayName} ${suffix}` : cleanDisplayName;
        return item.rawValue ? display : `Model: ${display}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
