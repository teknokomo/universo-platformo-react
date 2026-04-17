import type { LinkedCollectionLocalizedPayload } from '../../../../types'
import type { LinkedCollectionCopyInput } from '../api/linkedCollections'

export interface CreateLinkedCollectionParams {
    metahubId: string
    treeEntityId: string
    kindKey?: string
    data: LinkedCollectionLocalizedPayload & { sortOrder?: number }
}

export interface CreateLinkedCollectionAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: LinkedCollectionLocalizedPayload & { sortOrder?: number }
}

export interface UpdateLinkedCollectionParams {
    metahubId: string
    treeEntityId: string
    linkedCollectionId: string
    kindKey?: string
    data: LinkedCollectionLocalizedPayload & { sortOrder?: number }
}

export interface UpdateLinkedCollectionAtMetahubParams {
    metahubId: string
    linkedCollectionId: string
    kindKey?: string
    data: LinkedCollectionLocalizedPayload & { sortOrder?: number }
}

export interface DeleteLinkedCollectionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    force?: boolean
    kindKey?: string
}

export interface CopyLinkedCollectionParams {
    metahubId: string
    linkedCollectionId: string
    data: LinkedCollectionCopyInput
    kindKey?: string
}

export interface ReorderLinkedCollectionParams {
    metahubId: string
    treeEntityId?: string
    linkedCollectionId: string
    newSortOrder: number
    kindKey?: string
}
