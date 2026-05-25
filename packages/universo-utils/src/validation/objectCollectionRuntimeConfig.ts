import {
    DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY,
    defaultObjectCollectionRuntimeViewConfig,
    type ObjectCollectionLayoutBehaviorConfig,
    type ObjectCollectionRuntimeEditSurface,
    type ObjectCollectionRuntimeRowHeight,
    type ObjectCollectionRuntimeSearchMode,
    type ObjectCollectionRuntimeViewConfig,
    type DashboardViewMode,
    type ResolvedObjectCollectionRuntimeViewConfig,
    type DashboardLayoutConfig,
    type DashboardLayoutRowHeight
} from '@universo/types'

const isSearchMode = (value: unknown): value is ObjectCollectionRuntimeSearchMode => value === 'server' || value === 'page-local'

const isEditSurface = (value: unknown): value is ObjectCollectionRuntimeEditSurface => value === 'dialog' || value === 'page'

const isRowHeight = (value: unknown): value is ObjectCollectionRuntimeRowHeight =>
    value === 'compact' || value === 'normal' || value === 'auto'

const isDashboardViewMode = (value: unknown): value is DashboardViewMode => value === 'table' || value === 'card'

const isCardColumns = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 4

const resolveBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const hasOwn = (source: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(source, key)

const hasLegacyLayoutOverrides = (source: Record<string, unknown>): boolean =>
    (typeof source.showSearch === 'boolean' && source.showSearch !== defaultObjectCollectionRuntimeViewConfig.showSearch) ||
    (typeof source.showViewToggle === 'boolean' && source.showViewToggle !== defaultObjectCollectionRuntimeViewConfig.showViewToggle) ||
    (isDashboardViewMode(source.defaultViewMode) && source.defaultViewMode !== defaultObjectCollectionRuntimeViewConfig.defaultViewMode) ||
    (isCardColumns(source.cardColumns) && source.cardColumns !== defaultObjectCollectionRuntimeViewConfig.cardColumns) ||
    (isRowHeight(source.rowHeight) && source.rowHeight !== defaultObjectCollectionRuntimeViewConfig.rowHeight) ||
    (typeof source.enableRowReordering === 'boolean' &&
        source.enableRowReordering !== defaultObjectCollectionRuntimeViewConfig.enableRowReordering) ||
    (hasOwn(source, 'reorderPersistenceField') &&
        ((typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0) ||
            source.reorderPersistenceField === null))

const areLayoutOverridesEnabled = (source: Record<string, unknown>): boolean => {
    if (typeof source.useLayoutOverrides === 'boolean') {
        return source.useLayoutOverrides
    }

    return hasLegacyLayoutOverrides(source)
}

export function normalizeObjectCollectionRuntimeViewConfig(
    config: ObjectCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): ResolvedObjectCollectionRuntimeViewConfig {
    const source = (config ?? {}) as Record<string, unknown>
    const useLayoutOverrides = areLayoutOverridesEnabled(source)

    return {
        useLayoutOverrides,
        showSearch: resolveBoolean(source.showSearch, defaultObjectCollectionRuntimeViewConfig.showSearch),
        searchMode: isSearchMode(source.searchMode) ? source.searchMode : defaultObjectCollectionRuntimeViewConfig.searchMode,
        showCreateButton: resolveBoolean(source.showCreateButton, defaultObjectCollectionRuntimeViewConfig.showCreateButton),
        showViewToggle: resolveBoolean(source.showViewToggle, defaultObjectCollectionRuntimeViewConfig.showViewToggle),
        defaultViewMode: isDashboardViewMode(source.defaultViewMode)
            ? source.defaultViewMode
            : defaultObjectCollectionRuntimeViewConfig.defaultViewMode,
        cardColumns: isCardColumns(source.cardColumns) ? source.cardColumns : defaultObjectCollectionRuntimeViewConfig.cardColumns,
        rowHeight: isRowHeight(source.rowHeight) ? source.rowHeight : defaultObjectCollectionRuntimeViewConfig.rowHeight,
        enableRowReordering: resolveBoolean(source.enableRowReordering, defaultObjectCollectionRuntimeViewConfig.enableRowReordering),
        reorderPersistenceField:
            typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0
                ? source.reorderPersistenceField.trim()
                : defaultObjectCollectionRuntimeViewConfig.reorderPersistenceField,
        createSurface: isEditSurface(source.createSurface) ? source.createSurface : defaultObjectCollectionRuntimeViewConfig.createSurface,
        editSurface: isEditSurface(source.editSurface) ? source.editSurface : defaultObjectCollectionRuntimeViewConfig.editSurface,
        copySurface: isEditSurface(source.copySurface) ? source.copySurface : defaultObjectCollectionRuntimeViewConfig.copySurface
    }
}

export function sanitizeObjectCollectionRuntimeViewConfig(
    config: ObjectCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): ObjectCollectionRuntimeViewConfig | undefined {
    const source = (config ?? {}) as Record<string, unknown>
    const sanitized: ObjectCollectionRuntimeViewConfig = {}
    const useLayoutOverrides = areLayoutOverridesEnabled(source)

    if (useLayoutOverrides) {
        sanitized.useLayoutOverrides = true

        if (typeof source.showSearch === 'boolean') {
            sanitized.showSearch = source.showSearch
        }
        if (typeof source.showViewToggle === 'boolean') {
            sanitized.showViewToggle = source.showViewToggle
        }
        if (isDashboardViewMode(source.defaultViewMode)) {
            sanitized.defaultViewMode = source.defaultViewMode
        }
        if (isCardColumns(source.cardColumns)) {
            sanitized.cardColumns = source.cardColumns
        }
        if (isRowHeight(source.rowHeight)) {
            sanitized.rowHeight = source.rowHeight
        }
        if (typeof source.enableRowReordering === 'boolean') {
            sanitized.enableRowReordering = source.enableRowReordering
        }
        if (hasOwn(source, 'reorderPersistenceField')) {
            sanitized.reorderPersistenceField =
                typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0
                    ? source.reorderPersistenceField.trim()
                    : null
        }
    }

    if (isSearchMode(source.searchMode) && source.searchMode !== defaultObjectCollectionRuntimeViewConfig.searchMode) {
        sanitized.searchMode = source.searchMode
    }
    if (
        typeof source.showCreateButton === 'boolean' &&
        source.showCreateButton !== defaultObjectCollectionRuntimeViewConfig.showCreateButton
    ) {
        sanitized.showCreateButton = source.showCreateButton
    }
    if (isEditSurface(source.createSurface) && source.createSurface !== defaultObjectCollectionRuntimeViewConfig.createSurface) {
        sanitized.createSurface = source.createSurface
    }
    if (isEditSurface(source.editSurface) && source.editSurface !== defaultObjectCollectionRuntimeViewConfig.editSurface) {
        sanitized.editSurface = source.editSurface
    }
    if (isEditSurface(source.copySurface) && source.copySurface !== defaultObjectCollectionRuntimeViewConfig.copySurface) {
        sanitized.copySurface = source.copySurface
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

const mapObjectCollectionRowHeightToDashboard = (rowHeight: ObjectCollectionRuntimeRowHeight): DashboardLayoutRowHeight | undefined => {
    if (rowHeight === 'auto') return 'auto'
    if (rowHeight === 'normal') return 52
    return undefined
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

const resolveObjectRuntimeLayoutOverrides = (
    config: ObjectCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): Partial<DashboardLayoutConfig> => {
    const source = (config ?? {}) as Record<string, unknown>

    if (!areLayoutOverridesEnabled(source)) {
        return {}
    }

    const overrides: Partial<DashboardLayoutConfig> = {}

    if (typeof source.showViewToggle === 'boolean') {
        overrides.showViewToggle = source.showViewToggle
    }
    if (isDashboardViewMode(source.defaultViewMode)) {
        overrides.defaultViewMode = source.defaultViewMode
    }
    if (typeof source.showSearch === 'boolean') {
        overrides.showFilterBar = source.showSearch
    }
    if (typeof source.enableRowReordering === 'boolean') {
        overrides.enableRowReordering = source.enableRowReordering
    }
    if (isCardColumns(source.cardColumns)) {
        overrides.cardColumns = source.cardColumns
    }
    if (isRowHeight(source.rowHeight)) {
        overrides.rowHeight = mapObjectCollectionRowHeightToDashboard(source.rowHeight)
    }

    return overrides
}

export function resolveObjectCollectionRuntimeDashboardLayoutConfig(params: {
    layoutConfig: DashboardLayoutConfig | Record<string, unknown> | undefined
}): DashboardLayoutConfig {
    const { layoutConfig } = params
    const layout = (layoutConfig ?? {}) as Record<string, unknown>
    const { [DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]: _behaviorConfig, ...layoutWithoutBehaviorConfig } = layout
    void _behaviorConfig
    const sparseBehaviorSource = extractObjectCollectionLayoutBehaviorConfig(layout)

    return {
        ...layoutWithoutBehaviorConfig,
        ...resolveObjectRuntimeLayoutOverrides(sparseBehaviorSource)
    }
}
