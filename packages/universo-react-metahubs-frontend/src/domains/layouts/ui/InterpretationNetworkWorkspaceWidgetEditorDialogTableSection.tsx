import { FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Stack, Switch } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import {
    interpretationNetworkBreadcrumbDepthCounts,
    normalizeInterpretationNetworkMatrixViewSettings,
    normalizeInterpretationNetworkTableSettings,
    type InterpretationNetworkTableProjection,
    type InterpretationNetworkWorkspaceWidgetConfig
} from '@universo-react/types'

import type { InterpretationNetworkWorkspaceWidgetConfigDraftSetter } from './interpretationNetworkWorkspaceWidgetEditorDialogConfig'

interface InterpretationNetworkWorkspaceWidgetEditorDialogTableSectionProps {
    draft: InterpretationNetworkWorkspaceWidgetConfig
    setDraft: InterpretationNetworkWorkspaceWidgetConfigDraftSetter
    fieldIdPrefix: string
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialogTableSection({
    draft,
    setDraft,
    fieldIdPrefix
}: InterpretationNetworkWorkspaceWidgetEditorDialogTableSectionProps) {
    const { t } = useTranslation('metahubs')
    const defaultMatrixViewLabelId = fieldIdPrefix
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

    return (
        <>
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
                                              count: tableSettings.breadcrumbDepth.mode === 'last' ? tableSettings.breadcrumbDepth.count : 4
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
                            !viewSettings.allowedMatrixViews.includes('table') || tableSettings.tableProjection !== 'hierarchicalPath'
                        }
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                showHierarchicalTableHeaders: event.target.checked
                            }))
                        }
                        slotProps={{
                            input: {
                                'aria-label': t('layouts.interpretationNetworkEditor.tableHeaders', 'Show hierarchical table headers')
                            }
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
                            !viewSettings.allowedMatrixViews.includes('table') || tableSettings.tableProjection !== 'hierarchicalPath'
                        }
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                showHierarchicalTableHeaderCard: event.target.checked
                            }))
                        }
                        slotProps={{
                            input: {
                                'aria-label': t('layouts.interpretationNetworkEditor.tableHeaderCard', 'Show focused parent card')
                            }
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
                            !viewSettings.allowedMatrixViews.includes('table') || tableSettings.tableProjection !== 'hierarchicalPath'
                        }
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                colorBreadcrumbsByCell: event.target.checked
                            }))
                        }
                        slotProps={{
                            input: {
                                'aria-label': t('layouts.interpretationNetworkEditor.breadcrumbColors', 'Use cell colors for breadcrumbs')
                            }
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
                        slotProps={{
                            input: {
                                'aria-label': t('layouts.interpretationNetworkEditor.totalCells', 'Show total cells in tree')
                            }
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
        </>
    )
}
