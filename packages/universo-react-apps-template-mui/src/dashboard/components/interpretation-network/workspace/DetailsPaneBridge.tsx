import type { Dispatch, SetStateAction } from 'react'
import type { GridLocaleText } from '@mui/x-data-grid'
import type { TFunction } from 'i18next'
import { InterpretationNetworkDetailsPane } from '../InterpretationNetworkDetailsPane'
import {
    findMaterialTitle,
    readColumnText,
    readColumnValue,
    summarizeEditorJsContent,
    type MatrixCell,
    type RuntimeColumnLike,
    type RuntimeRow
} from '../model'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'

export interface DetailsPaneBridgeProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    selectedCell: MatrixCell | undefined
    selectedMaterial: RuntimeRow | undefined
    cellMaterials: RuntimeRow[]
    selectedMaterialId: string | null
    openedMaterialId: string | null
    materialBodyField: FieldConfig | undefined
    materialBodyValue: unknown
    dataGridLocaleText?: Partial<GridLocaleText>
    canCreateContent: boolean
    canEditContent: boolean
    canDeleteContent: boolean
    materialSectionId?: string
    isSavingMaterial: boolean
    isUpdatingPrimary: boolean
    isDeletingMaterial: boolean
    isLoadingMaterialAssociations?: boolean
    materialAssociationsError?: string | null
    materialEditorError: string | null
    primaryActionError: string | null
    deleteMaterialError: string | null
    materials: RuntimeRow[]
    materialColumns: RuntimeColumnLike[] | undefined
    materialTitleField: string
    saveMaterialBodyMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> }
    setPrimaryMaterialMutation: { mutate: (materialId: string | null) => void }
    deleteMaterialMutation: { mutateAsync: (materialId: string) => Promise<unknown> }
    actions: {
        setMaterialDialogError: Dispatch<SetStateAction<string | null>>
        setEditingMaterialId: Dispatch<SetStateAction<string | null>>
        setMaterialDialogMode: Dispatch<SetStateAction<'create' | 'edit' | null>>
        setSelectedMaterialId: Dispatch<SetStateAction<string | null>>
        setOpenedMaterialId: Dispatch<SetStateAction<string | null>>
    }
}

export function DetailsPaneBridge({
    t,
    locale,
    selectedCell,
    selectedMaterial,
    cellMaterials,
    selectedMaterialId,
    openedMaterialId,
    materialBodyField,
    materialBodyValue,
    dataGridLocaleText,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    materialSectionId,
    isSavingMaterial,
    isUpdatingPrimary,
    isDeletingMaterial,
    isLoadingMaterialAssociations = false,
    materialAssociationsError = null,
    materialEditorError,
    primaryActionError,
    deleteMaterialError,
    materials,
    materialColumns,
    materialTitleField,
    saveMaterialBodyMutation,
    setPrimaryMaterialMutation,
    deleteMaterialMutation,
    actions
}: DetailsPaneBridgeProps) {
    const materialTitle = findMaterialTitle(
        materials,
        materialColumns,
        selectedMaterial?.id ?? selectedCell?.materialRef ?? null,
        materialTitleField,
        locale
    )

    return (
        <InterpretationNetworkDetailsPane
            t={t}
            locale={locale}
            selectedCell={selectedCell}
            materialTitle={materialTitle}
            selectedMaterial={selectedMaterial}
            materialSummaries={cellMaterials.map((material) => ({
                id: material.id,
                row: material,
                title:
                    findMaterialTitle(materials, materialColumns, material.id, materialTitleField, locale) ||
                    t('workspace.material.untitled', 'Untitled material'),
                description: readColumnText(material, materialColumns, 'Description', locale),
                body: summarizeEditorJsContent(readColumnValue(material, materialColumns, 'Body'), locale),
                isPrimary: material.id === selectedCell?.materialRef
            }))}
            selectedMaterialId={openedMaterialId ?? selectedMaterialId ?? null}
            materialBodyField={materialBodyField}
            materialBodyValue={materialBodyValue}
            primaryMaterialId={selectedCell?.materialRef ?? null}
            dataGridLocaleText={dataGridLocaleText}
            canCreateContent={canCreateContent}
            canEditContent={canEditContent}
            canDeleteContent={canDeleteContent}
            materialSectionId={materialSectionId}
            isSavingMaterial={isSavingMaterial}
            isUpdatingPrimary={isUpdatingPrimary}
            isDeletingMaterial={isDeletingMaterial}
            isLoadingMaterialAssociations={isLoadingMaterialAssociations}
            materialAssociationsError={materialAssociationsError}
            materialEditorError={materialEditorError}
            primaryActionError={primaryActionError}
            deleteMaterialError={deleteMaterialError}
            onOpenCreateMaterial={() => {
                actions.setMaterialDialogError(null)
                actions.setEditingMaterialId(null)
                actions.setMaterialDialogMode('create')
            }}
            onOpenEditMaterial={(materialId) => {
                actions.setMaterialDialogError(null)
                actions.setEditingMaterialId(materialId)
                actions.setMaterialDialogMode('edit')
            }}
            onSelectMaterial={(materialId) => {
                actions.setSelectedMaterialId(materialId)
                actions.setOpenedMaterialId(materialId)
            }}
            onCloseMaterial={() => {
                actions.setOpenedMaterialId(null)
                actions.setMaterialDialogError(null)
            }}
            onSetPrimaryMaterial={(materialId) => setPrimaryMaterialMutation.mutate(materialId)}
            onClearPrimaryMaterial={() => setPrimaryMaterialMutation.mutate(null)}
            onDeleteMaterial={async (materialId) => {
                await deleteMaterialMutation.mutateAsync(materialId)
                actions.setOpenedMaterialId(null)
                actions.setSelectedMaterialId(null)
            }}
            onSaveMaterialBody={async (data) => {
                await saveMaterialBodyMutation.mutateAsync(data).catch(() => undefined)
            }}
        />
    )
}
