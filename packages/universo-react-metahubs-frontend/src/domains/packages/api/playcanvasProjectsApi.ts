import type {
    CreatePlayCanvasProjectRequest,
    PlayCanvasPublishedRuntimeManifestSummary,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    UpdatePlayCanvasProjectSettingsRequest
} from '@universo-react/types'
import { apiClient } from '../../shared'

export const playcanvasProjectsApi = {
    list: async (metahubId: string) => {
        const { data } = await apiClient.get<{ items: PlayCanvasProjectSummary[] }>(`/metahub/${metahubId}/playcanvas/projects`)
        return data.items
    },

    create: async (metahubId: string, payload: CreatePlayCanvasProjectRequest) => {
        const { data } = await apiClient.post<{ item: PlayCanvasProjectSummary }>(`/metahub/${metahubId}/playcanvas/projects`, payload)
        return data.item
    },

    update: async (
        metahubId: string,
        projectId: string,
        payload: UpdatePlayCanvasProjectSettingsRequest & { expectedVersion?: number }
    ) => {
        const { data } = await apiClient.patch<{ item: PlayCanvasProjectSummary }>(
            `/metahub/${metahubId}/playcanvas/projects/${projectId}`,
            payload
        )
        return data.item
    },

    remove: async (metahubId: string, projectId: string, expectedVersion: number) => {
        const { data } = await apiClient.delete<{ item: PlayCanvasProjectSummary }>(
            `/metahub/${metahubId}/playcanvas/projects/${projectId}`,
            { params: { expectedVersion } }
        )
        return data.item
    },

    publish: async (metahubId: string, projectId: string) => {
        const { data } = await apiClient.post<{ items: PlayCanvasRuntimeManifest[] }>(
            `/metahub/${metahubId}/playcanvas/projects/${projectId}/publish`,
            {}
        )
        return data.items
    },

    listPublishedRuntimeManifests: async (metahubId: string) => {
        const { data } = await apiClient.get<{ items: PlayCanvasPublishedRuntimeManifestSummary[] }>(
            `/metahub/${metahubId}/playcanvas/published-runtime-manifests`
        )
        return data.items
    }
}
