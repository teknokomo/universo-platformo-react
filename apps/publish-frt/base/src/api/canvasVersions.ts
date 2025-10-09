// Universo Platformo | Canvas Versions API Client

import axios from 'axios'
import { getApiBaseUrl, getAuthHeaders } from './common'

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
    version_uuid?: string | null
    canvasId?: string | number | null
    canvas_id?: string | number | null
}

const API_BASE_URL = getApiBaseUrl()

const toNullableString = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value
    }
    if (typeof value === 'number') {
        return String(value)
    }
    return null
}

const normalizeDate = (value: unknown): string | null => {
    if (!value) {
        return null
    }
    if (value instanceof Date) {
        return value.toISOString()
    }
    if (typeof value === 'string') {
        return value
    }
    return null
}

const mapCanvasVersion = (version: RawCanvasVersion): CanvasVersion | null => {
    const rawId = version.id ?? version.canvasId ?? version.canvas_id ?? null
    const rawVersionUuid = version.versionUuid ?? version.version_uuid ?? null

    const id = toNullableString(rawId)
    const versionUuid = toNullableString(rawVersionUuid)

    if (!id || !versionUuid) {
        return null
    }

    const createdAt = normalizeDate(version.createdAt ?? version.createdDate ?? null)
    const updatedAt = normalizeDate(version.updatedAt ?? version.updatedDate ?? null)

    const versionIndex =
        typeof version.versionIndex === 'number'
            ? version.versionIndex
            : Number.isFinite(Number(version.versionIndex))
                ? Number(version.versionIndex)
                : 0

    return {
        id,
        versionUuid,
        versionLabel: version.versionLabel ?? '',
        versionDescription: version.versionDescription,
        versionIndex,
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
        const { data } = await axios.get(
            `${API_BASE_URL}/api/v1/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`,
            {
                headers: {
                    ...getAuthHeaders(),
                    'x-request-from': 'internal'
                }
            }
        )

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

        return rawVersions
            .map((version) => mapCanvasVersion(version as RawCanvasVersion))
            .filter((version): version is CanvasVersion => Boolean(version))
    }
}
