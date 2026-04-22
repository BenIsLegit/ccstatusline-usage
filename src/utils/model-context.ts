interface ModelContextConfig {
    maxTokens: number;
    usableTokens: number;
}

interface ModelIdentifier {
    id?: string;
    display_name?: string;
}

const DEFAULT_CONTEXT_WINDOW_SIZE = 200000;
const USABLE_CONTEXT_RATIO = 0.8;

/**
 * Model context mappings for opencode models that don't have native context information
 */
const OPENCODE_MODEL_CONTEXT_MAP: Record<string, number> = {
    // GLM models
    'glm-5.1': 1000000, // 1M tokens
    'glm-4.5': 1000000, // 1M tokens
    'glm-4.0': 1000000, // 1M tokens

    // MiniMax models
    'mm-2.7': 1000000, // 1M tokens
    'mm-2.5': 1000000, // 1M tokens

    // Kimi models
    'kimi-k2.6': 1000000, // 1M tokens
    'kimi-k2.5': 1000000, // 1M tokens

    // Owen models
    'owen-3.6': 1000000, // 1M tokens
    'owen-3.5': 1000000, // 1M tokens

    // Qwen models
    'qwen-2.5': 1000000, // 1M tokens
    'qwen-2.0': 1000000, // 1M tokens
    'qwen-1.5': 1000000, // 1M tokens
    'qwen-1.0': 1000000 // 1M tokens
};

function toValidWindowSize(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    return value;
}

function parseContextWindowSize(modelIdentifier: string): number | null {
    const delimitedMatch = /(?:\(|\[)\s*(\d+(?:[,_]\d+)*(?:\.\d+)?)\s*([km])\s*(?:\)|\])/i.exec(modelIdentifier);
    if (delimitedMatch) {
        const delimitedValue = delimitedMatch[1];
        const delimitedUnit = delimitedMatch[2];
        if (!delimitedValue || !delimitedUnit) {
            return null;
        }

        const parsed = Number.parseFloat(delimitedValue.replace(/[,_]/g, ''));
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.round(parsed * (delimitedUnit.toLowerCase() === 'm' ? 1000000 : 1000));
        }
    }

    const contextMatch = /\b(\d+(?:[,_]\d+)*(?:\.\d+)?)\s*([km])(?:\s*(?:token\s*)?context)?\b/i.exec(modelIdentifier);
    if (!contextMatch) {
        return null;
    }

    const contextValue = contextMatch[1];
    const contextUnit = contextMatch[2];
    if (!contextValue || !contextUnit) {
        return null;
    }

    const parsed = Number.parseFloat(contextValue.replace(/[,_]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.round(parsed * (contextUnit.toLowerCase() === 'm' ? 1000000 : 1000));
}

export function getModelContextIdentifier(model?: string | ModelIdentifier): string | undefined {
    if (typeof model === 'string') {
        const trimmed = model.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    if (!model) {
        return undefined;
    }

    const id = model.id?.trim();
    const displayName = model.display_name?.trim();

    if (id && displayName) {
        return `${id} ${displayName}`;
    }

    return id ?? displayName;
}

export function getContextConfig(modelIdentifier?: string, contextWindowSize?: number | null): ModelContextConfig {
    const statusWindowSize = toValidWindowSize(contextWindowSize);
    if (statusWindowSize !== null) {
        return {
            maxTokens: statusWindowSize,
            usableTokens: Math.floor(statusWindowSize * USABLE_CONTEXT_RATIO)
        };
    }

    // Default to 200k for older models
    const defaultConfig = {
        maxTokens: DEFAULT_CONTEXT_WINDOW_SIZE,
        usableTokens: Math.floor(DEFAULT_CONTEXT_WINDOW_SIZE * USABLE_CONTEXT_RATIO)
    };

    if (!modelIdentifier) {
        return defaultConfig;
    }

    // Check if this is an opencode model with known context size
    const normalizedModel = modelIdentifier.toLowerCase().trim();
    for (const [modelName, contextSize] of Object.entries(OPENCODE_MODEL_CONTEXT_MAP)) {
        if (normalizedModel.includes(modelName)) {
            return {
                maxTokens: contextSize,
                usableTokens: Math.floor(contextSize * USABLE_CONTEXT_RATIO)
            };
        }
    }

    const inferredWindowSize = parseContextWindowSize(modelIdentifier);
    if (inferredWindowSize !== null) {
        return {
            maxTokens: inferredWindowSize,
            usableTokens: Math.floor(inferredWindowSize * USABLE_CONTEXT_RATIO)
        };
    }

    return defaultConfig;
}
