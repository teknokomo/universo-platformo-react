import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { economyMineRequestSchema, economyTradeRequestSchema } from '@universo-react/types'
import { createQueryHelper, ensureRuntimePermission, resolveRuntimeSchema, UpdateFailure } from '../shared/runtimeHelpers'
import { dispatchRuntimeLifecycleAfterCommit } from '../services/runtimeLifecycleDispatch'
import {
    createRuntimeEconomyService,
    fingerprintEconomyTradeBody,
    hashEconomyIdempotencyKey,
    parseEconomyIdempotencyKey,
    purgeEconomyIdempotencyFailSoft,
    type EconomyTradeKind
} from '../services/runtimeEconomyService'

/**
 * Runtime economy controller (MMOOMM plan B6), extended with the mining routes
 * (mining plan B4, TZ DOC-2026-006 §8).
 *
 * - summary: runtime read convention (no content permission) — the payload is
 *   server-scoped to `ctx.userId` through ownerOnly filters.
 * - sell/buy: `editContent` permission (posting precedent), strict body schema,
 *   server-injected prices/balances, `Idempotency-Key` replay protection.
 * - mining/state: auth-only read (belt snapshot + constants), member-only via
 *   `resolveRuntimeSchema`.
 * - mining/fire: `editContent` permission, TZ §8.2 400/422 split, strict body
 *   schema, server-authoritative amounts, optional `Idempotency-Key`.
 */
const FORBIDDEN_TRADE_BODY_KEYS: ReadonlySet<string> = new Set(['ownerkey', 'walletid', 'balance', 'price', 'status'])
// Mining TZ §8.2 row MINING_INVALID_PAYLOAD: any server-owned economic field in
// the fire body is rejected (never ignored) — 422 before any economy DB work.
const FORBIDDEN_MINING_BODY_KEYS: ReadonlySet<string> = new Set([
    'quantity',
    'mass',
    'masskg',
    'yield',
    'price',
    'unitprice',
    'totalprice',
    'remaining',
    'remainingquantitykg',
    'cargo',
    'walletid',
    'balance',
    'status'
])

const hasForbiddenBodyKey = (body: unknown, forbidden: ReadonlySet<string>): boolean => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false
    return Object.keys(body).some((key) => forbidden.has(key.trim().toLowerCase()))
}

const mapUpdateFailure = (res: Response, error: unknown): boolean => {
    if (error instanceof UpdateFailure) {
        res.status(error.statusCode).json(error.body)
        return true
    }
    return false
}

/**
 * Non-contract failures stay opaque: the stable D9 codes carry all user-facing
 * meaning, so internal error messages never reach the client (ids only are
 * logged server-side).
 */
const respondUnexpectedFailure = (res: Response, error: unknown): void => {
    // Thermos logging rule: never persist raw internal error text — it can
    // embed SQL fragments or user-supplied values. The error class name plus
    // the opaque response is the observable surface.
    console.error('[runtimeEconomy] unexpected failure', {
        name: error instanceof Error ? error.name : 'UnknownError'
    })
    res.status(500).json({ error: 'Internal server error', code: 'ECONOMY_POSTING_FAILED' })
}

export function createRuntimeEconomyController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const service = createRuntimeEconomyService({ getDbExecutor, query })

    const getSummary = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })

        try {
            const { summary, afterLifecycleRequests } = await service.getEconomySummary(ctx, applicationId)
            // AfterCreate/afterPost hooks run after the commit boundary, mirroring
            // the runtime create handler (`create.ts` dispatch pattern).
            for (const request of afterLifecycleRequests) dispatchRuntimeLifecycleAfterCommit(ctx.manager, request)
            return res.json(summary)
        } catch (error) {
            if (mapUpdateFailure(res, error)) return
            respondUnexpectedFailure(res, error)
        }
    }

    const createTradeHandler = (kind: EconomyTradeKind) => async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        // TZ FR-023: any client-supplied server-owned economic field is rejected
        // 422 before any economy DB work (D9 maps INVALID_QUANTITY to 422).
        if (hasForbiddenBodyKey(req.body, FORBIDDEN_TRADE_BODY_KEYS)) {
            return res.status(422).json({ error: 'Trade payload contains server-owned fields', code: 'ECONOMY_INVALID_QUANTITY' })
        }

        const parsedBody = economyTradeRequestSchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid trade payload', details: parsedBody.error.flatten() })
        }

        // TZ §6.2: absent Idempotency-Key → no replay protection (still allowed);
        // a malformed key → 400 before any economy DB work.
        const parsedKey = parseEconomyIdempotencyKey(req.header('Idempotency-Key'))
        if (parsedKey.kind === 'malformed') {
            return res.status(400).json({ error: 'Invalid Idempotency-Key header format', code: 'ECONOMY_IDEMPOTENCY_KEY_INVALID' })
        }
        const idempotency =
            parsedKey.kind === 'ok'
                ? {
                      applicationId,
                      userId: ctx.userId,
                      workspaceId: ctx.currentWorkspaceId,
                      keyHash: hashEconomyIdempotencyKey(parsedKey.key),
                      // Fingerprint is computed over the trade kind + the VALIDATED
                      // body so semantically equal payloads (different key order)
                      // replay instead of conflicting, while a key reused across the
                      // /sell and /buy endpoints always conflicts.
                      fingerprint: fingerprintEconomyTradeBody(kind, parsedBody.data)
                  }
                : undefined

        if (idempotency) await purgeEconomyIdempotencyFailSoft(ctx.manager)

        try {
            const outcome = await service.executeTrade(ctx, applicationId, kind, parsedBody.data, idempotency)
            if (outcome.kind === 'replayed') {
                return res.status(outcome.status).json(outcome.body)
            }
            for (const request of outcome.afterLifecycleRequests) dispatchRuntimeLifecycleAfterCommit(ctx.manager, request)
            return res.status(outcome.status).json(outcome.body)
        } catch (error) {
            if (mapUpdateFailure(res, error)) return
            respondUnexpectedFailure(res, error)
        }
    }

    const getMiningState = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })

        try {
            // Belt snapshot + constants (TZ §8.1): member-only read, no
            // `editContent` required, remainders rounded to 0.1 kg server-side.
            const state = await service.getMiningState(ctx)
            return res.json(state)
        } catch (error) {
            if (mapUpdateFailure(res, error)) return
            respondUnexpectedFailure(res, error)
        }
    }

    const fireMining = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        // TZ §8.2 400/422 split (D5): a missing/invalid asteroidCode is row 1
        // (400 MINING_INVALID_TARGET); server-owned/forbidden fields and unknown
        // keys are MINING_INVALID_PAYLOAD (422) — never ignored. safeParse keeps
        // ZodError from escaping as an unmapped 500 (trade uses a codeless 400
        // here; mining maps it deliberately per the documented codes).
        const rawAsteroidCode = typeof req.body?.asteroidCode === 'string' ? req.body.asteroidCode.trim() : ''
        // TZ §8.2 row 1 covers an INVALID code too: an overlong value is a bad
        // target (400 MINING_INVALID_TARGET), not a payload-shape error — the
        // schema's max(64) would otherwise surface it as 422 (CodeRabbit,
        // PR #934).
        if (!rawAsteroidCode || rawAsteroidCode.length > 64) {
            return res.status(400).json({ error: 'Choose an asteroid', code: 'MINING_INVALID_TARGET' })
        }
        if (hasForbiddenBodyKey(req.body, FORBIDDEN_MINING_BODY_KEYS)) {
            return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })
        }
        const parsedBody = economyMineRequestSchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })
        }

        // TZ §8.3: absent Idempotency-Key → no replay protection (allowed, the
        // cooldown + asteroid lock protect the belt); malformed → 400.
        const parsedKey = parseEconomyIdempotencyKey(req.header('Idempotency-Key'))
        if (parsedKey.kind === 'malformed') {
            return res.status(400).json({ error: 'Invalid Idempotency-Key header format', code: 'ECONOMY_IDEMPOTENCY_KEY_INVALID' })
        }
        const idempotency =
            parsedKey.kind === 'ok'
                ? {
                      applicationId,
                      userId: ctx.userId,
                      workspaceId: ctx.currentWorkspaceId,
                      keyHash: hashEconomyIdempotencyKey(parsedKey.key),
                      // Fingerprint binds kind 'mine' + the VALIDATED body — a
                      // key reused with a different asteroid always conflicts.
                      fingerprint: fingerprintEconomyTradeBody('mine', parsedBody.data)
                  }
                : undefined

        if (idempotency) await purgeEconomyIdempotencyFailSoft(ctx.manager)

        try {
            const outcome = await service.executeMiningFire(ctx, applicationId, parsedBody.data, idempotency)
            if (outcome.kind === 'replayed') {
                return res.status(outcome.status).json(outcome.body)
            }
            for (const request of outcome.afterLifecycleRequests) dispatchRuntimeLifecycleAfterCommit(ctx.manager, request)
            return res.status(outcome.status).json(outcome.body)
        } catch (error) {
            if (mapUpdateFailure(res, error)) return
            respondUnexpectedFailure(res, error)
        }
    }

    return {
        getSummary,
        sellTrade: createTradeHandler('sell'),
        buyTrade: createTradeHandler('buy'),
        getMiningState,
        fireMining
    }
}
