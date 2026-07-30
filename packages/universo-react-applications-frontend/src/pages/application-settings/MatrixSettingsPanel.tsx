import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Stack } from '@mui/material'
import type { TFunction } from 'i18next'
import {
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    normalizeInterpretationNetworkTemplatePanelSettings,
    type InterpretationNetworkBreadcrumbDepth,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkStructureMode,
    type InterpretationNetworkSplitPaneSettings,
    type InterpretationNetworkTemplatePanelSettings,
    type InterpretationNetworkTableProjection,
    type InterpretationNetworkToolbarLayout
} from '@universo-react/types'
import { SaveSettingsButton } from './SettingsPanels'
import {
    MatrixBehaviorRows,
    MatrixHierarchyRows,
    MatrixStructureAndTemplateRows,
    MatrixTableOptionRows,
    MatrixViewRows
} from './MatrixSettingsRows'

type Translate = TFunction<'applications'>

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
}

const normalizeMatrixPanelSettings = (settings: InterpretationNetworkMatrixSettings): InterpretationNetworkMatrixSettings => {
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
        structureMode: settings.structureMode === 'singleSystem' ? 'singleSystem' : 'multiple',
        ...viewSettings,
        ...tableSettings,
        positionNumbering: {
            enabled: settings.positionNumbering.enabled,
            includeRoot: settings.positionNumbering.includeRoot,
            startIndex: settings.positionNumbering.startIndex
        },
        allowNewAxesInCellDialog: settings.allowNewAxesInCellDialog === true,
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(settings.splitPane),
        templatePanel: normalizeInterpretationNetworkTemplatePanelSettings(settings.templatePanel)
    }
}

const hasMatrixSettingsChanged = (
    localSettings: InterpretationNetworkMatrixSettings,
    normalizedSettings: InterpretationNetworkMatrixSettings,
    hasDivergentSettings: boolean
) =>
    hasDivergentSettings ||
    localSettings.structureMode !== normalizedSettings.structureMode ||
    localSettings.matrixMode !== normalizedSettings.matrixMode ||
    localSettings.allowedMatrixViews.length !== normalizedSettings.allowedMatrixViews.length ||
    localSettings.allowedMatrixViews.some((view, index) => view !== normalizedSettings.allowedMatrixViews[index]) ||
    localSettings.defaultMatrixView !== normalizedSettings.defaultMatrixView ||
    localSettings.tableProjection !== normalizedSettings.tableProjection ||
    localSettings.breadcrumbDepth.mode !== normalizedSettings.breadcrumbDepth.mode ||
    (localSettings.breadcrumbDepth.mode === 'last' &&
        (normalizedSettings.breadcrumbDepth.mode !== 'last' ||
            localSettings.breadcrumbDepth.count !== normalizedSettings.breadcrumbDepth.count)) ||
    localSettings.toolbarLayout !== normalizedSettings.toolbarLayout ||
    localSettings.showHierarchicalTableHeaders !== normalizedSettings.showHierarchicalTableHeaders ||
    localSettings.showHierarchicalTableHeaderCard !== normalizedSettings.showHierarchicalTableHeaderCard ||
    localSettings.showMatrixTreeTotalCells !== normalizedSettings.showMatrixTreeTotalCells ||
    localSettings.colorBreadcrumbsByCell !== normalizedSettings.colorBreadcrumbsByCell ||
    localSettings.hierarchyRowMode !== normalizedSettings.hierarchyRowMode ||
    localSettings.allowNewAxesInCellDialog !== normalizedSettings.allowNewAxesInCellDialog ||
    localSettings.splitPane.enabled !== normalizedSettings.splitPane.enabled ||
    localSettings.templatePanel.showInStructureList !== normalizedSettings.templatePanel.showInStructureList ||
    localSettings.templatePanel.showInMatrix !== normalizedSettings.templatePanel.showInMatrix ||
    localSettings.positionNumbering.enabled !== normalizedSettings.positionNumbering.enabled ||
    localSettings.positionNumbering.includeRoot !== normalizedSettings.positionNumbering.includeRoot ||
    localSettings.positionNumbering.startIndex !== normalizedSettings.positionNumbering.startIndex

export const MatrixSettingsPanel = ({
    t,
    settings,
    hasDivergentSettings,
    isSaving,
    onSave,
    renderSaveButton = true,
    onDraftChange,
    showResetButton = false,
    isResetting = false,
    onReset
}: {
    t: Translate
    settings: InterpretationNetworkMatrixSettings
    hasDivergentSettings: boolean
    isSaving: boolean
    onSave: (settings: InterpretationNetworkMatrixSettings) => void
    renderSaveButton?: boolean
    onDraftChange?: (settings: InterpretationNetworkMatrixSettings, hasChanges: boolean) => void
    showResetButton?: boolean
    isResetting?: boolean
    onReset?: () => void
}) => {
    const normalizedSettings = useMemo(() => normalizeMatrixPanelSettings(settings), [settings])
    const [localSettings, setLocalSettings] = useState(() => normalizedSettings)

    useEffect(() => {
        setLocalSettings(normalizedSettings)
    }, [normalizedSettings])

    const hasChanges = useMemo(
        () => hasMatrixSettingsChanged(localSettings, normalizedSettings, hasDivergentSettings),
        [hasDivergentSettings, localSettings, normalizedSettings]
    )

    useEffect(() => {
        onDraftChange?.(localSettings, hasChanges)
    }, [hasChanges, localSettings, onDraftChange])

    return (
        <Stack spacing={2}>
            <Alert severity='info'>
                {t('settings.matrixHint', 'Configure the interpretation matrix workspace installed in this application layout.')}
            </Alert>
            {hasDivergentSettings ? (
                <Alert severity='warning' data-testid='application-settings-matrix-divergence-warning'>
                    {t(
                        'settings.matrix.divergentSettings',
                        'Active Matrix widgets currently use different settings. Saving will normalize every active widget to the values shown here.'
                    )}
                </Alert>
            ) : null}

            <Stack spacing={0} divider={<Divider />}>
                <MatrixStructureAndTemplateRows
                    t={t}
                    isSaving={isSaving}
                    localSettings={localSettings}
                    setLocalSettings={setLocalSettings}
                />
                <MatrixViewRows t={t} isSaving={isSaving} localSettings={localSettings} setLocalSettings={setLocalSettings} />
                <MatrixTableOptionRows t={t} isSaving={isSaving} localSettings={localSettings} setLocalSettings={setLocalSettings} />
                <MatrixHierarchyRows t={t} isSaving={isSaving} localSettings={localSettings} setLocalSettings={setLocalSettings} />
                <MatrixBehaviorRows t={t} isSaving={isSaving} localSettings={localSettings} setLocalSettings={setLocalSettings} />
            </Stack>

            {renderSaveButton && hasChanges ? (
                <SaveSettingsButton
                    testId='application-settings-matrix-save'
                    t={t}
                    disabled={isSaving}
                    onSave={() => onSave(localSettings)}
                />
            ) : null}
            {showResetButton ? (
                <Button
                    data-testid='application-settings-matrix-reset'
                    variant='outlined'
                    disabled={isSaving || isResetting}
                    onClick={onReset}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    {t('settings.matrix.reset', 'Restore metahub settings')}
                </Button>
            ) : null}
        </Stack>
    )
}
