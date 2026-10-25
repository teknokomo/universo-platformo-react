import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import {
    createInterpretationNetworkMaterial,
    deleteInterpretationNetworkMaterial,
    setInterpretationNetworkPrimaryMaterial,
    updateInterpretationNetworkMaterial
} from '../../../../api/interpretationNetwork'
import type { MatrixCell, RuntimeRow } from '../model'
import { readRuntimeRowVersion } from './workspaceRuntime'
import type { MaterialDialogMode } from './workspaceState'

type RuntimeApplicationDetails = {
    apiBaseUrl?: string | null
    applicationId?: string | null
    currentWorkspaceId?: string | null
}

type UseMaterialMutationsOptions = {
    t: TFunction<'interpretationNetwork'>
    queryClient: QueryClient
    details: RuntimeApplicationDetails | null | undefined
    canCreateContent: boolean
    canEditContent: boolean
    canDeleteContent: boolean
    widgetId?: string | null
    layoutId?: string | null
    materialSectionId?: string | null
    interpretationSectionId?: string | null
    interpretationId?: string | null
    matrixColumnId?: string | null
    selectedCell?: MatrixCell
    selectedRawCell?: RuntimeRow
    selectedMaterial?: RuntimeRow
    cellMaterials: RuntimeRow[]
    materials: RuntimeRow[]
    materialDialogMode: MaterialDialogMode | null
    editingMaterialId: string | null
    openedMaterialId: string | null
    setMaterialDialogMode: (mode: MaterialDialogMode | null) => void
    setEditingMaterialId: Dispatch<SetStateAction<string | null>>
    setSelectedMaterialId: (materialId: string | null) => void
    setOpenedMaterialId: (materialId: string | null) => void
    setMaterialDialogError: (message: string | null) => void
    setPrimaryActionError: (message: string | null) => void
    setDeleteMaterialError: (message: string | null) => void
}

export function useMaterialMutations({
    t,
    queryClient,
    details,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    widgetId,
    layoutId,
    materialSectionId,
    interpretationSectionId,
    interpretationId,
    matrixColumnId,
    selectedCell,
    selectedRawCell,
    selectedMaterial,
    cellMaterials,
    materials,
    materialDialogMode,
    editingMaterialId,
    openedMaterialId,
    setMaterialDialogMode,
    setEditingMaterialId,
    setSelectedMaterialId,
    setOpenedMaterialId,
    setMaterialDialogError,
    setPrimaryActionError,
    setDeleteMaterialError
}: UseMaterialMutationsOptions) {
    const invalidateMaterialQueries = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] }),
            queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] }),
            queryClient.invalidateQueries({ queryKey: ['interpretationNetworkMaterialAssociations'] })
        ])
    }

    const saveMaterialMetadataMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !materialSectionId) return null
            if (!interpretationId || !matrixColumnId || !selectedRawCell?.id || !selectedCell?.id || !interpretationSectionId) {
                throw new Error('cell-not-selected')
            }

            if (materialDialogMode === 'edit') {
                const targetMaterialId = editingMaterialId
                if (!canEditContent || !targetMaterialId) throw new Error('permission-denied')
                const targetMaterial =
                    cellMaterials.find((material) => material.id === targetMaterialId) ??
                    materials.find((material) => material.id === targetMaterialId)
                const expectedCellVersion = readRuntimeRowVersion(selectedRawCell)
                const expectedMaterialVersion = readRuntimeRowVersion(targetMaterial)
                if (expectedCellVersion === undefined || expectedMaterialVersion === undefined) throw new Error('version-unavailable')
                return updateInterpretationNetworkMaterial({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    interpretationId,
                    cellId: selectedCell.id,
                    materialId: targetMaterialId,
                    data,
                    expectedCellVersion,
                    expectedMaterialVersion,
                    widgetId,
                    layoutId
                })
            }

            if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
            return createInterpretationNetworkMaterial({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                interpretationId,
                cellId: selectedCell.id,
                data,
                expectedCellVersion: readRuntimeRowVersion(selectedRawCell),
                widgetId,
                layoutId
            })
        },
        onSuccess: async (saved) => {
            setMaterialDialogMode(null)
            setEditingMaterialId(null)
            setMaterialDialogError(null)
            if (saved && typeof saved.id === 'string') {
                setSelectedMaterialId(saved.id)
                setOpenedMaterialId(saved.id)
            }
            await invalidateMaterialQueries()
        },
        onError: () => setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
    })

    const saveMaterialBodyMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !openedMaterialId) return null
            if (!canEditContent) throw new Error('permission-denied')
            if (!interpretationId || !selectedCell?.id) throw new Error('cell-not-selected')
            const expectedCellVersion = readRuntimeRowVersion(selectedRawCell)
            const expectedMaterialVersion = readRuntimeRowVersion(selectedMaterial)
            if (expectedCellVersion === undefined || expectedMaterialVersion === undefined) throw new Error('version-unavailable')
            return updateInterpretationNetworkMaterial({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                interpretationId,
                cellId: selectedCell.id,
                materialId: openedMaterialId,
                data,
                expectedCellVersion,
                expectedMaterialVersion,
                widgetId,
                layoutId
            })
        },
        onSuccess: async () => {
            setMaterialDialogError(null)
            await invalidateMaterialQueries()
        },
        onError: () => setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
    })

    const setPrimaryMaterialMutation = useMutation({
        mutationFn: async (materialId: string | null) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (!details?.apiBaseUrl || !details.applicationId) throw new Error('runtime-unavailable')
            if (!interpretationId || !selectedCell?.id) throw new Error('cell-not-selected')
            const expectedCellVersion = readRuntimeRowVersion(selectedRawCell)
            if (expectedCellVersion === undefined) throw new Error('version-unavailable')
            return setInterpretationNetworkPrimaryMaterial({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                interpretationId,
                cellId: selectedCell.id,
                materialId,
                expectedCellVersion,
                widgetId,
                layoutId
            })
        },
        onMutate: () => setPrimaryActionError(null),
        onSuccess: async () => {
            setPrimaryActionError(null)
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] }),
                queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
            ])
        },
        onError: () => setPrimaryActionError(t('workspace.material.primaryError', 'Could not update Primary Material.'))
    })

    const deleteMaterialMutation = useMutation({
        mutationFn: async (materialId: string) => {
            if (!canDeleteContent) throw new Error('permission-denied')
            if (!details?.apiBaseUrl || !details.applicationId) throw new Error('runtime-unavailable')
            if (!interpretationId || !selectedCell?.id) throw new Error('cell-not-selected')
            const targetMaterial = cellMaterials.find((material) => material.id === materialId)
            const expectedCellVersion = readRuntimeRowVersion(selectedRawCell)
            const expectedMaterialVersion = readRuntimeRowVersion(targetMaterial)
            if (expectedCellVersion === undefined || expectedMaterialVersion === undefined) throw new Error('version-unavailable')
            return deleteInterpretationNetworkMaterial({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                interpretationId,
                cellId: selectedCell.id,
                materialId,
                expectedCellVersion,
                expectedMaterialVersion,
                widgetId,
                layoutId
            })
        },
        onMutate: () => setDeleteMaterialError(null),
        onSuccess: async () => {
            setDeleteMaterialError(null)
            await invalidateMaterialQueries()
        },
        onError: () => setDeleteMaterialError(t('workspace.material.deleteError', 'Could not delete the material.'))
    })

    return { saveMaterialMetadataMutation, saveMaterialBodyMutation, setPrimaryMaterialMutation, deleteMaterialMutation }
}
