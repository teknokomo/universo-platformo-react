import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAppRow, deleteAppRow, fetchAppRow, updateAppRow } from './api'

/** Query key factory for application data. */
export const appQueryKeys = {
    all: ['application-data'] as const,
    list: (applicationId: string, catalogId?: string) => [...appQueryKeys.all, applicationId, catalogId] as const,
    row: (applicationId: string, rowId: string) => [...appQueryKeys.all, 'row', applicationId, rowId] as const
}

/** @deprecated Use appQueryKeys instead */
export const runtimeKeys = appQueryKeys

/** Fetch a single row (raw data for edit forms). */
export function useAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string | null
    catalogId?: string
    enabled?: boolean
}) {
    const { apiBaseUrl, applicationId, rowId, catalogId, enabled = true } = options
    return useQuery({
        queryKey: appQueryKeys.row(applicationId, rowId ?? ''),
        queryFn: () => fetchAppRow({ apiBaseUrl, applicationId, rowId: rowId!, catalogId }),
        enabled: enabled && Boolean(rowId),
        staleTime: 0, // Always refetch for fresh data
        gcTime: 0
    })
}

/** Create a new row and invalidate list queries. */
export function useCreateAppRow(options: { apiBaseUrl: string; applicationId: string; catalogId?: string }) {
    const { apiBaseUrl, applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createAppRow({ apiBaseUrl, applicationId, catalogId, data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) })
        }
    })
}

/** Update an existing row and invalidate list + row queries. */
export function useUpdateAppRow(options: { apiBaseUrl: string; applicationId: string; catalogId?: string }) {
    const { apiBaseUrl, applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (params: { rowId: string; data: Record<string, unknown> }) =>
            updateAppRow({ apiBaseUrl, applicationId, rowId: params.rowId, catalogId, data: params.data }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) })
            queryClient.invalidateQueries({ queryKey: appQueryKeys.row(applicationId, variables.rowId) })
        }
    })
}

/** Soft-delete a row and invalidate list queries. */
export function useDeleteAppRow(options: { apiBaseUrl: string; applicationId: string; catalogId?: string }) {
    const { apiBaseUrl, applicationId, catalogId } = options
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (rowId: string) => deleteAppRow({ apiBaseUrl, applicationId, rowId, catalogId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) })
        }
    })
}
