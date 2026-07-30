import { ConfirmDeleteDialog } from '../../../../components/dialogs/ConfirmDeleteDialog'
import { FormDialog } from '../../../../components/dialogs/FormDialog'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import type { TFunction } from 'i18next'
import { CellEditDialog } from '../CellEditDialog'
import type { InterpretationNetworkTemplateSummary } from '../../../../api/interpretationNetwork'
import type { MatrixAxisOptions, MatrixCell } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { StructureSummary } from './StructurePane'
import type { MatrixAxisDialogKind } from './workspaceState'
import { readInterpretationNetworkTemplateLabel } from './templateDisplay'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type MaterialDialogMode = 'create' | 'edit'
type StructureDialogMode = 'create' | 'edit'
type TemplateDialogMode = 'save' | 'edit'
type StructureCreateSource = 'blank' | 'template'

function MatrixAxisDialog({
    open,
    axis,
    t,
    isSubmitting,
    error,
    onClose,
    onSubmit
}: {
    open: boolean
    axis: MatrixAxisDialogKind | null
    t: TFunction<'interpretationNetwork'>
    isSubmitting: boolean
    error?: string | null
    onClose: () => void
    onSubmit: (name: string) => Promise<void>
}) {
    const [name, setName] = useState('')
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setName('')
        setValidationError(null)
    }, [open, axis])

    const title = axis === 'column' ? t('workspace.axis.addColumnTitle', 'Add column') : t('workspace.axis.addRowTitle', 'Add row')
    const fieldLabel = axis === 'column' ? t('workspace.axis.columnNameField', 'Column name') : t('workspace.axis.rowNameField', 'Row name')

    return (
        <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth='xs' fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ overflowY: 'visible', overflowX: 'visible', pt: 2 }}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {error ? <Alert severity='error'>{error}</Alert> : null}
                    <TextField
                        fullWidth
                        required
                        label={fieldLabel}
                        value={name}
                        error={Boolean(validationError)}
                        helperText={validationError ?? ' '}
                        disabled={isSubmitting}
                        onChange={(event) => {
                            setName(event.target.value)
                            if (validationError) setValidationError(null)
                        }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={isSubmitting}>
                    {t('workspace.actions.cancel', 'Cancel')}
                </Button>
                <Button
                    variant='contained'
                    disabled={isSubmitting}
                    onClick={async () => {
                        const trimmedName = name.trim()
                        if (!trimmedName) {
                            setValidationError(t('workspace.axis.requiredName', 'Enter a name.'))
                            return
                        }
                        await onSubmit(trimmedName)
                    }}
                >
                    {t('workspace.actions.create', 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

const templatePolicyOptions = [
    { value: 'structureOnly', labelKey: 'workspace.template.structureOnly', fallback: 'Structure only' },
    { value: 'withMaterials', labelKey: 'workspace.template.withMaterials', fallback: 'Structure and materials' }
]

const templatePolicyField = (t: TFunction<'interpretationNetwork'>): FieldConfig => ({
    id: 'templatePolicy',
    codename: 'templatePolicy',
    label: t('workspace.template.copyScope', 'Saved data'),
    type: 'REF',
    required: true,
    refTargetEntityKind: 'enumeration',
    enumPresentationMode: 'radio',
    enumAllowEmpty: false,
    enumOptions: templatePolicyOptions.map((option) => ({
        id: option.value,
        label: t(option.labelKey, option.fallback),
        codename: option.value
    }))
})

const templateFormFields = (t: TFunction<'interpretationNetwork'>, mode: TemplateDialogMode | null): FieldConfig[] => [
    {
        id: 'templateName',
        codename: 'templateName',
        label: t('workspace.template.name', 'Template name'),
        type: 'STRING',
        required: true,
        validationRules: { localized: true, minLength: 1, maxLength: 255 }
    },
    {
        id: 'description',
        codename: 'description',
        label: t('workspace.template.description', 'Description'),
        type: 'STRING',
        widget: 'textarea',
        validationRules: { localized: true, maxLength: 4000 },
        multilineRows: 3
    },
    ...(mode === 'save' ? [templatePolicyField(t)] : [])
]

const templateCopyScopeTable = (t: TFunction<'interpretationNetwork'>) => (
    <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size='small' aria-label={t('workspace.template.copyScope', 'Saved data')}>
            <TableHead>
                <TableRow>
                    <TableCell>{t('workspace.template.copyScopeColumn', 'Saved data')}</TableCell>
                    <TableCell>{t('workspace.template.copyScopeDescriptionColumn', 'Description')}</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow>
                    <TableCell>{t('workspace.template.structureOnly', 'Structure only')}</TableCell>
                    <TableCell>{t('workspace.template.structureOnlyHint', 'Matrix cells and hierarchy are copied.')}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>{t('workspace.template.withMaterials', 'Structure and materials')}</TableCell>
                    <TableCell>
                        {t(
                            'workspace.template.copyScopeHint',
                            'Materials attached to cells are copied. Relations and external files are not copied in this phase.'
                        )}
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </TableContainer>
)

const createFromTemplateHintTable = (
    t: TFunction<'interpretationNetwork'>,
    locale: string,
    selectedTemplate: InterpretationNetworkTemplateSummary | undefined
) => (
    <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size='small' aria-label={t('workspace.template.createScope', 'Template creation details')}>
            <TableBody>
                <TableRow>
                    <TableCell component='th' scope='row' sx={{ width: 180 }}>
                        {t('workspace.template.selectTemplate', 'Template')}
                    </TableCell>
                    <TableCell>
                        {selectedTemplate
                            ? readInterpretationNetworkTemplateLabel(selectedTemplate.name, locale) ||
                              t('workspace.template.untitled', 'Untitled template')
                            : t('workspace.template.selectTemplateRequired', 'Select a template.')}
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell component='th' scope='row'>
                        {t('workspace.template.copyScope', 'Saved data')}
                    </TableCell>
                    <TableCell>
                        {selectedTemplate?.includesMaterials
                            ? t(
                                  'workspace.template.createIncludesMaterials',
                                  'The new structure will include matrix cells and saved materials.'
                              )
                            : t('workspace.template.createStructureOnly', 'The new structure will include matrix cells only.')}
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </TableContainer>
)

export interface WorkspaceDialogsProps {
    a11yIdPrefix: string
    t: TFunction<'interpretationNetwork'>
    locale: string
    structureDialogMode: StructureDialogMode | null
    structureFields: FieldConfig[]
    structureInitialData: Record<string, unknown>
    structureCreateSource?: StructureCreateSource
    structureCreateTemplateId?: string
    templates?: InterpretationNetworkTemplateSummary[]
    isCreatingStructure: boolean
    isUpdatingStructure: boolean
    structureDialogError: string | null
    onCloseStructureDialog: () => void
    onSubmitStructure: (data: Record<string, unknown>) => Promise<void>
    onStructureCreateSourceChange?: (source: StructureCreateSource) => void
    onStructureCreateTemplateIdChange?: (templateId: string) => void
    structureDeleteId: string | null
    deleteStructure: StructureSummary | undefined
    isDeletingStructure: boolean
    structureDeleteError: string | null
    onCancelDeleteStructure: () => void
    onConfirmDeleteStructure: () => Promise<void>
    templateDialogMode?: TemplateDialogMode | null
    templateInitialData?: Record<string, unknown>
    templateDeleteId?: string | null
    deleteTemplate?: InterpretationNetworkTemplateSummary | undefined
    isSavingTemplate?: boolean
    isUpdatingTemplate?: boolean
    isDeletingTemplate?: boolean
    templateDialogError?: string | null
    onCloseTemplateDialog?: () => void
    onSubmitTemplate?: (data: Record<string, unknown>) => Promise<void>
    onCancelDeleteTemplate?: () => void
    onConfirmDeleteTemplate?: () => Promise<void>
    materialDialogMode: MaterialDialogMode | null
    materialFields: FieldConfig[]
    materialInitialData: Record<string, unknown>
    isSavingMaterialMetadata: boolean
    materialDialogError: string | null
    onCloseMaterialDialog: () => void
    onSubmitMaterial: (data: Record<string, unknown>) => Promise<void>
    cellDialogMode: CellDialogMode | null
    axisDialogKind: MatrixAxisDialogKind | null
    cellMetadataFields: FieldConfig[]
    styleFields: FieldConfig[]
    cellDialogInitialData: Record<string, unknown>
    matrixAxisOptions: MatrixAxisOptions
    cellDialogPlacement: MatrixCellPlacement | null
    allowNewAxesInCellDialog: boolean
    hideAxisLabelFields: boolean
    isSavingCell: boolean
    cellDialogError: string | null
    onCloseCellDialog: () => void
    onSubmitCell: (data: Record<string, unknown>) => Promise<void>
    onCloseAxisDialog: () => void
    onSubmitAxis: (name: string) => Promise<void>
    cellDeleteId: string | null
    deleteCell: MatrixCell | undefined
    isDeletingCell: boolean
    cellDeleteError: string | null
    onCancelDeleteCell: () => void
    onConfirmDeleteCell: () => Promise<void>
}

export function WorkspaceDialogs({
    a11yIdPrefix,
    t,
    locale,
    structureDialogMode,
    structureFields,
    structureInitialData,
    structureCreateSource = 'blank',
    structureCreateTemplateId = '',
    templates = [],
    isCreatingStructure,
    isUpdatingStructure,
    structureDialogError,
    onCloseStructureDialog,
    onSubmitStructure,
    onStructureCreateSourceChange = () => undefined,
    onStructureCreateTemplateIdChange = () => undefined,
    structureDeleteId,
    deleteStructure,
    isDeletingStructure,
    structureDeleteError,
    onCancelDeleteStructure,
    onConfirmDeleteStructure,
    templateDialogMode = null,
    templateInitialData = {},
    templateDeleteId = null,
    deleteTemplate,
    isSavingTemplate = false,
    isUpdatingTemplate = false,
    isDeletingTemplate = false,
    templateDialogError = null,
    onCloseTemplateDialog = () => undefined,
    onSubmitTemplate = async () => undefined,
    onCancelDeleteTemplate = () => undefined,
    onConfirmDeleteTemplate = async () => undefined,
    materialDialogMode,
    materialFields,
    materialInitialData,
    isSavingMaterialMetadata,
    materialDialogError,
    onCloseMaterialDialog,
    onSubmitMaterial,
    cellDialogMode,
    axisDialogKind,
    cellMetadataFields,
    styleFields,
    cellDialogInitialData,
    matrixAxisOptions,
    cellDialogPlacement,
    allowNewAxesInCellDialog,
    hideAxisLabelFields,
    isSavingCell,
    cellDialogError,
    onCloseCellDialog,
    onSubmitCell,
    onCloseAxisDialog,
    onSubmitAxis,
    cellDeleteId,
    deleteCell,
    isDeletingCell,
    cellDeleteError,
    onCancelDeleteCell,
    onConfirmDeleteCell
}: WorkspaceDialogsProps) {
    const selectedTemplate = templates.find((template) => template.id === structureCreateTemplateId)
    const createFromTemplateDescriptionId = `${a11yIdPrefix}-create-from-template-description`
    const templateCopyScopeDescriptionId = `${a11yIdPrefix}-template-copy-scope-description`
    const createTabIds = {
        blank: `${a11yIdPrefix}-create-blank-tab`,
        template: `${a11yIdPrefix}-create-template-tab`
    } as const
    const createTabPanelIds = {
        blank: `${a11yIdPrefix}-create-blank-panel`,
        template: `${a11yIdPrefix}-create-template-panel`
    } as const
    const showCreateTabs = structureDialogMode === 'create' && templates.length > 0
    const effectiveStructureFields =
        structureDialogMode === 'create' && structureCreateSource === 'template'
            ? structureFields.map((field) =>
                  field.codename === 'Name' || field.id === 'Name'
                      ? {
                            ...field,
                            required: true,
                            validationRules: {
                                ...field.validationRules,
                                localized: field.validationRules?.localized ?? true,
                                minLength: Math.max(1, field.validationRules?.minLength ?? 1)
                            }
                        }
                      : field
              )
            : structureFields
    return (
        <>
            <FormDialog
                open={structureDialogMode !== null}
                title={
                    structureDialogMode === 'edit'
                        ? t('workspace.structure.editTitle', 'Edit structure')
                        : t('workspace.structure.create', 'Create structure')
                }
                fields={effectiveStructureFields}
                locale={locale}
                initialData={structureInitialData}
                isSubmitting={isCreatingStructure || isUpdatingStructure}
                error={structureDialogError}
                contentHeaderId={structureCreateSource === 'template' ? createFromTemplateDescriptionId : undefined}
                contentHeader={
                    showCreateTabs ? (
                        <Stack spacing={2}>
                            <Tabs
                                value={structureCreateSource}
                                onChange={(_event, value: StructureCreateSource) => onStructureCreateSourceChange(value)}
                                aria-label={t('workspace.structure.createTabs', 'Create structure sections')}
                                sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                            >
                                <Tab
                                    value='blank'
                                    label={t('workspace.structure.mainTab', 'Main')}
                                    id={createTabIds.blank}
                                    aria-controls={createTabPanelIds.blank}
                                    sx={{ minHeight: 40 }}
                                />
                                <Tab
                                    value='template'
                                    label={t('workspace.template.title', 'Templates')}
                                    id={createTabIds.template}
                                    aria-controls={createTabPanelIds.template}
                                    sx={{ minHeight: 40 }}
                                />
                            </Tabs>
                            <Box
                                role='tabpanel'
                                id={createTabPanelIds[structureCreateSource]}
                                aria-labelledby={createTabIds[structureCreateSource]}
                            >
                                {structureCreateSource === 'template' ? (
                                    <Stack spacing={2}>
                                        <FormControl fullWidth required disabled={isCreatingStructure}>
                                            <InputLabel id='interpretation-network-create-template-select-label'>
                                                {t('workspace.template.selectTemplate', 'Template')}
                                            </InputLabel>
                                            <Select
                                                labelId='interpretation-network-create-template-select-label'
                                                label={t('workspace.template.selectTemplate', 'Template')}
                                                value={structureCreateTemplateId}
                                                onChange={(event) => onStructureCreateTemplateIdChange(event.target.value)}
                                                MenuProps={{ anchorReference: 'none' }}
                                            >
                                                {templates.map((template) => (
                                                    <MenuItem key={template.id} value={template.id}>
                                                        {readInterpretationNetworkTemplateLabel(template.name, locale) ||
                                                            t('workspace.template.untitled', 'Untitled template')}
                                                        {template.includesMaterials
                                                            ? ` · ${t('workspace.template.withMaterialsShort', 'with materials')}`
                                                            : ''}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        {createFromTemplateHintTable(t, locale, selectedTemplate)}
                                    </Stack>
                                ) : null}
                            </Box>
                            <Box
                                role='tabpanel'
                                id={createTabPanelIds[structureCreateSource === 'blank' ? 'template' : 'blank']}
                                aria-labelledby={createTabIds[structureCreateSource === 'blank' ? 'template' : 'blank']}
                                hidden
                            />
                        </Stack>
                    ) : null
                }
                saveButtonText={
                    structureDialogMode === 'edit' ? t('workspace.actions.save', 'Save') : t('workspace.actions.create', 'Create')
                }
                onClose={onCloseStructureDialog}
                onSubmit={onSubmitStructure}
            />
            <ConfirmDeleteDialog
                open={Boolean(structureDeleteId)}
                title={t('workspace.structure.deleteTitle', 'Delete structure?')}
                description={t('workspace.structure.deleteDescription', {
                    defaultValue: 'Delete the structure “{{title}}” and its matrix?',
                    title: deleteStructure?.title || t('workspace.untitledConcept', 'Untitled concept')
                })}
                confirmButtonText={t('workspace.actions.delete', 'Delete')}
                deletingButtonText={t('workspace.actions.deleting', 'Deleting...')}
                cancelButtonText={t('workspace.actions.cancel', 'Cancel')}
                loading={isDeletingStructure}
                error={structureDeleteError ?? undefined}
                onCancel={onCancelDeleteStructure}
                onConfirm={onConfirmDeleteStructure}
            />
            <FormDialog
                open={templateDialogMode !== null}
                title={
                    templateDialogMode === 'edit'
                        ? t('workspace.template.editTitle', 'Edit template')
                        : t('workspace.template.saveTitle', 'Save structure as template')
                }
                fields={templateFormFields(t, templateDialogMode)}
                locale={locale}
                initialData={templateInitialData}
                isSubmitting={isSavingTemplate || isUpdatingTemplate}
                error={templateDialogError}
                contentHeaderId={templateDialogMode === 'save' ? templateCopyScopeDescriptionId : undefined}
                contentHeader={templateDialogMode === 'save' ? templateCopyScopeTable(t) : undefined}
                saveButtonText={templateDialogMode === 'edit' ? t('workspace.actions.save', 'Save') : t('workspace.actions.save', 'Save')}
                onClose={onCloseTemplateDialog}
                onSubmit={onSubmitTemplate}
            />
            <ConfirmDeleteDialog
                open={Boolean(templateDeleteId)}
                title={t('workspace.template.deleteTitle', 'Delete template?')}
                description={t('workspace.template.deleteDescription', {
                    defaultValue: 'Delete the template “{{title}}”? Structures created from this template are not changed.',
                    title:
                        readInterpretationNetworkTemplateLabel(deleteTemplate?.name, locale) ||
                        t('workspace.template.untitled', 'Untitled template')
                })}
                confirmButtonText={t('workspace.actions.delete', 'Delete')}
                deletingButtonText={t('workspace.actions.deleting', 'Deleting...')}
                cancelButtonText={t('workspace.actions.cancel', 'Cancel')}
                loading={isDeletingTemplate}
                error={templateDialogError ?? undefined}
                onCancel={onCancelDeleteTemplate}
                onConfirm={onConfirmDeleteTemplate}
            />
            <FormDialog
                open={materialDialogMode !== null}
                title={
                    materialDialogMode === 'edit'
                        ? t('workspace.material.editTitle', 'Edit material')
                        : t('workspace.material.createTitle', 'Add material')
                }
                fields={materialFields}
                locale={locale}
                initialData={materialInitialData}
                isSubmitting={isSavingMaterialMetadata}
                error={materialDialogError}
                saveButtonText={
                    materialDialogMode === 'edit' ? t('workspace.actions.save', 'Save') : t('workspace.actions.create', 'Create')
                }
                onClose={onCloseMaterialDialog}
                onSubmit={onSubmitMaterial}
            />
            <CellEditDialog
                open={cellDialogMode !== null && axisDialogKind === null}
                mode={cellDialogMode === 'edit' ? 'edit' : 'create'}
                t={t}
                locale={locale}
                fields={cellMetadataFields}
                styleFields={styleFields}
                initialData={cellDialogInitialData}
                axisOptions={matrixAxisOptions}
                initialPlacement={cellDialogPlacement ?? undefined}
                allowNewAxes={allowNewAxesInCellDialog}
                hidePlacementFields={(cellDialogMode === 'create-child' && !allowNewAxesInCellDialog) || hideAxisLabelFields}
                hideAxisLabelFields={hideAxisLabelFields}
                isSubmitting={isSavingCell}
                error={cellDialogError}
                onClose={onCloseCellDialog}
                onSubmit={onSubmitCell}
            />
            <MatrixAxisDialog
                open={axisDialogKind !== null}
                axis={axisDialogKind}
                t={t}
                isSubmitting={isSavingCell}
                error={cellDialogError}
                onClose={onCloseAxisDialog}
                onSubmit={onSubmitAxis}
            />
            <ConfirmDeleteDialog
                open={Boolean(cellDeleteId)}
                title={t('workspace.cell.deleteTitle', 'Delete cell?')}
                description={t('workspace.cell.deleteDescription', {
                    defaultValue: 'Delete the cell “{{title}}”? Materials attached to the cell will stay in the workspace.',
                    title: deleteCell?.title || t('workspace.emptyCell', 'Empty cell')
                })}
                confirmButtonText={t('workspace.actions.delete', 'Delete')}
                deletingButtonText={t('workspace.actions.deleting', 'Deleting...')}
                cancelButtonText={t('workspace.actions.cancel', 'Cancel')}
                loading={isDeletingCell}
                error={cellDeleteError ?? undefined}
                onCancel={onCancelDeleteCell}
                onConfirm={onConfirmDeleteCell}
            />
        </>
    )
}
