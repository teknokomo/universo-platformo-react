import { ConfirmDeleteDialog } from '../../../../components/dialogs/ConfirmDeleteDialog'
import { FormDialog } from '../../../../components/dialogs/FormDialog'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import type { TFunction } from 'i18next'
import { CellEditDialog } from '../CellEditDialog'
import type { MatrixCell } from '../model'
import type { StructureSummary } from './StructurePane'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type MaterialDialogMode = 'create' | 'edit'
type StructureDialogMode = 'create' | 'edit'

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
    cellMetadataFields: FieldConfig[]
    styleFields: FieldConfig[]
    cellDialogInitialData: Record<string, unknown>
    isSavingCell: boolean
    cellDialogError: string | null
    onCloseCellDialog: () => void
    onSubmitCell: (data: Record<string, unknown>) => Promise<void>
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
    cellMetadataFields,
    styleFields,
    cellDialogInitialData,
    isSavingCell,
    cellDialogError,
    onCloseCellDialog,
    onSubmitCell,
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
                open={cellDialogMode !== null}
                mode={cellDialogMode === 'edit' ? 'edit' : 'create'}
                t={t}
                locale={locale}
                fields={cellMetadataFields}
                styleFields={styleFields}
                initialData={cellDialogInitialData}
                isSubmitting={isSavingCell}
                error={cellDialogError}
                onClose={onCloseCellDialog}
                onSubmit={onSubmitCell}
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
