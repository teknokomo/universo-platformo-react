import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import type { TFunction } from 'i18next'
import {
    interpretationNetworkBreadcrumbDepthCounts,
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    type InterpretationNetworkBreadcrumbDepth,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkSplitPaneSettings,
    type InterpretationNetworkTableProjection,
    type InterpretationNetworkToolbarLayout
} from '@universo-react/types'
import { SaveSettingsButton, testIdInputProps } from './SettingsPanels'

type Translate = TFunction<'applications'>

const MATRIX_VIEW_FALLBACK_LABELS: Record<InterpretationNetworkMatrixView, string> = {
    table: 'Table view',
    horizontalRows: 'Horizontal rows',
    verticalTree: 'Vertical tree'
}

const defaultTableProjectionForMode = (matrixMode: InterpretationNetworkMatrixMode): InterpretationNetworkTableProjection =>
    matrixMode === 'independentRows' ? 'independentAxes' : 'hierarchicalPath'

export type InterpretationNetworkPositionNumberingSettings = {
    enabled: boolean
    includeRoot: boolean
    startIndex: number
}

export type InterpretationNetworkMatrixSettings = {
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
        ...viewSettings,
        ...tableSettings,
        positionNumbering: {
            enabled: settings.positionNumbering.enabled,
            includeRoot: settings.positionNumbering.includeRoot,
            startIndex: settings.positionNumbering.startIndex
        },
        allowNewAxesInCellDialog: settings.allowNewAxesInCellDialog === true,
        splitPane: normalizeInterpretationNetworkSplitPaneSettings(settings.splitPane)
    }
}

export const MatrixSettingsPanel = ({
    t,
    settings,
    hasDivergentSettings,
    isSaving,
    onSave
}: {
    t: Translate
    settings: InterpretationNetworkMatrixSettings
    hasDivergentSettings: boolean
    isSaving: boolean
    onSave: (settings: InterpretationNetworkMatrixSettings) => void
}) => {
    const normalizedSettings = useMemo(() => normalizeMatrixPanelSettings(settings), [settings])
    const [localSettings, setLocalSettings] = useState(() => normalizedSettings)

    useEffect(() => {
        setLocalSettings(normalizedSettings)
    }, [normalizedSettings])

    const tableViewAllowed = localSettings.allowedMatrixViews.includes('table')
    const tableOnlyControlsDisabled = isSaving || !tableViewAllowed
    const tableProjectionDisabled = tableOnlyControlsDisabled || localSettings.matrixMode === 'independentRows'
    const breadcrumbDepthDisabled = tableOnlyControlsDisabled

    const hasChanges = useMemo(
        () =>
            hasDivergentSettings ||
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
            localSettings.positionNumbering.enabled !== normalizedSettings.positionNumbering.enabled ||
            localSettings.positionNumbering.includeRoot !== normalizedSettings.positionNumbering.includeRoot ||
            localSettings.positionNumbering.startIndex !== normalizedSettings.positionNumbering.startIndex,
        [hasDivergentSettings, localSettings, normalizedSettings]
    )

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
                <Box
                    data-testid='application-setting-matrix-mode'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.mode', 'Matrix mode')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.modeDescription',
                                'Choose whether matrix cells use hierarchical parent-child grouping or independent row cells.'
                            )}
                        </Typography>
                    </Box>
                    <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                        <InputLabel id='application-settings-matrix-mode-label'>{t('settings.matrix.mode', 'Matrix mode')}</InputLabel>
                        <Select
                            id='application-settings-matrix-mode'
                            labelId='application-settings-matrix-mode-label'
                            value={localSettings.matrixMode}
                            label={t('settings.matrix.mode', 'Matrix mode')}
                            onChange={(event) => {
                                const matrixMode = event.target.value as InterpretationNetworkMatrixMode
                                setLocalSettings((current) => ({
                                    ...current,
                                    matrixMode,
                                    tableProjection: defaultTableProjectionForMode(matrixMode),
                                    ...normalizeInterpretationNetworkMatrixViewSettings(
                                        matrixMode,
                                        current.allowedMatrixViews,
                                        current.defaultMatrixView
                                    )
                                }))
                            }}
                            disabled={isSaving}
                            inputProps={testIdInputProps('application-settings-matrix-mode-select')}
                        >
                            <MenuItem value='hierarchicalCells'>
                                {t('settings.matrix.modes.hierarchicalCells', 'Hierarchical cells')}
                            </MenuItem>
                            <MenuItem value='independentRows'>{t('settings.matrix.modes.independentRows', 'Independent rows')}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                <Box
                    data-testid='application-setting-matrix-available-views'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.availableViews', 'Available views')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.availableViewsDescription',
                                'Choose which views users can select for the same Matrix data. At least one view is required.'
                            )}
                        </Typography>
                        {localSettings.matrixMode === 'independentRows' ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                                {t(
                                    'settings.matrix.independentRowsViewConstraint',
                                    'Vertical tree is available only for hierarchical cells.'
                                )}
                            </Typography>
                        ) : null}
                    </Box>
                    <Stack sx={{ width: { xs: '100%', sm: 260 } }}>
                        {interpretationNetworkMatrixViews.map((view) => {
                            const supported = localSettings.matrixMode === 'hierarchicalCells' || view !== 'verticalTree'
                            const checked = localSettings.allowedMatrixViews.includes(view)
                            const lastAllowed = checked && localSettings.allowedMatrixViews.length === 1
                            return (
                                <FormControlLabel
                                    key={view}
                                    control={
                                        <Checkbox
                                            checked={checked}
                                            disabled={isSaving || !supported || lastAllowed}
                                            onChange={(_, nextChecked) =>
                                                setLocalSettings((current) => {
                                                    const requestedViews = nextChecked
                                                        ? [...current.allowedMatrixViews, view]
                                                        : current.allowedMatrixViews.filter((item) => item !== view)
                                                    return {
                                                        ...current,
                                                        ...normalizeInterpretationNetworkMatrixViewSettings(
                                                            current.matrixMode,
                                                            requestedViews,
                                                            current.defaultMatrixView
                                                        )
                                                    }
                                                })
                                            }
                                            inputProps={testIdInputProps(`application-settings-matrix-view-${view}`)}
                                        />
                                    }
                                    label={t(`settings.matrix.views.${view}`, MATRIX_VIEW_FALLBACK_LABELS[view])}
                                />
                            )
                        })}
                    </Stack>
                </Box>
                <Box
                    data-testid='application-setting-matrix-default-view'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.defaultView', 'Default view')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t('settings.matrix.defaultViewDescription', 'Choose which allowed view users see when they open the matrix.')}
                        </Typography>
                    </Box>
                    <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                        <InputLabel id='application-settings-matrix-default-view-label'>
                            {t('settings.matrix.defaultView', 'Default view')}
                        </InputLabel>
                        <Select
                            id='application-settings-matrix-default-view'
                            labelId='application-settings-matrix-default-view-label'
                            value={localSettings.defaultMatrixView}
                            label={t('settings.matrix.defaultView', 'Default view')}
                            onChange={(event) =>
                                setLocalSettings((current) => ({
                                    ...current,
                                    defaultMatrixView: event.target.value as InterpretationNetworkMatrixView
                                }))
                            }
                            disabled={isSaving}
                            inputProps={testIdInputProps('application-settings-matrix-default-view-select')}
                        >
                            {localSettings.allowedMatrixViews.map((view) => (
                                <MenuItem key={view} value={view}>
                                    {t(`settings.matrix.views.${view}`, MATRIX_VIEW_FALLBACK_LABELS[view])}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                <Box
                    data-testid='application-setting-matrix-table-projection'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.tableProjection', 'Table projection')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t('settings.matrix.tableProjectionDescription', 'Choose how hierarchical cells appear in the table view.')}
                        </Typography>
                        {localSettings.matrixMode === 'independentRows' ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                                {t(
                                    'settings.matrix.independentRowsProjectionConstraint',
                                    'Independent rows always use separate row and column axes.'
                                )}
                            </Typography>
                        ) : null}
                        {!tableViewAllowed ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                                {t(
                                    'settings.matrix.tableViewDisabledConstraint',
                                    'Enable Table view to configure table projection and breadcrumb depth.'
                                )}
                            </Typography>
                        ) : null}
                    </Box>
                    <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                        <InputLabel id='application-settings-matrix-table-projection-label'>
                            {t('settings.matrix.tableProjection', 'Table projection')}
                        </InputLabel>
                        <Select
                            id='application-settings-matrix-table-projection'
                            labelId='application-settings-matrix-table-projection-label'
                            value={localSettings.tableProjection}
                            label={t('settings.matrix.tableProjection', 'Table projection')}
                            onChange={(event) =>
                                setLocalSettings((current) => ({
                                    ...current,
                                    tableProjection: event.target.value as InterpretationNetworkTableProjection
                                }))
                            }
                            disabled={tableProjectionDisabled}
                            inputProps={testIdInputProps('application-settings-matrix-table-projection-select')}
                        >
                            <MenuItem value='hierarchicalPath'>
                                {t('settings.matrix.tableProjections.hierarchicalPath', 'Hierarchy path')}
                            </MenuItem>
                            <MenuItem value='independentAxes'>
                                {t('settings.matrix.tableProjections.independentAxes', 'Separate axes')}
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                <Box
                    data-testid='application-setting-matrix-breadcrumb-depth'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.breadcrumbDepth', 'Breadcrumb depth')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.breadcrumbDepthDescription',
                                'Choose how much of the focused path remains visible above hierarchical tables.'
                            )}
                        </Typography>
                        {!tableViewAllowed ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                                {t(
                                    'settings.matrix.tableViewDisabledConstraint',
                                    'Enable Table view to configure table projection and breadcrumb depth.'
                                )}
                            </Typography>
                        ) : null}
                    </Box>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}
                    >
                        <FormControl size='small' sx={{ minWidth: { sm: 150 } }}>
                            <InputLabel id='application-settings-matrix-breadcrumb-depth-mode-label'>
                                {t('settings.matrix.breadcrumbDepthMode', 'Path')}
                            </InputLabel>
                            <Select
                                id='application-settings-matrix-breadcrumb-depth-mode'
                                labelId='application-settings-matrix-breadcrumb-depth-mode-label'
                                value={localSettings.breadcrumbDepth.mode}
                                label={t('settings.matrix.breadcrumbDepthMode', 'Path')}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        breadcrumbDepth:
                                            event.target.value === 'last'
                                                ? {
                                                      mode: 'last',
                                                      count: current.breadcrumbDepth.mode === 'last' ? current.breadcrumbDepth.count : 4
                                                  }
                                                : { mode: 'full' }
                                    }))
                                }
                                disabled={breadcrumbDepthDisabled}
                                inputProps={testIdInputProps('application-settings-matrix-breadcrumb-depth-mode-select')}
                            >
                                <MenuItem value='full'>{t('settings.matrix.breadcrumbDepthOptions.full', 'Full path')}</MenuItem>
                                <MenuItem value='last'>{t('settings.matrix.breadcrumbDepthOptions.lastMode', 'Last levels')}</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size='small' sx={{ minWidth: { sm: 104 } }}>
                            <InputLabel id='application-settings-matrix-breadcrumb-depth-count-label'>
                                {t('settings.matrix.breadcrumbDepthCount', 'Levels')}
                            </InputLabel>
                            <Select
                                id='application-settings-matrix-breadcrumb-depth-count'
                                labelId='application-settings-matrix-breadcrumb-depth-count-label'
                                value={localSettings.breadcrumbDepth.mode === 'last' ? String(localSettings.breadcrumbDepth.count) : '4'}
                                label={t('settings.matrix.breadcrumbDepthCount', 'Levels')}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        breadcrumbDepth: normalizeInterpretationNetworkTableSettings(
                                            current.matrixMode,
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
                                disabled={breadcrumbDepthDisabled || localSettings.breadcrumbDepth.mode === 'full'}
                                inputProps={testIdInputProps('application-settings-matrix-breadcrumb-depth-count-select')}
                            >
                                {interpretationNetworkBreadcrumbDepthCounts.map((count) => (
                                    <MenuItem key={count} value={String(count)}>
                                        {count}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
                <Box
                    data-testid='application-setting-matrix-table-headers'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.tableHeaders', 'Table headers')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.tableHeadersDescription',
                                'Show the current-level and cell column headers above hierarchical Matrix tables.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.showHierarchicalTableHeaders}
                                disabled={tableOnlyControlsDisabled || localSettings.tableProjection !== 'hierarchicalPath'}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        showHierarchicalTableHeaders: event.target.checked
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-table-headers')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
                <Box
                    data-testid='application-setting-matrix-table-header-card'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.tableHeaderCard', 'Focused parent card')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.tableHeaderCardDescription',
                                'Show the focused parent cell as a separate card above the hierarchical Matrix table.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.showHierarchicalTableHeaderCard}
                                disabled={tableOnlyControlsDisabled || localSettings.tableProjection !== 'hierarchicalPath'}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        showHierarchicalTableHeaderCard: event.target.checked
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-table-header-card')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
                <Box
                    data-testid='application-setting-matrix-breadcrumb-colors'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.breadcrumbColors', 'Breadcrumb colors')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.breadcrumbColorsDescription',
                                'Render hierarchy breadcrumbs as compact boxes using each cell color.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.colorBreadcrumbsByCell}
                                disabled={tableOnlyControlsDisabled || localSettings.tableProjection !== 'hierarchicalPath'}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        colorBreadcrumbsByCell: event.target.checked
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-breadcrumb-colors')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
                <Box
                    data-testid='application-setting-matrix-total-cells'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.totalCells', 'Total cells')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.totalCellsDescription',
                                'Show the total number of cells in the current Matrix tree below the structure.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.showMatrixTreeTotalCells}
                                disabled={isSaving}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        showMatrixTreeTotalCells: event.target.checked
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-total-cells')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
                <Box
                    data-testid='application-setting-matrix-toolbar-layout'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.toolbarLayout', 'Toolbar layout')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.toolbarLayoutDescription',
                                'Keep toolbar controls in one row by default, or stack them when the workspace needs more vertical controls.'
                            )}
                        </Typography>
                    </Box>
                    <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                        <InputLabel id='application-settings-matrix-toolbar-layout-label'>
                            {t('settings.matrix.toolbarLayout', 'Toolbar layout')}
                        </InputLabel>
                        <Select
                            id='application-settings-matrix-toolbar-layout'
                            labelId='application-settings-matrix-toolbar-layout-label'
                            value={localSettings.toolbarLayout}
                            label={t('settings.matrix.toolbarLayout', 'Toolbar layout')}
                            onChange={(event) =>
                                setLocalSettings((current) => ({
                                    ...current,
                                    toolbarLayout: event.target.value as InterpretationNetworkToolbarLayout
                                }))
                            }
                            disabled={isSaving}
                            inputProps={testIdInputProps('application-settings-matrix-toolbar-layout-select')}
                        >
                            <MenuItem value='horizontal'>{t('settings.matrix.toolbarLayouts.horizontal', 'Horizontal')}</MenuItem>
                            <MenuItem value='vertical'>{t('settings.matrix.toolbarLayouts.vertical', 'Vertical')}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                {localSettings.matrixMode === 'hierarchicalCells' ? (
                    <>
                        <Box
                            data-testid='application-setting-matrix-hierarchy-row-mode'
                            sx={{
                                py: 2,
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'stretch', sm: 'center' },
                                gap: { xs: 1.5, sm: 3 }
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle2'>{t('settings.matrix.hierarchyRowMode', 'Hierarchy rows')}</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {t(
                                        'settings.matrix.hierarchyRowModeDescription',
                                        'Choose whether tree-style Matrix views show the focused branch or every hierarchy level.'
                                    )}
                                </Typography>
                            </Box>
                            <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                                <InputLabel id='application-settings-matrix-hierarchy-row-mode-label'>
                                    {t('settings.matrix.hierarchyRowMode', 'Hierarchy rows')}
                                </InputLabel>
                                <Select
                                    id='application-settings-matrix-hierarchy-row-mode'
                                    labelId='application-settings-matrix-hierarchy-row-mode-label'
                                    value={localSettings.hierarchyRowMode}
                                    label={t('settings.matrix.hierarchyRowMode', 'Hierarchy rows')}
                                    onChange={(event) =>
                                        setLocalSettings((current) => ({
                                            ...current,
                                            hierarchyRowMode: event.target.value as InterpretationNetworkHierarchyRowMode
                                        }))
                                    }
                                    disabled={isSaving}
                                    inputProps={testIdInputProps('application-settings-matrix-hierarchy-row-mode-select')}
                                >
                                    <MenuItem value='focusedPath'>
                                        {t('settings.matrix.hierarchyRowModes.focusedPath', 'Focused branch')}
                                    </MenuItem>
                                    <MenuItem value='allNodes'>{t('settings.matrix.hierarchyRowModes.allNodes', 'All levels')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Box
                            data-testid='application-setting-matrix-position-numbering'
                            sx={{
                                py: 2,
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'stretch', sm: 'center' },
                                gap: { xs: 1.5, sm: 3 }
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle2'>{t('settings.matrix.positionNumbering', 'Position numbering')}</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {t(
                                        'settings.matrix.positionNumberingDescription',
                                        'Show derived position paths such as 1/2/2 on matrix cells without storing them on records.'
                                    )}
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={localSettings.positionNumbering.enabled}
                                        disabled={isSaving}
                                        onChange={(event) =>
                                            setLocalSettings((current) => ({
                                                ...current,
                                                positionNumbering: {
                                                    ...current.positionNumbering,
                                                    enabled: event.target.checked
                                                }
                                            }))
                                        }
                                        inputProps={testIdInputProps('application-settings-matrix-position-numbering-enabled')}
                                    />
                                }
                                label={t('settings.matrix.enabled', 'Enabled')}
                            />
                        </Box>
                        <Box
                            data-testid='application-setting-matrix-position-numbering-root'
                            sx={{
                                py: 2,
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'stretch', sm: 'center' },
                                gap: { xs: 1.5, sm: 3 }
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle2'>{t('settings.matrix.includeRootNumber', 'Include root number')}</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {t(
                                        'settings.matrix.includeRootNumberDescription',
                                        'When disabled, numbering starts from the first child level instead of the root cell.'
                                    )}
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={localSettings.positionNumbering.includeRoot}
                                        disabled={isSaving || !localSettings.positionNumbering.enabled}
                                        onChange={(event) =>
                                            setLocalSettings((current) => ({
                                                ...current,
                                                positionNumbering: {
                                                    ...current.positionNumbering,
                                                    includeRoot: event.target.checked
                                                }
                                            }))
                                        }
                                        inputProps={testIdInputProps('application-settings-matrix-position-numbering-root')}
                                    />
                                }
                                label={t('settings.matrix.includeRoot', 'Include root')}
                            />
                        </Box>
                        <Box
                            data-testid='application-setting-matrix-position-numbering-start'
                            sx={{
                                py: 2,
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'stretch', sm: 'center' },
                                gap: { xs: 1.5, sm: 3 }
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle2'>{t('settings.matrix.startIndex', 'Start number')}</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {t('settings.matrix.startIndexDescription', 'Choose the first number used for each sibling group.')}
                                </Typography>
                            </Box>
                            <TextField
                                type='number'
                                size='small'
                                label={t('settings.matrix.startIndex', 'Start number')}
                                value={localSettings.positionNumbering.startIndex}
                                disabled={isSaving || !localSettings.positionNumbering.enabled}
                                inputProps={{
                                    min: 0,
                                    max: 999,
                                    step: 1,
                                    ...testIdInputProps('application-settings-matrix-position-start')
                                }}
                                sx={{ width: { xs: '100%', sm: 180 } }}
                                onChange={(event) => {
                                    const nextValue = Number(event.target.value)
                                    setLocalSettings((current) => ({
                                        ...current,
                                        positionNumbering: {
                                            ...current.positionNumbering,
                                            startIndex: Number.isInteger(nextValue) && nextValue >= 0 ? nextValue : 0
                                        }
                                    }))
                                }}
                            />
                        </Box>
                    </>
                ) : null}
                <Box
                    data-testid='application-setting-matrix-resizable-panes'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>{t('settings.matrix.resizablePanes', 'Resizable workspace panes')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.resizablePanesDescription',
                                'Allow users to temporarily adjust the Structure and Materials pane widths. Their adjustment is not saved.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.splitPane.enabled}
                                disabled={isSaving}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        splitPane: { enabled: event.target.checked }
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-resizable-panes')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
                <Box
                    data-testid='application-setting-matrix-new-axes-in-cell-dialog'
                    sx={{
                        py: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: { xs: 1.5, sm: 3 }
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle2'>
                            {t('settings.matrix.newAxesInCellDialog', 'Create rows and columns from cell dialog')}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t(
                                'settings.matrix.newAxesInCellDialogDescription',
                                'When disabled, users add rows and columns with the table plus buttons, and the Add cell dialog uses existing axes.'
                            )}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localSettings.allowNewAxesInCellDialog}
                                disabled={isSaving}
                                onChange={(event) =>
                                    setLocalSettings((current) => ({
                                        ...current,
                                        allowNewAxesInCellDialog: event.target.checked
                                    }))
                                }
                                inputProps={testIdInputProps('application-settings-matrix-new-axes-in-cell-dialog')}
                            />
                        }
                        label={t('settings.matrix.enabled', 'Enabled')}
                    />
                </Box>
            </Stack>

            {hasChanges ? (
                <SaveSettingsButton
                    testId='application-settings-matrix-save'
                    t={t}
                    disabled={isSaving}
                    onSave={() => onSave(localSettings)}
                />
            ) : null}
        </Stack>
    )
}
