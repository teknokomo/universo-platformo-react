import { Checkbox, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Stack, Switch, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import {
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    normalizeInterpretationNetworkTemplatePanelSettings,
    type InterpretationNetworkHierarchyRowMode,
    type InterpretationNetworkToolbarLayout,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'

import type { InterpretationNetworkWorkspaceWidgetConfigDraftSetter } from './interpretationNetworkWorkspaceWidgetEditorDialogConfig'

interface InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSectionProps {
    draft: InterpretationNetworkWorkspaceWidgetConfig
    setDraft: InterpretationNetworkWorkspaceWidgetConfigDraftSetter
    fieldIdPrefix: string
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSection({
    draft,
    setDraft,
    fieldIdPrefix
}: InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSectionProps) {
    const { t } = useTranslation('metahubs')
    const defaultMatrixViewLabelId = fieldIdPrefix
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

    return (
        <>
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
                    <MenuItem value='vertical'>{t('layouts.interpretationNetworkEditor.toolbarLayouts.vertical', 'Vertical')}</MenuItem>
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
                        slotProps={{
                            input: {
                                'aria-label': t(
                                    'layouts.interpretationNetworkEditor.newAxesInCellDialog',
                                    'Create rows and columns from cell dialog'
                                )
                            }
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
                        slotProps={{
                            input: {
                                'aria-label': t(
                                    'layouts.interpretationNetworkEditor.resizablePanes',
                                    'Allow users to resize workspace panes'
                                )
                            }
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

            <Stack spacing={0.5}>
                <Typography variant='subtitle2'>{t('layouts.interpretationNetworkEditor.templatePanel', 'Template panels')}</Typography>
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary'
                    }}
                >
                    {t(
                        'layouts.interpretationNetworkEditor.templatePanelHelp',
                        'Choose where saved table templates are visible in published workspaces.'
                    )}
                </Typography>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={normalizeInterpretationNetworkTemplatePanelSettings(draft.templatePanel).showInStructureList}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    templatePanel: {
                                        ...normalizeInterpretationNetworkTemplatePanelSettings(current.templatePanel),
                                        showInStructureList: event.target.checked
                                    }
                                }))
                            }
                        />
                    }
                    label={t('layouts.interpretationNetworkEditor.templatePanelStructureList', 'Show next to Structures')}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={normalizeInterpretationNetworkTemplatePanelSettings(draft.templatePanel).showInMatrix}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    templatePanel: {
                                        ...normalizeInterpretationNetworkTemplatePanelSettings(current.templatePanel),
                                        showInMatrix: event.target.checked
                                    }
                                }))
                            }
                        />
                    }
                    label={t('layouts.interpretationNetworkEditor.templatePanelMatrix', 'Show next to Matrix')}
                />
            </Stack>
        </>
    )
}
