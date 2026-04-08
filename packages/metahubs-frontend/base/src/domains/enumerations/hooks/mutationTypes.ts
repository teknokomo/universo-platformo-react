import type { EnumerationLocalizedPayload, EnumerationValueLocalizedPayload } from '../../../types'
import type { EnumerationCopyInput, EnumerationValueCopyInput } from '../api'

export interface CreateEnumerationParams {
    metahubId: string
    hubId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

export interface CreateEnumerationAtMetahubParams {
    metahubId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

export interface UpdateEnumerationParams {
    metahubId: string
    hubId: string
    enumerationId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface UpdateEnumerationAtMetahubParams {
    metahubId: string
    enumerationId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteEnumerationParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    force?: boolean
}

export interface CopyEnumerationParams {
    metahubId: string
    enumerationId: string
    data: EnumerationCopyInput
}

export interface ReorderEnumerationParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    newSortOrder: number
}

export interface CreateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    data: EnumerationValueLocalizedPayload
}

export interface UpdateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    data: Partial<EnumerationValueLocalizedPayload> & { expectedVersion?: number }
}

export interface DeleteEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
}

export interface MoveEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    direction: 'up' | 'down'
}

export interface CopyEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    data?: EnumerationValueCopyInput
}

export interface ReorderEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    newSortOrder: number
    mergedOrderIds?: string[]
}
