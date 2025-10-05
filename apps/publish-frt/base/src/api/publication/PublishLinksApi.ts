import axios from 'axios'
import { getApiBaseUrl, getAuthHeaders, getCurrentUrlIds } from '../common'

const API_BASE_URL = getApiBaseUrl()

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

export class PublishLinksApi {
    static async listLinks(params: PublishLinkQueryParams = {}): Promise<PublishLinkRecord[]> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const searchParams = new URLSearchParams()
        searchParams.set('unikId', unikId)

        if (spaceId) {
            searchParams.set('spaceId', spaceId)
        }

        if (params.technology) {
            searchParams.set('technology', params.technology)
        }

        if (params.versionGroupId) {
            searchParams.set('versionGroupId', params.versionGroupId)
        }

        if (params.targetVersionUuid) {
            searchParams.set('targetVersionUuid', params.targetVersionUuid)
        }

        const queryString = searchParams.toString()
        const url = `${API_BASE_URL}/api/v1/publish/links${queryString ? `?${queryString}` : ''}`

        const response = await axios.get(url, {
            headers: {
                ...getAuthHeaders(),
                'x-request-from': 'internal'
            }
        })

        const records = response.data?.data
        if (Array.isArray(records)) {
            return records as PublishLinkRecord[]
        }

        return []
    }
}

export default PublishLinksApi
