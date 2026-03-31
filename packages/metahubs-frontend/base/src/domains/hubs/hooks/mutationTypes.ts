import type { HubLocalizedPayload } from '../../../types'
import type { HubCopyInput } from '../api'

export interface CreateHubParams {
    metahubId: string
    data: HubLocalizedPayload & { sortOrder?: number }
}

export interface UpdateHubParams {
    metahubId: string
    hubId: string
    data: Partial<HubLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
}

export interface DeleteHubParams {
    metahubId: string
    hubId: string
}

export interface CopyHubParams {
    metahubId: string
    hubId: string
    data: HubCopyInput
}

export interface ReorderHubParams {
    metahubId: string
    hubId: string
    newSortOrder: number
}
