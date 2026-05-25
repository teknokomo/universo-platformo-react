import type { CreatePublicationPayload, UpdatePublicationPayload } from '../api'

export interface CreatePublicationParams {
    metahubId: string
    data: CreatePublicationPayload
}

export interface UpdatePublicationParams {
    metahubId: string
    publicationId: string
    data: UpdatePublicationPayload
}

export interface SyncPublicationParams {
    metahubId: string
    publicationId: string
    confirmDestructive?: boolean
}

export interface DeletePublicationParams {
    metahubId: string
    publicationId: string
}
