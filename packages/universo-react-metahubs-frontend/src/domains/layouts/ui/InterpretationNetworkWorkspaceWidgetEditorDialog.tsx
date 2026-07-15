import { useEffect, useId, useState } from 'react'
import {
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntityFormDialog } from '@universo-react/template-mui'
import {
    interpretationNetworkBreadcrumbDepthCounts,
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkTableProjection,
    type InterpretationNetworkToolbarLayout,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'

import LayoutWidgetSharedBehaviorFields from './LayoutWidgetSharedBehaviorFields'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

export interface InterpretationNetworkWorkspaceWidgetEditorDialogProps {
    open: boolean
    config?: InterpretationNetworkWorkspaceWidgetConfig | null
    metahubId?: string | null
    layoutId?: string | null
    widgetId?: string | null
    showSharedBehavior?: boolean
    showScopeVisibility?: boolean
    onSave: (config: InterpretationNetworkWorkspaceWidgetConfig) => void
    onCancel: () => void
}

const MATRIX_VIEW_FALLBACK_LABELS: Record<InterpretationNetworkMatrixView, string> = {
    table: 'Table view',
    horizontalRows: 'Horizontal rows',
    verticalTree: 'Vertical tree'
}

const MATRIX_MODE_FALLBACK_LABELS: Record<InterpretationNetworkMatrixMode, string> = {
    hierarchicalCells: 'Hierarchical cells',
    independentRows: 'Separate rows and columns'
}

const normalizeConfig = (config?: InterpretationNetworkWorkspaceWidgetConfig | null): InterpretationNetworkWorkspaceWidgetConfig => {
    const current = config ?? {}
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
        ...viewSettings,
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(current.splitPane),
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
        allowNewAxesInCellDialog: current.allowNewAxesInCellDialog === true
    }
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialog({
    open,
    config,
    metahubId,
    layoutId,
    widgetId,
    showSharedBehavior = false,
    showScopeVisibility = false,
    onSave,
    onCancel
}: InterpretationNetworkWorkspaceWidgetEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const defaultMatrixViewLabelId = useId()
    const [draft, setDraft] = useState<InterpretationNetworkWorkspaceWidgetConfig>(() => normalizeConfig(config))

    useEffect(() => {
        if (open) {
            setDraft(normalizeConfig(config))
        }
    }, [config, open])

    const viewSettings = normalizeInterpretationNetworkMatrixViewSettings(
        draft.matrixMode ?? 'hierarchicalCells',
        draft.allowedMatrixViews,
        draft.defaultMatrixView
    )
    const tableSettings = normalizeInterpretationNetworkTableSettings(
        draft.matrixMode ?? 'hierarchicalCells',
        draft.tableProjection,
        draft.breadcrumbDepth,
        draft.toolbarLayout,
        draft.showHierarchicalTableHeaders,
        draft.showHierarchicalTableHeaderCard,
        draft.showMatrixTreeTotalCells,
        draft.colorBreadcrumbsByCell
    )

    const setViewAllowed = (view: InterpretationNetworkMatrixView, allowed: boolean) => {
        setDraft((current) => {
            const currentSettings = normalizeInterpretationNetworkMatrixViewSettings(
                current.matrixMode ?? 'hierarchicalCells',
                current.allowedMatrixViews,
                current.defaultMatrixView
            )
            const requestedViews = allowed
                ? [...currentSettings.allowedMatrixViews, view]
                : currentSettings.allowedMatrixViews.filter((item) => item !== view)
            return {
                ...current,
                ...normalizeInterpretationNetworkMatrixViewSettings(
                    current.matrixMode ?? 'hierarchicalCells',
                    requestedViews,
                    currentSettings.defaultMatrixView
                )
            }
        })
    }

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.interpretationNetworkEditor.title', 'Interpretation network workspace')}
            mode='edit'
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(normalizeConfig(draft))}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Stack spacing={0.5}>
                        <Typography variant='subtitle2'>{t('layouts.interpretationNetworkEditor.displayTitle', 'Matrix views')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'layouts.interpretationNetworkEditor.description',
                                'Choose which matrix views are available in the published application and which view opens by default.'
                            )}
                        </Typography>
                    </Stack>

                    <FormControl fullWidth>
                        <InputLabel id={`${defaultMatrixViewLabelId}-matrix-mode`}>
                            {t('layouts.interpretationNetworkEditor.matrixMode', 'Matrix mode')}
                        </InputLabel>
                        <Select
                            labelId={`${defaultMatrixViewLabelId}-matrix-mode`}
                            value={draft.matrixMode ?? 'hierarchicalCells'}
                            label={t('layouts.interpretationNetworkEditor.matrixMode', 'Matrix mode')}
                            onChange={(event) => {
                                const matrixMode = event.target.value as InterpretationNetworkMatrixMode
                                setDraft((current) => ({
                                    ...current,
                                    matrixMode,
                                    ...normalizeInterpretationNetworkMatrixViewSettings(
                                        matrixMode,
                                        current.allowedMatrixViews,
                                        current.defaultMatrixView
                                    ),
                                    ...normalizeInterpretationNetworkTableSettings(
                                        matrixMode,
                                        matrixMode === 'independentRows' ? 'independentAxes' : 'hierarchicalPath',
                                        current.breadcrumbDepth,
                                        current.toolbarLayout,
                                        current.showHierarchicalTableHeaders,
                                        current.showHierarchicalTableHeaderCard,
                                        current.showMatrixTreeTotalCells,
                                        current.colorBreadcrumbsByCell
                                    )
                                }))
                            }}
                        >
                            {(['hierarchicalCells', 'independentRows'] as const).map((mode) => (
                                <MenuItem key={mode} value={mode}>
                                    {t(`layouts.interpretationNetworkEditor.matrixModes.${mode}`, MATRIX_MODE_FALLBACK_LABELS[mode])}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.matrixModeHelp',
                                'Hierarchical cells are the default. Separate rows and columns keep the secondary Matrix table mode available.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <Stack spacing={0.25}>
                        {interpretationNetworkMatrixViews.map((view) => {
                            const supported = (draft.matrixMode ?? 'hierarchicalCells') === 'hierarchicalCells' || view !== 'verticalTree'
                            const checked = viewSettings.allowedMatrixViews.includes(view)
                            return (
                                <FormControlLabel
                                    key={view}
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox
                                            checked={checked}
                                            onChange={(_, nextChecked) => setViewAllowed(view, nextChecked)}
                                            disabled={!supported || (checked && viewSettings.allowedMatrixViews.length === 1)}
                                            inputProps={{
                                                'aria-label': t(
                                                    `layouts.interpretationNetworkEditor.views.${view}`,
                                                    MATRIX_VIEW_FALLBACK_LABELS[view]
                                                )
                                            }}
                                        />
                                    }
                                    label={t(`layouts.interpretationNetworkEditor.views.${view}`, MATRIX_VIEW_FALLBACK_LABELS[view])}
                                />
                            )
                        })}
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.availableViewsHelp',
                                'Select at least one Matrix view. Vertical tree requires hierarchical cells.'
                            )}
                        </FormHelperText>
                    </Stack>

                    <FormControl fullWidth>
                        <InputLabel id={defaultMatrixViewLabelId}>
                            {t('layouts.interpretationNetworkEditor.defaultMatrixView', 'Default view')}
                        </InputLabel>
                        <Select
                            labelId={defaultMatrixViewLabelId}
                            value={viewSettings.defaultMatrixView}
                            label={t('layouts.interpretationNetworkEditor.defaultMatrixView', 'Default view')}
                            onChange={(event) => {
                                const defaultMatrixView = event.target.value as InterpretationNetworkMatrixView
                                setDraft((current) => ({
                                    ...current,
                                    defaultMatrixView
                                }))
                            }}
                        >
                            {viewSettings.allowedMatrixViews.map((view) => (
                                <MenuItem key={view} value={view}>
                                    {t(`layouts.interpretationNetworkEditor.views.${view}`, MATRIX_VIEW_FALLBACK_LABELS[view])}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.defaultMatrixViewHelp',
                                'This view opens first unless a user has already chosen another available view.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel id={`${defaultMatrixViewLabelId}-table-projection`}>
                            {t('layouts.interpretationNetworkEditor.tableProjection', 'Table projection')}
                        </InputLabel>
                        <Select
                            labelId={`${defaultMatrixViewLabelId}-table-projection`}
                            value={tableSettings.tableProjection}
                            label={t('layouts.interpretationNetworkEditor.tableProjection', 'Table projection')}
                            disabled={(draft.matrixMode ?? 'hierarchicalCells') === 'independentRows'}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    tableProjection: event.target.value as InterpretationNetworkTableProjection
                                }))
                            }
                        >
                            <MenuItem value='hierarchicalPath'>
                                {t('layouts.interpretationNetworkEditor.tableProjections.hierarchicalPath', 'Hierarchy path')}
                            </MenuItem>
                            <MenuItem value='independentAxes'>
                                {t('layouts.interpretationNetworkEditor.tableProjections.independentAxes', 'Separate axes')}
                            </MenuItem>
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.tableProjectionHelp',
                                'Hierarchical path is the default table projection. Separate axes keep the row and column table behavior available.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <FormControl fullWidth>
                            <InputLabel id={`${defaultMatrixViewLabelId}-breadcrumb-depth-mode`}>
                                {t('layouts.interpretationNetworkEditor.breadcrumbDepthMode', 'Path')}
                            </InputLabel>
                            <Select
                                labelId={`${defaultMatrixViewLabelId}-breadcrumb-depth-mode`}
                                value={tableSettings.breadcrumbDepth.mode}
                                label={t('layouts.interpretationNetworkEditor.breadcrumbDepthMode', 'Path')}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        breadcrumbDepth:
                                            event.target.value === 'last'
                                                ? {
                                                      mode: 'last',
                                                      count:
                                                          tableSettings.breadcrumbDepth.mode === 'last'
                                                              ? tableSettings.breadcrumbDepth.count
                                                              : 4
                                                  }
                                                : { mode: 'full' }
                                    }))
                                }
                            >
                                <MenuItem value='full'>
                                    {t('layouts.interpretationNetworkEditor.breadcrumbDepthOptions.full', 'Full path')}
                                </MenuItem>
                                <MenuItem value='last'>
                                    {t('layouts.interpretationNetworkEditor.breadcrumbDepthOptions.lastMode', 'Last levels')}
                                </MenuItem>
                            </Select>
                            <FormHelperText>
                                {t(
                                    'layouts.interpretationNetworkEditor.breadcrumbDepthHelp',
                                    'Full path is shown by default. Limited depth keeps the last levels and opens hidden parents from the ellipsis menu.'
                                )}
                            </FormHelperText>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id={`${defaultMatrixViewLabelId}-breadcrumb-depth-count`}>
                                {t('layouts.interpretationNetworkEditor.breadcrumbDepthCount', 'Levels')}
                            </InputLabel>
                            <Select
                                labelId={`${defaultMatrixViewLabelId}-breadcrumb-depth-count`}
                                value={tableSettings.breadcrumbDepth.mode === 'last' ? String(tableSettings.breadcrumbDepth.count) : '4'}
                                label={t('layouts.interpretationNetworkEditor.breadcrumbDepthCount', 'Levels')}
                                disabled={tableSettings.breadcrumbDepth.mode === 'full'}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        breadcrumbDepth: normalizeInterpretationNetworkTableSettings(
                                            current.matrixMode ?? 'hierarchicalCells',
                                            current.tableProjection,
                                            { mode: 'last', count: Number(event.target.value) },
                                            current.toolbarLayout,
                                            current.showHierarchicalTableHeaders,
                                            current.showHierarchicalTableHeaderCard,
                                            current.showMatrixTreeTotalCells,
                                            current.colorBreadcrumbsByCell
                                        ).breadcrumbDepth
                                    }))
                                }
                            >
                                {interpretationNetworkBreadcrumbDepthCounts.map((count) => (
                                    <MenuItem key={count} value={String(count)}>
                                        {count}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={tableSettings.showHierarchicalTableHeaders}
                                disabled={
                                    !viewSettings.allowedMatrixViews.includes('table') ||
                                    tableSettings.tableProjection !== 'hierarchicalPath'
                                }
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        showHierarchicalTableHeaders: event.target.checked
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t('layouts.interpretationNetworkEditor.tableHeaders', 'Show hierarchical table headers')
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.tableHeaders', 'Show hierarchical table headers')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.tableHeadersHelp',
                            'Disabled by default for interpretation networks; users can enable the current-level and cell column headers when needed.'
                        )}
                    </FormHelperText>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={tableSettings.showHierarchicalTableHeaderCard}
                                disabled={
                                    !viewSettings.allowedMatrixViews.includes('table') ||
                                    tableSettings.tableProjection !== 'hierarchicalPath'
                                }
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        showHierarchicalTableHeaderCard: event.target.checked
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t('layouts.interpretationNetworkEditor.tableHeaderCard', 'Show focused parent card')
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.tableHeaderCard', 'Show focused parent card')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.tableHeaderCardHelp',
                            'Enabled by default so the focused parent cell remains visually separated before it moves into breadcrumbs.'
                        )}
                    </FormHelperText>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={tableSettings.colorBreadcrumbsByCell}
                                disabled={
                                    !viewSettings.allowedMatrixViews.includes('table') ||
                                    tableSettings.tableProjection !== 'hierarchicalPath'
                                }
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        colorBreadcrumbsByCell: event.target.checked
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t(
                                        'layouts.interpretationNetworkEditor.breadcrumbColors',
                                        'Use cell colors for breadcrumbs'
                                    )
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.breadcrumbColors', 'Use cell colors for breadcrumbs')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.breadcrumbColorsHelp',
                            'Enabled by default so hierarchy path items keep the same visual color as their cells.'
                        )}
                    </FormHelperText>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={tableSettings.showMatrixTreeTotalCells}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        showMatrixTreeTotalCells: event.target.checked
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t('layouts.interpretationNetworkEditor.totalCells', 'Show total cells in tree')
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.totalCells', 'Show total cells in tree')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.totalCellsHelp',
                            'Enabled by default so users can see the total number of cells in the current Matrix tree.'
                        )}
                    </FormHelperText>

                    <FormControl fullWidth>
                        <InputLabel id={`${defaultMatrixViewLabelId}-toolbar-layout`}>
                            {t('layouts.interpretationNetworkEditor.toolbarLayout', 'Toolbar layout')}
                        </InputLabel>
                        <Select
                            labelId={`${defaultMatrixViewLabelId}-toolbar-layout`}
                            value={tableSettings.toolbarLayout}
                            label={t('layouts.interpretationNetworkEditor.toolbarLayout', 'Toolbar layout')}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    toolbarLayout: event.target.value as InterpretationNetworkToolbarLayout
                                }))
                            }
                        >
                            <MenuItem value='horizontal'>
                                {t('layouts.interpretationNetworkEditor.toolbarLayouts.horizontal', 'Horizontal')}
                            </MenuItem>
                            <MenuItem value='vertical'>
                                {t('layouts.interpretationNetworkEditor.toolbarLayouts.vertical', 'Vertical')}
                            </MenuItem>
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.interpretationNetworkEditor.toolbarLayoutHelp',
                                'Horizontal toolbar remains the default. Vertical toolbar is available as an opt-in layout.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    {(draft.matrixMode ?? 'hierarchicalCells') === 'hierarchicalCells' ? (
                        <FormControl fullWidth>
                            <InputLabel id={`${defaultMatrixViewLabelId}-hierarchy-row-mode`}>
                                {t('layouts.interpretationNetworkEditor.hierarchyRowMode', 'Hierarchy rows')}
                            </InputLabel>
                            <Select
                                labelId={`${defaultMatrixViewLabelId}-hierarchy-row-mode`}
                                value={draft.hierarchyRowMode ?? 'focusedPath'}
                                label={t('layouts.interpretationNetworkEditor.hierarchyRowMode', 'Hierarchy rows')}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        hierarchyRowMode: event.target.value as InterpretationNetworkHierarchyRowMode
                                    }))
                                }
                            >
                                <MenuItem value='focusedPath'>
                                    {t('layouts.interpretationNetworkEditor.hierarchyRowModes.focusedPath', 'Focused branch')}
                                </MenuItem>
                                <MenuItem value='allNodes'>
                                    {t('layouts.interpretationNetworkEditor.hierarchyRowModes.allNodes', 'All levels')}
                                </MenuItem>
                            </Select>
                            <FormHelperText>
                                {t(
                                    'layouts.interpretationNetworkEditor.hierarchyRowModeHelp',
                                    'Controls whether hierarchy views show the selected branch or every hierarchy level.'
                                )}
                            </FormHelperText>
                        </FormControl>
                    ) : null}

                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.allowNewAxesInCellDialog === true}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        allowNewAxesInCellDialog: event.target.checked
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t(
                                        'layouts.interpretationNetworkEditor.newAxesInCellDialog',
                                        'Create rows and columns from cell dialog'
                                    )
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.newAxesInCellDialog', 'Create rows and columns from cell dialog')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.newAxesInCellDialogHelp',
                            'When disabled, users add rows and columns with the table plus buttons, and the Add cell dialog uses existing axes.'
                        )}
                    </FormHelperText>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={normalizeInterpretationNetworkSplitPaneSettings(draft.splitPane).enabled}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        splitPane: { enabled: event.target.checked }
                                    }))
                                }
                                inputProps={{
                                    'aria-label': t(
                                        'layouts.interpretationNetworkEditor.resizablePanes',
                                        'Allow users to resize workspace panes'
                                    )
                                }}
                            />
                        }
                        label={t('layouts.interpretationNetworkEditor.resizablePanes', 'Allow users to resize workspace panes')}
                    />
                    <FormHelperText>
                        {t(
                            'layouts.interpretationNetworkEditor.resizablePanesHelp',
                            'When enabled, users can temporarily adjust the Structure and Materials pane widths. Their adjustment is not saved.'
                        )}
                    </FormHelperText>

                    {showSharedBehavior ? <LayoutWidgetSharedBehaviorFields value={draft} onChange={setDraft} /> : null}
                    {showScopeVisibility && metahubId && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
