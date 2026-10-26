import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const NONCE_BYTES = 12
const AUTH_TAG_BYTES = 16
const DEFAULT_MAX_HANDLE_LENGTH = 1024
const HANDLE_PREFIX_PATTERN = /^[a-z][a-z0-9]*\.$/u

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

const deriveKey = (keyContext: string): Buffer =>
    createHash('sha256').update(keyContext).update('\0').update(resolveHandleSecret()).digest()

const hasHandleShape = (value: string, prefix: string, maxLength: number): boolean =>
    HANDLE_PREFIX_PATTERN.test(prefix) &&
    value.length <= maxLength &&
    value.startsWith(prefix) &&
    /^[A-Za-z0-9_-]+$/u.test(value.slice(prefix.length))

/** Encrypts JSON claims into a scoped, opaque AES-256-GCM handle. */
export const issueRuntimeOpaqueHandle = (
    prefix: string,
    keyContext: string,
    claims: object,
    maxLength = DEFAULT_MAX_HANDLE_LENGTH
): string => {
    if (!HANDLE_PREFIX_PATTERN.test(prefix)) throw new Error('Invalid opaque handle prefix')
    const nonce = randomBytes(NONCE_BYTES)
    const cipher = createCipheriv('aes-256-gcm', deriveKey(keyContext), nonce)
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(claims), 'utf8')), cipher.final()])
    const packed = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()])
    const handle = `${prefix}${packed.toString('base64url')}`
    if (handle.length > maxLength) throw new Error('Opaque handle exceeds the configured length limit')
    return handle
}

/** Decrypts a well-formed handle; invalid, modified, or out-of-scope tokens return null. */
export const readRuntimeOpaqueHandle = (
    value: string,
    prefix: string,
    keyContext: string,
    maxLength = DEFAULT_MAX_HANDLE_LENGTH
): Record<string, unknown> | null => {
    if (!hasHandleShape(value, prefix, maxLength)) return null
    try {
        const encoded = value.slice(prefix.length)
        const packed = Buffer.from(encoded, 'base64url')
        if (packed.toString('base64url') !== encoded || packed.length <= NONCE_BYTES + AUTH_TAG_BYTES) return null
        const nonce = packed.subarray(0, NONCE_BYTES)
        const authTag = packed.subarray(packed.length - AUTH_TAG_BYTES)
        const ciphertext = packed.subarray(NONCE_BYTES, packed.length - AUTH_TAG_BYTES)
        const decipher = createDecipheriv('aes-256-gcm', deriveKey(keyContext), nonce)
        decipher.setAuthTag(authTag)
        const parsed: unknown = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'))
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export const isRuntimeOpaqueHandle = (value: string, prefix: string, maxLength = DEFAULT_MAX_HANDLE_LENGTH): boolean =>
    hasHandleShape(value, prefix, maxLength)
