import {
    DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY,
    defaultLinkedCollectionRuntimeViewConfig,
    type LinkedCollectionLayoutBehaviorConfig,
    type LinkedCollectionRuntimeEditSurface,
    type LinkedCollectionRuntimeRowHeight,
    type LinkedCollectionRuntimeSearchMode,
    type LinkedCollectionRuntimeViewConfig,
    type DashboardViewMode,
    type ResolvedLinkedCollectionRuntimeViewConfig,
    type DashboardLayoutConfig,
    type DashboardLayoutRowHeight
} from '@universo/types'

const isSearchMode = (value: unknown): value is LinkedCollectionRuntimeSearchMode => value === 'server' || value === 'page-local'

const isEditSurface = (value: unknown): value is LinkedCollectionRuntimeEditSurface => value === 'dialog' || value === 'page'

const isRowHeight = (value: unknown): value is LinkedCollectionRuntimeRowHeight =>
    value === 'compact' || value === 'normal' || value === 'auto'

const isDashboardViewMode = (value: unknown): value is DashboardViewMode => value === 'table' || value === 'card'

const isCardColumns = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 4

const resolveBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const hasOwn = (source: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(source, key)

const hasLegacyLayoutOverrides = (source: Record<string, unknown>): boolean =>
    (typeof source.showSearch === 'boolean' && source.showSearch !== defaultLinkedCollectionRuntimeViewConfig.showSearch) ||
    (typeof source.showViewToggle === 'boolean' && source.showViewToggle !== defaultLinkedCollectionRuntimeViewConfig.showViewToggle) ||
    (isDashboardViewMode(source.defaultViewMode) && source.defaultViewMode !== defaultLinkedCollectionRuntimeViewConfig.defaultViewMode) ||
    (isCardColumns(source.cardColumns) && source.cardColumns !== defaultLinkedCollectionRuntimeViewConfig.cardColumns) ||
    (isRowHeight(source.rowHeight) && source.rowHeight !== defaultLinkedCollectionRuntimeViewConfig.rowHeight) ||
    (typeof source.enableRowReordering === 'boolean' &&
        source.enableRowReordering !== defaultLinkedCollectionRuntimeViewConfig.enableRowReordering) ||
    (hasOwn(source, 'reorderPersistenceField') &&
        ((typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0) ||
            source.reorderPersistenceField === null))

const areLayoutOverridesEnabled = (source: Record<string, unknown>): boolean => {
    if (typeof source.useLayoutOverrides === 'boolean') {
        return source.useLayoutOverrides
    }

    return hasLegacyLayoutOverrides(source)
}

export function normalizeLinkedCollectionRuntimeViewConfig(
    config: LinkedCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): ResolvedLinkedCollectionRuntimeViewConfig {
    const source = (config ?? {}) as Record<string, unknown>
    const useLayoutOverrides = areLayoutOverridesEnabled(source)

    return {
        useLayoutOverrides,
        showSearch: resolveBoolean(source.showSearch, defaultLinkedCollectionRuntimeViewConfig.showSearch),
        searchMode: isSearchMode(source.searchMode) ? source.searchMode : defaultLinkedCollectionRuntimeViewConfig.searchMode,
        showCreateButton: resolveBoolean(source.showCreateButton, defaultLinkedCollectionRuntimeViewConfig.showCreateButton),
        showViewToggle: resolveBoolean(source.showViewToggle, defaultLinkedCollectionRuntimeViewConfig.showViewToggle),
        defaultViewMode: isDashboardViewMode(source.defaultViewMode)
            ? source.defaultViewMode
            : defaultLinkedCollectionRuntimeViewConfig.defaultViewMode,
        cardColumns: isCardColumns(source.cardColumns) ? source.cardColumns : defaultLinkedCollectionRuntimeViewConfig.cardColumns,
        rowHeight: isRowHeight(source.rowHeight) ? source.rowHeight : defaultLinkedCollectionRuntimeViewConfig.rowHeight,
        enableRowReordering: resolveBoolean(source.enableRowReordering, defaultLinkedCollectionRuntimeViewConfig.enableRowReordering),
        reorderPersistenceField:
            typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0
                ? source.reorderPersistenceField.trim()
                : defaultLinkedCollectionRuntimeViewConfig.reorderPersistenceField,
        createSurface: isEditSurface(source.createSurface) ? source.createSurface : defaultLinkedCollectionRuntimeViewConfig.createSurface,
        editSurface: isEditSurface(source.editSurface) ? source.editSurface : defaultLinkedCollectionRuntimeViewConfig.editSurface,
        copySurface: isEditSurface(source.copySurface) ? source.copySurface : defaultLinkedCollectionRuntimeViewConfig.copySurface
    }
}

export function sanitizeLinkedCollectionRuntimeViewConfig(
    config: LinkedCollectionRuntimeViewConfig | Record<string, unknown> | undefined
): LinkedCollectionRuntimeViewConfig | undefined {
    const source = (config ?? {}) as Record<string, unknown>
    const sanitized: LinkedCollectionRuntimeViewConfig = {}
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

    if (isSearchMode(source.searchMode) && source.searchMode !== defaultLinkedCollectionRuntimeViewConfig.searchMode) {
        sanitized.searchMode = source.searchMode
    }
    if (
        typeof source.showCreateButton === 'boolean' &&
        source.showCreateButton !== defaultLinkedCollectionRuntimeViewConfig.showCreateButton
    ) {
        sanitized.showCreateButton = source.showCreateButton
    }
    if (isEditSurface(source.createSurface) && source.createSurface !== defaultLinkedCollectionRuntimeViewConfig.createSurface) {
        sanitized.createSurface = source.createSurface
    }
    if (isEditSurface(source.editSurface) && source.editSurface !== defaultLinkedCollectionRuntimeViewConfig.editSurface) {
        sanitized.editSurface = source.editSurface
    }
    if (isEditSurface(source.copySurface) && source.copySurface !== defaultLinkedCollectionRuntimeViewConfig.copySurface) {
        sanitized.copySurface = source.copySurface
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

const mapLinkedCollectionRowHeightToDashboard = (rowHeight: LinkedCollectionRuntimeRowHeight): DashboardLayoutRowHeight | undefined => {
    if (rowHeight === 'auto') return 'auto'
    if (rowHeight === 'normal') return 52
    return undefined
}

export function extractLinkedCollectionLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined | null
): LinkedCollectionLayoutBehaviorConfig | undefined {
    if (!layoutConfig || typeof layoutConfig !== 'object') {
        return undefined
    }

    const value = layoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
    return value && typeof value === 'object' ? sanitizeLinkedCollectionRuntimeViewConfig(value as Record<string, unknown>) : undefined
}

export function setLinkedCollectionLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined,
    behaviorConfig: LinkedCollectionLayoutBehaviorConfig | Record<string, unknown> | undefined
): Record<string, unknown> {
    const nextLayoutConfig = { ...((layoutConfig ?? {}) as Record<string, unknown>) }
    const sanitizedBehaviorConfig = sanitizeLinkedCollectionRuntimeViewConfig(behaviorConfig)

    if (!sanitizedBehaviorConfig) {
        delete nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
        return nextLayoutConfig
    }

    nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY] = sanitizedBehaviorConfig
    return nextLayoutConfig
}

export function resolveLinkedCollectionLayoutBehaviorConfig(params: {
    layoutConfig: Record<string, unknown> | undefined
}): ResolvedLinkedCollectionRuntimeViewConfig {
    const { layoutConfig } = params
    const layoutBehaviorConfig = extractLinkedCollectionLayoutBehaviorConfig(layoutConfig)

    return normalizeLinkedCollectionRuntimeViewConfig(layoutBehaviorConfig)
}

const resolveCatalogRuntimeLayoutOverrides = (
    config: LinkedCollectionRuntimeViewConfig | Record<string, unknown> | undefined
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
        overrides.rowHeight = mapLinkedCollectionRowHeightToDashboard(source.rowHeight)
    }

    return overrides
}

export function resolveLinkedCollectionRuntimeDashboardLayoutConfig(params: {
    layoutConfig: DashboardLayoutConfig | Record<string, unknown> | undefined
}): DashboardLayoutConfig {
    const { layoutConfig } = params
    const layout = (layoutConfig ?? {}) as Record<string, unknown>
    const { [DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]: _behaviorConfig, ...layoutWithoutBehaviorConfig } = layout
    void _behaviorConfig
    const sparseBehaviorSource = extractLinkedCollectionLayoutBehaviorConfig(layout)

    return {
        ...layoutWithoutBehaviorConfig,
        ...resolveCatalogRuntimeLayoutOverrides(sparseBehaviorSource)
    }
}
