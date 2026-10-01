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
import type {
    ApplicationLayoutWidgetKey,
    ApplicationLayoutZone,
    LayoutCopyOptions,
    LayoutLogicalPlacement,
    LayoutZoneSettingValue,
    MarketingWidgetRecordCopyIntent,
    ReplaceLayoutZoneWidgetBindingsInput,
    ReplaceLayoutZoneWidgetBindingsResult,
    WidgetBindingReadDto,
    WidgetBindingReadItem,
    WidgetBindingRecordsDto,
    WidgetBindingSelectedSourceOption,
    WidgetBindingSourceProvisionInput,
    WidgetBindingSourceProvisionResult,
    WidgetBindingSourcesDto
} from '@universo-react/types'
import { layoutWidgetMetadataResponseSchema } from '@universo-react/types'

export type {
    MarketingWidgetRecordCopyIntent,
    ReplaceLayoutZoneWidgetBindingsInput,
    ReplaceLayoutZoneWidgetBindingsResult,
    WidgetBindingReadDto,
    WidgetBindingReadItem,
    WidgetBindingRecordOption,
    WidgetBindingRecordsDto,
    WidgetBindingSelectedSourceOption,
    WidgetBindingSelectionInput,
    WidgetBindingSelectorInput,
    WidgetBindingSelectorKind,
    WidgetBindingSourceOption,
    WidgetBindingSourceProvisionInput,
    WidgetBindingSourceProvisionResult,
    WidgetBindingSourcesDto
} from '@universo-react/types'

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

export type LayoutZoneWidgetBindingReadItem = WidgetBindingReadItem
export type LayoutZoneWidgetBindings = WidgetBindingReadDto
export type WidgetBindingSelectedSource = WidgetBindingSelectedSourceOption
export type WidgetBindingSourcesPage = WidgetBindingSourcesDto
export type WidgetBindingRecordsPage = WidgetBindingRecordsDto

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
    entityBindingCopyMode?: 'reuse' | 'omit'
}

export const copyLayout = (metahubId: string, layoutId: string, data: LayoutCopyInput) =>
    apiClient.post<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}/copy`, data)

/**
 * Update a layout
 * @param data.expectedVersion - Required version for optimistic locking.
 */
export const updateLayout = (metahubId: string, layoutId: string, data: MetahubLayoutUpdatePayload) =>
    apiClient.patch<MetahubLayout>(`/metahub/${metahubId}/layout/${layoutId}`, data)

export const updateLayoutZoneSetting = (
    metahubId: string,
    layoutId: string,
    zone: ApplicationLayoutZone,
    settingKey: string,
    value: LayoutZoneSettingValue,
    expectedVersion: number
): Promise<MetahubLayout> =>
    apiClient
        .patch<{ item: MetahubLayout }>(
            `/metahub/${metahubId}/layout/${layoutId}/zone-settings/${encodeURIComponent(zone)}/${encodeURIComponent(settingKey)}`,
            { value, expectedVersion }
        )
        .then((response) => response.data.item)

export const resetLayoutZoneSetting = (
    metahubId: string,
    layoutId: string,
    zone: ApplicationLayoutZone,
    settingKey: string,
    expectedVersion: number
): Promise<MetahubLayout> =>
    apiClient
        .post<{ item: MetahubLayout }>(
            `/metahub/${metahubId}/layout/${layoutId}/zone-settings/${encodeURIComponent(zone)}/${encodeURIComponent(settingKey)}/reset`,
            { expectedVersion }
        )
        .then((response) => response.data.item)

/**
 * Delete a layout
 */
export const deleteLayout = (metahubId: string, layoutId: string, expectedVersion: number) =>
    apiClient.delete<void>(`/metahub/${metahubId}/layout/${layoutId}`, { params: { expectedVersion } })

export const getLayoutZoneWidgetObjects = async (metahubId: string, layoutId: string): Promise<DashboardLayoutWidgetItem[]> => {
    const response = await apiClient.get<unknown>(`/metahub/${metahubId}/layout/${layoutId}/zone-widgets/object`)
    const parsed = layoutWidgetMetadataResponseSchema.safeParse(response.data)
    if (!parsed.success) {
        throw new Error('LAYOUT_WIDGET_METADATA_INVALID')
    }
    return parsed.data.items as DashboardLayoutWidgetItem[]
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

/** Atomically copy a Marketing content record and create its duplicated placement. */
export const duplicateLayoutZoneWidgetWithRecordCopy = (
    metahubId: string,
    layoutId: string,
    data: {
        zone: ApplicationLayoutZone
        widgetKey: ApplicationLayoutWidgetKey
        config: Record<string, unknown>
        expectedVersion: number
        recordCopy: MarketingWidgetRecordCopyIntent
    }
) => apiClient.post<MetahubLayoutZoneWidget>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/duplicate`, data)

/** Load the current generic slot bindings for an existing placement in this layout. */
export const getLayoutZoneWidgetBindings = (metahubId: string, layoutId: string, widgetId: string, locale: string) =>
    apiClient.get<LayoutZoneWidgetBindings>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding`, {
        params: { locale }
    })

/** List compatible semantic Entity sources for a placement or a new marketing widget. */
export const listWidgetBindingSources = (
    metahubId: string,
    layoutId: string,
    widgetKey: string,
    slot: string,
    widgetId: string | null,
    locale: string,
    offset = 0,
    search?: string,
    variant?: string,
    parentSourceKey?: string,
    selectedSourceKey?: string
) =>
    apiClient.get<WidgetBindingSourcesPage>(
        `/metahub/${metahubId}/layout/${layoutId}/widget-binding-sources/${encodeURIComponent(widgetKey)}/${encodeURIComponent(slot)}`,
        {
            params: {
                ...(widgetId === null ? {} : { widgetId }),
                locale,
                offset,
                ...(search === undefined ? {} : { search }),
                ...(variant === undefined ? {} : { variant }),
                ...(parentSourceKey === undefined ? {} : { parentSourceKey }),
                ...(selectedSourceKey === undefined ? {} : { selectedSourceKey })
            }
        }
    )

export const provisionWidgetBindingSource = (
    metahubId: string,
    layoutId: string,
    widgetKey: string,
    slot: string,
    data: WidgetBindingSourceProvisionInput
) =>
    apiClient.post<WidgetBindingSourceProvisionResult>(
        `/metahub/${metahubId}/layout/${layoutId}/widget-binding-sources/${encodeURIComponent(widgetKey)}/${encodeURIComponent(slot)}`,
        data
    )

/** List safe semantic-key choices; physical record identifiers stay on the server. */
export const listWidgetBindingRecords = (
    metahubId: string,
    layoutId: string,
    widgetKey: string,
    slot: string,
    widgetId: string | null,
    sourceKey: string,
    locale: string,
    offset = 0,
    search?: string,
    variant?: string,
    selectedSemanticKey?: string
) =>
    apiClient.get<WidgetBindingRecordsPage>(
        widgetId === null
            ? `/metahub/${metahubId}/layout/${layoutId}/widget-binding-records/${encodeURIComponent(widgetKey)}/${encodeURIComponent(slot)}`
            : `/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding-records/${encodeURIComponent(slot)}`,
        {
            params: {
                sourceKey,
                locale,
                offset,
                ...(search === undefined ? {} : { search }),
                ...(variant === undefined ? {} : { variant }),
                ...(selectedSemanticKey === undefined ? {} : { selectedSemanticKey })
            }
        }
    )

/** Replace every selected slot atomically using the placement's optimistic version. */
export const replaceLayoutZoneWidgetBindings = (
    metahubId: string,
    layoutId: string,
    widgetId: string,
    data: ReplaceLayoutZoneWidgetBindingsInput
) =>
    apiClient.patch<ReplaceLayoutZoneWidgetBindingsResult>(`/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding`, data)

export const moveLayoutZoneWidget = (
    metahubId: string,
    layoutId: string,
    data: {
        widgetId: string
        targetZone?: ApplicationLayoutZone
        targetIndex?: number
        targetPlacement?: LayoutLogicalPlacement
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
