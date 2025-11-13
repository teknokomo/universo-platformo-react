import { useEffect } from 'react'
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useAuthError } from '@universo/auth-frt'

import { api } from '@universo/api-client' // Replaced: import spacesApi from '../api/spaces'
import type { AxiosResponse } from 'axios'

// Query keys for TanStack Query
const spacesQueryKeys = {
    all: ['spaces'] as const,
    lists: () => [...spacesQueryKeys.all, 'list'] as const,
    list: (unikId: string | undefined) => [...spacesQueryKeys.lists(), unikId] as const
}

type SpacesResponse = AxiosResponse<{ spaces?: unknown[] }> | { spaces?: unknown[] } | unknown[] | null | undefined

const normalizeSpacesPayload = (payload: SpacesResponse): unknown[] => {
    if (!payload) return []
    if (Array.isArray(payload)) return payload.filter(Boolean)
    if (typeof payload === 'object') {
        const data = (payload as { data?: unknown; spaces?: unknown[] }).spaces
        if (Array.isArray(data)) return data.filter(Boolean)
        const nestedData = (payload as { data?: unknown }).data
        if (Array.isArray(nestedData)) return nestedData.filter(Boolean)
        if (typeof nestedData === 'object' && Array.isArray((nestedData as { spaces?: unknown[] }).spaces)) {
            return ((nestedData as { spaces?: unknown[] }).spaces ?? []).filter(Boolean)
        }
        if (Array.isArray((payload as { data?: { items?: unknown[] } }).data?.items)) {
            return ((payload as { data?: { items?: unknown[] } }).data?.items ?? []).filter(Boolean)
        }
    }
    return []
}

const fetchSpaces = async (unikId: string | undefined) => {
    if (!unikId) return []
    const response = await api.spaces.getAll(unikId)
    return response ?? null
}

type UseSpacesQueryOptions = Omit<
    UseQueryOptions<unknown[], unknown, unknown[], ReturnType<typeof spacesQueryKeys.list>>,
    'queryFn' | 'queryKey' | 'enabled' | 'select'
>

export const useSpacesQuery = (unikId: string | undefined, options: UseSpacesQueryOptions = {}) => {
    const { handleAuthError } = useAuthError()

    const query = useQuery({
        queryKey: spacesQueryKeys.list(unikId),
        queryFn: () => fetchSpaces(unikId),
        enabled: Boolean(unikId),
        select: normalizeSpacesPayload,
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
        gcTime: 30 * 60 * 1000,
        ...options
    })

    useEffect(() => {
        if (query.error) {
            handleAuthError(query.error)
        }
    }, [query.error, handleAuthError])

    return query
}

export type UseSpacesQueryResult = ReturnType<typeof useSpacesQuery>
