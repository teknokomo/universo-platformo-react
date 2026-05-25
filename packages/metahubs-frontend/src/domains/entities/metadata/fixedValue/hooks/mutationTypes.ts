import type { FixedValueLocalizedPayload } from '../../../../../types'
import type { FixedValueCopyInput } from '../api'

export interface BaseConstantScope {
    metahubId: string
    treeEntityId?: string
    valueGroupId: string
    kindKey?: string
}

export interface CreateFixedValueParams extends BaseConstantScope {
    data: FixedValueLocalizedPayload
}

export interface UpdateFixedValueParams extends BaseConstantScope {
    fixedValueId: string
    data: FixedValueLocalizedPayload
}

export interface DeleteFixedValueParams extends BaseConstantScope {
    fixedValueId: string
}

export interface MoveFixedValueParams extends BaseConstantScope {
    fixedValueId: string
    direction: 'up' | 'down'
}

export interface CopyFixedValueParams extends BaseConstantScope {
    fixedValueId: string
    data: FixedValueCopyInput
}

export interface ReorderFixedValueParams extends BaseConstantScope {
    fixedValueId: string
    newSortOrder: number
    mergedOrderIds?: string[]
}
