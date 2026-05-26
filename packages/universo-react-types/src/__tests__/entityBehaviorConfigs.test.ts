import { describe, expect, it } from 'vitest'

import {
    catalogBehaviorSchema,
    accountChartBehaviorSchema,
    calculationTypeGraphSchema,
    dynamicCharacteristicSchema,
    documentBehaviorSchema,
    documentPostingSchema,
    entityBehaviorConfigSchema,
    journalBehaviorSchema,
    registerBehaviorSchema,
    singleValueBehaviorSchema,
    validateEntityBehaviorReferences
} from '../index'

describe('typed entity behavior configs', () => {
    it('normalizes first-class single-value constants without Set/fixedValues leakage', () => {
        expect(
            singleValueBehaviorSchema.parse({
                kind: 'singleValue',
                dataType: 'NUMBER'
            })
        ).toMatchObject({
            kind: 'singleValue',
            dataType: 'NUMBER',
            scope: 'workspace',
            periodicity: 'none',
            allowRuntimeEdit: true,
            auditChanges: true
        })

        expect(
            singleValueBehaviorSchema.safeParse({
                kind: 'singleValue',
                dataType: 'JSON'
            }).success
        ).toBe(false)
    })

    it('keeps catalog and document behavior as strict typed config sections', () => {
        const catalog = catalogBehaviorSchema.parse({
            kind: 'catalog',
            code: {
                enabled: true,
                autoNumbering: true,
                unique: true,
                periodicity: 'year'
            },
            hierarchy: {
                mode: 'groups-and-items',
                ownerSubordination: true
            },
            predefinedRows: [{ codename: 'MainWarehouse', presentation: 'Main warehouse' }]
        })

        expect(catalog.hierarchy.mode).toBe('groups-and-items')
        expect(
            catalogBehaviorSchema.safeParse({
                ...catalog,
                recordBehavior: { mode: 'reference' }
            }).success
        ).toBe(false)

        const document = documentBehaviorSchema.parse({
            kind: 'document',
            number: {
                enabled: true,
                autoNumbering: true,
                unique: true,
                periodicity: 'month',
                minLength: 8
            },
            date: {},
            lifecycle: {},
            immutability: 'posted'
        })

        expect(document.date.fieldCodename).toBe('Date')
        expect(document.lifecycle.states.map((state) => state.codename)).toEqual(['Draft', 'Posted', 'Voided'])
    })

    it('validates document posting references fail-closed', () => {
        const config = documentPostingSchema.parse({
            kind: 'documentPosting',
            movements: [
                {
                    targetRegisterCodename: 'StockBalance',
                    sourceTableCodename: 'Goods',
                    directionFieldCodename: 'Direction',
                    dimensionMappings: {
                        Warehouse: 'Warehouse'
                    },
                    resourceMappings: {
                        Quantity: 'Qty'
                    }
                }
            ],
            moduleCodename: 'PostGoodsReceipt'
        })

        expect(
            validateEntityBehaviorReferences(config, {
                registers: ['StockBalance'],
                modules: ['PostGoodsReceipt'],
                sourceTables: ['Goods'],
                fields: ['Warehouse', 'Qty']
            })
        ).toEqual([])

        expect(
            validateEntityBehaviorReferences(config, {
                registers: [],
                modules: [],
                sourceTables: [],
                fields: ['Warehouse']
            })
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'TARGET_REGISTER_NOT_FOUND' }),
                expect.objectContaining({ code: 'MODULE_NOT_FOUND' }),
                expect.objectContaining({ code: 'SOURCE_TABLE_NOT_FOUND' }),
                expect.objectContaining({ code: 'FIELD_MAPPING_NOT_FOUND' })
            ])
        )
    })

    it('validates journal and register references without a template-specific branch', () => {
        const journal = journalBehaviorSchema.parse({
            kind: 'journal',
            sources: [{ documentCodename: 'GoodsReceipt' }]
        })
        expect(validateEntityBehaviorReferences(journal, { documents: ['GoodsReceipt'] })).toEqual([])
        expect(validateEntityBehaviorReferences(journal, { documents: [] })).toEqual([
            { path: ['sources', 0, 'documentCodename'], code: 'JOURNAL_SOURCE_NOT_FOUND' }
        ])

        const register = registerBehaviorSchema.parse({
            kind: 'register',
            mode: 'balance',
            projections: [{ codename: 'ByWarehouse', dimensions: ['Warehouse'], resources: ['Quantity'] }]
        })
        expect(validateEntityBehaviorReferences(register, { projections: ['ByWarehouse'] })).toEqual([])
        expect(validateEntityBehaviorReferences(register, { projections: ['ByItem'] })).toEqual([
            { path: ['projections', 0, 'codename'], code: 'PROJECTION_NOT_FOUND' }
        ])
    })

    it('validates accounting, dynamic characteristic, and calculation preview contracts', () => {
        const accountChart = accountChartBehaviorSchema.parse({
            kind: 'accountChart',
            subcontoCharacteristicChartCodename: 'SubcontoTypes'
        })
        expect(accountChart.supportsCurrency).toBe(true)
        expect(validateEntityBehaviorReferences(accountChart, { charts: ['SubcontoTypes'] })).toEqual([])
        expect(validateEntityBehaviorReferences(accountChart, { charts: [] })).toEqual([
            { path: ['subcontoCharacteristicChartCodename'], code: 'CHART_NOT_FOUND' }
        ])

        expect(
            dynamicCharacteristicSchema.parse({
                kind: 'dynamicCharacteristic',
                allowedDataTypes: ['STRING', 'NUMBER', 'REF'],
                valueCatalogCodename: 'Products'
            })
        ).toMatchObject({
            kind: 'dynamicCharacteristic',
            allowedDataTypes: ['STRING', 'NUMBER', 'REF'],
            valueCatalogCodename: 'Products'
        })

        const calculationTypeGraph = calculationTypeGraphSchema.parse({
            kind: 'calculationTypeGraph',
            baseTypes: ['Salary'],
            displacementTypes: ['Absence'],
            leadingTypes: ['Bonus']
        })
        expect(calculationTypeGraph.baseTypes).toEqual(['Salary'])
        expect(
            calculationTypeGraphSchema.safeParse({
                ...calculationTypeGraph,
                templateCodename: '1c-compatible'
            }).success
        ).toBe(false)
    })

    it('rejects unknown behavior kinds and unknown keys', () => {
        expect(entityBehaviorConfigSchema.safeParse({ kind: '1c-only' }).success).toBe(false)
        expect(
            registerBehaviorSchema.safeParse({
                kind: 'register',
                mode: 'facts',
                templateCodename: '1c-compatible'
            }).success
        ).toBe(false)
    })
})
