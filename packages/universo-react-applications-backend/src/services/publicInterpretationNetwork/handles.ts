import { createHash } from 'node:crypto'
import { isUuidV7 } from '@universo-react/utils'
import { PublicInterpretationNetworkUnavailableError, type PublicInterpretationNetworkReadInput } from './contracts'
import { issueRuntimeOpaqueHandle, readRuntimeOpaqueHandle } from '../runtimeOpaqueHandleCodec'

const PUBLIC_HANDLE_PREFIX = 'pn1.'
const PUBLIC_HANDLE_KEY_CONTEXT = 'universo-public-interpretation-network:v1'
const MAX_HANDLE_LENGTH = 1024

export interface PublicHandleClaims {
    readonly v: 1
    readonly kind: 'structure' | 'interpretation' | 'cell'
    readonly applicationId: string
    readonly workspaceId: string | null
    readonly layoutId: string
    readonly widgetId: string
    readonly instanceKey: string
    readonly targetHash: string
    readonly recordId: string
    readonly cellId?: string
}

const targetHash = (target: PublicInterpretationNetworkReadInput['target']): string =>
    createHash('sha256').update(JSON.stringify(target)).digest('hex')

const publicHandleScope = (input: PublicInterpretationNetworkReadInput) => ({
    applicationId: input.applicationId,
    workspaceId: input.surface.workspaceId,
    layoutId: input.layoutId,
    widgetId: input.widgetId,
    instanceKey: input.instanceKey,
    targetHash: targetHash(input.target)
})

/** Mint an opaque read handle scoped to the active public runtime placement. */
export const issueHandle = (
    input: PublicInterpretationNetworkReadInput,
    claims: Pick<PublicHandleClaims, 'kind' | 'recordId' | 'cellId'>
): string => {
    if (!isUuidV7(claims.recordId)) throw new Error('Public read handle requires an internal UUID v7 identity')
    return issueRuntimeOpaqueHandle(
        PUBLIC_HANDLE_PREFIX,
        PUBLIC_HANDLE_KEY_CONTEXT,
        { v: 1, ...publicHandleScope(input), ...claims },
        MAX_HANDLE_LENGTH
    )
}

/** Decode a handle and reject identities or runtime scopes outside the current request. */
export const readHandle = (
    value: string | undefined,
    input: PublicInterpretationNetworkReadInput,
    expectedKind: PublicHandleClaims['kind']
): PublicHandleClaims => {
    const claims = readRuntimeOpaqueHandle(
        value ?? '',
        PUBLIC_HANDLE_PREFIX,
        PUBLIC_HANDLE_KEY_CONTEXT,
        MAX_HANDLE_LENGTH
    ) as Partial<PublicHandleClaims> | null
    if (!claims) {
        throw new PublicInterpretationNetworkUnavailableError()
    }
    const expected = publicHandleScope(input)
    if (
        claims.v !== 1 ||
        claims.kind !== expectedKind ||
        claims.applicationId !== expected.applicationId ||
        claims.workspaceId !== expected.workspaceId ||
        claims.layoutId !== expected.layoutId ||
        claims.widgetId !== expected.widgetId ||
        claims.instanceKey !== expected.instanceKey ||
        claims.targetHash !== expected.targetHash ||
        typeof claims.recordId !== 'string' ||
        !isUuidV7(claims.recordId) ||
        (claims.kind === 'cell' && (typeof claims.cellId !== 'string' || claims.cellId.length === 0 || claims.cellId.length > 255))
    ) {
        throw new PublicInterpretationNetworkUnavailableError()
    }
    return claims as PublicHandleClaims
}
