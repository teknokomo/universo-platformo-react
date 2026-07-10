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
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView
} from '@universo-react/types'
import { SaveSettingsButton, testIdInputProps } from './SettingsPanels'

type Translate = TFunction<'applications'>

const MATRIX_VIEW_FALLBACK_LABELS: Record<InterpretationNetworkMatrixView, string> = {
    table: 'Table view',
    horizontalRows: 'Horizontal rows',
    verticalTree: 'Vertical tree'
}

export type InterpretationNetworkPositionNumberingSettings = {
    enabled: boolean
    includeRoot: boolean
    startIndex: number
}

export type InterpretationNetworkMatrixSettings = {
    matrixMode: InterpretationNetworkMatrixMode
    allowedMatrixViews: InterpretationNetworkMatrixView[]
    defaultMatrixView: InterpretationNetworkMatrixView
    hierarchyRowMode: InterpretationNetworkHierarchyRowMode
    positionNumbering: InterpretationNetworkPositionNumberingSettings
    allowNewAxesInCellDialog: boolean
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
    const [localSettings, setLocalSettings] = useState(settings)

    useEffect(() => {
        setLocalSettings(settings)
    }, [settings])

    const hasChanges = useMemo(
        () =>
            hasDivergentSettings ||
            localSettings.matrixMode !== settings.matrixMode ||
            localSettings.allowedMatrixViews.length !== settings.allowedMatrixViews.length ||
            localSettings.allowedMatrixViews.some((view, index) => view !== settings.allowedMatrixViews[index]) ||
            localSettings.defaultMatrixView !== settings.defaultMatrixView ||
            localSettings.hierarchyRowMode !== settings.hierarchyRowMode ||
            localSettings.allowNewAxesInCellDialog !== settings.allowNewAxesInCellDialog ||
            localSettings.positionNumbering.enabled !== settings.positionNumbering.enabled ||
            localSettings.positionNumbering.includeRoot !== settings.positionNumbering.includeRoot ||
            localSettings.positionNumbering.startIndex !== settings.positionNumbering.startIndex,
        [hasDivergentSettings, localSettings, settings]
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
