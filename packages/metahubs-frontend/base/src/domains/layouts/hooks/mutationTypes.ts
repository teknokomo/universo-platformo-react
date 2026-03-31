import type { MetahubLayoutLocalizedPayload } from '../../../types'
import type { LayoutCopyInput } from '../api'

export interface CreateLayoutParams {
    metahubId: string
    data: MetahubLayoutLocalizedPayload
}

export interface UpdateLayoutParams {
    metahubId: string
    layoutId: string
    data: Partial<MetahubLayoutLocalizedPayload>
}

export interface DeleteLayoutParams {
    metahubId: string
    layoutId: string
}

export interface CopyLayoutParams {
    metahubId: string
    layoutId: string
    data: LayoutCopyInput
}
