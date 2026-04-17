import type { VersionedLocalizedContent } from '@universo/types'

import { apiClient } from '../../shared'

type JsonRecord = Record<string, unknown>

export interface MetahubEntityAction {
    id: string
    objectId: string
    codename: VersionedLocalizedContent<string> | string | JsonRecord | null
    presentation: JsonRecord
    actionType: 'script' | 'builtin'
    scriptId: string | null
    config: JsonRecord
    sortOrder: number
    version: number
    updatedAt: string | null
}

export interface EntityActionPayload {
    codename: VersionedLocalizedContent<string> | string | JsonRecord
    presentation?: JsonRecord
    actionType: 'script' | 'builtin'
    scriptId?: string | null
    config?: JsonRecord
    sortOrder?: number
}

export interface UpdateEntityActionPayload extends Partial<EntityActionPayload> {
    expectedVersion?: number
}

export interface MetahubEventBinding {
    id: string
    objectId: string
    eventName: string
    actionId: string
    priority: number
    isActive: boolean
    config: JsonRecord
    version: number
    updatedAt: string | null
}

export interface EventBindingPayload {
    eventName: string
    actionId: string
    priority?: number
    isActive?: boolean
    config?: JsonRecord
}

export interface UpdateEventBindingPayload extends Partial<EventBindingPayload> {
    expectedVersion?: number
}

export const listEntityActions = async (metahubId: string, entityId: string): Promise<MetahubEntityAction[]> => {
    const response = await apiClient.get<{ items?: MetahubEntityAction[] }>(`/metahub/${metahubId}/object/${entityId}/actions`)
    return response.data.items ?? []
}

export const createEntityAction = async (metahubId: string, entityId: string, data: EntityActionPayload): Promise<MetahubEntityAction> => {
    const response = await apiClient.post<MetahubEntityAction>(`/metahub/${metahubId}/object/${entityId}/actions`, data)
    return response.data
}

export const updateEntityAction = async (
    metahubId: string,
    actionId: string,
    data: UpdateEntityActionPayload
): Promise<MetahubEntityAction> => {
    const response = await apiClient.patch<MetahubEntityAction>(`/metahub/${metahubId}/action/${actionId}`, data)
    return response.data
}

export const deleteEntityAction = async (metahubId: string, actionId: string): Promise<void> => {
    await apiClient.delete(`/metahub/${metahubId}/action/${actionId}`)
}

export const listEntityEventBindings = async (metahubId: string, entityId: string): Promise<MetahubEventBinding[]> => {
    const response = await apiClient.get<{ items?: MetahubEventBinding[] }>(`/metahub/${metahubId}/object/${entityId}/event-bindings`)
    return response.data.items ?? []
}

export const createEntityEventBinding = async (
    metahubId: string,
    entityId: string,
    data: EventBindingPayload
): Promise<MetahubEventBinding> => {
    const response = await apiClient.post<MetahubEventBinding>(`/metahub/${metahubId}/object/${entityId}/event-bindings`, data)
    return response.data
}

export const updateEntityEventBinding = async (
    metahubId: string,
    bindingId: string,
    data: UpdateEventBindingPayload
): Promise<MetahubEventBinding> => {
    const response = await apiClient.patch<MetahubEventBinding>(`/metahub/${metahubId}/event-binding/${bindingId}`, data)
    return response.data
}

export const deleteEntityEventBinding = async (metahubId: string, bindingId: string): Promise<void> => {
    await apiClient.delete(`/metahub/${metahubId}/event-binding/${bindingId}`)
}
