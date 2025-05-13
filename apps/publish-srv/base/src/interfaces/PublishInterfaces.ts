// Universo Platformo | Interfaces for publication API

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
 * Publication response
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

/**
 * Published project model
 */
export interface PublishedProject {
    id: string
    projectId: string
    platform: string
    url: string
    createdAt: Date
    updatedAt: Date
    status: 'published' | 'failed' | 'in_progress'
    error?: string
    isPublic: boolean
    customUrl?: string
    options?: Record<string, any>
}
