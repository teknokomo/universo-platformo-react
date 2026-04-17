import type { OptionListLocalizedPayload, OptionValueLocalizedPayload } from '../../../../types'
import type { OptionListCopyInput, OptionValueCopyInput } from '../api/optionLists'

export interface CreateOptionListParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: OptionListLocalizedPayload & { sortOrder?: number }
}

export interface CreateOptionListAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: OptionListLocalizedPayload & { sortOrder?: number }
}

export interface UpdateOptionListParams {
    metahubId: string
    treeEntityId: string
    optionListId: string
    kindKey?: string
    data: OptionListLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface UpdateOptionListAtMetahubParams {
    metahubId: string
    optionListId: string
    kindKey?: string
    data: OptionListLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteOptionListParams {
    metahubId: string
    treeEntityId?: string
    optionListId: string
    kindKey?: string
    force?: boolean
}

export interface CopyOptionListParams {
    metahubId: string
    optionListId: string
    kindKey?: string
    data: OptionListCopyInput
}

export interface ReorderOptionListParams {
    metahubId: string
    treeEntityId?: string
    optionListId: string
    kindKey?: string
    newSortOrder: number
}

export interface CreateOptionValueParams {
    metahubId: string
    optionListId: string
    kindKey?: string
    data: OptionValueLocalizedPayload
}

export interface UpdateOptionValueParams {
    metahubId: string
    optionListId: string
    valueId: string
    kindKey?: string
    data: Partial<OptionValueLocalizedPayload> & { expectedVersion?: number }
}

export interface DeleteOptionValueParams {
    metahubId: string
    optionListId: string
    valueId: string
    kindKey?: string
}

export interface MoveOptionValueParams {
    metahubId: string
    optionListId: string
    valueId: string
    kindKey?: string
    direction: 'up' | 'down'
}

export interface CopyOptionValueParams {
    metahubId: string
    optionListId: string
    valueId: string
    kindKey?: string
    data?: OptionValueCopyInput
}

export interface ReorderOptionValueParams {
    metahubId: string
    optionListId: string
    valueId: string
    kindKey?: string
    newSortOrder: number
    mergedOrderIds?: string[]
}
