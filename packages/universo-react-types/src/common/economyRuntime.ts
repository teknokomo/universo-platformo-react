import { z } from 'zod'

/**
 * Types-local UUID v7 schema: the types package stays zod-only, so the shared
 * `uuidV7Schema` from `@universo-react/utils` cannot be imported here (utils
 * depends on types → circular import).
 */
export const economyUuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14] === '7', {
        message: 'Expected UUID v7'
    })

export const economyErrorCodeSchema = z.enum([
    'ECONOMY_NOT_AT_STATION',
    'ECONOMY_UNKNOWN_NOMENCLATURE',
    'ECONOMY_INVALID_QUANTITY',
    'ECONOMY_INSUFFICIENT_CARGO',
    'ECONOMY_INSUFFICIENT_FUNDS',
    'ECONOMY_CAPACITY_EXCEEDED',
    'ECONOMY_MARKET_DISABLED',
    'ECONOMY_IDEMPOTENCY_CONFLICT',
    'ECONOMY_IDEMPOTENCY_KEY_INVALID',
    'ECONOMY_POSTING_FAILED',
    // Mining (TZ DOC-2026-006 §8.2): 401/403 stay on the shared runtime guard,
    // so MINING_AUTH_REQUIRED / MINING_PERMISSION_DENIED are reserved, not emitted.
    'MINING_INVALID_TARGET',
    'MINING_TARGET_NOT_FOUND',
    'MINING_NO_FLIGHT_SESSION',
    'MINING_OUT_OF_RANGE',
    'MINING_DEPLETED',
    'MINING_COOLDOWN',
    'MINING_INVALID_PAYLOAD',
    'MINING_POSTING_FAILED'
])
export type EconomyErrorCode = z.infer<typeof economyErrorCodeSchema>

export const economyErrorStatusByCode: Record<EconomyErrorCode, 400 | 404 | 409 | 422 | 500> = {
    ECONOMY_NOT_AT_STATION: 409,
    ECONOMY_UNKNOWN_NOMENCLATURE: 404,
    ECONOMY_INVALID_QUANTITY: 422,
    ECONOMY_INSUFFICIENT_CARGO: 409,
    ECONOMY_INSUFFICIENT_FUNDS: 409,
    ECONOMY_CAPACITY_EXCEEDED: 409,
    ECONOMY_MARKET_DISABLED: 409,
    ECONOMY_IDEMPOTENCY_CONFLICT: 409,
    ECONOMY_IDEMPOTENCY_KEY_INVALID: 400,
    ECONOMY_POSTING_FAILED: 500,
    // TZ DOC-2026-006 §8.2 statuses
    MINING_INVALID_TARGET: 400,
    MINING_TARGET_NOT_FOUND: 404,
    MINING_NO_FLIGHT_SESSION: 409,
    MINING_OUT_OF_RANGE: 409,
    MINING_DEPLETED: 409,
    MINING_COOLDOWN: 409,
    MINING_INVALID_PAYLOAD: 422,
    MINING_POSTING_FAILED: 500
} // TZ §8.4 + mining TZ §8.2

export const economyTradeKindSchema = z.enum(['sell', 'buy', 'mine'])

/** Market sides never include `mine` — the belt has no market rows. */
export const economyMarketSideSchema = z.enum(['sell', 'buy'])
export type EconomyMarketSide = z.infer<typeof economyMarketSideSchema>

export const economyTradeRequestSchema = z
    .object({
        stationId: economyUuidV7Schema.optional(),
        nomenclatureCode: z.string().min(1).max(64),
        quantity: z.number()
    })
    .strict()
export type EconomyTradeRequest = z.infer<typeof economyTradeRequestSchema>

export const economyCargoEntrySchema = z.object({
    nomenclatureCode: z.string().min(1),
    nomenclatureName: z.string().min(1),
    quantity: z.number(),
    unit: z.string().min(1),
    massKg: z.number().nonnegative()
}) // display-ready: names resolved server-side, codes only as stable keys
export type EconomyCargoEntry = z.infer<typeof economyCargoEntrySchema>

/**
 * Trade response shape (TZ §8.2) — `{ operationId, walletBalance, cargo }`.
 * Shared between the backend service gate and the client API surface so both
 * validate against ONE contract.
 */
export const economyTradeResponseSchema = z
    .object({
        operationId: economyUuidV7Schema,
        walletBalance: z.number(),
        cargo: z.array(economyCargoEntrySchema)
    })
    .strict()
export type EconomyTradeResponse = z.infer<typeof economyTradeResponseSchema>

export const economySummarySchema = z
    .object({
        wallet: z.object({ currency: z.string().min(1), balance: z.number() }),
        cargo: z.array(economyCargoEntrySchema),
        capacity: z.object({ usedKg: z.number(), maxKg: z.number() }),
        market: z.array(
            z.object({
                nomenclatureCode: z.string().min(1),
                nomenclatureName: z.string().min(1),
                side: economyMarketSideSchema,
                price: z.number(),
                unit: z.string().min(1)
            })
        ),
        operations: z.array(
            z.object({
                id: economyUuidV7Schema,
                type: z.string(),
                quantity: z.number(),
                total: z.number(),
                occurredAt: z.string()
            })
        ),
        atStation: z.boolean(),
        stationName: z.string().nullable()
    })
    .strict() // superset of TZ §8.1 (additive: names/atStation/stationName) — no TZ field removed
export type EconomySummary = z.infer<typeof economySummarySchema>
export type EconomyMarketEntry = z.infer<typeof economySummarySchema>['market'][number]
export type EconomyOperationEntry = z.infer<typeof economySummarySchema>['operations'][number]

/**
 * Mining fire request (mining TZ §8.2) — the client supplies ONLY the asteroid
 * code. `.strict()` is the FR-030 mechanism: any forbidden/server-owned client
 * field (quantity/mass/price/remaining/cargo/…) or unknown key fails validation
 * and the route maps it to 422 `MINING_INVALID_PAYLOAD`.
 */
export const economyMineRequestSchema = z
    .object({
        asteroidCode: z.string().min(1).max(64)
    })
    .strict()
export type EconomyMineRequest = z.infer<typeof economyMineRequestSchema>

export const economyMiningChunkSchema = z
    .object({
        id: z.string().min(1),
        massKg: z.number().positive(),
        scale: z.number().positive() // visual coefficient, not an economic value
    })
    .strict()
export type EconomyMiningChunk = z.infer<typeof economyMiningChunkSchema>

/**
 * Fire response (mining TZ §8.2) — `remainingQuantityKg` is rounded to 0.1 kg
 * server-side (TZ §8.1). The wallet echo proves `Mine` did not touch it.
 */
export const economyMineResponseSchema = z
    .object({
        operationId: economyUuidV7Schema,
        asteroid: z
            .object({
                code: z.string().min(1),
                remainingQuantityKg: z.number().nonnegative(),
                status: z.enum(['Active', 'Depleted'])
            })
            .strict(),
        chunks: z.array(economyMiningChunkSchema).min(1).max(3),
        cargo: z.object({ usedKg: z.number().nonnegative(), capacityKg: z.number().positive() }).strict(),
        wallet: z.object({ balance: z.number(), currency: z.string().min(1) }).strict()
    })
    .strict()
export type EconomyMineResponse = z.infer<typeof economyMineResponseSchema>

export const economyAsteroidStateSchema = z
    .object({
        code: z.string().min(1),
        name: z.string().min(1),
        resourceCode: z.string().min(1),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }).strict(),
        scale: z.number().positive(),
        totalQuantityKg: z.number().positive(),
        remainingQuantityKg: z.number().nonnegative(), // rounded to 0.1 kg server-side (TZ §8.1)
        status: z.enum(['Active', 'Depleted']),
        visualVariant: z.number().int()
    })
    .strict()
export type EconomyAsteroidState = z.infer<typeof economyAsteroidStateSchema>

/**
 * Belt snapshot for `GET /runtime/economy/mining/state` (mining TZ §8.1).
 * `chunkVisualLifetimeMs` travels to the client so chunk visuals never hardcode
 * server constants; remainders arrive rounded to 0.1 kg.
 */
export const economyMiningStateSchema = z
    .object({
        asteroids: z.array(economyAsteroidStateSchema),
        constants: z
            .object({
                miningRadiusMeters: z.number().positive(),
                miningCooldownMs: z.number().positive(),
                chunkMassMinKg: z.number().positive(),
                chunkMassMaxKg: z.number().positive(),
                chunkVisualLifetimeMs: z.number().positive(),
                statePollMs: z.number().positive()
            })
            .strict()
    })
    .strict()
export type EconomyMiningState = z.infer<typeof economyMiningStateSchema>
