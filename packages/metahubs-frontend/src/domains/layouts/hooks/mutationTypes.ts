import type { MetahubCreateLayoutPayload, MetahubLayoutLocalizedPayload } from '../../../types'
import type { LayoutCopyInput, LayoutScopeParams } from '../api'

export interface CreateLayoutParams {
    metahubId: string
    data: MetahubCreateLayoutPayload
}

export interface UpdateLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
    data: Partial<MetahubLayoutLocalizedPayload>
}

export interface DeleteLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
}

export interface CopyLayoutParams extends LayoutScopeParams {
    metahubId: string
    layoutId: string
    data: LayoutCopyInput
}
