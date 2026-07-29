import {
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    normalizeInterpretationNetworkTemplatePanelSettings,
    parseInterpretationNetworkStructureMode,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'
import type { InterpretationNetworkMatrixSettings } from '../application-settings/MatrixSettingsPanel'

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

export const parseInterpretationNetworkMatrixSettings = (
    config: Record<string, unknown> | null | undefined
): InterpretationNetworkMatrixSettings => {
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
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(config?.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(config?.templatePanel)
    }
}

export const normalizeInterpretationNetworkMatrixSettingsForSave = (
    settings: InterpretationNetworkMatrixSettings
): InterpretationNetworkMatrixSettings => {
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
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(settings.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(settings.templatePanel)
    }
}

export const areInterpretationNetworkMatrixSettingsEqual = (
    left: InterpretationNetworkMatrixSettings,
    right: InterpretationNetworkMatrixSettings
): boolean =>
    left.structureMode === right.structureMode &&
    left.matrixMode === right.matrixMode &&
    left.allowedMatrixViews.length === right.allowedMatrixViews.length &&
    left.allowedMatrixViews.every((view, index) => view === right.allowedMatrixViews[index]) &&
    left.defaultMatrixView === right.defaultMatrixView &&
    left.tableProjection === right.tableProjection &&
    left.breadcrumbDepth.mode === right.breadcrumbDepth.mode &&
    (left.breadcrumbDepth.mode !== 'last' ||
        (right.breadcrumbDepth.mode === 'last' && left.breadcrumbDepth.count === right.breadcrumbDepth.count)) &&
    left.toolbarLayout === right.toolbarLayout &&
    left.showHierarchicalTableHeaders === right.showHierarchicalTableHeaders &&
    left.showHierarchicalTableHeaderCard === right.showHierarchicalTableHeaderCard &&
    left.showMatrixTreeTotalCells === right.showMatrixTreeTotalCells &&
    left.colorBreadcrumbsByCell === right.colorBreadcrumbsByCell &&
    left.hierarchyRowMode === right.hierarchyRowMode &&
    left.allowNewAxesInCellDialog === right.allowNewAxesInCellDialog &&
    left.splitPane.enabled === right.splitPane.enabled &&
    left.templatePanel.showInStructureList === right.templatePanel.showInStructureList &&
    left.templatePanel.showInMatrix === right.templatePanel.showInMatrix &&
    left.positionNumbering.enabled === right.positionNumbering.enabled &&
    left.positionNumbering.includeRoot === right.positionNumbering.includeRoot &&
    left.positionNumbering.startIndex === right.positionNumbering.startIndex

export const mergeInterpretationNetworkMatrixSettings = (
    config: Record<string, unknown> | null | undefined,
    settings: InterpretationNetworkMatrixSettings
): InterpretationNetworkWorkspaceWidgetConfig => {
    const normalized = normalizeInterpretationNetworkMatrixSettingsForSave(settings)

    return {
        ...(config ?? {}),
        structureMode: normalized.structureMode,
        matrixMode: normalized.matrixMode,
        allowedMatrixViews: normalized.allowedMatrixViews,
        defaultMatrixView: normalized.defaultMatrixView,
        tableProjection: normalized.tableProjection,
        breadcrumbDepth: normalized.breadcrumbDepth,
        toolbarLayout: normalized.toolbarLayout,
        showHierarchicalTableHeaders: normalized.showHierarchicalTableHeaders,
        showHierarchicalTableHeaderCard: normalized.showHierarchicalTableHeaderCard,
        showMatrixTreeTotalCells: normalized.showMatrixTreeTotalCells,
        colorBreadcrumbsByCell: normalized.colorBreadcrumbsByCell,
        hierarchyRowMode: normalized.hierarchyRowMode,
        positionNumbering: normalized.positionNumbering,
        allowNewAxesInCellDialog: normalized.allowNewAxesInCellDialog,
        splitPane: normalized.splitPane,
        templatePanel: normalized.templatePanel
    }
}
