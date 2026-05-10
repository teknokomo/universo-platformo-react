import { describe, expect, it } from 'vitest'

import {
    DEFAULT_CATALOG_RECORD_BEHAVIOR,
    catalogRecordBehaviorSchema,
    isCatalogRecordBehaviorEnabled,
    normalizeCatalogRecordBehavior,
    normalizeCatalogRecordBehaviorFromConfig
} from '../index'

describe('record behavior contracts', () => {
    it('normalizes missing and invalid input to the safe default behavior', () => {
        expect(normalizeCatalogRecordBehavior(null)).toEqual(DEFAULT_CATALOG_RECORD_BEHAVIOR)
        expect(
            normalizeCatalogRecordBehavior({
                mode: 'unsafe',
                numbering: { enabled: 'yes', scope: 'tenant', periodicity: 'century', minLength: 99 },
                effectiveDate: { enabled: 'yes', defaultToNow: 'no' },
                lifecycle: { enabled: true, states: [{ codename: '', title: '' }] },
                posting: { mode: 'direct', targetLedgers: ['', 'ProgressLedger', 'ProgressLedger'] },
                immutability: 'locked'
            })
        ).toEqual({
            ...DEFAULT_CATALOG_RECORD_BEHAVIOR,
            numbering: {
                ...DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering,
                minLength: 32
            },
            lifecycle: {
                enabled: true,
                states: []
            },
            posting: {
                mode: 'disabled',
                targetLedgers: ['ProgressLedger']
            }
        })
    })

    it('preserves valid transactional behavior and removes duplicate list values', () => {
        const normalized = normalizeCatalogRecordBehaviorFromConfig({
            recordBehavior: {
                mode: 'transactional',
                numbering: {
                    enabled: true,
                    scope: 'workspace',
                    periodicity: 'year',
                    prefix: ' ENR- ',
                    minLength: '8'
                },
                effectiveDate: {
                    enabled: true,
                    fieldCodename: ' EnrolledAt ',
                    defaultToNow: true
                },
                lifecycle: {
                    enabled: true,
                    stateFieldCodename: ' EnrollmentStatus ',
                    states: [
                        { codename: 'Draft', title: 'Draft', isInitial: true },
                        { codename: 'Draft', title: 'Duplicate' },
                        { codename: 'Posted', title: 'Posted', isFinal: true }
                    ]
                },
                posting: {
                    mode: 'manual',
                    targetLedgers: ['ProgressLedger', 'ProgressLedger', 'ScoreLedger'],
                    scriptCodename: ' EnrollmentPostingScript '
                },
                immutability: 'posted'
            }
        })

        expect(normalized).toEqual({
            mode: 'transactional',
            numbering: {
                enabled: true,
                scope: 'workspace',
                periodicity: 'year',
                prefix: 'ENR-',
                minLength: 8
            },
            effectiveDate: {
                enabled: true,
                fieldCodename: 'EnrolledAt',
                defaultToNow: true
            },
            lifecycle: {
                enabled: true,
                stateFieldCodename: 'EnrollmentStatus',
                states: [
                    { codename: 'Draft', title: 'Draft', isInitial: true },
                    { codename: 'Posted', title: 'Posted', isFinal: true }
                ]
            },
            posting: {
                mode: 'manual',
                targetLedgers: ['ProgressLedger', 'ScoreLedger'],
                scriptCodename: 'EnrollmentPostingScript'
            },
            immutability: 'posted'
        })
        expect(catalogRecordBehaviorSchema.parse(normalized)).toEqual(normalized)
        expect(isCatalogRecordBehaviorEnabled(normalized)).toBe(true)
    })

    it('reports disabled behavior for the default reference configuration', () => {
        expect(isCatalogRecordBehaviorEnabled(DEFAULT_CATALOG_RECORD_BEHAVIOR)).toBe(false)
    })
})
