import { describe, expect, it } from 'vitest'

import {
    economyErrorCodeSchema,
    economyErrorStatusByCode,
    economyMineRequestSchema,
    economyMineResponseSchema,
    economyMiningStateSchema,
    economySummarySchema,
    economyTradeKindSchema,
    economyUuidV7Schema,
    ledgerConfigSchema
} from '../index'

const walletLedgerConfig = {
    mode: 'facts',
    mutationPolicy: 'appendOnly',
    periodicity: 'instant',
    sourcePolicy: 'registrar',
    registrarKinds: ['object'],
    fieldRoles: [
        { fieldCodename: 'WalletKey', role: 'dimension', required: true },
        { fieldCodename: 'Currency', role: 'dimension', required: true },
        { fieldCodename: 'Amount', role: 'resource', aggregate: 'sum', required: true },
        { fieldCodename: 'OccurredAt', role: 'component' },
        { fieldCodename: 'SourceObject', role: 'component' },
        { fieldCodename: 'SourceRow', role: 'component' },
        { fieldCodename: 'SourceLine', role: 'component' }
    ],
    projections: [
        { codename: 'walletBalance', kind: 'balance', dimensions: ['WalletKey', 'Currency'], resources: ['Amount'] },
        { codename: 'walletTurnover', kind: 'turnover', dimensions: ['WalletKey', 'Currency'], resources: ['Amount'], period: 'day' }
    ],
    idempotency: {
        keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
    }
}

const validEconomySummary = {
    wallet: { currency: 'CR', balance: 1250.5 },
    cargo: [{ nomenclatureCode: 'ore.iron', nomenclatureName: 'Iron ore', quantity: 12.5, unit: 't', massKg: 12500 }],
    capacity: { usedKg: 12500, maxKg: 50000 },
    market: [
        { nomenclatureCode: 'ore.iron', nomenclatureName: 'Iron ore', side: 'sell', price: 12.5, unit: 't' },
        { nomenclatureCode: 'fuel.cell', nomenclatureName: 'Fuel cell', side: 'buy', price: 40, unit: 'pcs' }
    ],
    operations: [
        { id: '018f6a2c-3f1a-7abc-9def-1a2b3c4d5e6f', type: 'sell', quantity: 5, total: 62.5, occurredAt: '2026-11-12T10:00:00.000Z' }
    ],
    atStation: true,
    stationName: 'Cargoterminal Prime'
}

describe('economy runtime contracts', () => {
    it('accepts the wallet-ledger economy register config (registrar sources, appendOnly facts, instant periodicity, day turnover projection)', () => {
        expect(ledgerConfigSchema.safeParse(walletLedgerConfig).success).toBe(true)
    })

    it('keeps registrarKinds a free-form string array (["ledger"] also parses — the register-kind restriction is enforced outside ledgerConfigSchema)', () => {
        expect(ledgerConfigSchema.safeParse({ ...walletLedgerConfig, registrarKinds: ['object'] }).success).toBe(true)
        expect(ledgerConfigSchema.safeParse({ ...walletLedgerConfig, registrarKinds: ['ledger'] }).success).toBe(true)
        expect(ledgerConfigSchema.safeParse({ ...walletLedgerConfig, registrarKinds: [] }).success).toBe(true)
        expect(ledgerConfigSchema.safeParse({ ...walletLedgerConfig, registrarKinds: [' '] }).success).toBe(false)
        expect(
            ledgerConfigSchema.safeParse({ ...walletLedgerConfig, registrarKinds: Array.from({ length: 33 }, () => 'object') }).success
        ).toBe(false)
    })

    it('keeps the types-local UUID v7 check on generated economy identifiers', () => {
        expect(economyUuidV7Schema.safeParse('018f6a2c-3f1a-7abc-9def-1a2b3c4d5e6f').success).toBe(true)
        expect(economyUuidV7Schema.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(false)
    })

    it('maps every economy error code to its TZ §8.4 HTTP status', () => {
        const codes = economyErrorCodeSchema.options
        expect(codes).toHaveLength(18) // 10 economy codes + 8 mining codes (TZ DOC-2026-006 §8.2)
        expect(Object.keys(economyErrorStatusByCode).sort()).toEqual([...codes].sort())
        expect(economyErrorStatusByCode.ECONOMY_NOT_AT_STATION).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_UNKNOWN_NOMENCLATURE).toBe(404)
        expect(economyErrorStatusByCode.ECONOMY_INVALID_QUANTITY).toBe(422)
        expect(economyErrorStatusByCode.ECONOMY_INSUFFICIENT_CARGO).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_INSUFFICIENT_FUNDS).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_CAPACITY_EXCEEDED).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_MARKET_DISABLED).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_IDEMPOTENCY_CONFLICT).toBe(409)
        expect(economyErrorStatusByCode.ECONOMY_IDEMPOTENCY_KEY_INVALID).toBe(400)
        expect(economyErrorStatusByCode.ECONOMY_POSTING_FAILED).toBe(500)
    })

    it('accepts a display-ready economy summary payload', () => {
        expect(economySummarySchema.safeParse(validEconomySummary).success).toBe(true)
    })

    it('rejects unknown keys on the economy summary payload', () => {
        expect(economySummarySchema.safeParse({ ...validEconomySummary, ownerKey: 'member-1' }).success).toBe(false)
        expect(economySummarySchema.safeParse({ ...validEconomySummary, walletId: 'wallet-1' }).success).toBe(false)
    })

    it('accepts the mine trade kind alongside sell and buy', () => {
        expect(economyTradeKindSchema.safeParse('mine').success).toBe(true)
        expect(economyTradeKindSchema.safeParse('sell').success).toBe(true)
        expect(economyTradeKindSchema.safeParse('trade').success).toBe(false)
    })

    it('maps every mining error code to its mining TZ §8.2 HTTP status', () => {
        expect(economyErrorStatusByCode.MINING_INVALID_TARGET).toBe(400)
        expect(economyErrorStatusByCode.MINING_TARGET_NOT_FOUND).toBe(404)
        expect(economyErrorStatusByCode.MINING_NO_FLIGHT_SESSION).toBe(409)
        expect(economyErrorStatusByCode.MINING_OUT_OF_RANGE).toBe(409)
        expect(economyErrorStatusByCode.MINING_DEPLETED).toBe(409)
        expect(economyErrorStatusByCode.MINING_COOLDOWN).toBe(409)
        expect(economyErrorStatusByCode.MINING_INVALID_PAYLOAD).toBe(422)
        expect(economyErrorStatusByCode.MINING_POSTING_FAILED).toBe(500)
    })

    it('rejects forbidden and unknown client fields on the fire request (FR-030)', () => {
        expect(economyMineRequestSchema.safeParse({ asteroidCode: 'AST-01' }).success).toBe(true)
        expect(economyMineRequestSchema.safeParse({ asteroidCode: 'AST-01', quantity: 5 }).success).toBe(false)
        expect(economyMineRequestSchema.safeParse({ asteroidCode: 'AST-01', remainingQuantityKg: 12 }).success).toBe(false)
        expect(economyMineRequestSchema.safeParse({ asteroidCode: 'AST-01', mass: 2, price: 3 }).success).toBe(false)
        expect(economyMineRequestSchema.safeParse({}).success).toBe(false)
        expect(economyMineRequestSchema.safeParse({ asteroidCode: '' }).success).toBe(false)
    })

    it('validates the fire response shape and chunk bounds', () => {
        const response = {
            operationId: '018f6a2c-3f1a-7abc-9def-1a2b3c4d5e6f',
            asteroid: { code: 'AST-01', remainingQuantityKg: 117.9, status: 'Active' },
            chunks: [{ id: 'chunk-1', massKg: 2.1, scale: 0.73 }],
            cargo: { usedKg: 12.1, capacityKg: 40 },
            wallet: { balance: 1000, currency: 'CR' }
        }
        expect(economyMineResponseSchema.safeParse(response).success).toBe(true)
        expect(economyMineResponseSchema.safeParse({ ...response, chunks: [] }).success).toBe(false)
        expect(
            economyMineResponseSchema.safeParse({
                ...response,
                chunks: [...response.chunks, response.chunks[0], response.chunks[0], response.chunks[0]]
            }).success
        ).toBe(false)
        expect(
            economyMineResponseSchema.safeParse({ ...response, asteroid: { ...response.asteroid, remainingQuantityKg: -1 } }).success
        ).toBe(false)
        expect(economyMineResponseSchema.safeParse({ ...response, operationId: 'not-a-uuid' }).success).toBe(false)
    })

    it('validates the belt state payload and its constants', () => {
        const state = {
            asteroids: [
                {
                    code: 'AST-01',
                    name: 'Asteroid A-01',
                    resourceCode: 'ORE',
                    position: { x: 36, y: 2, z: -26 },
                    scale: 7,
                    totalQuantityKg: 120,
                    remainingQuantityKg: 112.4,
                    status: 'Active',
                    visualVariant: 1
                }
            ],
            constants: {
                miningRadiusMeters: 80,
                miningCooldownMs: 350,
                chunkMassMinKg: 0.8,
                chunkMassMaxKg: 3.2,
                chunkVisualLifetimeMs: 900,
                statePollMs: 2000
            }
        }
        expect(economyMiningStateSchema.safeParse(state).success).toBe(true)
        expect(economyMiningStateSchema.safeParse({ ...state, asteroids: [] }).success).toBe(true)
        expect(
            economyMiningStateSchema.safeParse({ ...state, constants: { ...state.constants, chunkVisualLifetimeMs: undefined } }).success
        ).toBe(false)
        expect(economyMiningStateSchema.safeParse({ ...state, asteroids: [{ ...state.asteroids[0], status: 'Exploded' }] }).success).toBe(
            false
        )
    })
})
