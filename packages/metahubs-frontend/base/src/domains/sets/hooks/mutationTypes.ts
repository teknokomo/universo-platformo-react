import type { SetLocalizedPayload } from '../../../types'
import type { SetCopyInput } from '../api'

export interface CreateSetParams {
    metahubId: string
    hubId: string
    kindKey?: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface CreateSetAtMetahubParams {
    metahubId: string
    kindKey?: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface UpdateSetParams {
    metahubId: string
    hubId: string
    setId: string
    kindKey?: string
    data: SetLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface UpdateSetAtMetahubParams {
    metahubId: string
    setId: string
    kindKey?: string
    data: SetLocalizedPayload & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteSetParams {
    metahubId: string
    hubId?: string
    setId: string
    kindKey?: string
    force?: boolean
}

export interface CopySetParams {
    metahubId: string
    setId: string
    kindKey?: string
    data: SetCopyInput
}

export interface ReorderSetParams {
    metahubId: string
    hubId?: string
    setId: string
    kindKey?: string
    newSortOrder: number
}
