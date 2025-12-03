import { PublishCanvas } from '../database/entities'

export interface CreatePublishLinkDto {
    unikId: string
    spaceId?: string | null
    technology: PublishCanvas['technology']
    versionGroupId?: string | null
    targetCanvasId?: string | null
    targetVersionUuid?: string | null
    customSlug?: string | null
    isPublic?: boolean
}

export interface UpdatePublishLinkDto {
    customSlug?: string | null
    isPublic?: boolean
    targetCanvasId?: string | null
    targetVersionUuid?: string | null
}

export interface PublishLinkQuery {
    unikId: string
    spaceId?: string
    technology?: PublishCanvas['technology']
    versionGroupId?: string
    targetVersionUuid?: string
}

export type PublishLinkResponse = PublishCanvas
