import {
    MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES,
    publicApplicationInstanceKeySchema,
    publicInterpretationNetworkHandleSchema,
    publicInterpretationNetworkReadResponseSchema,
    uuidV7Schema,
    type PublicInterpretationNetworkReadResponse
} from '@universo-react/types'

export type PublicNetworkView = PublicInterpretationNetworkReadResponse['view']

/** Public selectors mirror the bootstrap contract; identifiers stay out of DTOs and rendered content. */
export interface PublicDashboardTarget {
    targetKind?: 'page' | 'object' | null
    entityTypeId?: string | null
    entityTypeCodename?: string | null
}

export interface PublicNetworkReadInput {
    applicationRef: string
    locale: string
    target?: PublicDashboardTarget
    instanceKey: string
    view: PublicNetworkView
    parentHandle?: string
    offset: number
}

export class PublicNetworkReadError extends Error {
    constructor() {
        super('Public content is unavailable')
        this.name = 'PublicNetworkReadError'
    }
}

const readBoundedJsonBody = async (response: Response): Promise<unknown> => {
    const contentLength = response.headers.get('content-length')
    if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) {
        await response.body?.cancel().catch(() => undefined)
        throw new PublicNetworkReadError()
    }
    if (!response.body) return null

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let byteCount = 0
    let body = ''
    try {
        let done = false
        while (!done) {
            const chunk = await reader.read()
            done = chunk.done
            if (done) break
            const { value } = chunk
            if (!value) continue
            byteCount += value.byteLength
            if (byteCount > MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) {
                await reader.cancel().catch(() => undefined)
                throw new PublicNetworkReadError()
            }
            body += decoder.decode(value, { stream: true })
        }
        body += decoder.decode()
        return body ? JSON.parse(body) : null
    } catch (error) {
        if (error instanceof PublicNetworkReadError) throw error
        throw new PublicNetworkReadError()
    } finally {
        reader.releaseLock()
    }
}

const normalizeScope = (input: PublicNetworkReadInput) => ({
    applicationRef: input.applicationRef.trim().toLowerCase(),
    locale: input.locale.trim().split(/[-_]/u)[0].toLowerCase(),
    target: {
        targetKind: input.target?.targetKind?.trim().toLowerCase() ?? null,
        entityTypeId: input.target?.entityTypeId?.trim().toLowerCase() ?? null,
        entityTypeCodename: input.target?.entityTypeCodename?.trim() ?? null
    }
})

/** Each public navigation page has an independent cache entry, including its opaque parent. */
export const publicNetworkReadQueryKey = (input: PublicNetworkReadInput) => {
    const scope = normalizeScope(input)
    return [
        'public-interpretation-network',
        scope.applicationRef,
        scope.locale,
        scope.target,
        input.instanceKey,
        input.view,
        input.parentHandle ?? null,
        input.offset
    ] as const
}

/** Read-only transport: validates the endpoint selectors and the complete, strict public DTO. */
export async function readPublicInterpretationNetwork(input: PublicNetworkReadInput, signal?: AbortSignal) {
    const { applicationRef, locale, target } = normalizeScope(input)
    const isStructures = input.view === 'structures'
    if (
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(applicationRef) ||
        (locale !== 'en' && locale !== 'ru') ||
        !publicApplicationInstanceKeySchema.safeParse(input.instanceKey).success ||
        !['structures', 'interpretations', 'matrix', 'materials'].includes(input.view) ||
        !Number.isInteger(input.offset) ||
        input.offset < 0 ||
        input.offset > 10_000 ||
        (isStructures
            ? input.parentHandle !== undefined
            : !publicInterpretationNetworkHandleSchema.safeParse(input.parentHandle).success) ||
        (target.targetKind !== null && target.targetKind !== 'page' && target.targetKind !== 'object') ||
        (target.targetKind === null) !== (target.entityTypeId === null && target.entityTypeCodename === null) ||
        (target.entityTypeId !== null && target.entityTypeCodename !== null) ||
        (target.entityTypeId !== null && !uuidV7Schema.safeParse(target.entityTypeId).success) ||
        (target.entityTypeCodename !== null && !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u.test(target.entityTypeCodename))
    )
        throw new PublicNetworkReadError()

    const params = new URLSearchParams({ locale, view: input.view, offset: String(input.offset) })
    if (target.targetKind && (target.entityTypeId || target.entityTypeCodename)) {
        params.set('targetKind', target.targetKind)
        if (target.entityTypeId) params.set('entityTypeId', target.entityTypeId)
        if (target.entityTypeCodename) params.set('entityTypeCodename', target.entityTypeCodename)
    }
    if (input.parentHandle) params.set('parentHandle', input.parentHandle)
    const response = await fetch(
        `/api/v1/public/applications/${encodeURIComponent(applicationRef)}/runtime/widgets/${encodeURIComponent(
            input.instanceKey
        )}/interpretation-network?${params}`,
        { method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal }
    )
    if (!response.ok) throw new PublicNetworkReadError()
    const body = await readBoundedJsonBody(response)
    const parsed = publicInterpretationNetworkReadResponseSchema.safeParse(body)
    if (!parsed.success || parsed.data.view !== input.view || parsed.data.locale !== locale || parsed.data.page.offset !== input.offset) {
        throw new PublicNetworkReadError()
    }
    const data = parsed.data
    if (
        (data.view === 'interpretations' && data.structure.handle !== input.parentHandle) ||
        (data.view === 'matrix' && data.interpretation.handle !== input.parentHandle) ||
        (data.view === 'materials' && (data.cellHandle !== input.parentHandle || data.items.filter((item) => item.isPrimary).length > 1))
    )
        throw new PublicNetworkReadError()
    return data
}
