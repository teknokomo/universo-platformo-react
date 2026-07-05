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
    materialSectionId?: string
    isSavingMaterial: boolean
    materialEditorError: string | null
    materials: RuntimeRow[]
    materialColumns: RuntimeColumnLike[] | undefined
    materialTitleField: string
    saveMaterialBodyMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> }
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
    materialSectionId,
    isSavingMaterial,
    materialEditorError,
    materials,
    materialColumns,
    materialTitleField,
    saveMaterialBodyMutation,
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
                body: summarizeEditorJsContent(readColumnValue(material, materialColumns, 'Body'), locale)
            }))}
            selectedMaterialId={openedMaterialId ?? selectedMaterialId ?? null}
            materialBodyField={materialBodyField}
            materialBodyValue={materialBodyValue}
            dataGridLocaleText={dataGridLocaleText}
            canCreateContent={canCreateContent}
            canEditContent={canEditContent}
            materialSectionId={materialSectionId}
            isSavingMaterial={isSavingMaterial}
            materialEditorError={materialEditorError}
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
            onSaveMaterialBody={async (data) => {
                await saveMaterialBodyMutation.mutateAsync(data).catch(() => undefined)
            }}
        />
    )
}
