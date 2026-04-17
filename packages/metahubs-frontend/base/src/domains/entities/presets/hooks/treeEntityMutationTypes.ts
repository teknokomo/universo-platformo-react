import type { TreeEntityLocalizedPayload } from '../../../../types'
import type { TreeEntityCopyInput } from '../api/trees'

export interface CreateTreeEntityParams {
    metahubId: string
    kindKey?: string
    data: TreeEntityLocalizedPayload & { sortOrder?: number }
}

export interface UpdateTreeEntityParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: Partial<TreeEntityLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteTreeEntityParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
}

export interface CopyTreeEntityParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: TreeEntityCopyInput
}

export interface ReorderTreeEntityParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    newSortOrder: number
}
