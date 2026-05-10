import { describe, expect, it } from 'vitest'

import {
    DEFAULT_LEDGER_CONFIG,
    FieldDefinitionDataType,
    ledgerConfigSchema,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    validateLedgerConfigReferences
} from '../index'

describe('ledger contracts', () => {
    it('normalizes missing config to the conservative default', () => {
        expect(normalizeLedgerConfig(null)).toEqual(DEFAULT_LEDGER_CONFIG)
        expect(normalizeLedgerConfigFromConfig({})).toEqual(DEFAULT_LEDGER_CONFIG)
    })

    it('preserves valid partial config and trims author input', () => {
        const normalized = normalizeLedgerConfig({
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            sourcePolicy: 'registrar',
            registrarKinds: [' catalog ', 'document'],
            fieldRoles: [
                { fieldCodename: ' Learner ', role: 'dimension', required: true },
                { fieldCodename: ' ProgressDelta ', role: 'resource', aggregate: 'sum' }
            ],
            projections: [
                {
                    codename: ' ProgressByLearner ',
                    kind: 'balance',
                    dimensions: [' Learner '],
                    resources: [' ProgressDelta '],
                    period: 'day'
                }
            ],
            idempotency: {
                keyFields: [' SourceObjectId ', ' SourceRowId ']
            }
        })

        expect(normalized).toEqual({
            ...DEFAULT_LEDGER_CONFIG,
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            sourcePolicy: 'registrar',
            registrarKinds: ['catalog', 'document'],
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension', required: true },
                { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum' }
            ],
            projections: [
                {
                    codename: 'ProgressByLearner',
                    kind: 'balance',
                    dimensions: ['Learner'],
                    resources: ['ProgressDelta'],
                    period: 'day'
                }
            ],
            idempotency: {
                keyFields: ['SourceObjectId', 'SourceRowId']
            }
        })
        expect(ledgerConfigSchema.parse(normalized)).toEqual(normalized)
    })

    it('rejects unknown keys at the boundary', () => {
        expect(() => normalizeLedgerConfig({ mode: 'facts', unsafe: true })).toThrow()
        expect(() => normalizeLedgerConfig({ fieldRoles: [{ fieldCodename: 'Amount', role: 'resource', extra: true }] })).toThrow()
    })

    it('validates field references, duplicate roles, projections, idempotency, and resource types', () => {
        const config = normalizeLedgerConfig({
            effectiveDateField: 'EffectiveAt',
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension' },
                { fieldCodename: 'Learner', role: 'attribute' },
                { fieldCodename: 'Status', role: 'resource', aggregate: 'sum' },
                { fieldCodename: 'Missing', role: 'resource' }
            ],
            projections: [
                { codename: 'Progress', kind: 'balance', dimensions: ['Learner', 'Status'], resources: ['Learner', 'MissingResource'] },
                { codename: 'Progress', kind: 'timeline', dimensions: ['MissingDimension'], resources: [] }
            ],
            idempotency: {
                keyFields: ['SourceRowId', 'MissingKey']
            }
        })

        const errors = validateLedgerConfigReferences({
            config,
            fields: [
                { codename: 'Learner', dataType: FieldDefinitionDataType.REF },
                { codename: 'Status', dataType: FieldDefinitionDataType.STRING },
                { codename: 'SourceRowId', dataType: FieldDefinitionDataType.STRING }
            ]
        })

        expect(errors.map((error) => error.code)).toEqual(
            expect.arrayContaining([
                'DUPLICATE_FIELD_ROLE',
                'RESOURCE_REQUIRES_NUMBER',
                'FIELD_NOT_FOUND',
                'PROJECTION_DIMENSION_NOT_CONFIGURED',
                'PROJECTION_FIELD_NOT_FOUND',
                'PROJECTION_RESOURCE_NOT_CONFIGURED',
                'DUPLICATE_PROJECTION_CODENAME',
                'IDEMPOTENCY_FIELD_NOT_FOUND',
                'EFFECTIVE_DATE_FIELD_NOT_FOUND'
            ])
        )
    })

    it('accepts physical snake-case field aliases for ledger idempotency keys', () => {
        const config = normalizeLedgerConfig({
            idempotency: {
                keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
            }
        })

        const errors = validateLedgerConfigReferences({
            config,
            fields: [
                { codename: 'SourceObjectId', dataType: FieldDefinitionDataType.STRING },
                { codename: 'SourceRowId', dataType: FieldDefinitionDataType.STRING },
                { codename: 'SourceLineId', dataType: FieldDefinitionDataType.STRING }
            ]
        })

        expect(errors).toEqual([])
    })
})
