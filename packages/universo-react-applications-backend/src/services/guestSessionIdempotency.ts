import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

export interface GuestSessionIdempotencyScope {
    applicationId: string
    accessLinkId: string
    workspaceId: string | null
}

export interface GuestSessionIntakePayload {
    displayName?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    termsAccepted?: boolean
    privacyAccepted?: boolean
}

export interface EncryptedGuestSessionSecret {
    secretNonce: Uint8Array
    secretCiphertext: Uint8Array
    secretAuthTag: Uint8Array
}

const GUEST_INTAKE_ENCRYPTION_DOMAIN = Buffer.from('universo-guest-session-idempotency:v1\0', 'utf8')

export const parseGuestIdempotencyKey = (value: string | undefined): Buffer | null => {
    if (!value || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return null

    const key = Buffer.from(value, 'base64url')
    return key.length === 32 && key.toString('base64url') === value ? key : null
}

export const hashGuestIdempotencyKey = (key: Uint8Array): string => crypto.createHash('sha256').update(key).digest('hex')

const normalizeOptionalPayloadValue = (value: string | undefined): string | null => {
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
}

export const fingerprintGuestIntakePayload = (key: Uint8Array, payload: GuestSessionIntakePayload): string => {
    const canonicalPayload = JSON.stringify([
        normalizeOptionalPayloadValue(payload.displayName),
        normalizeOptionalPayloadValue(payload.firstName),
        normalizeOptionalPayloadValue(payload.lastName),
        normalizeOptionalPayloadValue(payload.email),
        normalizeOptionalPayloadValue(payload.phone),
        payload.termsAccepted === true,
        payload.privacyAccepted === true
    ])

    return crypto.createHmac('sha256', key).update(canonicalPayload, 'utf8').digest('hex')
}

const sameDigest = (left: string, right: string): boolean => {
    if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export const matchesGuestSessionIdempotency = (
    stored: {
        payloadHash: string
        applicationId: string
        accessLinkId: string
        workspaceId: string | null
    },
    scope: GuestSessionIdempotencyScope,
    payloadHash: string
): boolean =>
    sameDigest(stored.payloadHash, payloadHash) &&
    stored.applicationId.toLowerCase() === scope.applicationId.toLowerCase() &&
    stored.accessLinkId.toLowerCase() === scope.accessLinkId.toLowerCase() &&
    (stored.workspaceId?.toLowerCase() ?? null) === (scope.workspaceId?.toLowerCase() ?? null)

const deriveGuestIntakeEncryptionKey = (key: Uint8Array): Buffer =>
    crypto.createHash('sha256').update(GUEST_INTAKE_ENCRYPTION_DOMAIN).update(key).digest()

const guestSessionSecretAad = (scope: GuestSessionIdempotencyScope, participantId: string): Buffer =>
    Buffer.from(
        JSON.stringify([
            scope.applicationId.toLowerCase(),
            scope.accessLinkId.toLowerCase(),
            scope.workspaceId?.toLowerCase() ?? null,
            participantId.toLowerCase()
        ]),
        'utf8'
    )

export const encryptGuestSessionSecret = (
    sessionSecret: string,
    key: Uint8Array,
    scope: GuestSessionIdempotencyScope,
    participantId: string
): EncryptedGuestSessionSecret => {
    const secretNonce = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveGuestIntakeEncryptionKey(key), secretNonce)
    cipher.setAAD(guestSessionSecretAad(scope, participantId))
    const secretCiphertext = Buffer.concat([cipher.update(sessionSecret, 'utf8'), cipher.final()])

    return {
        secretNonce,
        secretCiphertext,
        secretAuthTag: cipher.getAuthTag()
    }
}

export const decryptGuestSessionSecret = (
    encrypted: EncryptedGuestSessionSecret,
    key: Uint8Array,
    scope: GuestSessionIdempotencyScope,
    participantId: string
): string | null => {
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', deriveGuestIntakeEncryptionKey(key), Buffer.from(encrypted.secretNonce))
        decipher.setAAD(guestSessionSecretAad(scope, participantId))
        decipher.setAuthTag(Buffer.from(encrypted.secretAuthTag))
        return Buffer.concat([decipher.update(Buffer.from(encrypted.secretCiphertext)), decipher.final()]).toString('utf8')
    } catch {
        return null
    }
}
