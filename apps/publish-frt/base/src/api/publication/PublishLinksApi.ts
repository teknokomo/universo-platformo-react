import { getCurrentUrlIds } from '../common'
import { getPublishApiClient } from '../client'

const client = () => getPublishApiClient()

export type PublishLinkTargetType = 'group' | 'version'

export interface PublishLinkRecord {
    id: string
    unikId: string
    spaceId: string | null
    technology: string
    versionGroupId: string | null
    targetCanvasId: string | null
    targetVersionUuid: string | null
    targetType: PublishLinkTargetType
    baseSlug: string
    customSlug: string | null
    isPublic: boolean
    createdAt: string
    updatedAt: string
}

export interface PublishLinkQueryParams {
    technology?: string
    versionGroupId?: string | null
    targetVersionUuid?: string | null
}

export interface PublishLinksApiConfig {
    signal?: AbortSignal
}

export class PublishLinksApi {
    static async listLinks(params: PublishLinkQueryParams = {}, config?: PublishLinksApiConfig): Promise<PublishLinkRecord[]> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const normalizedParams = Object.fromEntries(
            Object.entries({
                unikId,
                spaceId: spaceId ?? undefined,
                ...params
            }).filter(([, value]) => value !== null && value !== undefined && value !== '')
        )

        const response = await client().get('/publish/links', {
            params: normalizedParams,
            signal: config?.signal
        })

        const records = response.data?.data
        if (Array.isArray(records)) {
            return records as PublishLinkRecord[]
        }

        return []
    }

    static async createGroupLink(canvasId: string, technology: 'arjs' | 'playcanvas', versionGroupId?: string): Promise<PublishLinkRecord> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const response = await client().post('/publish/links', {
            unikId,
            spaceId: spaceId || null,
            technology,
            targetCanvasId: canvasId,
            versionGroupId: versionGroupId || null,
            targetType: 'group',
            isPublic: true
        })

        return response.data.data
    }

    static async createVersionLink(canvasId: string, versionUuid: string, technology: 'arjs' | 'playcanvas'): Promise<PublishLinkRecord> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const response = await client().post('/publish/links', {
            unikId,
            spaceId: spaceId || null,
            technology,
            targetCanvasId: canvasId,
            targetVersionUuid: versionUuid,
            targetType: 'version',
            isPublic: true
        })

        return response.data.data
    }

    static async deleteLink(linkId: string): Promise<void> {
        await client().delete(`/publish/links/${linkId}`)
    }

    static async updateCustomSlug(linkId: string, customSlug: string): Promise<PublishLinkRecord> {
        const response = await client().patch(`/publish/links/${linkId}`, {
            customSlug
        })

        return response.data.data
    }
}

export default PublishLinksApi
