import {
    Box,
    Checkbox,
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
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import {
    interpretationNetworkBreadcrumbDepthCounts,
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkTableSettings,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkStructureMode,
    type InterpretationNetworkTableProjection,
    type InterpretationNetworkToolbarLayout
} from '@universo-react/types'
import { testIdInputProps } from './SettingsPanels'
import type { InterpretationNetworkMatrixSettings } from './MatrixSettingsPanel'

type Translate = TFunction<'applications'>

const MATRIX_VIEW_FALLBACK_LABELS: Record<InterpretationNetworkMatrixView, string> = {
    table: 'Table view',
    horizontalRows: 'Horizontal rows',
    verticalTree: 'Vertical tree'
}

const defaultTableProjectionForMode = (matrixMode: InterpretationNetworkMatrixMode): InterpretationNetworkTableProjection =>
    matrixMode === 'independentRows' ? 'independentAxes' : 'hierarchicalPath'

const SettingsRow = ({
    testId,
    title,
    description,
    children,
    extra
}: {
    testId: string
    title: string
    description: string
    children: ReactNode
    extra?: ReactNode
}) => (
    <Box
        data-testid={testId}
        sx={{
            py: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1.5, sm: 3 }
        }}
    >
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant='subtitle2'>{title}</Typography>
            <Typography variant='body2' color='text.secondary'>
                {description}
            </Typography>
            {extra}
        </Box>
        {children}
    </Box>
)

export interface MatrixSettingsRowsProps {
    t: Translate
    isSaving: boolean
    localSettings: InterpretationNetworkMatrixSettings
    setLocalSettings: Dispatch<SetStateAction<InterpretationNetworkMatrixSettings>>
}

export const MatrixStructureAndTemplateRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) => (
    <>
        <SettingsRow
            testId='application-setting-matrix-structure-mode'
            title={t('settings.matrix.structureMode', 'Structure mode')}
            description={t(
                'settings.matrix.structureModeDescription',
                'Choose whether users manage several named Structures or open one system Matrix directly.'
            )}
        >
            <FormControl size='small' sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
                <InputLabel id='application-settings-matrix-structure-mode-label'>
                    {t('settings.matrix.structureMode', 'Structure mode')}
                </InputLabel>
                <Select
                    id='application-settings-matrix-structure-mode'
                    labelId='application-settings-matrix-structure-mode-label'
                    value={localSettings.structureMode}
                    label={t('settings.matrix.structureMode', 'Structure mode')}
                    onChange={(event) =>
                        setLocalSettings((current) => ({
                            ...current,
                            structureMode: event.target.value as InterpretationNetworkStructureMode
                        }))
                    }
                    disabled={isSaving}
                    inputProps={testIdInputProps('application-settings-matrix-structure-mode-select')}
                >
                    <MenuItem value='multiple'>{t('settings.matrix.structureModes.multiple', 'Multiple structures')}</MenuItem>
                    <MenuItem value='singleSystem'>{t('settings.matrix.structureModes.singleSystem', 'One system structure')}</MenuItem>
                </Select>
            </FormControl>
        </SettingsRow>
        <SettingsRow
            testId='application-setting-matrix-template-panel'
            title={t('settings.matrix.templatePanel', 'Template panels')}
            description={t(
                'settings.matrix.templatePanelDescription',
                'Choose where workspace table templates are shown in the published application.'
            )}
        >
            <Stack spacing={0.5} sx={{ minWidth: { sm: 260 } }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={localSettings.templatePanel.showInStructureList}
                            onChange={(event) =>
                                setLocalSettings((current) => ({
                                    ...current,
                                    templatePanel: {
                                        ...current.templatePanel,
                                        showInStructureList: event.target.checked
                                    }
                                }))
                            }
                            disabled={isSaving}
                        />
                    }
                    label={t('settings.matrix.templatePanelLocations.structureList', 'Show next to Structures')}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={localSettings.templatePanel.showInMatrix}
                            onChange={(event) =>
                                setLocalSettings((current) => ({
                                    ...current,
                                    templatePanel: {
                                        ...current.templatePanel,
                                        showInMatrix: event.target.checked
                                    }
                                }))
                            }
                            disabled={isSaving}
                        />
                    }
                    label={t('settings.matrix.templatePanelLocations.matrix', 'Show next to Matrix')}
                />
            </Stack>
        </SettingsRow>
    </>
)

export const MatrixViewRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) => {
    const tableViewAllowed = localSettings.allowedMatrixViews.includes('table')
    const tableOnlyControlsDisabled = isSaving || !tableViewAllowed
    const tableProjectionDisabled = tableOnlyControlsDisabled || localSettings.matrixMode === 'independentRows'
    const breadcrumbDepthDisabled = tableOnlyControlsDisabled

    return (
        <>
            <SettingsRow
                testId='application-setting-matrix-mode'
                title={t('settings.matrix.mode', 'Matrix mode')}
                description={t(
                    'settings.matrix.modeDescription',
                    'Choose whether matrix cells use hierarchical parent-child grouping or independent row cells.'
                )}
            >
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
                        <MenuItem value='hierarchicalCells'>{t('settings.matrix.modes.hierarchicalCells', 'Hierarchical cells')}</MenuItem>
                        <MenuItem value='independentRows'>{t('settings.matrix.modes.independentRows', 'Independent rows')}</MenuItem>
                    </Select>
                </FormControl>
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-available-views'
                title={t('settings.matrix.availableViews', 'Available views')}
                description={t(
                    'settings.matrix.availableViewsDescription',
                    'Choose which views users can select for the same Matrix data. At least one view is required.'
                )}
                extra={
                    localSettings.matrixMode === 'independentRows' ? (
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                            {t('settings.matrix.independentRowsViewConstraint', 'Vertical tree is available only for hierarchical cells.')}
                        </Typography>
                    ) : null
                }
            >
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
                                        slotProps={{ input: testIdInputProps(`application-settings-matrix-view-${view}`) }}
                                    />
                                }
                                label={t(`settings.matrix.views.${view}`, MATRIX_VIEW_FALLBACK_LABELS[view])}
                            />
                        )
                    })}
                </Stack>
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-default-view'
                title={t('settings.matrix.defaultView', 'Default view')}
                description={t('settings.matrix.defaultViewDescription', 'Choose which allowed view users see when they open the matrix.')}
            >
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
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-table-projection'
                title={t('settings.matrix.tableProjection', 'Table projection')}
                description={t('settings.matrix.tableProjectionDescription', 'Choose how hierarchical cells appear in the table view.')}
                extra={
                    <>
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
                    </>
                }
            >
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
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-breadcrumb-depth'
                title={t('settings.matrix.breadcrumbDepth', 'Breadcrumb depth')}
                description={t(
                    'settings.matrix.breadcrumbDepthDescription',
                    'Choose how much of the focused path remains visible above hierarchical tables.'
                )}
                extra={
                    !tableViewAllowed ? (
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                            {t(
                                'settings.matrix.tableViewDisabledConstraint',
                                'Enable Table view to configure table projection and breadcrumb depth.'
                            )}
                        </Typography>
                    ) : null
                }
            >
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
            </SettingsRow>
        </>
    )
}

export const MatrixTableOptionRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) => {
    const tableViewAllowed = localSettings.allowedMatrixViews.includes('table')
    const tableOnlyControlsDisabled = isSaving || !tableViewAllowed

    return (
        <>
            <SettingsRow
                testId='application-setting-matrix-table-headers'
                title={t('settings.matrix.tableHeaders', 'Table headers')}
                description={t(
                    'settings.matrix.tableHeadersDescription',
                    'Show the current-level and cell column headers above hierarchical Matrix tables.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-table-headers') }}
                        />
                    }
                    label={t('settings.matrix.enabled', 'Enabled')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-table-header-card'
                title={t('settings.matrix.tableHeaderCard', 'Focused parent card')}
                description={t(
                    'settings.matrix.tableHeaderCardDescription',
                    'Show the focused parent cell as a separate card above the hierarchical Matrix table.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-table-header-card') }}
                        />
                    }
                    label={t('settings.matrix.enabled', 'Enabled')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-breadcrumb-colors'
                title={t('settings.matrix.breadcrumbColors', 'Breadcrumb colors')}
                description={t(
                    'settings.matrix.breadcrumbColorsDescription',
                    'Render hierarchy breadcrumbs as compact boxes using each cell color.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-breadcrumb-colors') }}
                        />
                    }
                    label={t('settings.matrix.enabled', 'Enabled')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-total-cells'
                title={t('settings.matrix.totalCells', 'Total cells')}
                description={t(
                    'settings.matrix.totalCellsDescription',
                    'Show the total number of cells in the current Matrix tree below the structure.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-total-cells') }}
                        />
                    }
                    label={t('settings.matrix.enabled', 'Enabled')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-toolbar-layout'
                title={t('settings.matrix.toolbarLayout', 'Toolbar layout')}
                description={t(
                    'settings.matrix.toolbarLayoutDescription',
                    'Keep toolbar controls in one row by default, or stack them when the workspace needs more vertical controls.'
                )}
            >
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
            </SettingsRow>
        </>
    )
}

export const MatrixHierarchyRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) =>
    localSettings.matrixMode === 'hierarchicalCells' ? (
        <>
            <SettingsRow
                testId='application-setting-matrix-hierarchy-row-mode'
                title={t('settings.matrix.hierarchyRowMode', 'Hierarchy rows')}
                description={t(
                    'settings.matrix.hierarchyRowModeDescription',
                    'Choose whether tree-style Matrix views show the focused branch or every hierarchy level.'
                )}
            >
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
                        <MenuItem value='focusedPath'>{t('settings.matrix.hierarchyRowModes.focusedPath', 'Focused branch')}</MenuItem>
                        <MenuItem value='allNodes'>{t('settings.matrix.hierarchyRowModes.allNodes', 'All levels')}</MenuItem>
                    </Select>
                </FormControl>
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-position-numbering'
                title={t('settings.matrix.positionNumbering', 'Position numbering')}
                description={t(
                    'settings.matrix.positionNumberingDescription',
                    'Show derived position paths such as 1/2/2 on matrix cells without storing them on records.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-position-numbering-enabled') }}
                        />
                    }
                    label={t('settings.matrix.enabled', 'Enabled')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-position-numbering-root'
                title={t('settings.matrix.includeRootNumber', 'Include root number')}
                description={t(
                    'settings.matrix.includeRootNumberDescription',
                    'When disabled, numbering starts from the first child level instead of the root cell.'
                )}
            >
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
                            slotProps={{ input: testIdInputProps('application-settings-matrix-position-numbering-root') }}
                        />
                    }
                    label={t('settings.matrix.includeRoot', 'Include root')}
                />
            </SettingsRow>
            <SettingsRow
                testId='application-setting-matrix-position-numbering-start'
                title={t('settings.matrix.startIndex', 'Start number')}
                description={t('settings.matrix.startIndexDescription', 'Choose the first number used for each sibling group.')}
            >
                <TextField
                    type='number'
                    size='small'
                    label={t('settings.matrix.startIndex', 'Start number')}
                    value={localSettings.positionNumbering.startIndex}
                    disabled={isSaving || !localSettings.positionNumbering.enabled}
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            max: 999,
                            step: 1,
                            ...testIdInputProps('application-settings-matrix-position-start')
                        }
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
            </SettingsRow>
        </>
    ) : null

export const MatrixBehaviorRows = ({ t, isSaving, localSettings, setLocalSettings }: MatrixSettingsRowsProps) => (
    <>
        <SettingsRow
            testId='application-setting-matrix-resizable-panes'
            title={t('settings.matrix.resizablePanes', 'Resizable workspace panes')}
            description={t(
                'settings.matrix.resizablePanesDescription',
                'Allow users to temporarily adjust the Structure and Materials pane widths. Their adjustment is not saved.'
            )}
        >
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
                        slotProps={{ input: testIdInputProps('application-settings-matrix-resizable-panes') }}
                    />
                }
                label={t('settings.matrix.enabled', 'Enabled')}
            />
        </SettingsRow>
        <SettingsRow
            testId='application-setting-matrix-new-axes-in-cell-dialog'
            title={t('settings.matrix.newAxesInCellDialog', 'Create rows and columns from cell dialog')}
            description={t(
                'settings.matrix.newAxesInCellDialogDescription',
                'When disabled, users add rows and columns with the table plus buttons, and the Add cell dialog uses existing axes.'
            )}
        >
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
                        slotProps={{ input: testIdInputProps('application-settings-matrix-new-axes-in-cell-dialog') }}
                    />
                }
                label={t('settings.matrix.enabled', 'Enabled')}
            />
        </SettingsRow>
    </>
)
