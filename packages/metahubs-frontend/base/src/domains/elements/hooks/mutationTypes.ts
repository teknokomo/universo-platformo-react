import type { ElementCopyOptions } from '@universo/types'

export interface BaseElementScope {
    metahubId: string
    hubId?: string
    catalogId: string
}

export interface CreateElementParams extends BaseElementScope {
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

export interface UpdateElementParams extends BaseElementScope {
    elementId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

export interface DeleteElementParams extends BaseElementScope {
    elementId: string
}

export interface CopyElementParams extends BaseElementScope {
    elementId: string
    data?: Partial<ElementCopyOptions>
}

export interface MoveElementParams extends BaseElementScope {
    elementId: string
    direction: 'up' | 'down'
}

export interface ReorderElementParams extends BaseElementScope {
    elementId: string
    newSortOrder: number
}
