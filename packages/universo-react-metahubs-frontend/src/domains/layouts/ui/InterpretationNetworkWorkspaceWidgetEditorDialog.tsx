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
    interpretationNetworkMatrixViews,
    normalizeInterpretationNetworkMatrixViewSettings,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkMatrixView,
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

const normalizeConfig = (config?: InterpretationNetworkWorkspaceWidgetConfig | null): InterpretationNetworkWorkspaceWidgetConfig => {
    const current = config ?? {}
    const { hierarchyLayout, ...persistableConfig } = current as InterpretationNetworkWorkspaceWidgetConfig & {
        hierarchyLayout?: unknown
    }
    const matrixMode = current.matrixMode ?? 'hierarchicalCells'
    const hasLegacyHierarchyLayout = hierarchyLayout === 'verticalTree' || hierarchyLayout === 'horizontalRows'
    const hasNewViewSettings = current.allowedMatrixViews !== undefined || current.defaultMatrixView !== undefined
    const requestedViews =
        hasLegacyHierarchyLayout && !hasNewViewSettings && matrixMode === 'hierarchicalCells'
            ? Array.from(new Set(['horizontalRows', hierarchyLayout]))
            : current.allowedMatrixViews
    const viewSettings = normalizeInterpretationNetworkMatrixViewSettings(
        matrixMode,
        requestedViews,
        current.defaultMatrixView ?? (hasLegacyHierarchyLayout && !hasNewViewSettings ? hierarchyLayout : undefined)
    )

    return {
        ...persistableConfig,
        ...viewSettings,
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

                    {showSharedBehavior ? <LayoutWidgetSharedBehaviorFields value={draft} onChange={setDraft} /> : null}
                    {showScopeVisibility && metahubId && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
