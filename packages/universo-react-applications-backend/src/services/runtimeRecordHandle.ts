import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { isUuidV7 } from '@universo-react/utils'

const HANDLE_PREFIX = 'rh1.'
const NONCE_BYTES = 12
const AUTH_TAG_BYTES = 16
const KEY_CONTEXT = 'universo-runtime-record-handle:v1'
const MAX_HANDLE_LENGTH = 1024

type RuntimeRecordHandleClaims = {
    v: 1
    applicationId: string
    workspaceId: string | null
    entityCodename: string
    recordId: string
}

export type RuntimeRecordHandleScope = {
    applicationId: string
    workspaceId: string | null
    entityCodename: string
}

let developmentFallbackSecret: string | null = null

const resolveHandleSecret = (): string => {
    const configured = process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET?.trim() || process.env.SESSION_SECRET?.trim()
    if (configured) return configured
    if (process.env.NODE_ENV === 'production') {
        throw new Error('UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET or SESSION_SECRET must be configured in production')
    }
    developmentFallbackSecret ??= randomBytes(32).toString('base64url')
    return developmentFallbackSecret
}

const deriveKey = (): Buffer => createHash('sha256').update(KEY_CONTEXT).update('\0').update(resolveHandleSecret()).digest()

const encodePayload = (claims: RuntimeRecordHandleClaims): Buffer => Buffer.from(JSON.stringify(claims), 'utf8')

const decodePayload = (payload: Buffer): RuntimeRecordHandleClaims | null => {
    try {
        const parsed: unknown = JSON.parse(payload.toString('utf8'))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
        const candidate = parsed as Partial<RuntimeRecordHandleClaims>
        if (
            candidate.v !== 1 ||
            typeof candidate.applicationId !== 'string' ||
            (candidate.workspaceId !== null && typeof candidate.workspaceId !== 'string') ||
            typeof candidate.entityCodename !== 'string' ||
            typeof candidate.recordId !== 'string' ||
            !isUuidV7(candidate.recordId)
        ) {
            return null
        }
        return candidate as RuntimeRecordHandleClaims
    } catch {
        return null
    }
}

export const isRuntimeRecordHandle = (value: string): boolean => value.length <= MAX_HANDLE_LENGTH && /^rh1\.[A-Za-z0-9_-]+$/u.test(value)

export const isRuntimeRecordReference = (value: string): boolean => isUuidV7(value) || isRuntimeRecordHandle(value)

export const issueRuntimeRecordHandle = (scope: RuntimeRecordHandleScope & { recordId: string }): string => {
    if (!isUuidV7(scope.recordId)) throw new Error('Runtime record handle requires a UUID v7 record ID')
    const nonce = randomBytes(NONCE_BYTES)
    const cipher = createCipheriv('aes-256-gcm', deriveKey(), nonce)
    const ciphertext = Buffer.concat([
        cipher.update(
            encodePayload({
                v: 1,
                applicationId: scope.applicationId,
                workspaceId: scope.workspaceId,
                entityCodename: scope.entityCodename,
                recordId: scope.recordId
            })
        ),
        cipher.final()
    ])
    const authTag = cipher.getAuthTag()
    return `${HANDLE_PREFIX}${Buffer.concat([nonce, ciphertext, authTag]).toString('base64url')}`
}

export const resolveRuntimeRecordHandle = (handle: string, expected: RuntimeRecordHandleScope): string | null => {
    if (!isRuntimeRecordHandle(handle)) return null
    try {
        const encoded = handle.slice(HANDLE_PREFIX.length)
        const packed = Buffer.from(encoded, 'base64url')
        if (packed.length <= NONCE_BYTES + AUTH_TAG_BYTES) return null
        const nonce = packed.subarray(0, NONCE_BYTES)
        const authTag = packed.subarray(packed.length - AUTH_TAG_BYTES)
        const ciphertext = packed.subarray(NONCE_BYTES, packed.length - AUTH_TAG_BYTES)
        const decipher = createDecipheriv('aes-256-gcm', deriveKey(), nonce)
        decipher.setAuthTag(authTag)
        const claims = decodePayload(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
        if (
            !claims ||
            claims.applicationId !== expected.applicationId ||
            claims.workspaceId !== expected.workspaceId ||
            claims.entityCodename !== expected.entityCodename
        ) {
            return null
        }
        return claims.recordId
    } catch {
        return null
    }
}

export const resolveRuntimeRecordReference = (
    reference: string,
    expected: RuntimeRecordHandleScope
): { recordId: string; fromHandle: boolean } | null => {
    if (isUuidV7(reference)) return { recordId: reference, fromHandle: false }
    const recordId = resolveRuntimeRecordHandle(reference, expected)
    return recordId ? { recordId, fromHandle: true } : null
}
