import {
    DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY,
    defaultObjectCollectionRuntimeViewConfig,
    objectCollectionRuntimeViewConfigSchema,
    type ObjectCollectionLayoutBehaviorConfig,
    type ObjectCollectionRuntimeEditSurface,
    type ObjectCollectionRuntimeViewConfig,
    type ResolvedObjectCollectionRuntimeViewConfig
} from '@universo-react/types'

const isEditSurface = (value: unknown): value is ObjectCollectionRuntimeEditSurface => value === 'dialog' || value === 'page'

const resolveBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

export function normalizeObjectCollectionRuntimeViewConfig(
    config: ObjectCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): ResolvedObjectCollectionRuntimeViewConfig {
    const source = (config ?? {}) as Record<string, unknown>

    return {
        showCreateButton: resolveBoolean(source.showCreateButton, defaultObjectCollectionRuntimeViewConfig.showCreateButton),
        createSurface: isEditSurface(source.createSurface) ? source.createSurface : defaultObjectCollectionRuntimeViewConfig.createSurface,
        editSurface: isEditSurface(source.editSurface) ? source.editSurface : defaultObjectCollectionRuntimeViewConfig.editSurface,
        copySurface: isEditSurface(source.copySurface) ? source.copySurface : defaultObjectCollectionRuntimeViewConfig.copySurface
    }
}

export function sanitizeObjectCollectionRuntimeViewConfig(
    config: ObjectCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): ObjectCollectionRuntimeViewConfig | undefined {
    const source = (config ?? {}) as Record<string, unknown>
    const parsed = objectCollectionRuntimeViewConfigSchema.safeParse(source)
    if (!parsed.success) return undefined
    const sanitized: ObjectCollectionRuntimeViewConfig = {}

    if (
        typeof parsed.data.showCreateButton === 'boolean' &&
        parsed.data.showCreateButton !== defaultObjectCollectionRuntimeViewConfig.showCreateButton
    ) {
        sanitized.showCreateButton = parsed.data.showCreateButton
    }
    if (parsed.data.createSurface && parsed.data.createSurface !== defaultObjectCollectionRuntimeViewConfig.createSurface) {
        sanitized.createSurface = parsed.data.createSurface
    }
    if (parsed.data.editSurface && parsed.data.editSurface !== defaultObjectCollectionRuntimeViewConfig.editSurface) {
        sanitized.editSurface = parsed.data.editSurface
    }
    if (parsed.data.copySurface && parsed.data.copySurface !== defaultObjectCollectionRuntimeViewConfig.copySurface) {
        sanitized.copySurface = parsed.data.copySurface
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function extractObjectCollectionLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined | null
): ObjectCollectionLayoutBehaviorConfig | undefined {
    if (!layoutConfig || typeof layoutConfig !== 'object') {
        return undefined
    }

    const value = layoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
    return value && typeof value === 'object' ? sanitizeObjectCollectionRuntimeViewConfig(value as Record<string, unknown>) : undefined
}

export function setObjectCollectionLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined,
    behaviorConfig: ObjectCollectionLayoutBehaviorConfig | Record<string, unknown> | undefined
): Record<string, unknown> {
    const nextLayoutConfig = { ...((layoutConfig ?? {}) as Record<string, unknown>) }
    const sanitizedBehaviorConfig = sanitizeObjectCollectionRuntimeViewConfig(behaviorConfig)

    if (!sanitizedBehaviorConfig) {
        delete nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
        return nextLayoutConfig
    }

    nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY] = sanitizedBehaviorConfig
    return nextLayoutConfig
}

export function resolveObjectCollectionLayoutBehaviorConfig(params: {
    layoutConfig: Record<string, unknown> | undefined
}): ResolvedObjectCollectionRuntimeViewConfig {
    const { layoutConfig } = params
    const layoutBehaviorConfig = extractObjectCollectionLayoutBehaviorConfig(layoutConfig)

    return normalizeObjectCollectionRuntimeViewConfig(layoutBehaviorConfig)
}
