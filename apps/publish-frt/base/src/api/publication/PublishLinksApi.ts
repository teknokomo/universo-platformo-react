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

    static async createGroupLink(
        canvasId: string,
        technology: 'arjs' | 'playcanvas',
        versionGroupId?: string
    ): Promise<PublishLinkRecord> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const response = await axios.post(
            `${API_BASE_URL}/api/v1/publish/links`,
            {
                unikId,
                spaceId: spaceId || null,
                technology,
                targetCanvasId: canvasId,
                versionGroupId: versionGroupId || null,
                targetType: 'group',
                isPublic: true
            },
            {
                headers: {
                    ...getAuthHeaders(),
                    'x-request-from': 'internal'
                }
            }
        )

        return response.data.data
    }

    static async createVersionLink(canvasId: string, versionUuid: string, technology: 'arjs' | 'playcanvas'): Promise<PublishLinkRecord> {
        const { unikId, spaceId } = getCurrentUrlIds()
        if (!unikId) {
            throw new Error('unikId not found in URL')
        }

        const response = await axios.post(`${API_BASE_URL}/api/v1/publish/links`, {
            unikId,
            spaceId: spaceId || null,
            technology,
            targetCanvasId: canvasId,
            targetVersionUuid: versionUuid,
            targetType: 'version',
            isPublic: true
        }, {
            headers: {
                ...getAuthHeaders(),
                'x-request-from': 'internal'
            }
        })

        return response.data.data
    }

    static async deleteLink(linkId: string): Promise<void> {
        await axios.delete(`${API_BASE_URL}/api/v1/publish/links/${linkId}`, {
            headers: {
                ...getAuthHeaders(),
                'x-request-from': 'internal'
            }
        })
    }

    static async updateCustomSlug(linkId: string, customSlug: string): Promise<PublishLinkRecord> {
        const response = await axios.patch(`${API_BASE_URL}/api/v1/publish/links/${linkId}`, {
            customSlug
        }, {
            headers: {
                ...getAuthHeaders(),
                'x-request-from': 'internal'
            }
        })

        return response.data.data
    }
}

export default PublishLinksApi
