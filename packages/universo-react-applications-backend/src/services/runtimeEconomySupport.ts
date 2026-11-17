import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { economyTradeKindSchema, type EconomyCargoEntry, type EconomySummary } from '@universo-react/types'
import { loadApplicationRuntimeConstants } from './applicationRuntimeConstants'
import {
    buildRuntimeActiveRowCondition,
    IDENTIFIER_REGEX,
    pgNumericToNumber,
    quoteIdentifier,
    resolveLocalizedContent,
    resolveRuntimeCodenameText,
    runtimeCodenameTextSql,
    UUID_REGEX,
    UpdateFailure,
    type RuntimeSchemaContext
} from '../shared/runtimeHelpers'
import type { RuntimeObjectCollectionAttr } from './runtimeRowSupport/contracts'
import { findRuntimeAttrByFieldKey, loadRuntimeObjectAttrs } from './runtimeRowSupport/objectMetadata'
import { buildRuntimeRecordAccessClause } from './runtimeRowSupport/access'
import type { RuntimeLedgerService } from './runtimeLedgersService'
import { describeFlightContext } from './runtimeFlightRoomBridge'
import type { RuntimeResolvedObjectCollection } from '../controllers/runtimeRowCommandHandlers/types'

/**
 * Pure resolution/reading helpers for the runtime economy service
 * (MMOOMM plan B4/B4a/B5, decisions D2/D3/D8/D9).
 *
 * All SQL is schema-qualified and parameterized over per-component physical
 * columns (`attr.column_name` resolved from `_app_components`); entity tables
 * are `obj_<entityId>` resolved by entity codename — no `data` jsonb reads and
 * no hardcoded table names. Balance facts are read exclusively through the
 * generic ledger projection machinery (`RuntimeLedgerService.queryProjection`)
 * with the requester's scope injected via `readScope` (Phase H) and remaining
 * filters keyed by ledger FIELD CODENAMES — never client-supplied (D8).
 * Everything fails closed with the stable D9 codes.
 */

export const ECONOMY_CONSTANTS_SET_CODE = 'EconomyConstants'
export const NOMENCLATURE_ENTITY_CODE = 'Nomenclature'
export const WALLET_ENTITY_CODE = 'Wallet'
export const OPERATION_ENTITY_CODE = 'Operation'
export const STATION_ENTITY_CODE = 'FlightStation'
export const WALLET_LEDGER_CODE = 'WalletLedger'
export const INVENTORY_LEDGER_CODE = 'InventoryLedger'
export const WALLET_BALANCE_PROJECTION = 'walletBalance'
export const STOCK_BALANCE_PROJECTION = 'stockBalance'
export const ORE_NOMENCLATURE_CODE = 'ORE'
export const FUEL_NOMENCLATURE_CODE = 'FUEL'

const RECENT_OPERATIONS_LIMIT = 5

export type EconomyTradeKind = z.infer<typeof economyTradeKindSchema>

/**
 * Market sides are derived from the EconomyConstants price constants: each
 * nomenclature code maps to the constant that governs its price (data-driven —
 * add an entry here and the market row appears without touching the flow).
 */
export const MARKET_SIDE_CONFIGS: ReadonlyArray<{
    nomenclatureCode: string
    side: EconomyTradeKind
    priceConstant: string
    fallbackUnit: string
}> = [
    { nomenclatureCode: ORE_NOMENCLATURE_CODE, side: 'sell', priceConstant: 'OrePricePerKg', fallbackUnit: 'Kg' },
    { nomenclatureCode: FUEL_NOMENCLATURE_CODE, side: 'buy', priceConstant: 'FuelPricePerLiter', fallbackUnit: 'Liter' }
]

export const REQUIRED_CONSTANT_CODES = [
    'CurrencyCode',
    'StartingBalance',
    'StartingOreKg',
    'OrePricePerKg',
    'FuelPricePerLiter',
    'MaxCargoMassKg',
    'MarketRadiusMeters'
] as const

export type EconomyCollection = RuntimeResolvedObjectCollection & { attrs: RuntimeObjectCollectionAttr[] }

export type EconomyResolvedConfig = {
    currencyCode: string
    startingBalance: number
    startingOreKg: number
    marketRadiusMeters: number
    maxCargoMassKg: number
    priceByConstant: Map<string, number>
    nomenclature: EconomyCollection
    wallet: EconomyCollection
    operation: EconomyCollection
    station: EconomyCollection
    walletLedgerId: string
    inventoryLedgerId: string
}

export type NomenclatureRow = { id: string; code: string; name: string; unit: string; massPerUnit: number }

export type EconomyCargo = { entries: EconomyCargoEntry[]; usedKg: number; quantityByCode: Map<string, number> }

export type StationProximity = { atStation: boolean; stationName: string | null; stationId: string | null; marketEnabled: boolean | null }

// ---------------------------------------------------------------------------
// Stable economy error mapping (D9 / TZ §8.4)
// ---------------------------------------------------------------------------

const ECONOMY_ERROR_STATUS_BY_CODE = {
    ECONOMY_NOT_AT_STATION: 409,
    ECONOMY_UNKNOWN_NOMENCLATURE: 404,
    ECONOMY_INVALID_QUANTITY: 422,
    ECONOMY_INSUFFICIENT_CARGO: 409,
    ECONOMY_INSUFFICIENT_FUNDS: 409,
    ECONOMY_CAPACITY_EXCEEDED: 409,
    ECONOMY_MARKET_DISABLED: 409,
    ECONOMY_IDEMPOTENCY_CONFLICT: 409,
    ECONOMY_POSTING_FAILED: 500
} as const

export type EconomyErrorCode = keyof typeof ECONOMY_ERROR_STATUS_BY_CODE

// A `function` declaration (not an arrow const) so the `never` return type
// drives control-flow narrowing at every call site.
export function throwEconomyFailure(code: EconomyErrorCode, error: string): never {
    throw new UpdateFailure(ECONOMY_ERROR_STATUS_BY_CODE[code], { error, code })
}

// ---------------------------------------------------------------------------
// Pure value helpers
// ---------------------------------------------------------------------------

export const toFiniteNumber = (value: unknown): number | null => {
    const parsed = pgNumericToNumber(value)
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

const resolveRowText = (value: unknown): string => resolveLocalizedContent(value, 'en', '')

const distance3D = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)

// ---------------------------------------------------------------------------
// Metadata resolution helpers (fail closed with D9 codes)
// ---------------------------------------------------------------------------

export const resolveEconomyObjectCollection = async (
    executor: DbExecutor,
    schemaIdent: string,
    entityCodename: string
): Promise<EconomyCollection> => {
    const rows = (await executor.query(
        `
      SELECT id, kind, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE kind = 'object'
        AND LOWER(${runtimeCodenameTextSql('codename')}) = LOWER($1)
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [entityCodename]
    )) as Array<{ id: string; kind: string; codename: unknown; table_name: string | null; config?: Record<string, unknown> | null }>

    const row = rows[0]
    const tableName = typeof row?.table_name === 'string' && IDENTIFIER_REGEX.test(row.table_name) ? row.table_name : null
    if (!row || !tableName) {
        throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy entity ${entityCodename} is not available in this application`)
    }

    return {
        id: row.id,
        kind: 'object',
        codename: row.codename,
        table_name: tableName,
        config: row.config,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(row.config),
        attrs: await loadRuntimeObjectAttrs(executor, schemaIdent, row.id)
    }
}

export const requireAttr = (collection: EconomyCollection, fieldCodename: string): RuntimeObjectCollectionAttr => {
    const attr = findRuntimeAttrByFieldKey(collection.attrs, fieldCodename)
    if (!attr || !IDENTIFIER_REGEX.test(attr.column_name)) {
        throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy entity is missing the ${fieldCodename} field`)
    }
    return attr
}

export const resolveEconomyEnumValueId = async (
    executor: DbExecutor,
    schemaIdent: string,
    enumerationObjectId: string,
    valueCodename: string
): Promise<string | null> => {
    const rows = (await executor.query(
        `
      SELECT id
      FROM ${schemaIdent}._app_values
      WHERE object_id = $1
        AND LOWER(${runtimeCodenameTextSql('codename')}) = LOWER($2)
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [enumerationObjectId, valueCodename]
    )) as Array<{ id: string }>
    return rows[0]?.id ?? null
}

/** Resolve an enum REF value by codename; STRING fields take the text as-is; otherwise the value is omitted (defaults apply). */
export const resolveAttrValueByCodename = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    attr: RuntimeObjectCollectionAttr,
    valueCodename: string
): Promise<unknown> => {
    if (attr.data_type === 'REF') {
        if (typeof attr.target_object_id !== 'string') return undefined
        return resolveEconomyEnumValueId(executor, ctx.schemaIdent, attr.target_object_id, valueCodename)
    }
    if (attr.data_type === 'STRING') return valueCodename
    return undefined
}

export const resolveOperationTypeValueId = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig,
    typeCodename: string
): Promise<string> => {
    const typeAttr = requireAttr(economy.operation, 'OperationType')
    if (typeof typeAttr.target_object_id !== 'string') {
        throwEconomyFailure('ECONOMY_MARKET_DISABLED', 'OperationType field does not reference an enumeration')
    }
    const valueId = await resolveEconomyEnumValueId(executor, ctx.schemaIdent, typeAttr.target_object_id, typeCodename)
    if (!valueId) throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Operation type ${typeCodename} is not configured`)
    return valueId
}

export const resolveEnumValueLabels = async (
    executor: DbExecutor,
    schemaIdent: string,
    valueIds: string[]
): Promise<Map<string, string>> => {
    const labels = new Map<string, string>()
    if (valueIds.length === 0) return labels
    const rows = (await executor.query(
        `
      SELECT id, codename
      FROM ${schemaIdent}._app_values
      WHERE id = ANY($1::uuid[])
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [valueIds]
    )) as Array<{ id: string; codename: unknown }>
    for (const row of rows) {
        const label = resolveRuntimeCodenameText(row.codename)
        if (label) labels.set(row.id, label)
    }
    return labels
}

// ---------------------------------------------------------------------------
// D3 economy constants (materialized `_app_constants`, fail-soft reads)
// ---------------------------------------------------------------------------

export const resolveEconomyConstants = async (executor: DbExecutor, ctx: RuntimeSchemaContext): Promise<Map<string, unknown>> => {
    const allConstants = await loadApplicationRuntimeConstants(executor, ctx.schemaName)
    const groupRows = (await executor.query(
        `
      SELECT id
      FROM ${ctx.schemaIdent}._app_objects
      WHERE kind = 'set'
        AND ${runtimeCodenameTextSql('codename')} = $1
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [ECONOMY_CONSTANTS_SET_CODE]
    )) as Array<{ id: string }>

    const groupId = groupRows[0]?.id
    if (!groupId) throwEconomyFailure('ECONOMY_MARKET_DISABLED', 'Economy constants set is not configured')

    const constants = new Map<string, unknown>()
    for (const constant of allConstants) {
        if (constant.groupId === groupId) constants.set(constant.codenameText, constant.value)
    }
    return constants
}

export const readNumberConstant = (constants: Map<string, unknown>, codename: string): number => {
    const parsed = toFiniteNumber(constants.get(codename))
    if (parsed === null) throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy constant ${codename} is missing or invalid`)
    return parsed
}

export const readStringConstant = (constants: Map<string, unknown>, codename: string): string => {
    const text = resolveRowText(constants.get(codename)).trim()
    if (!text) throwEconomyFailure('ECONOMY_MARKET_DISABLED', `Economy constant ${codename} is missing or invalid`)
    return text
}

// ---------------------------------------------------------------------------
// Row loading helpers
// ---------------------------------------------------------------------------

export const buildEconomyActiveCondition = (ctx: RuntimeSchemaContext, collection: EconomyCollection): string =>
    buildRuntimeActiveRowCondition(collection.lifecycleContract, collection.config, undefined, ctx.currentWorkspaceId)

export const loadNomenclatureRowsByCode = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig,
    codes: string[]
): Promise<NomenclatureRow[]> => {
    if (codes.length === 0) return []
    const codeAttr = requireAttr(economy.nomenclature, 'Code')
    const nameAttr = findRuntimeAttrByFieldKey(economy.nomenclature.attrs, 'Name')
    const unitAttr = findRuntimeAttrByFieldKey(economy.nomenclature.attrs, 'Unit')
    const massAttr = requireAttr(economy.nomenclature, 'MassPerUnit')

    const textSelect = (attr: RuntimeObjectCollectionAttr | undefined, alias: string) =>
        attr && IDENTIFIER_REGEX.test(attr.column_name) ? `${quoteIdentifier(attr.column_name)} AS ${alias}` : `NULL AS ${alias}`

    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(economy.nomenclature.table_name)}`
    const rows = (await executor.query(
        `
      SELECT id,
             ${quoteIdentifier(codeAttr.column_name)} AS code,
             ${textSelect(nameAttr, 'name_value')},
             ${textSelect(unitAttr, 'unit_value')},
             ${quoteIdentifier(massAttr.column_name)} AS mass_per_unit
      FROM ${dataTableIdent}
      WHERE ${buildEconomyActiveCondition(ctx, economy.nomenclature)}
        AND ${quoteIdentifier(codeAttr.column_name)} = ANY($1::text[])
    `,
        [codes]
    )) as Array<{ id: string; code: unknown; name_value: unknown; unit_value: unknown; mass_per_unit: unknown }>

    const fallbackUnits = new Map(MARKET_SIDE_CONFIGS.map((config) => [config.nomenclatureCode, config.fallbackUnit]))
    // REF units store enumeration value ids — batch-resolve them to
    // human-readable labels so summary panels never surface raw ids
    // (runtime UX rule: no raw user-facing ids).
    const refUnitIds =
        unitAttr?.data_type === 'REF'
            ? [
                  ...new Set(
                      rows
                          .map((row) => resolveRowText(row.unit_value))
                          .filter((value): value is string => Boolean(value && UUID_REGEX.test(value)))
                  )
              ]
            : []
    const unitLabels = await resolveEnumValueLabels(executor, ctx.schemaIdent, refUnitIds)
    const resolveUnitLabel = (code: string, rawUnit: string | null): string => {
        if (rawUnit && UUID_REGEX.test(rawUnit)) return unitLabels.get(rawUnit) ?? fallbackUnits.get(code) ?? rawUnit
        return rawUnit || fallbackUnits.get(code) || code
    }
    return rows
        .map((row): NomenclatureRow | null => {
            if (typeof row.code !== 'string' || row.code.trim().length === 0) return null
            const code = row.code.trim()
            return {
                id: String(row.id),
                code,
                name: resolveRowText(row.name_value) || code,
                unit: resolveUnitLabel(code, resolveRowText(row.unit_value)),
                massPerUnit: toFiniteNumber(row.mass_per_unit) ?? 0
            }
        })
        .filter((row): row is NomenclatureRow => row !== null)
}

const loadStationRowByIds = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig,
    stationIds: string[]
): Promise<{ id: string; name: string | null; marketEnabled: boolean | null } | null> => {
    const uuidIds = stationIds.filter((id) => UUID_REGEX.test(id))
    if (uuidIds.length === 0) return null
    const nameAttr = findRuntimeAttrByFieldKey(economy.station.attrs, 'Name')
    const marketAttr = findRuntimeAttrByFieldKey(economy.station.attrs, 'MarketEnabled')
    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(economy.station.table_name)}`
    const nameSelect =
        nameAttr && IDENTIFIER_REGEX.test(nameAttr.column_name)
            ? `${quoteIdentifier(nameAttr.column_name)} AS name_value`
            : 'NULL AS name_value'
    const marketSelect =
        marketAttr && IDENTIFIER_REGEX.test(marketAttr.column_name)
            ? `${quoteIdentifier(marketAttr.column_name)} AS market_enabled`
            : 'NULL AS market_enabled'
    const rows = (await executor.query(
        `
      SELECT id, ${nameSelect}, ${marketSelect}
      FROM ${dataTableIdent}
      WHERE ${buildEconomyActiveCondition(ctx, economy.station)}
        AND id = ANY($1::uuid[])
      ORDER BY _upl_created_at ASC NULLS LAST, id ASC
    `,
        [uuidIds]
    )) as Array<{ id: string; name_value: unknown; market_enabled: unknown }>

    const row = rows[0]
    if (!row) return null
    return {
        id: String(row.id),
        name: resolveRowText(row.name_value) || null,
        marketEnabled: typeof row.market_enabled === 'boolean' ? row.market_enabled : null
    }
}

const loadFirstStationRow = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig
): Promise<{ id: string; name: string | null; marketEnabled: boolean | null } | null> => {
    const nameAttr = findRuntimeAttrByFieldKey(economy.station.attrs, 'Name')
    const marketAttr = findRuntimeAttrByFieldKey(economy.station.attrs, 'MarketEnabled')
    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(economy.station.table_name)}`
    const nameSelect =
        nameAttr && IDENTIFIER_REGEX.test(nameAttr.column_name)
            ? `${quoteIdentifier(nameAttr.column_name)} AS name_value`
            : 'NULL AS name_value'
    const marketSelect =
        marketAttr && IDENTIFIER_REGEX.test(marketAttr.column_name)
            ? `${quoteIdentifier(marketAttr.column_name)} AS market_enabled`
            : 'NULL AS market_enabled'
    const rows = (await executor.query(
        `
        SELECT id, ${nameSelect}, ${marketSelect}
        FROM ${dataTableIdent}
        WHERE ${buildRuntimeActiveRowCondition(
            economy.station.lifecycleContract,
            economy.station.config,
            undefined,
            ctx.currentWorkspaceId
        )}
        LIMIT 1
        `,
        []
    )) as Array<{ id: string; name_value: unknown; market_enabled: unknown }>
    const row = rows[0]
    if (!row?.id) return null
    return {
        id: String(row.id),
        // Localized-content resolver — a raw String() would serialize JSONB
        // names ("[object Object]") into the summary.
        name: resolveRowText(row.name_value) || null,
        marketEnabled: row.market_enabled === null || row.market_enabled === undefined ? null : Boolean(row.market_enabled)
    }
}

// ---------------------------------------------------------------------------
// Balance projections (server-injected filters, D8)
// ---------------------------------------------------------------------------

const queryEconomyProjection = (
    ledgerService: RuntimeLedgerService,
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    ledgerId: string,
    projectionCodename: string,
    filters: Record<string, unknown>
) =>
    ledgerService.queryProjection({
        executor,
        schemaName: ctx.schemaName,
        ledgerId,
        currentWorkspaceId: ctx.currentWorkspaceId,
        projectionCodename,
        // Phase H: the owner dimension (WalletKey/OwnerKey) is server-scoped by
        // the ledger read scope — economy filters carry only non-owner
        // dimensions (Currency, NomenclatureCode).
        readScope: { userId: ctx.userId },
        filters
    })

export const computeWalletBalance = async (
    ledgerService: RuntimeLedgerService,
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig
): Promise<number> => {
    const projection = await queryEconomyProjection(ledgerService, executor, ctx, economy.walletLedgerId, WALLET_BALANCE_PROJECTION, {
        Currency: economy.currencyCode
    })
    return toFiniteNumber(projection.rows[0]?.Amount) ?? 0
}

export const computeCargo = async (
    ledgerService: RuntimeLedgerService,
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig
): Promise<EconomyCargo> => {
    const projection = await queryEconomyProjection(ledgerService, executor, ctx, economy.inventoryLedgerId, STOCK_BALANCE_PROJECTION, {})

    const quantityByCode = new Map<string, number>()
    for (const row of projection.rows) {
        const code = typeof row.NomenclatureCode === 'string' ? row.NomenclatureCode.trim() : ''
        if (!code) continue
        const quantity = toFiniteNumber(row.Quantity) ?? 0
        quantityByCode.set(code, (quantityByCode.get(code) ?? 0) + quantity)
    }

    const rows = await loadNomenclatureRowsByCode(executor, ctx, economy, [...quantityByCode.keys()])
    const rowByCode = new Map(rows.map((row) => [row.code, row]))
    const entries: EconomyCargoEntry[] = []
    for (const [code, quantity] of quantityByCode) {
        const row = rowByCode.get(code)
        if (!row) {
            // A cargo fact without a matching Nomenclature row is data corruption — fail closed.
            throwEconomyFailure('ECONOMY_UNKNOWN_NOMENCLATURE', `Nomenclature ${code} referenced by cargo facts is missing`)
        }
        entries.push({
            nomenclatureCode: row.code,
            nomenclatureName: row.name,
            quantity,
            unit: row.unit,
            massKg: Math.max(0, quantity * row.massPerUnit)
        })
    }
    const usedKg = entries.reduce((sum, entry) => sum + entry.massKg, 0)
    return { entries, usedKg, quantityByCode }
}

export const buildMarketEntries = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    economy: EconomyResolvedConfig
): Promise<EconomySummary['market']> => {
    const rows = await loadNomenclatureRowsByCode(
        executor,
        ctx,
        economy,
        MARKET_SIDE_CONFIGS.map((config) => config.nomenclatureCode)
    )
    const rowByCode = new Map(rows.map((row) => [row.code, row]))
    const market: EconomySummary['market'] = []
    for (const config of MARKET_SIDE_CONFIGS) {
        const row = rowByCode.get(config.nomenclatureCode)
        const price = economy.priceByConstant.get(config.priceConstant)
        if (!row || price === undefined) continue
        market.push({ nomenclatureCode: row.code, nomenclatureName: row.name, side: config.side, price, unit: row.unit })
    }
    return market
}

// ---------------------------------------------------------------------------
// D2 station proximity via the read-only flight room bridge
// ---------------------------------------------------------------------------

export const resolveStationProximity = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    applicationId: string,
    economy: EconomyResolvedConfig
): Promise<StationProximity> => {
    const flight = await describeFlightContext(applicationId, ctx.userId, ctx.currentWorkspaceId)
    if (!flight) return { atStation: false, stationName: null, stationId: null, marketEnabled: null }

    const withinRadius = flight.stations
        .filter((station) => distance3D(flight.position, station.position) <= economy.marketRadiusMeters)
        .map((station) => station.id)
    if (withinRadius.length === 0) return { atStation: false, stationName: null, stationId: null, marketEnabled: null }

    let stationRow = await loadStationRowByIds(executor, ctx, economy, withinRadius)
    if (!stationRow) {
        // The room bridge reports scene-object ids (widget scene config), which do
        // not map to FlightStation rows. The MVP has exactly one station row —
        // resolve it by collection so the Station REF targets a real row.
        stationRow = await loadFirstStationRow(executor, ctx, economy)
    }
    if (!stationRow) {
        // No station row seeded: refuse the trade rather than write a dangling REF.
        return { atStation: false, stationName: null, stationId: null, marketEnabled: null }
    }
    return {
        atStation: true,
        stationName: stationRow.name,
        stationId: stationRow.id,
        marketEnabled: stationRow.marketEnabled
    }
}

// ---------------------------------------------------------------------------
// Recent operations (ownerOnly-scoped, last 5)
// ---------------------------------------------------------------------------

export const buildRecentOperations = async (executor: DbExecutor, ctx: RuntimeSchemaContext, economy: EconomyResolvedConfig) => {
    const typeAttr = requireAttr(economy.operation, 'OperationType')
    const quantityAttr = requireAttr(economy.operation, 'Quantity')
    const priceAttr = findRuntimeAttrByFieldKey(economy.operation.attrs, 'UnitPrice')
    const totalPriceAttr = findRuntimeAttrByFieldKey(economy.operation.attrs, 'TotalPrice')
    const occurredAttr = findRuntimeAttrByFieldKey(economy.operation.attrs, 'OccurredAt')
    const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(economy.operation.table_name)}`

    const values: unknown[] = []
    const accessClause = await buildRuntimeRecordAccessClause({
        manager: executor,
        schemaIdent: ctx.schemaIdent,
        currentWorkspaceId: ctx.currentWorkspaceId,
        currentUserId: ctx.userId,
        permissions: ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(economy.operation.codename),
        attrs: economy.operation.attrs,
        config: economy.operation.config,
        outerRowIdSql: `${dataTableIdent}.id`,
        values,
        minimumAccessLevel: 'read'
    })
    // Belt-and-braces user isolation: runtimeRecordAccess ownerOnly is config-driven,
    // so the summary never relies on it alone — the creator column is a platform
    // system column stamped on every insert.
    const ownerClause = `_upl_created_by = $${values.length + 1}`
    values.push(ctx.userId)

    const whereSql = [buildEconomyActiveCondition(ctx, economy.operation), accessClause, ownerClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const limitParamIndex = values.length + 1
    values.push(RECENT_OPERATIONS_LIMIT)

    const priceSelect =
        priceAttr && IDENTIFIER_REGEX.test(priceAttr.column_name)
            ? `${quoteIdentifier(priceAttr.column_name)} AS unit_price`
            : 'NULL AS unit_price'
    // TotalPrice is the server-stamped monetary magnitude (M4) — the operation
    // feed reports it so the StarterGrant shows its real credited amount
    // instead of a zero-valued price x quantity product.
    const totalPriceSelect =
        totalPriceAttr && IDENTIFIER_REGEX.test(totalPriceAttr.column_name)
            ? `${quoteIdentifier(totalPriceAttr.column_name)} AS total_price`
            : 'NULL AS total_price'
    const occurredSelect =
        occurredAttr && IDENTIFIER_REGEX.test(occurredAttr.column_name)
            ? `${quoteIdentifier(occurredAttr.column_name)} AS occurred_at`
            : 'NULL AS occurred_at'
    const rows = (await executor.query(
        `
      SELECT id,
             ${quoteIdentifier(typeAttr.column_name)} AS operation_type,
             ${quoteIdentifier(quantityAttr.column_name)} AS quantity,
             ${priceSelect},
             ${totalPriceSelect},
             ${occurredSelect},
             _upl_created_at
      FROM ${dataTableIdent}
      WHERE ${whereSql}
      ORDER BY _upl_created_at DESC, id DESC
      LIMIT $${limitParamIndex}
    `,
        values
    )) as Array<{
        id: string
        operation_type: unknown
        quantity: unknown
        unit_price: unknown
        total_price: unknown
        occurred_at: unknown
        _upl_created_at: unknown
    }>

    const typeIds = rows
        .map((row) => (typeof row.operation_type === 'string' ? row.operation_type : null))
        .filter((id): id is string => Boolean(id))
    const typeLabels = await resolveEnumValueLabels(executor, ctx.schemaIdent, typeIds)

    const toIsoTimestamp = (value: unknown): string | null => {
        if (value instanceof Date) return value.toISOString()
        if (typeof value === 'string' && value.trim().length > 0) return value
        return null
    }

    return rows.map((row) => {
        const quantity = toFiniteNumber(row.quantity) ?? 0
        const unitPrice = toFiniteNumber(row.unit_price) ?? 0
        // Prefer the server-stamped monetary magnitude; the price x quantity
        // product is the fallback for schemas authored before TotalPrice.
        const total = toFiniteNumber(row.total_price) ?? quantity * unitPrice
        const occurredAt = toIsoTimestamp(row.occurred_at) ?? toIsoTimestamp(row._upl_created_at) ?? new Date(0).toISOString()
        return {
            id: String(row.id),
            type: (typeof row.operation_type === 'string' ? typeLabels.get(row.operation_type) : undefined) ?? '',
            quantity,
            total,
            occurredAt
        }
    })
}
