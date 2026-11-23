import crypto from 'node:crypto'
import type { DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { isUuidV7 } from '@universo-react/utils'
import {
    findEconomyIdempotency,
    purgeExpiredEconomyIdempotency,
    saveEconomyIdempotency,
    type StoredEconomyIdempotency
} from '../persistence/economyIdempotencyStore'
import { logEconomyEvent, throwEconomyFailure, type EconomyTradeKind } from './runtimeEconomySupport'

/**
 * Idempotency machinery for the runtime economy endpoints (MMOOMM plan D7/B7,
 * guest `guestSessionIdempotency.ts` precedent) — mechanically extracted from
 * `runtimeEconomyService.ts` (mining plan B0) so the service stays focused on
 * the transactional flows. No behavior change: same codecs, gate, and save-race
 * semantics. The fingerprint binds the trade kind (`sell`/`buy`/`mine`), so one
 * key can never replay a response across endpoints.
 */

/** Replay window for stored trade/fire responses (mirrors the guest TTL approach). */
const ECONOMY_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const IDEMPOTENCY_LOCK_PREFIX = 'economy-idem:'

export type EconomyIdempotencyScope = {
    applicationId: string
    userId: string
    workspaceId: string | null
    keyHash: string
    fingerprint: string
}

let developmentFallbackSecret: string | null = null

const resolveEconomyIdempotencySecret = (): string => {
    const configured = process.env.UNIVERSO_ECONOMY_IDEMPOTENCY_SECRET?.trim() || process.env.SESSION_SECRET?.trim()
    if (configured) return configured
    if (process.env.NODE_ENV === 'production') {
        throw new Error('UNIVERSO_ECONOMY_IDEMPOTENCY_SECRET or SESSION_SECRET must be configured in production')
    }
    developmentFallbackSecret ??= crypto.randomBytes(32).toString('base64url')
    return developmentFallbackSecret
}

export const parseEconomyIdempotencyKey = (
    rawKey: string | undefined
): { kind: 'absent' } | { kind: 'ok'; key: string } | { kind: 'malformed' } => {
    const trimmed = rawKey?.trim() ?? ''
    if (trimmed.length === 0) return { kind: 'absent' }
    // TZ §6.2: an absent key means no replay protection (still allowed); a
    // present key must be a UUID v7 — anything else is a client bug → 400.
    return isUuidV7(trimmed) ? { kind: 'ok', key: trimmed.toLowerCase() } : { kind: 'malformed' }
}

export const hashEconomyIdempotencyKey = (key: string): string => crypto.createHash('sha256').update(key, 'utf8').digest('hex')

const canonicalizeEconomyValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalizeEconomyValue)
    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>
        return Object.keys(source)
            .sort()
            .reduce<Record<string, unknown>>((acc, itemKey) => {
                acc[itemKey] = canonicalizeEconomyValue(source[itemKey])
                return acc
            }, {})
    }
    return value
}

/**
 * HMAC-SHA256 of the canonical JSON body under a server secret — raw keys and
 * bodies are never stored verbatim. The trade kind is bound into the
 * fingerprint so one key can never replay a response across the /sell, /buy
 * and /mining/fire endpoints (scoped-unique is (application, user, key) —
 * endpoint identity must be part of the payload identity, not an implicit
 * assumption).
 */
export const fingerprintEconomyTradeBody = (kind: EconomyTradeKind, body: Record<string, unknown>): string =>
    crypto
        .createHmac('sha256', resolveEconomyIdempotencySecret())
        .update(JSON.stringify({ kind, body: canonicalizeEconomyValue(body) }), 'utf8')
        .digest('hex')

const matchesEconomyFingerprint = (stored: string, fingerprint: string): boolean => {
    if (!/^[a-f0-9]{64}$/u.test(stored) || !/^[a-f0-9]{64}$/u.test(fingerprint)) return false
    return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(fingerprint, 'hex'))
}

/** Best-effort on-request purge before the gate (guest precedent). Fail-soft: a purge failure never blocks a trade. */
export const purgeEconomyIdempotencyFailSoft = async (executor: DbExecutor): Promise<void> => {
    try {
        await purgeExpiredEconomyIdempotency(executor)
    } catch {
        // Expiry is also enforced by the `expires_at > NOW()` read predicate;
        // the failure is logged as an opaque event (Thermos logging rule: raw
        // database error text never reaches logs), never surfaced to the trade.
        logEconomyEvent('idempotency purge failed', {})
    }
}

/**
 * The idempotency gate runs INSIDE the trade/fire transaction (plan B7 primary
 * pattern): scoped lookup → advisory lock on the key hash → trade → INSERT of
 * the stored response, all atomic with the trade facts. A crash between the
 * trade commit and the idempotency insert is therefore impossible. Only
 * successful (200) trades are stored — failed trades roll back entirely and
 * stay retryable with the same key.
 */
export const runIdempotencyGateInTx = async (
    executor: DbExecutor,
    scope: EconomyIdempotencyScope
): Promise<StoredEconomyIdempotency | null> => {
    // Advisory lock keys are application-scoped (LOW hygiene fix): two distinct
    // applications must never contend on the same lock key.
    await acquireAdvisoryXactLock(executor, `${IDEMPOTENCY_LOCK_PREFIX}${scope.applicationId}:${scope.userId}:${scope.keyHash}`)
    const stored = await findEconomyIdempotency(executor, {
        applicationId: scope.applicationId,
        userId: scope.userId,
        keyHash: scope.keyHash
    })
    if (stored && !matchesEconomyFingerprint(stored.bodyFingerprint, scope.fingerprint)) {
        logEconomyEvent('idempotency key reuse with a different payload', {
            applicationId: scope.applicationId,
            principalId: scope.userId
        })
        throwEconomyFailure('ECONOMY_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload')
    }
    return stored
}

/** Persist the response for replay. Returns a stored row only when this call lost the scoped-unique race. */
export const saveIdempotentResponseInTx = async (
    executor: DbExecutor,
    scope: EconomyIdempotencyScope,
    body: unknown
): Promise<StoredEconomyIdempotency | null> => {
    const saved = await saveEconomyIdempotency(executor, {
        applicationId: scope.applicationId,
        userId: scope.userId,
        workspaceId: scope.workspaceId,
        keyHash: scope.keyHash,
        bodyFingerprint: scope.fingerprint,
        response: body,
        statusCode: 200,
        expiresAt: new Date(Date.now() + ECONOMY_IDEMPOTENCY_TTL_MS).toISOString()
    })
    if (saved) return null
    // Lost the scoped-unique race (defensive; the advisory lock above normally
    // serializes same-key racers) — hand back the winner's stored response.
    const stored = await findEconomyIdempotency(executor, {
        applicationId: scope.applicationId,
        userId: scope.userId,
        keyHash: scope.keyHash
    })
    if (!stored) return null
    if (!matchesEconomyFingerprint(stored.bodyFingerprint, scope.fingerprint)) {
        throwEconomyFailure('ECONOMY_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload')
    }
    return stored
}
