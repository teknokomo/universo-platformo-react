import type {
    AttachMetahubPackageRequest,
    ChangeMetahubPackageVersionRequest,
    PackageAuthoringHostDescriptor,
    PlayCanvasEditorCompatibilityConfig,
    UpdateMetahubPackageConfigRequest,
    MetahubPackageAttachment,
    MetahubPackageCatalogItem
} from '@universo-react/types'
import { apiClient } from '../../shared'

export const packagesApi = {
    listCatalog: async (metahubId: string) => {
        const { data } = await apiClient.get<{ items: MetahubPackageCatalogItem[]; total: number }>(
            `/metahub/${metahubId}/packages/catalog`
        )
        return data.items
    },

    listAttached: async (metahubId: string) => {
        const { data } = await apiClient.get<{ items: MetahubPackageAttachment[]; total: number }>(`/metahub/${metahubId}/packages`)
        return data.items
    },

    attach: async (metahubId: string, payload: AttachMetahubPackageRequest) => {
        const { data } = await apiClient.post<MetahubPackageAttachment>(`/metahub/${metahubId}/packages`, payload)
        return data
    },

    changeVersion: async (metahubId: string, attachmentId: string, payload: ChangeMetahubPackageVersionRequest) => {
        const { data } = await apiClient.patch<MetahubPackageAttachment>(`/metahub/${metahubId}/package/${attachmentId}`, payload)
        return data
    },

    updateConfig: async (metahubId: string, attachmentId: string, payload: UpdateMetahubPackageConfigRequest) => {
        const { data } = await apiClient.patch<MetahubPackageAttachment>(`/metahub/${metahubId}/package/${attachmentId}/config`, payload)
        return data
    },

    getAuthoringHost: async (metahubId: string, packageSlug: string) => {
        const { data } = await apiClient.get<PackageAuthoringHostDescriptor>(`/metahub/${metahubId}/packages/${packageSlug}/authoring-host`)
        return data
    },

    getPlayCanvasEditorCompatibilityConfig: async (metahubId: string, projectId: string, artifactOrigin?: string | null) => {
        const { data } = await apiClient.get<{ item: PlayCanvasEditorCompatibilityConfig }>(
            `/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/config`,
            artifactOrigin ? { params: { artifactOrigin } } : undefined
        )
        return data.item
    },

    getCsrfToken: async () => {
        const { data } = await apiClient.get<{ csrfToken: string }>('auth/csrf')
        return data.csrfToken
    },

    detach: async (metahubId: string, attachmentId: string) => {
        await apiClient.delete(`/metahub/${metahubId}/package/${attachmentId}`)
    }
}
