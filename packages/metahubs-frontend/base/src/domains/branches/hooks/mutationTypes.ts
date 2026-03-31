import type { BranchLocalizedPayload } from '../../../types'

export interface CreateBranchParams {
    metahubId: string
    data: BranchLocalizedPayload
}

export interface UpdateBranchParams {
    metahubId: string
    branchId: string
    data: BranchLocalizedPayload
}

export interface DeleteBranchParams {
    metahubId: string
    branchId: string
}

export interface ActivateBranchParams {
    metahubId: string
    branchId: string
}

export interface SetDefaultBranchParams {
    metahubId: string
    branchId: string
}

export interface CopyBranchParams {
    metahubId: string
    data: BranchLocalizedPayload
}

export type BranchMutationError = Error & {
    response?: {
        status?: number
        data?: {
            code?: string
            error?: string
        }
    }
}
