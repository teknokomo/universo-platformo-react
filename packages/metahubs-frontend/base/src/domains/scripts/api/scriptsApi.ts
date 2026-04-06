import type { MetahubScriptRecord, ScriptAttachmentKind, ScriptCapability, ScriptModuleRole, ScriptSourceKind } from '@universo/types'
import { apiClient } from '../../shared'

export interface ScriptUpsertPayload {
    codename: string
    name: string
    description?: string | null
    attachedToKind: ScriptAttachmentKind
    attachedToId?: string | null
    moduleRole?: ScriptModuleRole
    sourceKind?: ScriptSourceKind
    sdkApiVersion?: string
    sourceCode: string
    isActive?: boolean
    capabilities?: ScriptCapability[]
}

export const scriptsApi = {
    list: async (metahubId: string, params: { attachedToKind?: ScriptAttachmentKind; attachedToId?: string | null } = {}) => {
        const { data } = await apiClient.get<{ items: MetahubScriptRecord[] }>(`/metahub/${metahubId}/scripts`, {
            params: {
                ...(params.attachedToKind ? { attachedToKind: params.attachedToKind } : {}),
                ...(params.attachedToId !== undefined ? { attachedToId: params.attachedToId } : {})
            }
        })
        return data.items
    },

    create: async (metahubId: string, payload: ScriptUpsertPayload) => {
        const { data } = await apiClient.post<MetahubScriptRecord>(`/metahub/${metahubId}/scripts`, payload)
        return data
    },

    update: async (metahubId: string, scriptId: string, payload: Partial<ScriptUpsertPayload>) => {
        const { data } = await apiClient.patch<MetahubScriptRecord>(`/metahub/${metahubId}/script/${scriptId}`, payload)
        return data
    },

    remove: async (metahubId: string, scriptId: string) => {
        await apiClient.delete(`/metahub/${metahubId}/script/${scriptId}`)
    }
}