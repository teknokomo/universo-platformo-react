import { apiClient } from '../../shared'
import type {
    DashboardLayoutWidgetCatalogItem,
    MetahubLayout,
    MetahubLayoutLocalizedPayload,
    MetahubLayoutZoneWidget,
    PaginationParams,
    PaginatedResponse
} from '../../../types'
import type { DashboardLayoutWidgetKey, DashboardLayoutZone, LayoutCopyOptions } from '@universo/types'

/**
 * List layouts for a specific metahub
 */
export const listLayouts = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubLayout>> => {
    const response = await apiClient.get<{ items: MetahubLayout[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/layouts`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search
            }
        }
    )

    // Backend returns { items, pagination } object
    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * Get a single layout
 */
export const getLayout = (metahubId: string, layoutId: string) => apiClient.get<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`)

/**
 * Create a new layout
 */
export const createLayout = (metahubId: string, data: MetahubLayoutLocalizedPayload) =>
    apiClient.post<MetahubLayout>(`/metahub/${metahubId}/layouts`, data)

export type LayoutCopyInput = {
    name: MetahubLayoutLocalizedPayload['name']
    description?: MetahubLayoutLocalizedPayload['description']
    namePrimaryLocale?: MetahubLayoutLocalizedPayload['namePrimaryLocale']
    descriptionPrimaryLocale?: MetahubLayoutLocalizedPayload['descriptionPrimaryLocale']
    copyWidgets?: LayoutCopyOptions['copyWidgets']
    deactivateAllWidgets?: LayoutCopyOptions['deactivateAllWidgets']
}

export const copyLayout = (metahubId: string, layoutId: string, data: LayoutCopyInput) =>
    apiClient.post<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}/copy`, data)

/**
 * Update a layout
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateLayout = (metahubId: string, layoutId: string, data: Partial<MetahubLayoutLocalizedPayload>) =>
    apiClient.patch<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`, data)

/**
 * Delete a layout
 */
export const deleteLayout = (metahubId: string, layoutId: string) => apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}`)

export const getLayoutZoneWidgetsCatalog = async (metahubId: string, layoutId: string): Promise<DashboardLayoutWidgetCatalogItem[]> => {
    const response = await apiClient.get<{ items: DashboardLayoutWidgetCatalogItem[] }>(
        `/metahub/${metahubId}/layout/${layoutId}/zone-widgets/catalog`
    )
    return response.data.items ?? []
}

export const listLayoutZoneWidgets = async (metahubId: string, layoutId: string): Promise<MetahubLayoutZoneWidget[]> => {
    const response = await apiClient.get<{ items: MetahubLayoutZoneWidget[] }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widgets`)
    return response.data.items ?? []
}

export const assignLayoutZoneWidget = (
    metahubId: string,
    layoutId: string,
    data: {
        zone: DashboardLayoutZone
        widgetKey: DashboardLayoutWidgetKey
        sortOrder?: number
        config?: Record<string, unknown>
    }
) => apiClient.put<MetahubLayoutZoneWidget>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget`, data)

export const moveLayoutZoneWidget = (
    metahubId: string,
    layoutId: string,
    data: {
        widgetId: string
        targetZone?: DashboardLayoutZone
        targetIndex?: number
    }
) => apiClient.patch<{ items: MetahubLayoutZoneWidget[] }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widgets/move`, data)

export const removeLayoutZoneWidget = (metahubId: string, layoutId: string, widgetId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}`)

export const updateLayoutZoneWidgetConfig = (metahubId: string, layoutId: string, widgetId: string, config: Record<string, unknown>) =>
    apiClient.patch<MetahubLayoutZoneWidget>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/config`, { config })

export const toggleLayoutZoneWidgetActive = (metahubId: string, layoutId: string, widgetId: string, isActive: boolean) =>
    apiClient.patch<{ item: MetahubLayoutZoneWidget }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/toggle-active`, {
        isActive
    })
