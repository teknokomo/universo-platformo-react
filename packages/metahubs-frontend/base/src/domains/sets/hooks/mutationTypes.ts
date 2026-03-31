import type { SetLocalizedPayload } from '../../../types'
import type { SetCopyInput } from '../api'

export interface CreateSetParams {
    metahubId: string
    hubId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface CreateSetAtMetahubParams {
    metahubId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface UpdateSetParams {
    metahubId: string
    hubId: string
    setId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface UpdateSetAtMetahubParams {
    metahubId: string
    setId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

export interface DeleteSetParams {
    metahubId: string
    hubId?: string
    setId: string
    force?: boolean
}

export interface CopySetParams {
    metahubId: string
    setId: string
    data: SetCopyInput
}

export interface ReorderSetParams {
    metahubId: string
    hubId?: string
    setId: string
    newSortOrder: number
}
