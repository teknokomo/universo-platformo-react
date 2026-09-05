import { apiClient } from '../../shared'
import type {
    DashboardLayoutWidgetItem,
    MetahubCreateLayoutPayload,
    MetahubLayout,
    MetahubLayoutLocalizedPayload,
    MetahubLayoutUpdatePayload,
    MetahubLayoutZoneWidget,
    PaginationParams,
    PaginatedResponse
} from '../../../types'
import type { ApplicationLayoutWidgetKey, ApplicationLayoutZone, LayoutCopyOptions } from '@universo-react/types'

export type LayoutScopeParams = {
    scopeEntityId?: string | null
}

export type LayoutListParams = PaginationParams & LayoutScopeParams

export type LayoutWidgetScopeVisibility = {
    scopeEntityId: string
    kind: string
    codename: unknown
    name: unknown
    layoutId: string | null
    layoutName: unknown
    version: number
    isVisible: boolean
    isOverridden: boolean
}

/**
 * List layouts for a specific metahub
 */
export const listLayouts = async (metahubId: string, params?: LayoutListParams): Promise<PaginatedResponse<MetahubLayout>> => {
    const response = await apiClient.get<{ items: MetahubLayout[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/layouts`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                scopeEntityId: params?.scopeEntityId ?? undefined
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
export const createLayout = (metahubId: string, data: MetahubCreateLayoutPayload) =>
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
 * @param data.expectedVersion - Required version for optimistic locking.
 */
export const updateLayout = (metahubId: string, layoutId: string, data: MetahubLayoutUpdatePayload) =>
    apiClient.patch<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`, data)

/**
 * Delete a layout
 */
export const deleteLayout = (metahubId: string, layoutId: string, expectedVersion: number) =>
    apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}`, { params: { expectedVersion } })

export const getLayoutZoneWidgetObjects = async (metahubId: string, layoutId: string): Promise<DashboardLayoutWidgetItem[]> => {
    const response = await apiClient.get<{ items: DashboardLayoutWidgetItem[] }>(
        `/metahub/${metahubId}/layout/${layoutId}/zone-widgets/object`
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
        zone: ApplicationLayoutZone
        widgetKey: ApplicationLayoutWidgetKey
        sortOrder?: number
        config?: Record<string, unknown>
        expectedVersion: number
    }
) => apiClient.put<MetahubLayoutZoneWidget>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget`, data)

export const moveLayoutZoneWidget = (
    metahubId: string,
    layoutId: string,
    data: {
        widgetId: string
        targetZone?: ApplicationLayoutZone
        targetIndex?: number
        expectedVersion: number
    }
) => apiClient.patch<{ items: MetahubLayoutZoneWidget[] }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widgets/move`, data)

export const removeLayoutZoneWidget = (metahubId: string, layoutId: string, widgetId: string, expectedVersion: number) =>
    apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}`, {
        params: { expectedVersion }
    })

export const resetLayoutZoneWidgetOverride = (metahubId: string, layoutId: string, widgetId: string, expectedVersion: number) =>
    apiClient.post<void>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/reset`, undefined, {
        params: { expectedVersion }
    })

export const updateLayoutZoneWidgetConfig = (
    metahubId: string,
    layoutId: string,
    widgetId: string,
    config: Record<string, unknown>,
    expectedVersion: number
) =>
    apiClient.patch<{ item: MetahubLayoutZoneWidget }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/config`, {
        config,
        expectedVersion
    })

export const toggleLayoutZoneWidgetActive = (
    metahubId: string,
    layoutId: string,
    widgetId: string,
    isActive: boolean,
    expectedVersion: number
) =>
    apiClient.patch<{ item: MetahubLayoutZoneWidget }>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/toggle-active`, {
        isActive,
        expectedVersion
    })

export const listLayoutWidgetScopeVisibility = async (
    metahubId: string,
    layoutId: string,
    widgetId: string
): Promise<LayoutWidgetScopeVisibility[]> => {
    const response = await apiClient.get<{ items: LayoutWidgetScopeVisibility[] }>(
        `/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/scope-visibility`
    )
    return response.data.items ?? []
}

export const updateLayoutWidgetScopeVisibility = (
    metahubId: string,
    layoutId: string,
    widgetId: string,
    scopeEntityId: string,
    isVisible: boolean,
    expectedVersion: number
) =>
    apiClient.patch<{ item: LayoutWidgetScopeVisibility }>(
        `/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/scope-visibility/${scopeEntityId}`,
        { isVisible, expectedVersion }
    )
