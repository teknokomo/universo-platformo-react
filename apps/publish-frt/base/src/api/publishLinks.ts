// Universo Platformo | Publication Links API Client

import axios from 'axios'

const API_BASE = '/api/v1/publish'

export interface PublishLinkResponse {
    id: string
    baseSlug: string
    customSlug: string | null
    technology: 'arjs' | 'playcanvas' | 'generic'
    isPublic: boolean
    targetType: 'group' | 'version'
    versionGroupId: string | null
    targetCanvasId: string | null
    targetVersionUuid: string | null
    unikId: string
    spaceId: string | null
    createdAt: string
    updatedAt: string
}

export const publishLinksApi = {
    /**
     * Ensure a group link exists for a canvas
     * Creates if doesn't exist, returns existing if found
     */
    async ensureGroupLink(canvasId: string, technology: 'arjs' | 'playcanvas'): Promise<PublishLinkResponse> {
        const { data } = await axios.post(`${API_BASE}/arjs`, {
            canvasId,
            technology,
            generationMode: 'streaming',
            isPublic: true
        })

        // Legacy endpoint returns different format, normalize it
        if (data.success && data.publicationId) {
            // Fetch the actual link to get full details
            const links = await this.listLinks(canvasId)
            const link = links.find((l) => l.baseSlug === data.publicationId || l.customSlug === data.publicationId)
            if (link) {
                return link
            }
        }

        throw new Error('Failed to ensure group link')
    },

    /**
     * List all publication links for a canvas
     */
    async listLinks(canvasId: string): Promise<PublishLinkResponse[]> {
        // Note: This requires unikId, which we'll need to pass from the component
        // For now, we'll use a workaround by fetching from the canvas context
        const { data } = await axios.get(`${API_BASE}/links`, {
            params: { targetCanvasId: canvasId }
        })
        return data.data || []
    },

    /**
     * List version links by version group and technology
     */
    async listVersionLinks(versionGroupId: string, technology: 'arjs' | 'playcanvas'): Promise<PublishLinkResponse[]> {
        const { data } = await axios.get(`${API_BASE}/links`, {
            params: { versionGroupId, technology }
        })
        return data.data || []
    },

    /**
     * Create a version-specific publication link
     */
    async createVersionLink(canvasId: string, versionUuid: string, technology: 'arjs' | 'playcanvas'): Promise<PublishLinkResponse> {
        const { data } = await axios.post(`${API_BASE}/arjs`, {
            canvasId,
            versionUuid,
            technology,
            generationMode: 'streaming',
            isPublic: true
        })

        if (data.success) {
            // Return the created link data
            return data as unknown as PublishLinkResponse
        }

        throw new Error('Failed to create version link')
    },

    /**
     * Delete a publication link
     */
    async deleteLink(linkId: string): Promise<void> {
        await axios.delete(`${API_BASE}/links/${linkId}`)
    },

    /**
     * Update custom slug for a publication link
     */
    async updateCustomSlug(linkId: string, customSlug: string): Promise<PublishLinkResponse> {
        const { data } = await axios.patch(`${API_BASE}/links/${linkId}`, {
            customSlug
        })
        return data.data
    }
}
