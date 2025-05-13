// Universo Platformo | Type definitions for publish API

/**
 * Publication request
 */
export interface PublishRequest {
    projectId: string
    platform: string
    options?: {
        isPublic: boolean
        customUrl?: string
        [key: string]: any
    }
}

/**
 * Response with publication information
 */
export interface PublishResponse {
    id: string
    projectId: string
    platform: string
    url: string
    createdAt: string
    updatedAt: string
    status: 'published' | 'failed' | 'in_progress'
    error?: string
}
