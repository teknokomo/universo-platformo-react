import { Checkbox, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import {
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkTableSettings,
    type InterpretationNetworkMatrixMode,
    type InterpretationNetworkMatrixView,
    type InterpretationNetworkWorkspaceWidgetConfig,
    type InterpretationNetworkStructureMode
} from '@universo-react/types'

import {
    MATRIX_MODE_FALLBACK_LABELS,
    MATRIX_VIEW_FALLBACK_LABELS,
    type InterpretationNetworkWorkspaceWidgetConfigDraftSetter
} from './interpretationNetworkWorkspaceWidgetEditorDialogConfig'

interface InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySectionProps {
    draft: InterpretationNetworkWorkspaceWidgetConfig
    setDraft: InterpretationNetworkWorkspaceWidgetConfigDraftSetter
    fieldIdPrefix: string
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySection({
    draft,
    setDraft,
    fieldIdPrefix
}: InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySectionProps) {
    const { t } = useTranslation('metahubs')
    const defaultMatrixViewLabelId = fieldIdPrefix
    const viewSettings = normalizeInterpretationNetworkMatrixViewSettings(
        draft.matrixMode ?? 'hierarchicalCells',
        draft.allowedMatrixViews,
        draft.defaultMatrixView
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
        <>
            <Stack spacing={0.5}>
                <Typography variant='subtitle2'>{t('layouts.interpretationNetworkEditor.displayTitle', 'Matrix display')}</Typography>
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary'
                    }}
                >
                    {t(
                        'layouts.interpretationNetworkEditor.description',
                        'Choose which matrix views are available in the published application and which view opens by default.'
                    )}
                </Typography>
            </Stack>

            <FormControl fullWidth>
                <InputLabel id={`${defaultMatrixViewLabelId}-structure-mode`}>
                    {t('layouts.interpretationNetworkEditor.structureMode', 'Structure mode')}
                </InputLabel>
                <Select
                    labelId={`${defaultMatrixViewLabelId}-structure-mode`}
                    value={draft.structureMode ?? 'multiple'}
                    label={t('layouts.interpretationNetworkEditor.structureMode', 'Structure mode')}
                    onChange={(event) => {
                        const structureMode = event.target.value as InterpretationNetworkStructureMode
                        setDraft((current) => ({
                            ...current,
                            structureMode
                        }))
                    }}
                >
                    <MenuItem value='multiple'>
                        {t('layouts.interpretationNetworkEditor.structureModes.multiple', 'Multiple structures')}
                    </MenuItem>
                    <MenuItem value='singleSystem'>
                        {t('layouts.interpretationNetworkEditor.structureModes.singleSystem', 'One system structure')}
                    </MenuItem>
                </Select>
                <FormHelperText>
                    {t(
                        'layouts.interpretationNetworkEditor.structureModeHelp',
                        'Multiple structures shows the Structure list. One system structure opens the Matrix directly and hides the internal Structure name.'
                    )}
                </FormHelperText>
            </FormControl>

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
                                    slotProps={{
                                        input: {
                                            'aria-label': t(
                                                `layouts.interpretationNetworkEditor.views.${view}`,
                                                MATRIX_VIEW_FALLBACK_LABELS[view]
                                            )
                                        }
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
        </>
    )
}
