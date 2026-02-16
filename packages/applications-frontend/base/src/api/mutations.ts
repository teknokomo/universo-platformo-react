import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getApplicationRuntimeRow,
    createApplicationRuntimeRow,
    updateApplicationRuntimeRow,
    deleteApplicationRuntimeRow,
    updateApplicationRuntimeCell
} from './applications'
import { applicationsQueryKeys } from './queryKeys'

/**
 * Fetch a single row (raw data for edit forms).
 * Uses staleTime: 0 and gcTime: 0 to always refetch fresh data.
 */
export function useRuntimeRow(options: {
    applicationId: string | undefined
    rowId: string | null
    catalogId?: string
    enabled?: boolean
}) {
    const { applicationId, rowId, catalogId, enabled = true } = options
    return useQuery({
        queryKey: applicationId && rowId ? applicationsQueryKeys.runtimeRow(applicationId, rowId) : ['noop'],
        queryFn: async () => {
            if (!applicationId || !rowId) throw new Error('Missing IDs')
            return getApplicationRuntimeRow({ applicationId, rowId, catalogId })
        },
        enabled: enabled && Boolean(applicationId && rowId),
        staleTime: 0,
        gcTime: 0
    })
}

/** Create a new runtime row and invalidate list queries. */
export function useCreateRuntimeRow(options: {
    applicationId: string | undefined
    catalogId?: string
}) {
    const { applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return createApplicationRuntimeRow({ applicationId, data, catalogId })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        }
    })
}

/** Update an existing runtime row and invalidate list + row queries. */
export function useUpdateRuntimeRow(options: {
    applicationId: string | undefined
    catalogId?: string
}) {
    const { applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: { rowId: string; data: Record<string, unknown> }) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return updateApplicationRuntimeRow({ applicationId, rowId: params.rowId, data: params.data, catalogId })
        },
        onSuccess: async (_data, variables) => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeRow(applicationId, variables.rowId) })
        }
    })
}

/** Soft-delete a runtime row and invalidate list queries. */
export function useDeleteRuntimeRow(options: {
    applicationId: string | undefined
    catalogId?: string
}) {
    const { applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (rowId: string) => {
            if (!applicationId) throw new Error('Application ID is missing')
            return deleteApplicationRuntimeRow({ applicationId, rowId, catalogId })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        }
    })
}

/** Inline cell mutation (e.g. checkbox toggle). */
export function useUpdateRuntimeCell(options: {
    applicationId: string | undefined
    catalogId?: string
}) {
    const { applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: { rowId: string; field: string; value: boolean | null; catalogId?: string }) => {
            if (!applicationId) throw new Error('Application ID is missing')
            await updateApplicationRuntimeCell({
                applicationId,
                rowId: params.rowId,
                field: params.field,
                value: params.value,
                catalogId: params.catalogId ?? catalogId
            })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        }
    })
}
