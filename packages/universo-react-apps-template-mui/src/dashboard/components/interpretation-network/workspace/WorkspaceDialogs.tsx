import { ConfirmDeleteDialog } from '../../../../components/dialogs/ConfirmDeleteDialog'
import { FormDialog } from '../../../../components/dialogs/FormDialog'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { TFunction } from 'i18next'
import { CellEditDialog } from '../CellEditDialog'
import type { MatrixAxisOptions, MatrixCell } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { StructureSummary } from './StructurePane'
import type { MatrixAxisDialogKind } from './workspaceState'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type MaterialDialogMode = 'create' | 'edit'
type StructureDialogMode = 'create' | 'edit'

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

export interface WorkspaceDialogsProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    structureDialogMode: StructureDialogMode | null
    structureFields: FieldConfig[]
    structureInitialData: Record<string, unknown>
    isCreatingStructure: boolean
    isUpdatingStructure: boolean
    structureDialogError: string | null
    onCloseStructureDialog: () => void
    onSubmitStructure: (data: Record<string, unknown>) => Promise<void>
    structureDeleteId: string | null
    deleteStructure: StructureSummary | undefined
    isDeletingStructure: boolean
    structureDeleteError: string | null
    onCancelDeleteStructure: () => void
    onConfirmDeleteStructure: () => Promise<void>
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
    t,
    locale,
    structureDialogMode,
    structureFields,
    structureInitialData,
    isCreatingStructure,
    isUpdatingStructure,
    structureDialogError,
    onCloseStructureDialog,
    onSubmitStructure,
    structureDeleteId,
    deleteStructure,
    isDeletingStructure,
    structureDeleteError,
    onCancelDeleteStructure,
    onConfirmDeleteStructure,
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
    return (
        <>
            <FormDialog
                open={structureDialogMode !== null}
                title={
                    structureDialogMode === 'edit'
                        ? t('workspace.structure.editTitle', 'Edit structure')
                        : t('workspace.structure.create', 'Create structure')
                }
                fields={structureFields}
                locale={locale}
                initialData={structureInitialData}
                isSubmitting={isCreatingStructure || isUpdatingStructure}
                error={structureDialogError}
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
