import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { createLocalizedContent } from '@universo-react/utils'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import type { InterpretationNetworkTemplateSummary } from '../../../../api/interpretationNetwork'
import type { MatrixAxisOptions, MatrixCell } from '../model'
import type { MatrixCellPlacement } from '../matrixCellData'
import type { StructureSummary } from './StructurePane'
import { WorkspaceDialogs } from './WorkspaceDialogs'
import type { MatrixAxisDialogKind } from './workspaceState'

type CellDialogMode = 'create-child' | 'create-cell' | 'create-row' | 'edit'
type MaterialDialogMode = 'create' | 'edit'
type StructureDialogMode = 'create' | 'edit'
type TemplateDialogMode = 'save' | 'edit'
type StructureCreateSource = 'blank' | 'template'
type MutationLike<TVariables = Record<string, unknown>> = {
    isPending: boolean
    mutateAsync: (variables: TVariables) => Promise<unknown>
}
type VoidMutationLike = {
    isPending: boolean
    mutateAsync: () => Promise<unknown>
}
const noopMutation: MutationLike = {
    isPending: false,
    mutateAsync: async () => undefined
}
const noopVoidMutation: VoidMutationLike = {
    isPending: false,
    mutateAsync: async () => undefined
}

const noopDispatch = () => undefined

export interface WorkspaceDialogsBridgeProps {
    a11yIdPrefix: string
    t: TFunction<'interpretationNetwork'>
    locale: string
    structure: {
        mode: StructureDialogMode | null
        fields: FieldConfig[]
        initialData: Record<string, unknown>
        createSource?: StructureCreateSource
        createTemplateId?: string
        templates?: InterpretationNetworkTemplateSummary[]
        error: string | null
        deleteId: string | null
        deleteStructure: StructureSummary | undefined
        deleteError: string | null
    }
    template?: {
        mode: TemplateDialogMode | null
        error: string | null
        initialData?: Record<string, unknown>
        deleteId?: string | null
        deleteTemplate?: InterpretationNetworkTemplateSummary | undefined
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
        hideAxisLabelFields: boolean
        error: string | null
        deleteId: string | null
        deleteCell: MatrixCell | undefined
        deleteError: string | null
    }
    mutations: {
        createStructure: MutationLike
        updateStructure: MutationLike
        deleteStructure: VoidMutationLike
        saveTemplate?: MutationLike
        updateTemplate?: MutationLike
        deleteTemplate?: VoidMutationLike
        saveMaterialMetadata: MutationLike
        saveCell: MutationLike<{ mode: CellDialogMode; data: Record<string, unknown> }>
        deleteCell: VoidMutationLike
    }
    actions: {
        setStructureDialogMode: Dispatch<SetStateAction<StructureDialogMode | null>>
        setStructureCreateSource?: Dispatch<SetStateAction<StructureCreateSource>>
        setStructureCreateTemplateId?: Dispatch<SetStateAction<string>>
        setEditingStructureId: Dispatch<SetStateAction<string | null>>
        setStructureDialogError: Dispatch<SetStateAction<string | null>>
        setStructureDeleteId: Dispatch<SetStateAction<string | null>>
        setStructureDeleteError: Dispatch<SetStateAction<string | null>>
        setTemplateDialogMode?: Dispatch<SetStateAction<TemplateDialogMode | null>>
        setTemplateDialogError?: Dispatch<SetStateAction<string | null>>
        closeTemplateDialog?: () => void
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

export function WorkspaceDialogsBridge({
    a11yIdPrefix,
    t,
    locale,
    structure,
    template,
    material,
    cell,
    mutations,
    actions
}: WorkspaceDialogsBridgeProps) {
    const templateState = template ?? { mode: null, error: null, initialData: {} }
    const saveTemplateMutation = mutations.saveTemplate ?? noopMutation
    const updateTemplateMutation = mutations.updateTemplate ?? noopMutation
    const deleteTemplateMutation = mutations.deleteTemplate ?? noopVoidMutation
    const setTemplateDialogMode = actions.setTemplateDialogMode ?? noopDispatch
    const setTemplateDialogError = actions.setTemplateDialogError ?? noopDispatch
    const closeTemplateDialog =
        actions.closeTemplateDialog ??
        (() => {
            setTemplateDialogMode(null)
            setTemplateDialogError(null)
        })

    return (
        <WorkspaceDialogs
            a11yIdPrefix={a11yIdPrefix}
            t={t}
            locale={locale}
            structureDialogMode={structure.mode}
            structureFields={structure.fields}
            structureInitialData={structure.initialData}
            structureCreateSource={structure.createSource}
            structureCreateTemplateId={structure.createTemplateId}
            templates={structure.templates}
            isCreatingStructure={mutations.createStructure.isPending}
            isUpdatingStructure={mutations.updateStructure.isPending}
            structureDialogError={structure.error}
            onCloseStructureDialog={() => {
                if (mutations.createStructure.isPending || mutations.updateStructure.isPending) return
                actions.setStructureDialogMode(null)
                actions.setEditingStructureId(null)
                actions.setStructureDialogError(null)
                actions.setStructureCreateSource?.('blank')
                actions.setStructureCreateTemplateId?.('')
            }}
            onSubmitStructure={async (data) => {
                if (structure.mode === 'edit') {
                    await mutations.updateStructure.mutateAsync(data).catch(() => undefined)
                    return
                }
                await mutations.createStructure.mutateAsync(data).catch(() => undefined)
            }}
            onStructureCreateSourceChange={(source) => actions.setStructureCreateSource?.(source)}
            onStructureCreateTemplateIdChange={(templateId) => actions.setStructureCreateTemplateId?.(templateId)}
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
                await mutations.deleteStructure.mutateAsync().catch(() => undefined)
            }}
            templateDialogMode={templateState.mode}
            templateInitialData={templateState.initialData}
            templateDeleteId={templateState.deleteId}
            deleteTemplate={templateState.deleteTemplate}
            isSavingTemplate={saveTemplateMutation.isPending}
            isUpdatingTemplate={updateTemplateMutation.isPending}
            isDeletingTemplate={deleteTemplateMutation.isPending}
            templateDialogError={templateState.error}
            onCloseTemplateDialog={() => {
                if (saveTemplateMutation.isPending || updateTemplateMutation.isPending) return
                closeTemplateDialog()
            }}
            onSubmitTemplate={async (data) => {
                if (templateState.mode === 'save') {
                    await saveTemplateMutation.mutateAsync(data).catch(() => undefined)
                    return
                }
                if (templateState.mode === 'edit') {
                    await updateTemplateMutation.mutateAsync(data).catch(() => undefined)
                }
            }}
            onCancelDeleteTemplate={() => {
                if (deleteTemplateMutation.isPending) return
                closeTemplateDialog()
            }}
            onConfirmDeleteTemplate={async () => {
                await deleteTemplateMutation.mutateAsync().catch(() => undefined)
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
            hideAxisLabelFields={cell.hideAxisLabelFields}
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
                await mutations.deleteCell.mutateAsync().catch(() => undefined)
            }}
        />
    )
}
