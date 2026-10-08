import { useCallback, useMemo, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppDataResponse } from '../api/api'
import type { CrudDataAdapter, RuntimeRecordCommand } from '../api/types'
import type { DashboardRowActionTarget, DashboardRowTarget, DashboardRowTargetAction } from './contracts'

export interface PendingDashboardRowTarget {
    sectionId: string
    rowId: string
    action: DashboardRowTargetAction
    expectedVersion?: number
    relationScope?: DashboardRowTarget['relationScope']
}

export type DashboardBoundRowMutationAction =
    | { kind: 'record'; command: RuntimeRecordCommand }
    | { kind: 'workflow'; actionCodename: string }

export type DashboardBoundRowActionGuardFailure = 'target' | 'record-version' | 'workflow-version'

export interface DashboardBoundRowActionData {
    appData: AppDataResponse
    row: Record<string, unknown> & { id: string; _upl_version: number }
    version: number
}

export type DashboardBoundRowActionLoadState =
    | { status: 'idle' | 'loading' | 'error'; data: null }
    | { status: 'ready'; data: DashboardBoundRowActionData }

export interface DashboardBoundRowActionsResult {
    boundRowActionMenu: { anchorEl: HTMLElement; target: DashboardRowActionTarget } | null
    rowActionLoadState: DashboardBoundRowActionLoadState
    pendingRowActionKind: DashboardBoundRowMutationAction['kind'] | null
    closeBoundRowActionMenu: () => void
    handleOpenDashboardRowMenu: (event: MouseEvent<HTMLElement>, rowId: string, target?: DashboardRowActionTarget) => void
    handleOpenBoundRowTargetAction: (rowId: string, action: DashboardRowTargetAction, expectedVersion: number | null) => void
    handleBoundRecordCommand: (rowId: string, command: RuntimeRecordCommand) => void
    handleBoundWorkflowAction: (rowId: string, actionCodename: string) => void
}

export interface UseDashboardBoundRowActionsOptions {
    applicationId: string
    locale: string
    adapter: CrudDataAdapter | null
    currentWorkspaceId: string | null
    currentSectionId: string | null
    resolveRowTargetSectionId: (target: DashboardRowTarget) => string | null
    onSelectObjectCollection: (objectCollectionId: string) => void
    setPendingRowTarget: Dispatch<SetStateAction<PendingDashboardRowTarget | null>>
    handleStateRowMenuOpen: (event: MouseEvent<HTMLElement>, rowId: string) => void
    onGuardFailure: (failure: DashboardBoundRowActionGuardFailure) => void
    onMutationSuccess: (action: DashboardBoundRowMutationAction) => void | Promise<void>
    onMutationError: (error: unknown, action: DashboardBoundRowMutationAction) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readPositiveSafeVersion = (value: unknown): number | null => {
    const version = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    return Number.isSafeInteger(version) && version > 0 ? version : null
}

/** Owns scoped record and workflow actions shared by hosted and standalone Dashboard runtimes. */
export const useDashboardBoundRowActions = ({
    applicationId,
    locale,
    adapter,
    currentWorkspaceId,
    currentSectionId,
    resolveRowTargetSectionId,
    onSelectObjectCollection,
    setPendingRowTarget,
    handleStateRowMenuOpen,
    onGuardFailure,
    onMutationSuccess,
    onMutationError
}: UseDashboardBoundRowActionsOptions): DashboardBoundRowActionsResult => {
    const queryClient = useQueryClient()
    const [boundRowActionMenu, setBoundRowActionMenu] = useState<{
        anchorEl: HTMLElement
        target: DashboardRowActionTarget
    } | null>(null)

    const boundRowActionSectionId = boundRowActionMenu
        ? resolveRowTargetSectionId({
              rowId: boundRowActionMenu.target.recordHandle,
              objectCollectionCodename: boundRowActionMenu.target.entityCodename
          })
        : null
    const boundRowActionQueryKey = useMemo(
        () =>
            [
                'runtime-bound-row-actions',
                ...(adapter?.queryKeyPrefix ?? []),
                applicationId,
                boundRowActionSectionId,
                locale,
                currentWorkspaceId,
                boundRowActionMenu?.target.recordHandle
            ] as const,
        [
            adapter?.queryKeyPrefix,
            applicationId,
            boundRowActionMenu?.target.recordHandle,
            boundRowActionSectionId,
            currentWorkspaceId,
            locale
        ]
    )
    const boundRowActionQuery = useQuery({
        queryKey: boundRowActionQueryKey,
        enabled: Boolean(adapter && boundRowActionMenu && boundRowActionSectionId),
        queryFn: async () => {
            if (!adapter || !boundRowActionMenu || !boundRowActionSectionId) {
                throw new Error('Runtime row action target is unavailable.')
            }

            const target = boundRowActionMenu.target
            const [appData, rowResponse] = await Promise.all([
                adapter.fetchList({
                    limit: 1,
                    offset: 0,
                    locale,
                    objectCollectionId: boundRowActionSectionId,
                    sectionId: boundRowActionSectionId,
                    workspaceId: currentWorkspaceId
                }),
                adapter.fetchRow(target.recordHandle, {
                    objectCollectionId: boundRowActionSectionId,
                    sectionId: boundRowActionSectionId,
                    workspaceId: currentWorkspaceId
                })
            ])

            const version = readPositiveSafeVersion(rowResponse.version)
            if (appData.objectCollection.id !== boundRowActionSectionId || version === null) {
                throw new Error('Runtime row action target is unavailable.')
            }

            const rowData = isRecord(rowResponse.data) ? rowResponse.data : {}
            const row = {
                ...rowData,
                id: target.recordHandle,
                _upl_version: version
            }

            return {
                appData: { ...appData, rows: [] } as AppDataResponse,
                row,
                version
            }
        },
        staleTime: 0,
        gcTime: 0
    })
    const boundRowActionMutation = useMutation({
        mutationFn: async (variables: {
            rowId: string
            objectCollectionId: string
            workspaceId: string | null
            expectedVersion: number
            queryKey: readonly unknown[]
            action: DashboardBoundRowMutationAction
        }) => {
            if (!adapter) throw new Error('Runtime adapter is unavailable.')
            const target = {
                objectCollectionId: variables.objectCollectionId,
                sectionId: variables.objectCollectionId,
                workspaceId: variables.workspaceId,
                expectedVersion: variables.expectedVersion
            }

            if (variables.action.kind === 'record') {
                if (!adapter.recordCommand) throw new Error('Runtime record commands are unavailable.')
                return adapter.recordCommand(variables.rowId, variables.action.command, target)
            }
            if (!adapter.workflowAction) throw new Error('Runtime workflow actions are unavailable.')
            return adapter.workflowAction(variables.rowId, variables.action.actionCodename, target)
        },
        onSuccess: async (_result, variables) => {
            await queryClient.invalidateQueries({ queryKey: variables.queryKey, exact: true })
            await onMutationSuccess(variables.action)
        },
        onError: (error, variables) => onMutationError(error, variables.action)
    })

    const rowActionLoadState: DashboardBoundRowActionLoadState = !boundRowActionMenu
        ? { status: 'idle', data: null }
        : !boundRowActionSectionId
        ? { status: 'error', data: null }
        : boundRowActionQuery.isFetching
        ? { status: 'loading', data: null }
        : boundRowActionQuery.isError
        ? { status: 'error', data: null }
        : boundRowActionQuery.data
        ? { status: 'ready', data: boundRowActionQuery.data }
        : { status: 'loading', data: null }
    const pendingRowActionKind = boundRowActionMutation.isPending ? boundRowActionMutation.variables?.action.kind ?? null : null

    const closeBoundRowActionMenu = useCallback(() => setBoundRowActionMenu(null), [])
    const handleOpenDashboardRowMenu = useCallback(
        (event: MouseEvent<HTMLElement>, rowId: string, target?: DashboardRowActionTarget) => {
            if (!target) {
                handleStateRowMenuOpen(event, rowId)
                return
            }
            event.preventDefault()
            event.stopPropagation()
            setBoundRowActionMenu({ anchorEl: event.currentTarget, target })
        },
        [handleStateRowMenuOpen]
    )
    const handleOpenBoundRowTargetAction = useCallback(
        (rowId: string, action: DashboardRowTargetAction, expectedVersion: number | null) => {
            const target = boundRowActionMenu?.target
            const targetPermissions = boundRowActionQuery.data?.appData.permissions
            if (!target || target.recordHandle !== rowId || !boundRowActionSectionId || !targetPermissions) return

            const currentVersion = boundRowActionQuery.data?.version
            if (expectedVersion === null || !Number.isSafeInteger(expectedVersion) || currentVersion !== expectedVersion) {
                onGuardFailure('target')
                return
            }

            const isAllowed =
                action === 'edit'
                    ? targetPermissions.editContent === true
                    : action === 'copy'
                    ? targetPermissions.createContent === true
                    : targetPermissions.deleteContent === true
            if (!isAllowed) return

            setPendingRowTarget({
                sectionId: boundRowActionSectionId,
                rowId,
                action,
                expectedVersion,
                relationScope: target.relationScope
            })
            if (boundRowActionSectionId !== currentSectionId) {
                onSelectObjectCollection(boundRowActionSectionId)
            }
        },
        [
            boundRowActionMenu,
            boundRowActionQuery.data,
            boundRowActionSectionId,
            currentSectionId,
            onGuardFailure,
            onSelectObjectCollection,
            setPendingRowTarget
        ]
    )
    const runBoundRowMutation = useCallback(
        (rowId: string, action: DashboardBoundRowMutationAction, failure: 'record-version' | 'workflow-version') => {
            const target = boundRowActionMenu?.target
            const expectedVersion = boundRowActionQuery.data?.version
            if (!target || target.recordHandle !== rowId || !boundRowActionSectionId) return
            if (expectedVersion === undefined || readPositiveSafeVersion(expectedVersion) === null) {
                onGuardFailure(failure)
                return
            }

            boundRowActionMutation.mutate({
                rowId,
                objectCollectionId: boundRowActionSectionId,
                workspaceId: currentWorkspaceId,
                expectedVersion,
                queryKey: boundRowActionQueryKey,
                action
            })
        },
        [
            boundRowActionMenu,
            boundRowActionMutation,
            boundRowActionQuery.data?.version,
            boundRowActionSectionId,
            boundRowActionQueryKey,
            currentWorkspaceId,
            onGuardFailure
        ]
    )
    const handleBoundRecordCommand = useCallback(
        (rowId: string, command: RuntimeRecordCommand) => runBoundRowMutation(rowId, { kind: 'record', command }, 'record-version'),
        [runBoundRowMutation]
    )
    const handleBoundWorkflowAction = useCallback(
        (rowId: string, actionCodename: string) => runBoundRowMutation(rowId, { kind: 'workflow', actionCodename }, 'workflow-version'),
        [runBoundRowMutation]
    )

    return {
        boundRowActionMenu,
        rowActionLoadState,
        pendingRowActionKind,
        closeBoundRowActionMenu,
        handleOpenDashboardRowMenu,
        handleOpenBoundRowTargetAction,
        handleBoundRecordCommand,
        handleBoundWorkflowAction
    }
}
