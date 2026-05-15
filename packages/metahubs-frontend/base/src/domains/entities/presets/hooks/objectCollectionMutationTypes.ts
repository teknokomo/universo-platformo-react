import type { ObjectCollectionLocalizedPayload } from '../../../../types'
import type { ObjectCollectionCopyInput } from '../api/objectCollections'

export interface CreateObjectCollectionParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: ObjectCollectionLocalizedPayload & { sortOrder?: number }
}

export interface CreateObjectCollectionAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: ObjectCollectionLocalizedPayload & { sortOrder?: number }
}

export interface UpdateObjectCollectionParams {
    metahubId: string
    treeEntityId: string
    objectCollectionId: string
    kindKey?: string
    data: ObjectCollectionLocalizedPayload & { sortOrder?: number }
}

export interface UpdateObjectCollectionAtMetahubParams {
    metahubId: string
    objectCollectionId: string
    kindKey?: string
    data: ObjectCollectionLocalizedPayload & { sortOrder?: number }
}

export interface DeleteObjectCollectionParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    force?: boolean
    kindKey?: string
}

export interface CopyObjectCollectionParams {
    metahubId: string
    objectCollectionId: string
    data: ObjectCollectionCopyInput
    kindKey?: string
}

export interface ReorderObjectCollectionParams {
    metahubId: string
    treeEntityId?: string
    objectCollectionId: string
    newSortOrder: number
    kindKey?: string
}
