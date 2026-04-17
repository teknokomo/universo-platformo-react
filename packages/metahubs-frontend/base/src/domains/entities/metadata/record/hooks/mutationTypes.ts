import type { RecordCopyOptions } from '@universo/types'

export interface BaseElementScope {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
}

export interface CreateRecordParams extends BaseElementScope {
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

export interface UpdateRecordParams extends BaseElementScope {
    recordId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
        expectedVersion?: number
    }
}

export interface DeleteRecordParams extends BaseElementScope {
    recordId: string
}

export interface CopyRecordParams extends BaseElementScope {
    recordId: string
    data?: Partial<RecordCopyOptions>
}

export interface MoveRecordParams extends BaseElementScope {
    recordId: string
    direction: 'up' | 'down'
}

export interface ReorderRecordParams extends BaseElementScope {
    recordId: string
    newSortOrder: number
}
