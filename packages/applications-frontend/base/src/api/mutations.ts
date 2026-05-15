import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getApplicationRuntimeRow,
    createApplicationRuntimeRow,
    updateApplicationRuntimeRow,
    deleteApplicationRuntimeRow,
    updateApplicationRuntimeCell
} from './applications'
import { applicationsQueryKeys } from './queryKeys'
import { safeInvalidateQueries } from '@universo/template-mui'

export interface RuntimeCellMutationVariables {
    rowId: string
    field: string
    value: boolean | null
    objectCollectionId?: string
    sectionId?: string
}

export interface PendingRuntimeCellMutation extends RuntimeCellMutationVariables {
    submittedAt: number
}

export const getRuntimeCellMutationKey = (applicationId: string | undefined) =>
    ['applications', 'updateCell', applicationId ?? 'unknown'] as const

export const getRuntimeCellPendingKey = (rowId: string, field: string) => `${rowId}::${field}`

export function buildPendingRuntimeCellMap(pendingMutations: PendingRuntimeCellMutation[]): Map<string, boolean | null> {
    const pendingByCell = new Map<string, { value: boolean | null; submittedAt: number }>()

    for (const mutation of pendingMutations) {
        const key = getRuntimeCellPendingKey(mutation.rowId, mutation.field)
        const previous = pendingByCell.get(key)

        if (!previous || mutation.submittedAt >= previous.submittedAt) {
            pendingByCell.set(key, {
                value: mutation.value,
                submittedAt: mutation.submittedAt
            })
        }
    }

    return new Map(Array.from(pendingByCell.entries()).map(([key, entry]) => [key, entry.value]))
}

function isPendingRuntimeCellMutation(value: RuntimeCellMutationVariables | undefined): value is RuntimeCellMutationVariables {
    return Boolean(value?.rowId && value?.field)
}

/**
 * Fetch a single row (raw data for edit forms).
 * Uses staleTime: 0 and gcTime: 0 to always refetch fresh data.
 */
export function useRuntimeRow(options: {
    applicationId: string | undefined
    rowId: string | null
    objectCollectionId?: string
    sectionId?: string
    enabled?: boolean
}) {
    const { applicationId, rowId, objectCollectionId, sectionId, enabled = true } = options
    return useQuery({
        queryKey: applicationId && rowId ? applicationsQueryKeys.runtimeRow(applicationId, rowId) : ['noop'],
        queryFn: async () => {
            if (!applicationId || !rowId) throw new Error('Missing IDs')
            return getApplicationRuntimeRow({ applicationId, rowId, objectCollectionId, sectionId })
        },
        enabled: enabled && Boolean(applicationId && rowId),
        staleTime: 0,
        gcTime: 0
    })
}

/** Create a new runtime row and invalidate list queries. */
export function useCreateRuntimeRow(options: { applicationId: string | undefined; objectCollectionId?: string; sectionId?: string }) {
    const { applicationId, objectCollectionId, sectionId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return createApplicationRuntimeRow({ applicationId, data, objectCollectionId, sectionId })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        }
    })
}

/** Update an existing runtime row and invalidate list + row queries. */
export function useUpdateRuntimeRow(options: { applicationId: string | undefined; objectCollectionId?: string; sectionId?: string }) {
    const { applicationId, objectCollectionId, sectionId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: { rowId: string; data: Record<string, unknown> }) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return updateApplicationRuntimeRow({ applicationId, rowId: params.rowId, data: params.data, objectCollectionId, sectionId })
        },
        onSuccess: async (_data, variables) => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeRow(applicationId, variables.rowId) })
        }
    })
}

/** Soft-delete a runtime row and invalidate list queries. */
export function useDeleteRuntimeRow(options: { applicationId: string | undefined; objectCollectionId?: string; sectionId?: string }) {
    const { applicationId, objectCollectionId, sectionId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (rowId: string) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return deleteApplicationRuntimeRow({ applicationId, rowId, objectCollectionId, sectionId })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        }
    })
}

/**
 * Inline cell mutation (e.g. checkbox toggle).
 * Uses "via UI" optimistic approach: component reads mutation.variables + isPending
 * to show the optimistic checked state directly in render — no cache manipulation.
 */
export function useUpdateRuntimeCell(options: { applicationId: string | undefined; objectCollectionId?: string; sectionId?: string }) {
    const { applicationId, objectCollectionId, sectionId } = options
    const queryClient = useQueryClient()
    const mutationKey = getRuntimeCellMutationKey(applicationId)

    return useMutation({
        mutationKey,
        mutationFn: async (params: RuntimeCellMutationVariables) => {
            if (!applicationId) throw new Error('Application ID is missing')
            await updateApplicationRuntimeCell({
                applicationId,
                rowId: params.rowId,
                field: params.field,
                value: params.value,
                objectCollectionId: params.objectCollectionId ?? objectCollectionId,
                sectionId: params.sectionId ?? sectionId
            })
        },
        onSettled: () => {
            if (!applicationId) return
            safeInvalidateQueries(queryClient, mutationKey, applicationsQueryKeys.runtimeAll(applicationId))
        }
    })
}

export function usePendingRuntimeCellMutations(options: { applicationId: string | undefined }): PendingRuntimeCellMutation[] {
    const { applicationId } = options

    return useMutationState({
        filters: {
            mutationKey: getRuntimeCellMutationKey(applicationId),
            status: 'pending'
        },
        select: (mutation): PendingRuntimeCellMutation | undefined => {
            const variables = mutation.state.variables as RuntimeCellMutationVariables | undefined
            if (!isPendingRuntimeCellMutation(variables)) {
                return undefined
            }

            return {
                ...variables,
                submittedAt: mutation.state.submittedAt ?? 0
            }
        }
    }).filter((mutation): mutation is PendingRuntimeCellMutation => mutation !== undefined)
}
