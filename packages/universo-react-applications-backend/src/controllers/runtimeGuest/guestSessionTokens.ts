import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import type { Request } from 'express'
import { UUID_REGEX } from '../../shared/runtimeHelpers'

export const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24

export const GUEST_PARTICIPANT_ID_HEADER = 'x-guest-participant-id'

export const LEGACY_GUEST_STUDENT_ID_HEADER = 'x-guest-student-id'

export const GUEST_SESSION_TOKEN_HEADER = 'x-guest-session-token'

export const MAX_GUEST_SESSION_TOKEN_LENGTH = 4096

export type GuestSessionPayload = {
    participantId: string
    linkId: string
    secret: string
    workspaceId?: string | null
}

export type StoredGuestSessionState = {
    participantId: string
    linkId: string
    secretHash: string
    expiresAt: string
    workspaceId?: string | null
    quizIntakeIdempotencyKeyHash?: string
}

export const encodeGuestSessionToken = (payload: GuestSessionPayload): string =>
    Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

export const encodeStoredGuestSessionState = (payload: StoredGuestSessionState): string => JSON.stringify(payload)

export const hashGuestSessionSecret = (secret: string): string => crypto.createHash('sha256').update(secret, 'utf8').digest('hex')

export const isSameSecretHash = (expectedHash: string, actualSecret: string): boolean => {
    const actualHash = hashGuestSessionSecret(actualSecret)
    const expectedBuffer = Buffer.from(expectedHash, 'utf8')
    const actualBuffer = Buffer.from(actualHash, 'utf8')
    return (
        expectedBuffer.length === actualBuffer.length &&
        crypto.timingSafeEqual(new Uint8Array(expectedBuffer), new Uint8Array(actualBuffer))
    )
}

export const decodeStoredGuestSessionState = (value: unknown): StoredGuestSessionState | null => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    try {
        const decoded = JSON.parse(value) as Partial<StoredGuestSessionState>
        if (!decoded || typeof decoded !== 'object') return null
        if (typeof decoded.participantId !== 'string' || !UUID_REGEX.test(decoded.participantId)) return null
        if (typeof decoded.linkId !== 'string' || !UUID_REGEX.test(decoded.linkId)) return null
        if (typeof decoded.secretHash !== 'string' || !/^[a-f0-9]{64}$/i.test(decoded.secretHash)) return null
        if (typeof decoded.expiresAt !== 'string' || Number.isNaN(new Date(decoded.expiresAt).getTime())) return null
        if (decoded.workspaceId != null && (typeof decoded.workspaceId !== 'string' || !UUID_REGEX.test(decoded.workspaceId))) return null
        if (
            decoded.quizIntakeIdempotencyKeyHash !== undefined &&
            (typeof decoded.quizIntakeIdempotencyKeyHash !== 'string' || !/^[a-f0-9]{64}$/i.test(decoded.quizIntakeIdempotencyKeyHash))
        ) {
            return null
        }
        return {
            participantId: decoded.participantId,
            linkId: decoded.linkId,
            secretHash: decoded.secretHash.toLowerCase(),
            expiresAt: decoded.expiresAt,
            workspaceId: decoded.workspaceId ?? null,
            quizIntakeIdempotencyKeyHash: decoded.quizIntakeIdempotencyKeyHash?.toLowerCase()
        }
    } catch {
        return null
    }
}

export const decodeGuestSessionToken = (token: string): GuestSessionPayload | null => {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Partial<GuestSessionPayload>
        if (!decoded || typeof decoded !== 'object') return null
        if (typeof decoded.participantId !== 'string' || !UUID_REGEX.test(decoded.participantId)) return null
        if (typeof decoded.linkId !== 'string' || !UUID_REGEX.test(decoded.linkId)) return null
        if (typeof decoded.secret !== 'string' || decoded.secret.trim().length === 0) return null
        if (decoded.workspaceId != null && (typeof decoded.workspaceId !== 'string' || !UUID_REGEX.test(decoded.workspaceId))) {
            return null
        }
        return {
            participantId: decoded.participantId,
            linkId: decoded.linkId,
            secret: decoded.secret,
            workspaceId: decoded.workspaceId ?? null
        }
    } catch {
        return null
    }
}

export const readGuestRuntimeSessionRequest = (
    req: Request
): { participantId: string; sessionToken: string } | { error: string } | null => {
    const participantIdHeader = req.get(GUEST_PARTICIPANT_ID_HEADER) ?? req.get(LEGACY_GUEST_STUDENT_ID_HEADER)
    const sessionTokenHeader = req.get(GUEST_SESSION_TOKEN_HEADER)

    const participantId = typeof participantIdHeader === 'string' ? participantIdHeader.trim() : ''
    const sessionToken = typeof sessionTokenHeader === 'string' ? sessionTokenHeader.trim() : ''

    if (!participantId && !sessionToken) {
        return null
    }

    if (!participantId || !sessionToken) {
        return { error: 'Guest runtime session headers must be provided together' }
    }

    if (!UUID_REGEX.test(participantId)) {
        return { error: 'Guest runtime participant header must be a UUID' }
    }
    if (sessionToken.length > MAX_GUEST_SESSION_TOKEN_LENGTH) {
        return { error: 'Guest runtime session token is too large' }
    }

    return {
        participantId,
        sessionToken
    }
}
