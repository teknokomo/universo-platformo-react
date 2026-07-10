import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { createLocalizedContent } from '@universo-react/utils'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import type { MatrixAxisOptions, MatrixCell } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { StructureSummary } from './StructurePane'
import { WorkspaceDialogs } from './WorkspaceDialogs'
import type { MatrixAxisDialogKind } from './workspaceState'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type MaterialDialogMode = 'create' | 'edit'
type StructureDialogMode = 'create' | 'edit'
type MutationLike<TVariables = Record<string, unknown>> = {
    isPending: boolean
    mutateAsync: (variables: TVariables) => Promise<unknown>
}

export interface WorkspaceDialogsBridgeProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    structure: {
        mode: StructureDialogMode | null
        fields: FieldConfig[]
        initialData: Record<string, unknown>
        error: string | null
        deleteId: string | null
        deleteStructure: StructureSummary | undefined
        deleteError: string | null
    }
    material: { mode: MaterialDialogMode | null; fields: FieldConfig[]; initialData: Record<string, unknown>; error: string | null }
    cell: {
        mode: CellDialogMode | null
        axisDialogKind: MatrixAxisDialogKind | null
        fields: FieldConfig[]
        styleFields: FieldConfig[]
        initialData: Record<string, unknown>
        axisOptions: MatrixAxisOptions
        placement: MatrixCellPlacement | null
        allowNewAxesInCellDialog: boolean
        error: string | null
        deleteId: string | null
        deleteCell: MatrixCell | undefined
        deleteError: string | null
    }
    mutations: {
        createStructure: MutationLike
        updateStructure: MutationLike
        deleteStructure: MutationLike<void>
        saveMaterialMetadata: MutationLike
        saveCell: MutationLike<{ mode: CellDialogMode; data: Record<string, unknown> }>
        deleteCell: MutationLike<void>
    }
    actions: {
        setStructureDialogMode: Dispatch<SetStateAction<StructureDialogMode | null>>
        setEditingStructureId: Dispatch<SetStateAction<string | null>>
        setStructureDialogError: Dispatch<SetStateAction<string | null>>
        setStructureDeleteId: Dispatch<SetStateAction<string | null>>
        setStructureDeleteError: Dispatch<SetStateAction<string | null>>
        setMaterialDialogMode: Dispatch<SetStateAction<MaterialDialogMode | null>>
        setEditingMaterialId: Dispatch<SetStateAction<string | null>>
        setMaterialDialogError: Dispatch<SetStateAction<string | null>>
        setCellDialogMode: Dispatch<SetStateAction<CellDialogMode | null>>
        setCellDialogSourceCellId: Dispatch<SetStateAction<string | null>>
        setCellDialogPlacement: Dispatch<SetStateAction<MatrixCellPlacement | null>>
        setAxisDialogKind: Dispatch<SetStateAction<MatrixAxisDialogKind | null>>
        setCellDialogError: Dispatch<SetStateAction<string | null>>
        setCellDeleteId: Dispatch<SetStateAction<string | null>>
        setCellDeleteError: Dispatch<SetStateAction<string | null>>
    }
}

export function WorkspaceDialogsBridge({ t, locale, structure, material, cell, mutations, actions }: WorkspaceDialogsBridgeProps) {
    return (
        <WorkspaceDialogs
            t={t}
            locale={locale}
            structureDialogMode={structure.mode}
            structureFields={structure.fields}
            structureInitialData={structure.initialData}
            isCreatingStructure={mutations.createStructure.isPending}
            isUpdatingStructure={mutations.updateStructure.isPending}
            structureDialogError={structure.error}
            onCloseStructureDialog={() => {
                if (mutations.createStructure.isPending || mutations.updateStructure.isPending) return
                actions.setStructureDialogMode(null)
                actions.setEditingStructureId(null)
                actions.setStructureDialogError(null)
            }}
            onSubmitStructure={async (data) => {
                if (structure.mode === 'edit') {
                    await mutations.updateStructure.mutateAsync(data).catch(() => undefined)
                    return
                }
                await mutations.createStructure.mutateAsync(data).catch(() => undefined)
            }}
            structureDeleteId={structure.deleteId}
            deleteStructure={structure.deleteStructure}
            isDeletingStructure={mutations.deleteStructure.isPending}
            structureDeleteError={structure.deleteError}
            onCancelDeleteStructure={() => {
                if (mutations.deleteStructure.isPending) return
                actions.setStructureDeleteId(null)
                actions.setStructureDeleteError(null)
            }}
            onConfirmDeleteStructure={async () => {
                await mutations.deleteStructure.mutateAsync(undefined).catch(() => undefined)
            }}
            materialDialogMode={material.mode}
            materialFields={material.fields}
            materialInitialData={material.initialData}
            isSavingMaterialMetadata={mutations.saveMaterialMetadata.isPending}
            materialDialogError={material.error}
            onCloseMaterialDialog={() => {
                if (mutations.saveMaterialMetadata.isPending) return
                actions.setMaterialDialogMode(null)
                actions.setEditingMaterialId(null)
                actions.setMaterialDialogError(null)
            }}
            onSubmitMaterial={async (data) => {
                await mutations.saveMaterialMetadata.mutateAsync(data).catch(() => undefined)
            }}
            cellDialogMode={cell.mode}
            axisDialogKind={cell.axisDialogKind}
            cellMetadataFields={cell.fields}
            styleFields={cell.styleFields}
            cellDialogInitialData={cell.initialData}
            matrixAxisOptions={cell.axisOptions}
            cellDialogPlacement={cell.placement}
            allowNewAxesInCellDialog={cell.allowNewAxesInCellDialog}
            isSavingCell={mutations.saveCell.isPending}
            cellDialogError={cell.error}
            onCloseCellDialog={() => {
                if (mutations.saveCell.isPending) return
                actions.setCellDialogMode(null)
                actions.setCellDialogSourceCellId(null)
                actions.setCellDialogPlacement(null)
                actions.setCellDialogError(null)
            }}
            onSubmitCell={async (data) => {
                if (!cell.mode) return
                await mutations.saveCell.mutateAsync({ mode: cell.mode, data }).catch(() => undefined)
            }}
            onCloseAxisDialog={() => {
                if (mutations.saveCell.isPending) return
                actions.setCellDialogMode(null)
                actions.setAxisDialogKind(null)
                actions.setCellDialogSourceCellId(null)
                actions.setCellDialogPlacement(null)
                actions.setCellDialogError(null)
            }}
            onSubmitAxis={async (name) => {
                if (!cell.mode) return
                const axisLabel = createLocalizedContent(locale, name)
                await mutations.saveCell
                    .mutateAsync({
                        mode: cell.mode,
                        data: {
                            __axisName: name,
                            __matrixCellPlacement: {
                                ...cell.placement,
                                ...(cell.axisDialogKind === 'row' ? { row: { kind: 'new', label: name, labelValue: axisLabel } } : {}),
                                ...(cell.axisDialogKind === 'column' ? { column: { kind: 'new', label: name, labelValue: axisLabel } } : {})
                            }
                        }
                    })
                    .catch(() => undefined)
            }}
            cellDeleteId={cell.deleteId}
            deleteCell={cell.deleteCell}
            isDeletingCell={mutations.deleteCell.isPending}
            cellDeleteError={cell.deleteError}
            onCancelDeleteCell={() => {
                if (mutations.deleteCell.isPending) return
                actions.setCellDeleteId(null)
                actions.setCellDeleteError(null)
            }}
            onConfirmDeleteCell={async () => {
                await mutations.deleteCell.mutateAsync(undefined).catch(() => undefined)
            }}
        />
    )
}
