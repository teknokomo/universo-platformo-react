import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resolveVlcContent } from '@universo/utils'
import apiClient from '../api/apiClient'
import { createInstancesApi, type InstancesListParams } from '../api/instancesApi'
import { instancesQueryKeys } from '../api/queryKeys'
import type { SupportedLocale } from '@universo/types'

// Singleton instance of instancesApi
const instancesApi = createInstancesApi(apiClient)

/**
 * Hook to fetch instance details by ID
 */
export function useInstanceDetails(instanceId: string | undefined) {
    return useQuery({
        queryKey: instancesQueryKeys.detail(instanceId ?? ''),
        queryFn: () => instancesApi.getInstance(instanceId!),
        enabled: Boolean(instanceId)
    })
}

/**
 * Hook to fetch instances list with pagination
 */
export function useInstancesList(params?: InstancesListParams) {
    return useQuery({
        queryKey: instancesQueryKeys.list(params),
        queryFn: () => instancesApi.listInstances(params)
    })
}

/**
 * Hook to fetch instance statistics
 */
export function useInstanceStats(instanceId: string | undefined) {
    return useQuery({
        queryKey: instancesQueryKeys.stats(instanceId ?? ''),
        queryFn: () => instancesApi.getInstanceStats(instanceId!),
        enabled: Boolean(instanceId)
    })
}

/**
 * Lightweight hook for just the instance name (breadcrumbs)
 * Uses React Query with VLC resolution
 */
export function useInstanceName(instanceId: string | null): string | null {
    const { i18n } = useTranslation()
    const locale = (i18n.language?.split('-')[0] || 'en') as SupportedLocale

    const query = useQuery({
        queryKey: instancesQueryKeys.detail(instanceId ?? ''),
        queryFn: () => instancesApi.getInstance(instanceId!),
        enabled: Boolean(instanceId),
        staleTime: 5 * 60 * 1000,
        select: (data) => resolveVlcContent(data.name, locale, data.codename)
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Truncate instance name for breadcrumb display
 */
export function truncateInstanceName(name: string, maxLength: number = 25): string {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
}
