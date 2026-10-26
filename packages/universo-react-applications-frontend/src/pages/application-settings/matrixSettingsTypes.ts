import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type {
    InterpretationNetworkBreadcrumbDepth,
    InterpretationNetworkCellStylePolicy,
    InterpretationNetworkHierarchyRowMode,
    InterpretationNetworkMatrixMode,
    InterpretationNetworkMatrixView,
    InterpretationNetworkSplitPaneSettings,
    InterpretationNetworkStructureMode,
    InterpretationNetworkTableProjection,
    InterpretationNetworkTemplatePanelSettings,
    InterpretationNetworkToolbarLayout
} from '@universo-react/types'

export type InterpretationNetworkPositionNumberingSettings = {
    enabled: boolean
    includeRoot: boolean
    startIndex: number
}

export type InterpretationNetworkMatrixSettings = {
    structureMode: InterpretationNetworkStructureMode
    matrixMode: InterpretationNetworkMatrixMode
    allowedMatrixViews: InterpretationNetworkMatrixView[]
    defaultMatrixView: InterpretationNetworkMatrixView
    tableProjection: InterpretationNetworkTableProjection
    breadcrumbDepth: InterpretationNetworkBreadcrumbDepth
    toolbarLayout: InterpretationNetworkToolbarLayout
    showHierarchicalTableHeaders: boolean
    showHierarchicalTableHeaderCard: boolean
    showMatrixTreeTotalCells: boolean
    colorBreadcrumbsByCell: boolean
    hierarchyRowMode: InterpretationNetworkHierarchyRowMode
    positionNumbering: InterpretationNetworkPositionNumberingSettings
    allowNewAxesInCellDialog: boolean
    splitPane: InterpretationNetworkSplitPaneSettings
    templatePanel: InterpretationNetworkTemplatePanelSettings
    cellStylePolicy: InterpretationNetworkCellStylePolicy
}

export type MatrixSettingsTranslate = TFunction<'applications'>

export interface MatrixSettingsRowsProps {
    t: MatrixSettingsTranslate
    isSaving: boolean
    localSettings: InterpretationNetworkMatrixSettings
    setLocalSettings: Dispatch<SetStateAction<InterpretationNetworkMatrixSettings>>
}
