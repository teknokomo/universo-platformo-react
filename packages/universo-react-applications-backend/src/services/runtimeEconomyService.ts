import crypto from 'node:crypto'
import type { DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock, withTransactionSavepoint } from '@universo-react/utils/database'
import { isUuidV7 } from '@universo-react/utils'
import {
    economySummarySchema,
    economyTradeResponseSchema,
    type EconomySummary,
    type EconomyTradeRequest,
    type EconomyTradeResponse
} from '@universo-react/types'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    quoteIdentifier,
    UpdateFailure,
    type RuntimeSchemaContext
} from '../shared/runtimeHelpers'
import { isRuntimeServerOwnedAttr } from './runtimeRowSupport/contracts'
import { findRuntimeAttrByFieldKey, resolveRuntimeRecordOwnerColumnName } from './runtimeRowSupport/objectMetadata'
import { RuntimeLedgerService } from './runtimeLedgersService'
import { RuntimePostingMovementService } from './runtimePostingMovements'
import { normalizeRuntimeRecordBehavior, RuntimeRecordCommandService } from './runtimeRecordBehavior'
import type { RuntimeLifecycleDispatchRequest } from './runtimeLifecycleDispatch'
import {
    findEconomyIdempotency,
    purgeExpiredEconomyIdempotency,
    saveEconomyIdempotency,
    type StoredEconomyIdempotency
} from '../persistence/economyIdempotencyStore'
import { createRecordStateCommandHandlers } from '../controllers/runtimeRowCommandHandlers/posting'
import type { RuntimeRowCommandHandlerDeps } from '../controllers/runtimeRowCommandHandlers/types'
import {
    buildCreateScalarColumnValues,
    executeCreateRowTransaction,
    validateCreatePendingRow
} from '../controllers/runtimeRowWriteHandlers/create'
import { collectTouchedComponentIds } from '../controllers/runtimeRowSupport/rows'
import {
    buildEconomyActiveCondition,
    buildMarketEntries,
    buildRecentOperations,
    computeCargo,
    computeWalletBalance,
    INVENTORY_LEDGER_CODE,
    loadNomenclatureRowsByCode,
    MARKET_SIDE_CONFIGS,
    NOMENCLATURE_ENTITY_CODE,
    ORE_NOMENCLATURE_CODE,
    OPERATION_ENTITY_CODE,
    readNumberConstant,
    readStringConstant,
    requireAttr,
    resolveAttrValueByCodename,
    resolveEconomyConstants,
    resolveEconomyObjectCollection,
    resolveOperationTypeValueId,
    resolveStationProximity,
    REQUIRED_CONSTANT_CODES,
    STATION_ENTITY_CODE,
    throwEconomyFailure,
    WALLET_ENTITY_CODE,
    WALLET_LEDGER_CODE,
    type EconomyCollection,
    type EconomyResolvedConfig,
    type EconomyTradeKind
} from './runtimeEconomySupport'

/**
 * Runtime economy service (MMOOMM plan B4/B4a/B5, decisions D5/D6/D7/D11).
 * Pure resolution/reading helpers live in `runtimeEconomySupport.ts`; this
 * module owns the idempotency gate and the transactional flows.
 *
 * Ledger movements are NOT composed here: Operation rows are posted through the
 * shared `runRecordStateCommandCore` (D5) so the authored
 * `MmoommEconomyPostingModule.beforePost` lifecycle module produces the
 * WalletLedger/InventoryLedger facts exactly as the HTTP posting shell does.
 *
 * Lifecycle note for module authors: `runRecordStateCommandCore` passes the raw
 * SQL row into `payload.previousRow` — keys are the physical column names
 * (`cmp_<fieldId>` per `_app_components.column_name`) plus system columns
 * (`id`, `_upl_*`, `_app_*`). Codename-keyed rows (`payload.previousRow?.learner`
 * style) are only produced by the module Record API
 * (`RuntimeModulesService.getRecordById` → `buildModuleRecordPayload`).
 */

const STARTER_GRANT_TYPE_CODE = 'StarterGrant'
const SELL_OPERATION_TYPE_CODE = 'Sell'
const BUY_OPERATION_TYPE_CODE = 'Buy'
const WALLET_ACTIVE_STATUS_CODE = 'Active'
/** Replay window for stored trade responses (mirrors the guest TTL approach). */
const ECONOMY_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const IDEMPOTENCY_LOCK_PREFIX = 'economy-idem:'
/** Float comparison slack for funds/capacity checks against NUMERIC aggregates. */
const NUMERIC_EPSILON = 1e-9

export { type EconomyTradeKind } from './runtimeEconomySupport'

// Trade response shape (TZ §8.2) lives in @universo-react/types so the backend
// gate and the client API surface validate against ONE shared contract.
export { economyTradeResponseSchema, type EconomyTradeResponse }

export type EconomyIdempotencyScope = {
    applicationId: string
    userId: string
    workspaceId: string | null
    keyHash: string
    fingerprint: string
}

export type EconomyTradeOutcome =
    | { kind: 'executed'; status: number; body: EconomyTradeResponse; afterLifecycleRequests: RuntimeLifecycleDispatchRequest[] }
    | { kind: 'replayed'; status: number; body: unknown }

export type EconomySummaryResult = {
    summary: EconomySummary
    afterLifecycleRequests: RuntimeLifecycleDispatchRequest[]
}

// ---------------------------------------------------------------------------
// Idempotency codecs (guest `guestSessionIdempotency.ts` precedent)
// ---------------------------------------------------------------------------

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
 * fingerprint so one key can never replay a response across the /sell and /buy
 * endpoints (scoped-unique is (application, user, key) — endpoint identity
 * must be part of the payload identity, not an implicit assumption).
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

/**
 * NFR §12/D9 observability: one structured line per economy mutation carrying
 * the correlation triad (`operationId`/`applicationId`/`principalId`). Ids
 * only — never secrets, key hashes, or raw trade payloads.
 */
const logEconomyEvent = (event: string, fields: Record<string, unknown>): void => {
    console.info(`[runtimeEconomy] ${event}`, fields)
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

// ---------------------------------------------------------------------------
// Idempotency gate (D7/B7)
// ---------------------------------------------------------------------------

/**
 * The idempotency gate runs INSIDE the trade transaction (plan B7 primary
 * pattern): scoped lookup → advisory lock on the key hash → trade → INSERT of
 * the stored response, all atomic with the trade facts. A crash between the
 * trade commit and the idempotency insert is therefore impossible. Only
 * successful (200) trades are stored — failed trades roll back entirely and
 * stay retryable with the same key.
 */
const runIdempotencyGateInTx = async (executor: DbExecutor, scope: EconomyIdempotencyScope): Promise<StoredEconomyIdempotency | null> => {
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

/** Persist the trade response for replay. Returns a stored row only when this call lost the scoped-unique race. */
const saveIdempotentResponseInTx = async (
    executor: DbExecutor,
    scope: EconomyIdempotencyScope,
    body: EconomyTradeResponse
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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type RuntimeEconomyServiceDeps = {
    getDbExecutor: () => DbExecutor
    query: <TRow = unknown>(req: import('express').Request, sql: string, parameters?: unknown[]) => Promise<TRow[]>
}

export function createRuntimeEconomyService({ getDbExecutor, query }: RuntimeEconomyServiceDeps) {
    const ledgerService = new RuntimeLedgerService()
    const recordCommandService = new RuntimeRecordCommandService()
    const postingMovementService = new RuntimePostingMovementService()
    // The record-state posting core is shared with the HTTP shell (D5): posting
    // from the economy service must fire the authored posting module identically.
    const handlerDeps: RuntimeRowCommandHandlerDeps = { getDbExecutor, query, recordCommandService, postingMovementService }
    const { runRecordStateCommandCore } = createRecordStateCommandHandlers(handlerDeps)

    const resolveLedgerIdByCodename = async (executor: DbExecutor, ctx: RuntimeSchemaContext, ledgerCodename: string): Promise<string> => {
        const ledgers = await ledgerService.listLedgers({ executor, schemaName: ctx.schemaName })
        const ledger = ledgers.find((item) => item.codename.trim().toLowerCase() === ledgerCodename.toLowerCase())
        if (!ledger) throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy ledger ${ledgerCodename} is not configured`)
        return ledger.id
    }

    const resolveEconomyConfig = async (executor: DbExecutor, ctx: RuntimeSchemaContext): Promise<EconomyResolvedConfig> => {
        const constants = await resolveEconomyConstants(executor, ctx)
        for (const requiredCode of REQUIRED_CONSTANT_CODES) {
            if (!constants.has(requiredCode)) {
                throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy constant ${requiredCode} is not configured`)
            }
        }

        const [nomenclature, wallet, operation, station] = await Promise.all([
            resolveEconomyObjectCollection(executor, ctx.schemaIdent, NOMENCLATURE_ENTITY_CODE),
            resolveEconomyObjectCollection(executor, ctx.schemaIdent, WALLET_ENTITY_CODE),
            resolveEconomyObjectCollection(executor, ctx.schemaIdent, OPERATION_ENTITY_CODE),
            resolveEconomyObjectCollection(executor, ctx.schemaIdent, STATION_ENTITY_CODE)
        ])

        const [walletLedgerId, inventoryLedgerId] = await Promise.all([
            resolveLedgerIdByCodename(executor, ctx, WALLET_LEDGER_CODE),
            resolveLedgerIdByCodename(executor, ctx, INVENTORY_LEDGER_CODE)
        ])

        const priceByConstant = new Map([
            ['OrePricePerKg', readNumberConstant(constants, 'OrePricePerKg')],
            ['FuelPricePerLiter', readNumberConstant(constants, 'FuelPricePerLiter')]
        ])
        // Market prices must be strictly positive: a zero (or negative) price
        // constant would break the posting module's grant heuristic (UnitPrice=0
        // marks the StarterGrant) and mint inventory for free.
        for (const [code, price] of priceByConstant) {
            if (!(price > 0)) {
                throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy price constant ${code} must be greater than zero`)
            }
        }

        return {
            currencyCode: readStringConstant(constants, 'CurrencyCode'),
            startingBalance: readNumberConstant(constants, 'StartingBalance'),
            startingOreKg: readNumberConstant(constants, 'StartingOreKg'),
            marketRadiusMeters: readNumberConstant(constants, 'MarketRadiusMeters'),
            maxCargoMassKg: readNumberConstant(constants, 'MaxCargoMassKg'),
            priceByConstant,
            nomenclature,
            wallet,
            operation,
            station,
            walletLedgerId,
            inventoryLedgerId
        }
    }

    const createEconomyRow = async (
        executor: DbExecutor,
        ctx: RuntimeSchemaContext,
        applicationId: string,
        collection: EconomyCollection,
        data: Record<string, unknown>
    ): Promise<{ rowId: string; afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest }> => {
        const runtimeRowCondition = buildEconomyActiveCondition(ctx, collection)
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(collection.table_name)}`
        const safeAttrs = collection.attrs.filter(
            (attr) =>
                IDENTIFIER_REGEX.test(attr.column_name) &&
                RUNTIME_WRITABLE_TYPES.has(attr.data_type) &&
                attr.data_type !== 'TABLE' &&
                !isRuntimeServerOwnedAttr(attr)
        )
        const scalarResult = await buildCreateScalarColumnValues({
            manager: executor,
            schemaIdent: ctx.schemaIdent,
            data,
            safeAttrs
        })
        if (scalarResult.kind === 'failure') throw new UpdateFailure(scalarResult.statusCode, scalarResult.body)
        const pendingResult = await validateCreatePendingRow({
            ctx,
            objectCollection: collection,
            attrs: collection.attrs,
            safeAttrs,
            columnValues: scalarResult.columnValues
        })
        if (pendingResult.kind === 'failure') throw new UpdateFailure(pendingResult.statusCode, pendingResult.body)

        const recordBehavior = normalizeRuntimeRecordBehavior(collection.config)
        const result = await executeCreateRowTransaction({
            executor,
            ctx,
            applicationId,
            objectCollection: collection,
            attrs: collection.attrs,
            data,
            runtimeRowCondition,
            dataTableIdent,
            columnValues: pendingResult.columnValues,
            touchedComponentIds: collectTouchedComponentIds(collection.attrs, data),
            recordBehavior,
            tableDataEntries: [],
            recordCommandService
        })
        return { rowId: result.parentId, afterCreateLifecycleRequest: result.afterCreateLifecycleRequest }
    }

    const postOperationRow = async (
        executor: DbExecutor,
        ctx: RuntimeSchemaContext,
        applicationId: string,
        economy: EconomyResolvedConfig,
        rowId: string
    ): Promise<RuntimeLifecycleDispatchRequest | null> => {
        let coreResult: Awaited<ReturnType<typeof runRecordStateCommandCore>>
        try {
            coreResult = await runRecordStateCommandCore({
                ctx,
                applicationId,
                objectCollection: economy.operation,
                attrs: economy.operation.attrs,
                rowId,
                command: 'post'
            })
        } catch (error) {
            if (error instanceof UpdateFailure) throw error
            // Non-mapped posting failures must never leak SQL/internals (TZ §11).
            throw new UpdateFailure(500, { error: 'Economy posting failed', code: 'ECONOMY_POSTING_FAILED' })
        }
        return coreResult.afterLifecycleRequest
    }

    const ensureWalletForUserInTx = async (
        executor: DbExecutor,
        ctx: RuntimeSchemaContext,
        applicationId: string,
        walletCollection: EconomyCollection,
        currencyCode: string,
        afterLifecycleRequests: RuntimeLifecycleDispatchRequest[]
    ): Promise<{ walletId: string; created: boolean }> => {
        const ownerColumnName = resolveRuntimeRecordOwnerColumnName(walletCollection.attrs, walletCollection.config) ?? '_upl_created_by'
        const currencyAttr = findRuntimeAttrByFieldKey(walletCollection.attrs, 'Currency')
        const currencyColumnValid = currencyAttr && IDENTIFIER_REGEX.test(currencyAttr.column_name)
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(walletCollection.table_name)}`

        const currencyClause = currencyColumnValid ? ` AND ${quoteIdentifier(currencyAttr.column_name)} = $2` : ''
        const existingRows = (await executor.query(
            `
      SELECT id
      FROM ${dataTableIdent}
      WHERE ${buildEconomyActiveCondition(ctx, walletCollection)}
        AND ${quoteIdentifier(ownerColumnName)} = $1${currencyClause}
      LIMIT 1
    `,
            currencyClause ? [ctx.userId, currencyCode] : [ctx.userId]
        )) as Array<{ id: string }>

        const existingId = existingRows[0]?.id
        if (existingId) return { walletId: String(existingId), created: false }

        const data: Record<string, unknown> = { OwnerKey: ctx.userId, Currency: currencyCode }
        const statusAttr = findRuntimeAttrByFieldKey(walletCollection.attrs, 'Status')
        if (statusAttr) {
            const statusValue = await resolveAttrValueByCodename(executor, ctx, statusAttr, WALLET_ACTIVE_STATUS_CODE)
            if (statusValue !== undefined) data.Status = statusValue
        }

        const created = await createEconomyRow(executor, ctx, applicationId, walletCollection, data)
        afterLifecycleRequests.push(created.afterCreateLifecycleRequest)
        return { walletId: created.rowId, created: true }
    }

    const ensureStarterGrantInTx = async (
        executor: DbExecutor,
        ctx: RuntimeSchemaContext,
        applicationId: string,
        economy: EconomyResolvedConfig,
        walletId: string,
        afterLifecycleRequests: RuntimeLifecycleDispatchRequest[]
    ): Promise<void> => {
        const grantTypeValueId = await resolveOperationTypeValueId(executor, ctx, economy, STARTER_GRANT_TYPE_CODE)

        // Once-only is defined over ALL rows, including soft-deleted ones, and
        // deliberately ignores the wallet id: a deleteContent holder who removes
        // the grant Operation (or the wallet row) must not be able to re-trigger
        // the grant by escaping the active-row condition.
        const typeAttr = requireAttr(economy.operation, 'OperationType')
        const ownerColumnName = resolveRuntimeRecordOwnerColumnName(economy.operation.attrs, economy.operation.config) ?? '_upl_created_by'
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(economy.operation.table_name)}`
        const grantRows = (await executor.query(
            `
      SELECT id
      FROM ${dataTableIdent}
      WHERE ${quoteIdentifier(ownerColumnName)} = $1
        AND ${quoteIdentifier(typeAttr.column_name)} = $2
      LIMIT 1
    `,
            [ctx.userId, grantTypeValueId]
        )) as Array<{ id: string }>
        if (grantRows[0]?.id) return

        const oreRows = await loadNomenclatureRowsByCode(executor, ctx, economy, [ORE_NOMENCLATURE_CODE])
        const oreRow = oreRows[0]
        if (!oreRow) throwEconomyFailure('ECONOMY_UNKNOWN_NOMENCLATURE', `Nomenclature ${ORE_NOMENCLATURE_CODE} is not configured`)

        const stationRows = (await executor.query(
            `
      SELECT id
      FROM ${ctx.schemaIdent}.${quoteIdentifier(economy.station.table_name)}
      WHERE ${buildEconomyActiveCondition(ctx, economy.station)}
      ORDER BY _upl_created_at ASC NULLS LAST, id ASC
      LIMIT 1
    `,
            []
        )) as Array<{ id: string }>
        const stationId = stationRows[0]?.id
        if (!stationId) throwEconomyFailure('ECONOMY_MARKET_DISABLED', 'No flight station is available for the starter grant')

        // Operation entity validation requires Station/Nomenclature REFs — the
        // grant posts Quantity=StartingOreKg, UnitPrice=0 and TotalPrice=
        // StartingBalance (server-resolved constants); the posting module
        // composes the actual ledger movements from those row fields.
        const grant = await createEconomyRow(executor, ctx, applicationId, economy.operation, {
            OperationType: grantTypeValueId,
            Wallet: walletId,
            Station: String(stationId),
            Nomenclature: oreRow.id,
            Quantity: economy.startingOreKg,
            UnitPrice: 0,
            TotalPrice: economy.startingBalance,
            OccurredAt: new Date().toISOString()
        })
        afterLifecycleRequests.push(grant.afterCreateLifecycleRequest)
        const posted = await postOperationRow(executor, ctx, applicationId, economy, grant.rowId)
        if (posted) afterLifecycleRequests.push(posted)
        logEconomyEvent('starter grant issued', {
            applicationId,
            principalId: ctx.userId,
            operationId: grant.rowId
        })
    }

    const bootstrapStarterGrant = async (
        executor: DbExecutor,
        ctx: RuntimeSchemaContext,
        applicationId: string,
        economy: EconomyResolvedConfig
    ): Promise<RuntimeLifecycleDispatchRequest[]> => {
        const requests: RuntimeLifecycleDispatchRequest[] = []
        // D6: one advisory transaction lock per (application, user, currency)
        // guards the wallet check-then-create AND the once-only StarterGrant check.
        await acquireAdvisoryXactLock(executor, `${applicationId}:${ctx.userId}:${economy.currencyCode}`)
        const wallet = await ensureWalletForUserInTx(executor, ctx, applicationId, economy.wallet, economy.currencyCode, requests)
        await ensureStarterGrantInTx(executor, ctx, applicationId, economy, wallet.walletId, requests)
        return requests
    }

    /**
     * Plan B4 public wallet ensure: check-then-create under the per-(user,
     * currency) advisory transaction lock (D6). The returned
     * `afterCreateLifecycleRequest` is dispatched post-commit by the caller
     * boundary (`dispatchRuntimeLifecycleAfterCommit`), mirroring `create.ts`.
     * `applicationId` is required because the afterCreate lifecycle dispatch
     * request must carry it.
     */
    const ensureWalletForUser = async (
        ctx: RuntimeSchemaContext,
        applicationId: string,
        currency: string
    ): Promise<{ walletId: string; created: boolean; afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest | null }> => {
        const walletCollection = await resolveEconomyObjectCollection(ctx.manager, ctx.schemaIdent, WALLET_ENTITY_CODE)
        return withTransactionSavepoint(ctx.manager, async (tx) => {
            await acquireAdvisoryXactLock(tx, `${applicationId}:${ctx.userId}:${currency}`)
            const requests: RuntimeLifecycleDispatchRequest[] = []
            const wallet = await ensureWalletForUserInTx(tx, ctx, applicationId, walletCollection, currency, requests)
            return { walletId: wallet.walletId, created: wallet.created, afterCreateLifecycleRequest: requests[0] ?? null }
        })
    }

    const getEconomySummary = async (ctx: RuntimeSchemaContext, applicationId: string): Promise<EconomySummaryResult> => {
        const economy = await resolveEconomyConfig(ctx.manager, ctx)

        // D11 — documented side-effecting GET: the wallet + once-only
        // StarterGrant bootstrap runs in its own advisory-locked transaction
        // before the payload is computed (replay-safe: the StarterGrant
        // Operation exists exactly once per user).
        const afterLifecycleRequests = await withTransactionSavepoint(ctx.manager, (tx) =>
            bootstrapStarterGrant(tx, ctx, applicationId, economy)
        )

        const [balance, cargo, market, operations, proximity] = await Promise.all([
            computeWalletBalance(ledgerService, ctx.manager, ctx, economy),
            computeCargo(ledgerService, ctx.manager, ctx, economy),
            buildMarketEntries(ctx.manager, ctx, economy),
            buildRecentOperations(ctx.manager, ctx, economy),
            resolveStationProximity(ctx.manager, ctx, applicationId, economy)
        ])

        const summary = economySummarySchema.parse({
            wallet: { currency: economy.currencyCode, balance },
            cargo: cargo.entries,
            capacity: { usedKg: cargo.usedKg, maxKg: economy.maxCargoMassKg },
            market,
            operations,
            atStation: proximity.atStation,
            stationName: proximity.stationName
        })
        return { summary, afterLifecycleRequests }
    }

    const executeTrade = async (
        ctx: RuntimeSchemaContext,
        applicationId: string,
        kind: EconomyTradeKind,
        body: EconomyTradeRequest,
        idempotency?: EconomyIdempotencyScope
    ): Promise<EconomyTradeOutcome> =>
        // ONE transaction for the whole trade (B5) — every failure throws
        // `UpdateFailure` and rolls the savepoint back (no partial facts).
        withTransactionSavepoint(ctx.manager, async (tx) => {
            // ① Idempotency gate: scoped lookup + same-key serialization.
            if (idempotency) {
                const stored = await runIdempotencyGateInTx(tx, idempotency)
                if (stored) {
                    logEconomyEvent('trade replayed from stored response', {
                        applicationId,
                        principalId: ctx.userId
                    })
                    return { kind: 'replayed' as const, status: stored.statusCode, body: stored.response }
                }
            }

            // ② Resolve economy config + entities.
            const economy = await resolveEconomyConfig(tx, ctx)

            // ③ Proximity: the authoritative ship position comes from the live
            // flight room (never the client); no session or too far → 409.
            const proximity = await resolveStationProximity(tx, ctx, applicationId, economy)
            if (!proximity.atStation || !proximity.stationId) {
                throwEconomyFailure('ECONOMY_NOT_AT_STATION', 'Trading requires being docked at a station')
            }
            if (proximity.marketEnabled === false) {
                throwEconomyFailure('ECONOMY_MARKET_DISABLED', 'The station market is disabled')
            }

            // ④ Wallet ensure FIRST — the per-(application, user, currency)
            // advisory lock is held before any balance read (TOCTOU guard).
            const afterLifecycleRequests: RuntimeLifecycleDispatchRequest[] = []
            await acquireAdvisoryXactLock(tx, `${applicationId}:${ctx.userId}:${economy.currencyCode}`)
            const wallet = await ensureWalletForUserInTx(
                tx,
                ctx,
                applicationId,
                economy.wallet,
                economy.currencyCode,
                afterLifecycleRequests
            )

            // ⑤ Request-shape and market-config validation AFTER the lock is held.
            // Quantity shape (finite number) is the shared schema's job; this is
            // the single semantic gate for the > 0 rule, producing the stable
            // 422 code from the documented D9 error contract.
            if (!(body.quantity > 0)) {
                throwEconomyFailure('ECONOMY_INVALID_QUANTITY', 'Trade quantity must be greater than zero')
            }

            const nomenclatureRows = await loadNomenclatureRowsByCode(tx, ctx, economy, [body.nomenclatureCode])
            const nomenclatureRow = nomenclatureRows[0]
            if (!nomenclatureRow) {
                // No client-supplied reflection in the message — the stable code
                // carries the meaning; the panel renders localized text anyway.
                throwEconomyFailure('ECONOMY_UNKNOWN_NOMENCLATURE', 'Nomenclature is not available')
            }
            const marketConfig = MARKET_SIDE_CONFIGS.find((config) => config.nomenclatureCode === nomenclatureRow.code)
            if (!marketConfig || marketConfig.side !== kind) {
                throwEconomyFailure('ECONOMY_MARKET_DISABLED', 'This nomenclature has no market side for the requested trade')
            }
            const unitPrice = economy.priceByConstant.get(marketConfig.priceConstant)
            if (unitPrice === undefined) {
                throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy price constant ${marketConfig.priceConstant} is not configured`)
            }

            // ⑥ Once-only StarterGrant BEFORE balance/cargo validation: the grant
            // posts the starting ore synchronously inside this transaction, so a
            // user's very first direct trade (no prior summary GET) can sell the
            // granted starting inventory instead of failing on an empty cargo.
            await ensureStarterGrantInTx(tx, ctx, applicationId, economy, wallet.walletId, afterLifecycleRequests)

            // ⑦ Balance/cargo validation computed AFTER the grant: all reads
            // observe the grant facts and every committed concurrent trade for
            // this user (advisory lock held since ④).
            const [balance, cargo] = await Promise.all([
                computeWalletBalance(ledgerService, tx, ctx, economy),
                computeCargo(ledgerService, tx, ctx, economy)
            ])
            if (kind === 'sell') {
                const ownedQuantity = cargo.quantityByCode.get(nomenclatureRow.code) ?? 0
                if (ownedQuantity + NUMERIC_EPSILON < body.quantity) {
                    throwEconomyFailure('ECONOMY_INSUFFICIENT_CARGO', 'Not enough cargo to sell')
                }
            } else {
                const cost = body.quantity * unitPrice
                if (balance + NUMERIC_EPSILON < cost) {
                    throwEconomyFailure('ECONOMY_INSUFFICIENT_FUNDS', 'Not enough funds to buy')
                }
                const addedMassKg = body.quantity * nomenclatureRow.massPerUnit
                if (cargo.usedKg + addedMassKg > economy.maxCargoMassKg + NUMERIC_EPSILON) {
                    throwEconomyFailure('ECONOMY_CAPACITY_EXCEEDED', 'Cargo capacity would be exceeded')
                }
            }

            // ⑧ Create the Operation row (prices from the server-side market):
            // UnitPrice = constant-driven per-unit price, TotalPrice = positive
            // monetary magnitude the posting module turns into signed ledger
            // movements (wallet credit/debit, inventory cost).
            const operationTypeValueId = await resolveOperationTypeValueId(
                tx,
                ctx,
                economy,
                kind === 'sell' ? SELL_OPERATION_TYPE_CODE : BUY_OPERATION_TYPE_CODE
            )
            const created = await createEconomyRow(tx, ctx, applicationId, economy.operation, {
                OperationType: operationTypeValueId,
                Wallet: wallet.walletId,
                Station: proximity.stationId,
                Nomenclature: nomenclatureRow.id,
                Quantity: body.quantity,
                UnitPrice: unitPrice,
                TotalPrice: unitPrice * body.quantity,
                OccurredAt: new Date().toISOString()
            })
            afterLifecycleRequests.push(created.afterCreateLifecycleRequest)

            // ⑧ Post through the shared core — movements come from the authored
            // MmoommEconomyPostingModule, never from this service.
            const posted = await postOperationRow(tx, ctx, applicationId, economy, created.rowId)
            if (posted) afterLifecycleRequests.push(posted)

            // ⑨ Fresh summary values for the response (TZ §8.2).
            const tradeResponse = economyTradeResponseSchema.parse({
                operationId: created.rowId,
                walletBalance: await computeWalletBalance(ledgerService, tx, ctx, economy),
                cargo: (await computeCargo(ledgerService, tx, ctx, economy)).entries
            })

            if (idempotency) {
                const raceReplay = await saveIdempotentResponseInTx(tx, idempotency, tradeResponse)
                if (raceReplay) {
                    logEconomyEvent('trade replayed after scoped-unique race', {
                        applicationId,
                        principalId: ctx.userId
                    })
                    return { kind: 'replayed' as const, status: raceReplay.statusCode, body: raceReplay.response }
                }
            }
            logEconomyEvent('trade executed', {
                applicationId,
                principalId: ctx.userId,
                operationId: created.rowId,
                kind
            })
            return { kind: 'executed' as const, status: 200, body: tradeResponse, afterLifecycleRequests }
        })

    return { getEconomySummary, executeTrade, ensureWalletForUser }
}
