import type { RuntimeTarget } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeSurfaceReady } from '../../shared/interpretationNetworkRuntimeContracts'
import { MAX_MATERIAL_BODY_BYTES } from '../interpretationNetwork/runtimeInterpretationNetworkSchemas'

export const PAGE_SIZE = { structures: 100, interpretations: 100, matrix: 250, materials: 25 } as const
export const MAX_OFFSET = 10_000
export const MAX_PUBLIC_BODY_TEXT = 10_000
export const MAX_PUBLIC_BODY_BYTES = MAX_MATERIAL_BODY_BYTES

export type PublicInterpretationNetworkView = keyof typeof PAGE_SIZE

/** Non-enumerating error for invalid, stale, or unavailable public runtime data. */
export class PublicInterpretationNetworkUnavailableError extends Error {
    constructor() {
        super('Public Interpretation Network data is unavailable')
        this.name = 'PublicInterpretationNetworkUnavailableError'
    }
}

export interface PublicInterpretationNetworkReadInput {
    readonly executor: DbExecutor
    readonly surface: RuntimeSurfaceReady
    readonly applicationId: string
    readonly layoutId: string
    readonly widgetId: string
    readonly instanceKey: string
    readonly target: RuntimeTarget
    readonly locale: 'en' | 'ru'
    readonly view: PublicInterpretationNetworkView
    readonly parentHandle?: string
    readonly offset: number
}

/** Build bounded page metadata while hiding the extra sentinel row from callers. */
export const page = (offset: number, limit: number, fetched: number) => ({
    offset,
    limit,
    hasMore: fetched > limit
})
