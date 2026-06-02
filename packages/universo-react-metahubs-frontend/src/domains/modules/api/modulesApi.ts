import type {
    MetahubModuleRecord,
    ModuleAttachmentKind,
    ModuleCapability,
    ModuleRole,
    ModuleSourceKind,
    ModuleStorageMode
} from '@universo-react/types'
import { apiClient } from '../../shared'

export interface ModuleUpsertPayload {
    codename: string
    name: string
    description?: string | null
    attachedToKind: ModuleAttachmentKind
    attachedToId?: string | null
    moduleRole?: ModuleRole
    sourceKind?: ModuleSourceKind
    storageMode?: ModuleStorageMode
    sourcePath?: string | null
    sdkApiVersion?: string
    sourceCode?: string
    expectedVersion?: number
    expectedSourceChecksum?: string
    isActive?: boolean
    capabilities?: ModuleCapability[]
    config?: Record<string, unknown>
}

export const modulesApi = {
    list: async (metahubId: string, params: { attachedToKind?: ModuleAttachmentKind; attachedToId?: string | null } = {}) => {
        const { data } = await apiClient.get<{ items: MetahubModuleRecord[] }>(`/metahub/${metahubId}/modules`, {
            params: {
                ...(params.attachedToKind ? { attachedToKind: params.attachedToKind } : {}),
                ...(params.attachedToId !== undefined ? { attachedToId: params.attachedToId } : {})
            }
        })
        return data.items
    },

    create: async (metahubId: string, payload: ModuleUpsertPayload) => {
        const { data } = await apiClient.post<MetahubModuleRecord>(`/metahub/${metahubId}/modules`, payload)
        return data
    },

    update: async (metahubId: string, moduleId: string, payload: Partial<ModuleUpsertPayload>) => {
        const { data } = await apiClient.patch<MetahubModuleRecord>(`/metahub/${metahubId}/module/${moduleId}`, payload)
        return data
    },

    remove: async (metahubId: string, moduleId: string, expectedVersion?: number, expectedSourceChecksum?: string) => {
        await apiClient.delete(`/metahub/${metahubId}/module/${moduleId}`, {
            params:
                expectedVersion !== undefined || expectedSourceChecksum
                    ? {
                          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
                          ...(expectedSourceChecksum ? { expectedSourceChecksum } : {})
                      }
                    : undefined
        })
    }
}
