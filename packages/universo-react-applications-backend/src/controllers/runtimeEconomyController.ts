import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { economyTradeRequestSchema } from '@universo-react/types'
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
 * Runtime economy controller (MMOOMM plan B6).
 *
 * - summary: runtime read convention (no content permission) — the payload is
 *   server-scoped to `ctx.userId` through ownerOnly filters.
 * - sell/buy: `editContent` permission (posting precedent), strict body schema,
 *   server-injected prices/balances, `Idempotency-Key` replay protection.
 */
const FORBIDDEN_TRADE_BODY_KEYS: ReadonlySet<string> = new Set(['ownerkey', 'walletid', 'balance', 'price', 'status'])

const hasForbiddenTradeBodyKey = (body: unknown): boolean => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false
    return Object.keys(body).some((key) => FORBIDDEN_TRADE_BODY_KEYS.has(key.trim().toLowerCase()))
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
        if (hasForbiddenTradeBodyKey(req.body)) {
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

    return {
        getSummary,
        sellTrade: createTradeHandler('sell'),
        buyTrade: createTradeHandler('buy')
    }
}
