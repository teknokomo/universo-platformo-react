import { describe, expect, it } from 'vitest'

import { economyErrorCodeSchema, economyErrorStatusByCode, economySummarySchema, economyUuidV7Schema, ledgerConfigSchema } from '../index'

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
        expect(codes).toHaveLength(10)
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
})
