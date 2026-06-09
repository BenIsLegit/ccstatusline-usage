import type { RenderContext } from '../../types/RenderContext';

import { anthropicProvider } from './providers/anthropic';
import { nullProvider } from './providers/null';
import { opencodeProvider } from './providers/opencode';
import type { UsageProvider } from './types';

const OPENCODE_PATTERN = /(?:^|[^a-z])(glm|kimi|minimax|mm-|qwen|owen|mimo)/i;
// 'claude' matches every first-party model id (all are `claude-*`, e.g.
// claude-fable-5), so new model families work without a code change. The
// family keywords remain as a fallback for bare display names ('Fable 5').
const ANTHROPIC_KEYWORDS = ['claude', 'opus', 'sonnet', 'haiku', 'fable'];

export function resolveProvider(modelId: string | undefined | null): UsageProvider {
    if (!modelId)
        return nullProvider;
    const id = modelId.toLowerCase();
    if (ANTHROPIC_KEYWORDS.some(k => id.includes(k)))
        return anthropicProvider;
    if (OPENCODE_PATTERN.test(id))
        return opencodeProvider;
    return nullProvider;
}

export function getModelIdFromContext(context: RenderContext): string {
    const model = context.data?.model;
    return (typeof model === 'string' ? model : model?.id) ?? '';
}
