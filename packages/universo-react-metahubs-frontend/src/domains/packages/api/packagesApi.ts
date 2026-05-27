import type {
    AttachMetahubPackageRequest,
    ChangeMetahubPackageVersionRequest,
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

    detach: async (metahubId: string, attachmentId: string) => {
        await apiClient.delete(`/metahub/${metahubId}/package/${attachmentId}`)
    }
}
