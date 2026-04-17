import type { ValueGroupLocalizedPayload } from '../../../../types'
import type { ValueGroupCopyInput } from '../api/valueGroups'

export interface CreateValueGroupParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: ValueGroupLocalizedPayload & { sortOrder?: number }
}

export interface CreateValueGroupAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: ValueGroupLocalizedPayload & { sortOrder?: number }
}

export interface UpdateValueGroupParams {
    metahubId: string
    treeEntityId: string
    valueGroupId: string
    kindKey?: string
    data: ValueGroupLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface UpdateValueGroupAtMetahubParams {
    metahubId: string
    valueGroupId: string
    kindKey?: string
    data: ValueGroupLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteValueGroupParams {
    metahubId: string
    treeEntityId?: string
    valueGroupId: string
    kindKey?: string
    force?: boolean
}

export interface CopyValueGroupParams {
    metahubId: string
    valueGroupId: string
    kindKey?: string
    data: ValueGroupCopyInput
}

export interface ReorderValueGroupParams {
    metahubId: string
    treeEntityId?: string
    valueGroupId: string
    kindKey?: string
    newSortOrder: number
}
