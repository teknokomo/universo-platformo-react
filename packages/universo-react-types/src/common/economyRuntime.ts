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
    'ECONOMY_POSTING_FAILED'
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
    ECONOMY_POSTING_FAILED: 500
} // TZ §8.4

export const economyTradeKindSchema = z.enum(['sell', 'buy'])

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
                side: economyTradeKindSchema,
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
