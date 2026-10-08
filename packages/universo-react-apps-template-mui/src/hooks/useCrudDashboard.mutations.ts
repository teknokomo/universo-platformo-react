import { useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { makePendingMarkers } from '@universo-react/utils'
import type { PendingAction } from '@universo-react/utils'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    confirmOptimisticCreate,
    confirmOptimisticUpdate,
    generateOptimisticId,
    rollbackOptimisticSnapshots,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive
} from './optimisticCrud'
import type { AppDataResponse } from '../api/api'
import type { CrudDataAdapter, RuntimeRecordCommand, RuntimeRelationScope, RuntimeRowTarget } from '../api/types'

type ActiveRuntimeTarget = Pick<RuntimeRowTarget, 'objectCollectionId' | 'sectionId' | 'workspaceId'>

interface UseCrudDashboardMutationsOptions {
    adapter: CrudDataAdapter | null
    activeRuntimeTarget: ActiveRuntimeTarget
    applyWorkspaceLimitDelta: (delta: number) => void
    copyRowId: string | null
    makeRowKey: (rowId: string | null | undefined) => readonly unknown[]
    onRuntimeDataChanged?: () => void | Promise<unknown>
    queryClient: QueryClient
    queryKeyPrefix: readonly unknown[]
}

export function useCrudDashboardMutations({
    adapter,
    activeRuntimeTarget,
    applyWorkspaceLimitDelta,
    copyRowId,
    makeRowKey,
    onRuntimeDataChanged,
    queryClient,
    queryKeyPrefix
}: UseCrudDashboardMutationsOptions) {
    // ----- Mutations -----
    const createMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'create'],
        mutationFn: (params: { data: Record<string, unknown>; relationScope?: RuntimeRelationScope }) => {
            if (!adapter) throw new Error('Adapter is not available')
            const target = params.relationScope ? { ...activeRuntimeTarget, relationScope: params.relationScope } : activeRuntimeTarget
            return adapter.createRow(params.data, target)
        },
        onMutate: async ({ data }) => {
            const optimisticId = generateOptimisticId()
            const pendingAction: PendingAction = copyRowId ? 'copy' : 'create'
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    ...data,
                    ...makePendingMarkers(pendingAction)
                } as AppDataResponse['rows'][number] & { id: string }
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, queryKeyPrefix, context.optimisticId, String(data.id), {
                    serverEntity: data
                })
            }
            applyWorkspaceLimitDelta(1)
        },
        onSettled: async () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            await onRuntimeDataChanged?.()
        }
    })

    const copyMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'copy'],
        mutationFn: (params: {
            rowId: string
            data: Record<string, unknown>
            expectedVersion?: number
            relationScope?: RuntimeRelationScope
        }) => {
            if (!adapter?.copyRow) throw new Error('Copy is not available for this runtime adapter')
            return adapter.copyRow(params.rowId, {
                objectCollectionId: activeRuntimeTarget.objectCollectionId,
                sectionId: activeRuntimeTarget.sectionId,
                ...(activeRuntimeTarget.workspaceId ? { workspaceId: activeRuntimeTarget.workspaceId } : {}),
                copyChildTables: true,
                data: params.data,
                expectedVersion: params.expectedVersion,
                ...(params.relationScope ? { relationScope: params.relationScope } : {})
            })
        },
        onMutate: async ({ data }) => {
            const optimisticId = generateOptimisticId()
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    ...data,
                    ...makePendingMarkers('copy')
                } as AppDataResponse['rows'][number] & { id: string }
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, queryKeyPrefix, context.optimisticId, String(data.id), {
                    serverEntity: {
                        id: data.id,
                        ...variables.data
                    }
                })
            }
            applyWorkspaceLimitDelta(1)
        },
        onSettled: async () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            await onRuntimeDataChanged?.()
        }
    })

    const updateMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'update'],
        mutationFn: (params: {
            rowId: string
            data: Record<string, unknown>
            expectedVersion?: number
            relationScope?: RuntimeRelationScope
        }) => {
            if (!adapter) throw new Error('Adapter is not available')
            const target = params.relationScope ? { ...activeRuntimeTarget, relationScope: params.relationScope } : activeRuntimeTarget
            return adapter.updateRow(params.rowId, params.data, target, params.expectedVersion)
        },
        onMutate: async ({ rowId, data }) => {
            const rowDetailKey = makeRowKey(rowId)
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix,
                entityId: rowId,
                updater: data as Partial<AppDataResponse['rows'][number]>,
                detailQueryKey: rowDetailKey
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
            confirmOptimisticUpdate(queryClient, queryKeyPrefix, variables.rowId, {
                serverEntity: data ?? null
            })
            if (data) {
                queryClient.setQueryData(makeRowKey(variables.rowId), data)
            }
        },
        onSettled: async (_data, _error, variables) => {
            safeInvalidateQueriesInactive(queryClient, queryKeyPrefix, queryKeyPrefix, makeRowKey(variables.rowId))
            // Also invalidate tabular rows for this row
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey
                    return Array.isArray(key) && key[0] === 'tabularRows' && String(key[2] ?? '') === variables.rowId
                }
            })
            await onRuntimeDataChanged?.()
        }
    })

    const deleteMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'delete'],
        mutationFn: (params: { rowId: string; expectedVersion?: number; relationScope?: RuntimeRelationScope }) => {
            if (!adapter) throw new Error('Adapter is not available')
            const target = params.relationScope ? { ...activeRuntimeTarget, relationScope: params.relationScope } : activeRuntimeTarget
            return adapter.deleteRow(params.rowId, target, params.expectedVersion)
        },
        onMutate: async (params) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: params.rowId,
                strategy: 'remove'
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: () => {
            applyWorkspaceLimitDelta(-1)
        },
        onSettled: async () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            await onRuntimeDataChanged?.()
        }
    })

    const reorderMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'reorder'],
        mutationFn: async (params: {
            orderedRowIds: string[]
            expectedVersionsByRowId?: Record<string, number>
            objectCollectionId?: string
            parentScope?: { fieldCodename: string; parentRecordId: string }
        }) => {
            if (!adapter?.reorderRows) {
                throw new Error('Row reordering is not available for this runtime adapter')
            }

            await adapter.reorderRows({
                objectCollectionId: params.objectCollectionId ?? activeRuntimeTarget.objectCollectionId,
                sectionId: params.objectCollectionId ?? activeRuntimeTarget.sectionId,
                ...(activeRuntimeTarget.workspaceId ? { workspaceId: activeRuntimeTarget.workspaceId } : {}),
                orderedRowIds: params.orderedRowIds,
                expectedVersionsByRowId: params.expectedVersionsByRowId,
                parentScope: params.parentScope
            })
        },
        onSettled: async () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            await onRuntimeDataChanged?.()
        }
    })

    const recordCommandMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'record-command'],
        mutationFn: async (params: { rowId: string; command: RuntimeRecordCommand; expectedVersion?: number }) => {
            if (!adapter?.recordCommand) {
                throw new Error('Record lifecycle commands are not available for this runtime adapter')
            }

            return adapter.recordCommand(params.rowId, params.command, {
                objectCollectionId: activeRuntimeTarget.objectCollectionId,
                sectionId: activeRuntimeTarget.sectionId,
                ...(activeRuntimeTarget.workspaceId ? { workspaceId: activeRuntimeTarget.workspaceId } : {}),
                expectedVersion: params.expectedVersion
            })
        },
        onSettled: async (_data, _error, variables) => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            queryClient.invalidateQueries({ queryKey: makeRowKey(variables.rowId) })
            await onRuntimeDataChanged?.()
        }
    })

    const workflowActionMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'workflow-action'],
        mutationFn: async (params: { rowId: string; actionCodename: string; expectedVersion: number }) => {
            if (!adapter?.workflowAction) {
                throw new Error('Workflow actions are not available for this runtime adapter')
            }

            return adapter.workflowAction(params.rowId, params.actionCodename, {
                objectCollectionId: activeRuntimeTarget.objectCollectionId,
                sectionId: activeRuntimeTarget.sectionId,
                ...(activeRuntimeTarget.workspaceId ? { workspaceId: activeRuntimeTarget.workspaceId } : {}),
                expectedVersion: params.expectedVersion
            })
        },
        onSettled: async (_data, _error, variables) => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            queryClient.invalidateQueries({ queryKey: makeRowKey(variables.rowId) })
            await onRuntimeDataChanged?.()
        }
    })

    return {
        createMutation,
        copyMutation,
        updateMutation,
        deleteMutation,
        reorderMutation,
        recordCommandMutation,
        workflowActionMutation
    }
}
