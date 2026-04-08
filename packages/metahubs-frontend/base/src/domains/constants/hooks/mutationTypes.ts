import type { ConstantLocalizedPayload } from '../../../types'
import type { ConstantCopyInput } from '../api'

export interface BaseConstantScope {
    metahubId: string
    hubId?: string
    setId: string
}

export interface CreateConstantParams extends BaseConstantScope {
    data: ConstantLocalizedPayload
}

export interface UpdateConstantParams extends BaseConstantScope {
    constantId: string
    data: ConstantLocalizedPayload
}

export interface DeleteConstantParams extends BaseConstantScope {
    constantId: string
}

export interface MoveConstantParams extends BaseConstantScope {
    constantId: string
    direction: 'up' | 'down'
}

export interface CopyConstantParams extends BaseConstantScope {
    constantId: string
    data: ConstantCopyInput
}

export interface ReorderConstantParams extends BaseConstantScope {
    constantId: string
    newSortOrder: number
    mergedOrderIds?: string[]
}
