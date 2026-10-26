import {
    normalizeInterpretationNetworkCellStylePolicy,
    normalizeInterpretationNetworkMatrixViewSettings,
    parseInterpretationNetworkStructureMode,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTemplatePanelSettings,
    normalizeInterpretationNetworkTableSettings
} from '@universo-react/types'
import type { ApplicationLayout, ApplicationLayoutWidget } from '@universo-react/types'
import type { SchemaStatus } from '../../types'
import type { InterpretationNetworkMatrixSettings } from './MatrixSettingsPanel'

export type MaterializedApplicationLayoutState = {
    layouts: ApplicationLayout[]
    widgets: Array<ApplicationLayoutWidget & { layout: ApplicationLayout }>
}

const RUNTIME_SCHEMA_READY_STATUSES = new Set<SchemaStatus | 'ready'>([
    'synced',
    'outdated',
    'update_available',
    'maintenance',
    'error',
    'ready'
])

export const hasInitializedRuntimeSchema = (schemaName?: string | null, schemaStatus?: SchemaStatus | null): boolean => {
    if (!schemaName) {
        return false
    }

    if (!schemaStatus) {
        return false
    }

    return RUNTIME_SCHEMA_READY_STATUSES.has(schemaStatus as SchemaStatus | 'ready')
}

export const isActiveMaterializedLayout = (layout: ApplicationLayout): boolean => layout.isActive && !layout.isSourceExcluded

const isActiveMaterializedWidget = (widget: ApplicationLayoutWidget & { layout: ApplicationLayout }): boolean =>
    widget.isActive && isActiveMaterializedLayout(widget.layout)

const hasNestedLearningContentWidget = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(hasNestedLearningContentWidget)

    const record = value as Record<string, unknown>
    if (record.isActive !== false && record.widgetKey === 'learnerPlayer') return true
    if (record.learningContent !== undefined) return true
    return Object.values(record).some(hasNestedLearningContentWidget)
}

export const hasLearningContentMaterializedState = (state?: MaterializedApplicationLayoutState): boolean =>
    (state?.widgets ?? []).some(
        (widget) =>
            isActiveMaterializedWidget(widget) &&
            (widget.widgetKey === 'learnerPlayer' ||
                widget.config?.learningContent !== undefined ||
                hasNestedLearningContentWidget(widget.config))
    )

export const hasMatrixMaterializedState = (state?: MaterializedApplicationLayoutState): boolean =>
    (state?.widgets ?? []).some((widget) => isActiveMaterializedWidget(widget) && widget.widgetKey === 'interpretationNetworkWorkspace')

export const listInterpretationNetworkWidgets = (
    state?: MaterializedApplicationLayoutState
): Array<ApplicationLayoutWidget & { layout: ApplicationLayout }> =>
    (state?.widgets ?? []).filter((widget) => isActiveMaterializedWidget(widget) && widget.widgetKey === 'interpretationNetworkWorkspace')

export const listWritableInterpretationNetworkWidgets = (
    state?: MaterializedApplicationLayoutState
): Array<ApplicationLayoutWidget & { layout: ApplicationLayout }> => listInterpretationNetworkWidgets(state)

const parseMatrixMode = (value: unknown): InterpretationNetworkMatrixSettings['matrixMode'] =>
    value === 'independentRows' || value === 'hierarchicalCells' ? value : 'hierarchicalCells'

const parseHierarchyRowMode = (value: unknown): InterpretationNetworkMatrixSettings['hierarchyRowMode'] =>
    value === 'allNodes' || value === 'focusedPath' ? value : 'focusedPath'

const parsePositionNumbering = (value: unknown): InterpretationNetworkMatrixSettings['positionNumbering'] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { enabled: true, includeRoot: true, startIndex: 1 }
    }
    const record = value as Record<string, unknown>
    const startIndex = record.startIndex
    return {
        enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
        includeRoot: typeof record.includeRoot === 'boolean' ? record.includeRoot : true,
        startIndex: typeof startIndex === 'number' && Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 1
    }
}

export const parseMatrixSettings = (config: Record<string, unknown> | null | undefined): InterpretationNetworkMatrixSettings => {
    const matrixMode = parseMatrixMode(config?.matrixMode)
    const requestedViews = Array.isArray(config?.allowedMatrixViews) ? config.allowedMatrixViews : undefined
    const defaultAllowedMatrixViews =
        matrixMode === 'hierarchicalCells' ? (['table', 'horizontalRows', 'verticalTree'] as const) : (['table', 'horizontalRows'] as const)
    const tableSettings = normalizeInterpretationNetworkTableSettings(
        matrixMode,
        config?.tableProjection,
        config?.breadcrumbDepth,
        config?.toolbarLayout,
        config?.showHierarchicalTableHeaders,
        config?.showHierarchicalTableHeaderCard,
        config?.showMatrixTreeTotalCells,
        config?.colorBreadcrumbsByCell
    )

    return {
        structureMode: parseInterpretationNetworkStructureMode(config?.structureMode),
        matrixMode,
        ...normalizeInterpretationNetworkMatrixViewSettings(
            matrixMode,
            requestedViews ?? defaultAllowedMatrixViews,
            config?.defaultMatrixView ?? 'table'
        ),
        tableProjection: tableSettings.tableProjection,
        breadcrumbDepth: tableSettings.breadcrumbDepth,
        toolbarLayout: tableSettings.toolbarLayout,
        showHierarchicalTableHeaders: tableSettings.showHierarchicalTableHeaders,
        showHierarchicalTableHeaderCard: tableSettings.showHierarchicalTableHeaderCard,
        showMatrixTreeTotalCells: tableSettings.showMatrixTreeTotalCells,
        colorBreadcrumbsByCell: tableSettings.colorBreadcrumbsByCell,
        hierarchyRowMode: parseHierarchyRowMode(config?.hierarchyRowMode),
        positionNumbering: parsePositionNumbering(config?.positionNumbering),
        allowNewAxesInCellDialog: config?.allowNewAxesInCellDialog === true,
        cellStylePolicy: normalizeInterpretationNetworkCellStylePolicy(config?.cellStylePolicy),
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(config?.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(config?.templatePanel)
    }
}

const INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS = new Set([
    'moduleCodename',
    'attachedToKind',
    'mountMethodName',
    'emptyStateTitle',
    'emptyStateDescription',
    'serverModuleCodename',
    'structureMode',
    'matrixMode',
    'allowedMatrixViews',
    'defaultMatrixView',
    'tableProjection',
    'breadcrumbDepth',
    'toolbarLayout',
    'showHierarchicalTableHeaders',
    'showHierarchicalTableHeaderCard',
    'showMatrixTreeTotalCells',
    'colorBreadcrumbsByCell',
    'hierarchyRowMode',
    'positionNumbering',
    'allowNewAxesInCellDialog',
    'cellStylePolicy',
    'splitPane',
    'templatePanel',
    'conceptCodename',
    'conceptNameField',
    'conceptDescriptionField',
    'interpretationCodename',
    'interpretationParentField',
    'matrixField',
    'relationCodename',
    'materialCodename',
    'materialTitleField',
    'interpretationTitleField',
    'tableTemplateCodename',
    'tableTemplateNameField',
    'tableTemplateDescriptionField',
    'tableTemplateMatrixField'
])

export const sanitizeWidgetConfigForSave = (config: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(config ?? {}).filter(([key, value]) => value !== undefined && INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS.has(key))
    )
}

export const normalizeMatrixSettingsForSave = (settings: InterpretationNetworkMatrixSettings): InterpretationNetworkMatrixSettings => {
    const viewSettings = normalizeInterpretationNetworkMatrixViewSettings(
        settings.matrixMode,
        settings.allowedMatrixViews,
        settings.defaultMatrixView
    )
    const tableSettings = normalizeInterpretationNetworkTableSettings(
        settings.matrixMode,
        settings.tableProjection,
        settings.breadcrumbDepth,
        settings.toolbarLayout,
        settings.showHierarchicalTableHeaders,
        settings.showHierarchicalTableHeaderCard,
        settings.showMatrixTreeTotalCells,
        settings.colorBreadcrumbsByCell
    )

    return {
        ...settings,
        ...viewSettings,
        ...tableSettings,
        cellStylePolicy: normalizeInterpretationNetworkCellStylePolicy(settings.cellStylePolicy),
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(settings.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(settings.templatePanel)
    }
}
