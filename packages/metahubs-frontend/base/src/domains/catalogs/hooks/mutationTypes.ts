import type { CatalogLocalizedPayload } from '../../../types'
import type { CatalogCopyInput } from '../api'

export interface CreateCatalogParams {
    metahubId: string
    hubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

export interface CreateCatalogAtMetahubParams {
    metahubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

export interface UpdateCatalogParams {
    metahubId: string
    hubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

export interface UpdateCatalogAtMetahubParams {
    metahubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

export interface DeleteCatalogParams {
    metahubId: string
    hubId?: string
    catalogId: string
    force?: boolean
}

export interface CopyCatalogParams {
    metahubId: string
    catalogId: string
    data: CatalogCopyInput
}

export interface ReorderCatalogParams {
    metahubId: string
    hubId?: string
    catalogId: string
    newSortOrder: number
}
