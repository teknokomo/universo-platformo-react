import type { HubLocalizedPayload } from '../../../types'
import type { HubCopyInput } from '../api'

export interface CreateHubParams {
    metahubId: string
    kindKey?: string
    data: HubLocalizedPayload & { sortOrder?: number }
}

export interface UpdateHubParams {
    metahubId: string
    hubId: string
    kindKey?: string
    data: Partial<HubLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteHubParams {
    metahubId: string
    hubId: string
    kindKey?: string
}

export interface CopyHubParams {
    metahubId: string
    hubId: string
    kindKey?: string
    data: HubCopyInput
}

export interface ReorderHubParams {
    metahubId: string
    hubId: string
    kindKey?: string
    newSortOrder: number
}
