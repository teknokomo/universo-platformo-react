import { useState, type MouseEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { DashboardLibraryTableWidgetConfig } from '@universo-react/types'

import { fetchAppData, restoreAppRow, setRuntimeLibraryRelation, updateAppRow } from '../../api'
import { fetchRuntimeWorkspaceMembers } from '../../api/workspaces'
import type { RuntimeRestoreTarget } from '../../api/types'
import type { DashboardDetailsSlot, DashboardRowTargetAction } from '../contracts'
import { findRuntimeSectionIdByCodename } from '../../utils/runtimeSections'
import {
    PICKER_PAGE_SIZE,
    resolveTargetCodename,
    resolveTargetId,
    type LibraryRow,
    type LibraryToggleAction,
    type TargetFieldAction
} from './libraryDetailsTableUtils'

interface UseLibraryDetailsTableActionsOptions {
    config: DashboardLibraryTableWidgetConfig | null
    details: DashboardDetailsSlot | undefined
    t: TFunction<'apps'>
}

/** Owns actor-scoped library queries, mutations, row actions, and dialog state. */
export function useLibraryDetailsTableActions({ config, details, t }: UseLibraryDetailsTableActionsOptions) {
    const queryClient = useQueryClient()
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
    const [menuRow, setMenuRow] = useState<LibraryRow | null>(null)
    const [targetActionDialog, setTargetActionDialog] = useState<{ row: LibraryRow; action: TargetFieldAction } | null>(null)
    const [restoreDialogRow, setRestoreDialogRow] = useState<LibraryRow | null>(null)
    const [shareDialog, setShareDialog] = useState<{ row: LibraryRow; action: LibraryToggleAction } | null>(null)
    const [selectedTargetId, setSelectedTargetId] = useState('')
    const [selectedRestoreId, setSelectedRestoreId] = useState('')
    const [selectedShareMemberId, setSelectedShareMemberId] = useState('')
    const [targetPickerOffset, setTargetPickerOffset] = useState(0)
    const [restorePickerOffset, setRestorePickerOffset] = useState(0)
    const [sharePickerOffset, setSharePickerOffset] = useState(0)

    const invalidateRuntime = async () => {
        if (details?.runtimeQueryKeyPrefix?.length) {
            await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            await queryClient.refetchQueries({ queryKey: details.runtimeQueryKeyPrefix, type: 'active' })
        } else if (details?.applicationId) {
            await queryClient.invalidateQueries({ queryKey: ['runtime', details.applicationId] })
        }
        await details?.onRuntimeDataChanged?.()
    }

    const resolveSourceId = (row: LibraryRow): string | undefined =>
        row.target ? findRuntimeSectionIdByCodename(details, row.target.entityCodename) : undefined

    const libraryMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'library-table-relation'],
        mutationFn: async ({
            row,
            relationKey,
            active,
            principalId
        }: {
            row: LibraryRow
            relationKey: 'starred' | 'shared'
            active: boolean
            principalId?: string
        }) => {
            const sourceId = resolveSourceId(row)
            if (!details?.apiBaseUrl || !details.applicationId || !row.target || !sourceId) {
                throw new Error(t('runtime.libraryActionUnavailable', 'This action is not available for this row.'))
            }
            await setRuntimeLibraryRelation({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: row.target.recordHandle,
                objectCollectionId: sourceId,
                relationKey,
                active,
                ...(principalId ? { principalType: 'workspaceMember' as const, principalId } : {})
            })
        },
        onSuccess: async () => {
            setShareDialog(null)
            setSelectedShareMemberId('')
            setSharePickerOffset(0)
            await invalidateRuntime()
        }
    })

    const targetMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'library-table-target-update'],
        mutationFn: async ({ row, action, targetId }: { row: LibraryRow; action: TargetFieldAction; targetId: string }) => {
            const sourceId = resolveSourceId(row)
            if (!details?.apiBaseUrl || !details.applicationId || !row.target || !sourceId) {
                throw new Error(t('runtime.targetActionUnavailable', 'This action is not available for this row.'))
            }
            await updateAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: row.target.recordHandle,
                objectCollectionId: sourceId,
                workspaceId: details.currentWorkspaceId,
                expectedVersion: row.target.version,
                data: { [action.fieldCodename]: targetId }
            })
        },
        onSuccess: async () => {
            setTargetActionDialog(null)
            setSelectedTargetId('')
            await invalidateRuntime()
        }
    })

    const restoreMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'library-table-restore'],
        mutationFn: async ({ row, restoreTarget }: { row: LibraryRow; restoreTarget?: RuntimeRestoreTarget }) => {
            const sourceId = resolveSourceId(row)
            if (!details?.apiBaseUrl || !details.applicationId || !row.target || !sourceId) {
                throw new Error(t('trash.restoreUnavailable', 'Restore is not available for this row.'))
            }
            await restoreAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: row.target.recordHandle,
                objectCollectionId: sourceId,
                workspaceId: details.currentWorkspaceId,
                expectedVersion: row.target.version,
                restoreTarget
            })
        },
        onSuccess: async () => {
            setRestoreDialogRow(null)
            setSelectedRestoreId('')
            await invalidateRuntime()
        }
    })

    const activeTargetConfig = targetActionDialog?.action
    const targetPickerCodename = resolveTargetCodename(activeTargetConfig)
    const targetPickerId = resolveTargetId(activeTargetConfig, details)
    const targetQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'library-table-targets',
            activeTargetConfig?.id,
            targetPickerCodename,
            targetPickerOffset
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                limit: PICKER_PAGE_SIZE,
                offset: targetPickerOffset,
                locale: details?.locale ?? 'en',
                objectCollectionId: targetPickerId,
                objectCollectionCodename: targetPickerId ? undefined : targetPickerCodename,
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: Boolean(targetActionDialog && details?.apiBaseUrl && details?.applicationId && (targetPickerId || targetPickerCodename))
    })

    const restoreConfig = config?.restoreTarget
    const restorePickerCodename = resolveTargetCodename(restoreConfig)
    const restorePickerId = resolveTargetId(restoreConfig, details)
    const restoreQuery = useQuery({
        queryKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'library-table-restore-targets', restorePickerCodename, restorePickerOffset],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                limit: PICKER_PAGE_SIZE,
                offset: restorePickerOffset,
                locale: details?.locale ?? 'en',
                objectCollectionId: restorePickerId,
                objectCollectionCodename: restorePickerId ? undefined : restorePickerCodename,
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: Boolean(
            restoreDialogRow && restoreConfig && details?.apiBaseUrl && details?.applicationId && (restorePickerId || restorePickerCodename)
        )
    })

    const shareQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'library-table-share-members',
            details?.currentWorkspaceId,
            sharePickerOffset
        ],
        queryFn: () =>
            fetchRuntimeWorkspaceMembers({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details!.currentWorkspaceId!,
                params: { limit: PICKER_PAGE_SIZE, offset: sharePickerOffset }
            }),
        enabled: Boolean(shareDialog && details?.apiBaseUrl && details?.applicationId && details?.currentWorkspaceId)
    })

    const canEdit = details?.runtimeAccessMode !== 'public' && details?.permissions?.editContent === true
    const canCopy = details?.runtimeAccessMode !== 'public' && details?.permissions?.createContent === true
    const canDelete = details?.runtimeAccessMode !== 'public' && details?.permissions?.deleteContent === true
    const canUseLibraryActions = details?.runtimeAccessMode !== 'public' && Boolean(details?.apiBaseUrl && details.applicationId)
    const canUseLibraryAction = (action: LibraryToggleAction): boolean => {
        if (!canUseLibraryActions) return false
        if (action.libraryView !== 'shared') return true
        if (!canEdit) return false
        return action.principalTarget !== 'workspaceMember' || Boolean(details?.currentWorkspaceId)
    }
    const libraryActions = (config?.rowActions ?? []).filter((action): action is LibraryToggleAction => action.kind === 'library.toggle')
    const targetActions = (config?.rowActions ?? []).filter(
        (action): action is TargetFieldAction => action.kind === 'field.updateWithTarget'
    )
    const visibleLibraryActions = libraryActions.filter(canUseLibraryAction)
    const showMenu =
        config?.lifecycleState === 'active' &&
        (visibleLibraryActions.length > 0 || (canEdit && targetActions.length > 0) || canEdit || canCopy || canDelete)

    const closeMenu = () => {
        setMenuAnchor(null)
        setMenuRow(null)
    }
    const openMenu = (event: MouseEvent<HTMLElement>, row: LibraryRow) => {
        event.preventDefault()
        event.stopPropagation()
        setMenuAnchor(event.currentTarget)
        setMenuRow(row)
    }
    const openHostAction = (action: DashboardRowTargetAction) => {
        const row = menuRow
        closeMenu()
        if (!row?.target) return
        details?.onOpenRowTarget?.(
            {
                rowId: row.target.recordHandle,
                expectedVersion: row.target.version,
                objectCollectionId: resolveSourceId(row),
                objectCollectionCodename: row.target.entityCodename
            },
            action
        )
    }
    const selectLibraryAction = (action: LibraryToggleAction) => {
        const row = menuRow
        closeMenu()
        if (!row?.target || !canUseLibraryAction(action)) return
        if (action.libraryView === 'shared' && action.principalTarget === 'workspaceMember') {
            libraryMutation.reset()
            setSelectedShareMemberId('')
            setSharePickerOffset(0)
            setShareDialog({ row, action })
            return
        }
        const active = action.libraryView === 'starred' ? row.target.starred : row.target.shared
        libraryMutation.mutate({ row, relationKey: action.libraryView, active: !active })
    }
    const selectTargetAction = (action: TargetFieldAction) => {
        const row = menuRow
        closeMenu()
        if (!row || !canEdit) return
        targetMutation.reset()
        setSelectedTargetId('')
        setTargetPickerOffset(0)
        setTargetActionDialog({ row, action })
    }
    const requestRestore = (row: LibraryRow) => {
        if (!canEdit) return
        restoreMutation.reset()
        if (restoreConfig) {
            setSelectedRestoreId('')
            setRestorePickerOffset(0)
            setRestoreDialogRow(row)
            return
        }
        restoreMutation.mutate({ row })
    }
    const closeTargetDialog = () => {
        if (targetMutation.isPending) return
        setTargetActionDialog(null)
        setSelectedTargetId('')
    }
    const submitTargetAction = () => {
        if (targetActionDialog && selectedTargetId) {
            targetMutation.mutate({ row: targetActionDialog.row, action: targetActionDialog.action, targetId: selectedTargetId })
        }
    }
    const changeTargetPickerOffset = (offset: number) => {
        setSelectedTargetId('')
        setTargetPickerOffset(offset)
    }
    const closeRestoreDialog = () => {
        if (restoreMutation.isPending) return
        setRestoreDialogRow(null)
        setSelectedRestoreId('')
    }
    const submitRestore = () => {
        if (!restoreDialogRow || !selectedRestoreId) return
        const targetObjectCollectionId = restorePickerId ?? restoreQuery.data?.activeObjectCollectionId ?? undefined
        if (!targetObjectCollectionId) return
        restoreMutation.mutate({
            row: restoreDialogRow,
            restoreTarget: {
                mode: 'target',
                targetObjectCollectionId,
                targetRecordId: selectedRestoreId,
                targetWorkspaceId: details?.currentWorkspaceId ?? null,
                parentFieldCodename: restoreConfig?.parentFieldCodename
            }
        })
    }
    const changeRestorePickerOffset = (offset: number) => {
        setSelectedRestoreId('')
        setRestorePickerOffset(offset)
    }
    const closeShareDialog = () => {
        setShareDialog(null)
        setSelectedShareMemberId('')
        setSharePickerOffset(0)
    }
    const submitShare = (active: boolean) => {
        if (!shareDialog || !selectedShareMemberId) return
        libraryMutation.mutate({
            row: shareDialog.row,
            relationKey: 'shared',
            active,
            principalId: selectedShareMemberId
        })
    }
    const changeSharePickerOffset = (offset: number) => {
        setSelectedShareMemberId('')
        setSharePickerOffset(offset)
    }

    return {
        menuAnchor,
        menuRow,
        openMenu,
        closeMenu,
        openHostAction,
        selectLibraryAction,
        selectTargetAction,
        requestRestore,
        canEdit,
        canCopy,
        canDelete,
        targetActions,
        visibleLibraryActions,
        showMenu,
        libraryMutation,
        targetMutation,
        restoreMutation,
        targetActionDialog,
        activeTargetConfig,
        targetQuery,
        selectedTargetId,
        setSelectedTargetId,
        targetPickerOffset,
        closeTargetDialog,
        submitTargetAction,
        changeTargetPickerOffset,
        restoreDialogRow,
        restoreConfig,
        restoreQuery,
        selectedRestoreId,
        setSelectedRestoreId,
        restorePickerOffset,
        closeRestoreDialog,
        submitRestore,
        changeRestorePickerOffset,
        shareDialog,
        shareQuery,
        selectedShareMemberId,
        setSelectedShareMemberId,
        sharePickerOffset,
        closeShareDialog,
        submitShare,
        changeSharePickerOffset
    }
}

export type LibraryDetailsTableActions = ReturnType<typeof useLibraryDetailsTableActions>
