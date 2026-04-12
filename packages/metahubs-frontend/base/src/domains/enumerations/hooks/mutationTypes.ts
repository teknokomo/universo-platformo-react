import type { EnumerationLocalizedPayload, EnumerationValueLocalizedPayload } from '../../../types'
import type { EnumerationCopyInput, EnumerationValueCopyInput } from '../api'

export interface CreateEnumerationParams {
    metahubId: string
    hubId: string
    kindKey?: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

export interface CreateEnumerationAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

export interface UpdateEnumerationParams {
    metahubId: string
    hubId: string
    enumerationId: string
    kindKey?: string
    data: EnumerationLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface UpdateEnumerationAtMetahubParams {
    metahubId: string
    enumerationId: string
    kindKey?: string
    data: EnumerationLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteEnumerationParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    kindKey?: string
    force?: boolean
}

export interface CopyEnumerationParams {
    metahubId: string
    enumerationId: string
    kindKey?: string
    data: EnumerationCopyInput
}

export interface ReorderEnumerationParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    kindKey?: string
    newSortOrder: number
}

export interface CreateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    kindKey?: string
    data: EnumerationValueLocalizedPayload
}

export interface UpdateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    kindKey?: string
    data: Partial<EnumerationValueLocalizedPayload> & { expectedVersion?: number }
}

export interface DeleteEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    kindKey?: string
}

export interface MoveEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    kindKey?: string
    direction: 'up' | 'down'
}

export interface CopyEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    kindKey?: string
    data?: EnumerationValueCopyInput
}

export interface ReorderEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    kindKey?: string
    newSortOrder: number
    mergedOrderIds?: string[]
}
