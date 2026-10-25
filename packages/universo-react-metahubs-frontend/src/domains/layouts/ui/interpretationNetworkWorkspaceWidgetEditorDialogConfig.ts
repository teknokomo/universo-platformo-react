import type { Dispatch, SetStateAction } from 'react'
import {
    interpretationNetworkCellStylePolicySchema,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    normalizeInterpretationNetworkTemplatePanelSettings,
    parseInterpretationNetworkStructureMode,
    type InterpretationNetworkCellStylePolicy,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'

export const MATRIX_VIEW_FALLBACK_LABELS: Record<InterpretationNetworkMatrixView, string> = {
    table: 'Table view',
    horizontalRows: 'Horizontal rows',
    verticalTree: 'Vertical tree'
}

export const MATRIX_MODE_FALLBACK_LABELS: Record<InterpretationNetworkMatrixMode, string> = {
    hierarchicalCells: 'Hierarchical cells',
    independentRows: 'Separate rows and columns'
}

export const normalizeCellStyleColor = (value: unknown): string | undefined => {
    const defaults = interpretationNetworkCellStylePolicySchema.parse(undefined)
    const parsed = interpretationNetworkCellStylePolicySchema.safeParse({
        ...defaults,
        allowedColors: [value]
    })

    return parsed.success ? parsed.data.allowedColors[0] : undefined
}

export const normalizeCellStylePolicy = (value: unknown): InterpretationNetworkCellStylePolicy => {
    const defaults = interpretationNetworkCellStylePolicySchema.parse(undefined)
    const source =
        value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<InterpretationNetworkCellStylePolicy>) : {}
    const sourceColors = Array.isArray(source.allowedColors) ? source.allowedColors : defaults.allowedColors
    const normalizedColors = sourceColors.map(normalizeCellStyleColor)
    if (normalizedColors.some((color) => color === undefined)) return defaults
    const allowedColors = Array.from(new Set(normalizedColors))
    const sourceEditable =
        source.editable !== null && typeof source.editable === 'object' && !Array.isArray(source.editable) ? source.editable : {}
    const parsed = interpretationNetworkCellStylePolicySchema.safeParse({
        allowedColors,
        allowCustomColors: typeof source.allowCustomColors === 'boolean' ? source.allowCustomColors : defaults.allowCustomColors,
        editable: { ...defaults.editable, ...sourceEditable }
    })

    return parsed.success ? parsed.data : defaults
}

export const normalizeConfig = (config?: InterpretationNetworkWorkspaceWidgetConfig | null): InterpretationNetworkWorkspaceWidgetConfig => {
    const current = { ...(config ?? {}) } as InterpretationNetworkWorkspaceWidgetConfig & { sharedBehavior?: unknown }
    delete current.sharedBehavior
    const matrixMode = current.matrixMode ?? 'hierarchicalCells'
    const defaultAllowedMatrixViews: InterpretationNetworkMatrixView[] =
        matrixMode === 'hierarchicalCells' ? ['table', 'horizontalRows', 'verticalTree'] : ['table', 'horizontalRows']
    const viewSettings = normalizeInterpretationNetworkMatrixViewSettings(
        matrixMode,
        current.allowedMatrixViews ?? defaultAllowedMatrixViews,
        current.defaultMatrixView ?? 'table'
    )

    return {
        ...current,
        structureMode: parseInterpretationNetworkStructureMode(current.structureMode),
        ...viewSettings,
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(current.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(current.templatePanel),
        ...normalizeInterpretationNetworkTableSettings(
            matrixMode,
            current.tableProjection,
            current.breadcrumbDepth,
            current.toolbarLayout,
            current.showHierarchicalTableHeaders,
            current.showHierarchicalTableHeaderCard,
            current.showMatrixTreeTotalCells,
            current.colorBreadcrumbsByCell
        ),
        cellStylePolicy: normalizeCellStylePolicy(current.cellStylePolicy),
        allowNewAxesInCellDialog: current.allowNewAxesInCellDialog === true
    }
}

export type InterpretationNetworkWorkspaceWidgetConfigDraftSetter = Dispatch<SetStateAction<InterpretationNetworkWorkspaceWidgetConfig>>
