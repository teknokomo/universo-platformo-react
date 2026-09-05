import type { MetahubCreateLayoutPayload, MetahubLayoutUpdatePayload } from '../../../types'
import type { LayoutCopyInput, LayoutScopeParams } from '../api'

export interface CreateLayoutParams {
    metahubId: string
    data: MetahubCreateLayoutPayload
}

export interface UpdateLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
    data: MetahubLayoutUpdatePayload
}

export interface DeleteLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
    expectedVersion: number
}

export interface CopyLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
    data: LayoutCopyInput
}
