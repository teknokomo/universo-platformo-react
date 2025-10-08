// Universo Platformo | Canvas Versions API Client

import axios from 'axios'

export interface CanvasVersion {
    id: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string
    versionIndex: number
    createdAt: string | null
    updatedAt: string | null
    isActive: boolean
}

type RawCanvasVersion = Partial<CanvasVersion> & {
    createdDate?: string | null
    updatedDate?: string | null
}

const mapCanvasVersion = (version: RawCanvasVersion): CanvasVersion => {
    const createdAt = version.createdAt ?? version.createdDate ?? null
    const updatedAt = version.updatedAt ?? version.updatedDate ?? null

    return {
        id: version.id ?? '',
        versionUuid: version.versionUuid ?? '',
        versionLabel: version.versionLabel ?? '',
        versionDescription: version.versionDescription,
        versionIndex: version.versionIndex ?? 0,
        createdAt,
        updatedAt,
        isActive: Boolean(version.isActive)
    }
}

export const canvasVersionsApi = {
    /**
     * List all versions for a canvas
     */
    async listVersions(unikId: string, spaceId: string, canvasId: string): Promise<CanvasVersion[]> {
        const { data } = await axios.get(`/api/v1/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`)

        const rawVersions = Array.isArray(data?.data?.versions)
            ? data.data.versions
            : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data)
                    ? data
                    : []

        if (!Array.isArray(rawVersions) || rawVersions.length === 0) {
            return []
        }

        return rawVersions.map((version) => mapCanvasVersion(version as RawCanvasVersion))
    }
}
