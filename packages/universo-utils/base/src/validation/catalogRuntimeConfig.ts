import {
    DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY,
    defaultCatalogRuntimeViewConfig,
    type CatalogLayoutBehaviorConfig,
    type CatalogRuntimeEditSurface,
    type CatalogRuntimeRowHeight,
    type CatalogRuntimeSearchMode,
    type CatalogRuntimeViewConfig,
    type DashboardViewMode,
    type ResolvedCatalogRuntimeViewConfig,
    type DashboardLayoutConfig,
    type DashboardLayoutRowHeight
} from '@universo/types'

const isSearchMode = (value: unknown): value is CatalogRuntimeSearchMode => value === 'server' || value === 'page-local'

const isEditSurface = (value: unknown): value is CatalogRuntimeEditSurface => value === 'dialog' || value === 'page'

const isRowHeight = (value: unknown): value is CatalogRuntimeRowHeight => value === 'compact' || value === 'normal' || value === 'auto'

const isDashboardViewMode = (value: unknown): value is DashboardViewMode => value === 'table' || value === 'card'

const isCardColumns = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 4

const resolveBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const hasOwn = (source: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(source, key)

const hasLegacyLayoutOverrides = (source: Record<string, unknown>): boolean =>
    (typeof source.showSearch === 'boolean' && source.showSearch !== defaultCatalogRuntimeViewConfig.showSearch) ||
    (typeof source.showViewToggle === 'boolean' && source.showViewToggle !== defaultCatalogRuntimeViewConfig.showViewToggle) ||
    (isDashboardViewMode(source.defaultViewMode) && source.defaultViewMode !== defaultCatalogRuntimeViewConfig.defaultViewMode) ||
    (isCardColumns(source.cardColumns) && source.cardColumns !== defaultCatalogRuntimeViewConfig.cardColumns) ||
    (isRowHeight(source.rowHeight) && source.rowHeight !== defaultCatalogRuntimeViewConfig.rowHeight) ||
    (typeof source.enableRowReordering === 'boolean' &&
        source.enableRowReordering !== defaultCatalogRuntimeViewConfig.enableRowReordering) ||
    (hasOwn(source, 'reorderPersistenceField') &&
        ((typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0) ||
            source.reorderPersistenceField === null))

const areLayoutOverridesEnabled = (source: Record<string, unknown>): boolean => {
    if (typeof source.useLayoutOverrides === 'boolean') {
        return source.useLayoutOverrides
    }

    return hasLegacyLayoutOverrides(source)
}

export function normalizeCatalogRuntimeViewConfig(
    config: CatalogRuntimeViewConfig | Record<string, unknown> | undefined
): ResolvedCatalogRuntimeViewConfig {
    const source = (config ?? {}) as Record<string, unknown>
    const useLayoutOverrides = areLayoutOverridesEnabled(source)

    return {
        useLayoutOverrides,
        showSearch: resolveBoolean(source.showSearch, defaultCatalogRuntimeViewConfig.showSearch),
        searchMode: isSearchMode(source.searchMode) ? source.searchMode : defaultCatalogRuntimeViewConfig.searchMode,
        showCreateButton: resolveBoolean(source.showCreateButton, defaultCatalogRuntimeViewConfig.showCreateButton),
        showViewToggle: resolveBoolean(source.showViewToggle, defaultCatalogRuntimeViewConfig.showViewToggle),
        defaultViewMode: isDashboardViewMode(source.defaultViewMode)
            ? source.defaultViewMode
            : defaultCatalogRuntimeViewConfig.defaultViewMode,
        cardColumns: isCardColumns(source.cardColumns) ? source.cardColumns : defaultCatalogRuntimeViewConfig.cardColumns,
        rowHeight: isRowHeight(source.rowHeight) ? source.rowHeight : defaultCatalogRuntimeViewConfig.rowHeight,
        enableRowReordering: resolveBoolean(source.enableRowReordering, defaultCatalogRuntimeViewConfig.enableRowReordering),
        reorderPersistenceField:
            typeof source.reorderPersistenceField === 'string' && source.reorderPersistenceField.trim().length > 0
                ? source.reorderPersistenceField.trim()
                : defaultCatalogRuntimeViewConfig.reorderPersistenceField,
        createSurface: isEditSurface(source.createSurface) ? source.createSurface : defaultCatalogRuntimeViewConfig.createSurface,
        editSurface: isEditSurface(source.editSurface) ? source.editSurface : defaultCatalogRuntimeViewConfig.editSurface,
        copySurface: isEditSurface(source.copySurface) ? source.copySurface : defaultCatalogRuntimeViewConfig.copySurface
    }
}

export function sanitizeCatalogRuntimeViewConfig(
    config: CatalogRuntimeViewConfig | Record<string, unknown> | undefined
): CatalogRuntimeViewConfig | undefined {
    const source = (config ?? {}) as Record<string, unknown>
    const sanitized: CatalogRuntimeViewConfig = {}
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

    if (isSearchMode(source.searchMode) && source.searchMode !== defaultCatalogRuntimeViewConfig.searchMode) {
        sanitized.searchMode = source.searchMode
    }
    if (typeof source.showCreateButton === 'boolean' && source.showCreateButton !== defaultCatalogRuntimeViewConfig.showCreateButton) {
        sanitized.showCreateButton = source.showCreateButton
    }
    if (isEditSurface(source.createSurface) && source.createSurface !== defaultCatalogRuntimeViewConfig.createSurface) {
        sanitized.createSurface = source.createSurface
    }
    if (isEditSurface(source.editSurface) && source.editSurface !== defaultCatalogRuntimeViewConfig.editSurface) {
        sanitized.editSurface = source.editSurface
    }
    if (isEditSurface(source.copySurface) && source.copySurface !== defaultCatalogRuntimeViewConfig.copySurface) {
        sanitized.copySurface = source.copySurface
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

const mapCatalogRowHeightToDashboard = (rowHeight: CatalogRuntimeRowHeight): DashboardLayoutRowHeight | undefined => {
    if (rowHeight === 'auto') return 'auto'
    if (rowHeight === 'normal') return 52
    return undefined
}

export function extractCatalogLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined | null
): CatalogLayoutBehaviorConfig | undefined {
    if (!layoutConfig || typeof layoutConfig !== 'object') {
        return undefined
    }

    const value = layoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
    return value && typeof value === 'object' ? sanitizeCatalogRuntimeViewConfig(value as Record<string, unknown>) : undefined
}

export function setCatalogLayoutBehaviorConfig(
    layoutConfig: Record<string, unknown> | undefined,
    behaviorConfig: CatalogLayoutBehaviorConfig | Record<string, unknown> | undefined
): Record<string, unknown> {
    const nextLayoutConfig = { ...((layoutConfig ?? {}) as Record<string, unknown>) }
    const sanitizedBehaviorConfig = sanitizeCatalogRuntimeViewConfig(behaviorConfig)

    if (!sanitizedBehaviorConfig) {
        delete nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]
        return nextLayoutConfig
    }

    nextLayoutConfig[DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY] = sanitizedBehaviorConfig
    return nextLayoutConfig
}

export function resolveCatalogLayoutBehaviorConfig(params: {
    layoutConfig: Record<string, unknown> | undefined
}): ResolvedCatalogRuntimeViewConfig {
    const { layoutConfig } = params
    const layoutBehaviorConfig = extractCatalogLayoutBehaviorConfig(layoutConfig)

    return normalizeCatalogRuntimeViewConfig(layoutBehaviorConfig)
}

const resolveCatalogRuntimeLayoutOverrides = (
    config: CatalogRuntimeViewConfig | Record<string, unknown> | undefined
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
        overrides.rowHeight = mapCatalogRowHeightToDashboard(source.rowHeight)
    }

    return overrides
}

export function resolveCatalogRuntimeDashboardLayoutConfig(params: {
    layoutConfig: DashboardLayoutConfig | Record<string, unknown> | undefined
}): DashboardLayoutConfig {
    const { layoutConfig } = params
    const layout = (layoutConfig ?? {}) as Record<string, unknown>
    const { [DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY]: _behaviorConfig, ...layoutWithoutBehaviorConfig } = layout
    void _behaviorConfig
    const sparseBehaviorSource = extractCatalogLayoutBehaviorConfig(layout)

    return {
        ...layoutWithoutBehaviorConfig,
        ...resolveCatalogRuntimeLayoutOverrides(sparseBehaviorSource)
    }
}
