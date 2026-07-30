import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { StructureSummary } from './StructurePane'
import type { SelectMatrixCell } from './useMatrixWorkspaceActions'

export function useRuntimeSelectionActions({
    templates,
    setStructureDialogError,
    clearEditingStructure,
    setStructureCreateSource,
    setStructureCreateTemplateId,
    setStructureDialogMode,
    setStructureReturnFocusId,
    setSelectedConceptId,
    setSelectedInterpretationId,
    setSelectedMaterialId,
    setOpenedMaterialId,
    setMaterialDialogMode,
    setEditingMaterialId,
    selectMatrixCell,
    navigateToStructure
}: {
    templates: Array<{ id: string }>
    setStructureDialogError: Dispatch<SetStateAction<string | null>>
    clearEditingStructure: () => void
    setStructureCreateSource: Dispatch<SetStateAction<'blank' | 'template'>>
    setStructureCreateTemplateId: Dispatch<SetStateAction<string>>
    setStructureDialogMode: Dispatch<SetStateAction<'create' | 'edit' | null>>
    setStructureReturnFocusId: Dispatch<SetStateAction<string | null>>
    setSelectedConceptId: Dispatch<SetStateAction<string | null>>
    setSelectedInterpretationId: Dispatch<SetStateAction<string | null>>
    setSelectedMaterialId: Dispatch<SetStateAction<string | null>>
    setOpenedMaterialId: Dispatch<SetStateAction<string | null>>
    setMaterialDialogMode: Dispatch<SetStateAction<'create' | 'edit' | null>>
    setEditingMaterialId: Dispatch<SetStateAction<string | null>>
    selectMatrixCell: SelectMatrixCell
    navigateToStructure: (structureId: string | null, options?: { replace?: boolean; focusedCellId?: string | null }) => void
}) {
    const clearMaterialRuntimeState = useCallback(() => {
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
    }, [setEditingMaterialId, setMaterialDialogMode, setOpenedMaterialId, setSelectedMaterialId])

    const openStructure = useCallback(
        (structure: StructureSummary) => {
            setStructureReturnFocusId(structure.id)
            setSelectedConceptId(structure.id)
            setSelectedInterpretationId(structure.interpretationId)
            selectMatrixCell(null, { replace: true })
            clearMaterialRuntimeState()
            navigateToStructure(structure.id)
        },
        [
            clearMaterialRuntimeState,
            navigateToStructure,
            selectMatrixCell,
            setSelectedConceptId,
            setSelectedInterpretationId,
            setStructureReturnFocusId
        ]
    )

    const backToStructureList = useCallback(() => {
        setSelectedConceptId(null)
        setSelectedInterpretationId(null)
        selectMatrixCell(null, { replace: true })
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        navigateToStructure(null)
    }, [
        navigateToStructure,
        selectMatrixCell,
        setOpenedMaterialId,
        setSelectedConceptId,
        setSelectedInterpretationId,
        setSelectedMaterialId
    ])

    const openCreateStructureDialog = useCallback(() => {
        setStructureDialogError(null)
        clearEditingStructure()
        setStructureCreateSource('blank')
        setStructureCreateTemplateId(templates[0]?.id ?? '')
        setStructureDialogMode('create')
    }, [
        clearEditingStructure,
        setStructureCreateSource,
        setStructureCreateTemplateId,
        setStructureDialogError,
        setStructureDialogMode,
        templates
    ])

    return { openStructure, backToStructureList, openCreateStructureDialog }
}
