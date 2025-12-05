import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/apiClient'
import { createInstancesApi, type InstancesListParams } from '../api/instancesApi'
import { instancesQueryKeys } from '../api/queryKeys'

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
