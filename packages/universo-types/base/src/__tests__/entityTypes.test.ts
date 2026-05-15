import { describe, expect, it } from 'vitest'

import {
    MetaEntityKind,
    BuiltinEntityKinds,
    getEnabledCapabilityKeys,
    getDefaultEntityResourceSurfaceDefinition,
    isBuiltinEntityKind,
    isLedgerSchemaCapableEntity,
    normalizeEntityResourceSurfaceDefinitions,
    resolveEntityResourceSurfaceTitle,
    supportsLedgerSchema,
    validateEntityResourceSurfacesAgainstCapabilities,
    validateCapabilityDependencies,
    buildEntitySettingKey,
    METAHUB_SETTINGS_REGISTRY,
    type EntityTypeCapabilities,
    METAHUB_MENU_ITEM_KINDS,
    type MetahubSnapshotFormatVersion
} from '../index'

describe('entity type contracts', () => {
    it('recognizes only the promoted entity metadata kinds', () => {
        expect(isBuiltinEntityKind(MetaEntityKind.OBJECT)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.SET)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.ENUMERATION)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.HUB)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.PAGE)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.LEDGER)).toBe(true)
        expect(isBuiltinEntityKind('custom_registry')).toBe(false)
        expect(Object.values(BuiltinEntityKinds)).toEqual(['object', 'set', 'enumeration', 'hub', 'page', 'ledger'])
        expect(Object.values(BuiltinEntityKinds)).not.toContain('document')
    })

    it('widens metahub snapshot format version to v3', () => {
        const version: MetahubSnapshotFormatVersion = 3

        expect(version).toBe(3)
    })

    it('uses generic section menu items for first-class entity sections', () => {
        expect(METAHUB_MENU_ITEM_KINDS).toEqual(['section', 'hub', 'link'])
        expect(METAHUB_MENU_ITEM_KINDS).not.toContain('page')
        expect(METAHUB_MENU_ITEM_KINDS).not.toContain('ledger')
    })

    it('exposes Page copy and delete settings through the shared entity settings registry', () => {
        expect(METAHUB_SETTINGS_REGISTRY).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: buildEntitySettingKey('page', 'allowCopy'), tab: 'page', defaultValue: true }),
                expect.objectContaining({ key: buildEntitySettingKey('page', 'allowDelete'), tab: 'page', defaultValue: true })
            ])
        )
    })

    it('exposes Ledger copy and delete settings through the shared entity settings registry', () => {
        expect(METAHUB_SETTINGS_REGISTRY).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: buildEntitySettingKey('ledger', 'allowCopy'), tab: 'ledger', defaultValue: true }),
                expect.objectContaining({ key: buildEntitySettingKey('ledger', 'allowDelete'), tab: 'ledger', defaultValue: true })
            ])
        )
    })

    it('reports missing component dependencies and lists enabled manifest keys', () => {
        const manifest: EntityTypeCapabilities = {
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: false,
            optionValues: false,
            fixedValues: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: { enabled: true },
            events: { enabled: true },
            scripting: false,
            blockContent: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: false,
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: false
        }

        expect(validateCapabilityDependencies(manifest)).toEqual([])
        expect(getEnabledCapabilityKeys(manifest)).toEqual(expect.arrayContaining(['dataSchema', 'records', 'actions', 'events']))
    })

    it('treats ledgerSchema as a generic component capability, not as a kind name', () => {
        const manifest: EntityTypeCapabilities = {
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: false,
            optionValues: false,
            fixedValues: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: false,
            events: false,
            scripting: false,
            blockContent: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: { enabled: true, prefix: 'obj' },
            identityFields: { enabled: true },
            recordLifecycle: { enabled: true },
            posting: false,
            ledgerSchema: {
                enabled: true,
                allowProjections: true,
                allowRegistrarPolicy: true,
                allowManualFacts: false,
                allowedModes: ['facts', 'balance']
            }
        }

        expect(supportsLedgerSchema(manifest)).toBe(true)
        expect(isLedgerSchemaCapableEntity(manifest)).toBe(true)
    })

    it('normalizes and validates resource surface contracts', () => {
        const surfaces = normalizeEntityResourceSurfaceDefinitions([
            {
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components',
                title: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Properties', version: 1, isActive: true },
                        ru: { content: 'Свойства', version: 1, isActive: true }
                    }
                },
                fallbackTitle: 'Components'
            }
        ])

        expect(surfaces).toHaveLength(1)
        expect(resolveEntityResourceSurfaceTitle(surfaces![0], { locale: 'ru' })).toBe('Свойства')
        expect(resolveEntityResourceSurfaceTitle(surfaces![0], { locale: 'de' })).toBe('Properties')

        validateEntityResourceSurfacesAgainstCapabilities(surfaces, {
            dataSchema: { enabled: true },
            records: false,
            treeAssignment: false,
            optionValues: false,
            constants: false,
            fixedValues: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: false,
            events: false,
            scripting: false,
            blockContent: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: false
        })
    })

    it('exposes shared default resource surface metadata by capability', () => {
        expect(getDefaultEntityResourceSurfaceDefinition('dataSchema')).toMatchObject({
            key: 'components',
            capability: 'dataSchema',
            routeSegment: 'components',
            fallbackTitle: 'components'
        })
        expect(getDefaultEntityResourceSurfaceDefinition('fixedValues')).toMatchObject({
            key: 'fixedValues',
            capability: 'fixedValues',
            routeSegment: 'fixed-values',
            fallbackTitle: 'fixedValues'
        })
        expect(getDefaultEntityResourceSurfaceDefinition('optionValues')).toMatchObject({
            key: 'optionValues',
            capability: 'optionValues',
            routeSegment: 'values',
            fallbackTitle: 'optionValues'
        })
    })

    it('rejects duplicate resource surface capabilities and component mismatches', () => {
        expect(() =>
            normalizeEntityResourceSurfaceDefinitions([
                { key: 'a', capability: 'dataSchema', routeSegment: 'a' },
                { key: 'b', capability: 'dataSchema', routeSegment: 'b' }
            ])
        ).toThrow(/duplicate capability/)

        expect(() =>
            validateEntityResourceSurfacesAgainstCapabilities(
                [{ key: 'components', capability: 'dataSchema', routeSegment: 'components' }],
                {
                    dataSchema: false,
                    records: false,
                    treeAssignment: false,
                    optionValues: false,
                    constants: false,
                    fixedValues: false,
                    hierarchy: false,
                    nestedCollections: false,
                    relations: false,
                    actions: false,
                    events: false,
                    scripting: false,
                    blockContent: false,
                    layoutConfig: false,
                    runtimeBehavior: false,
                    physicalTable: false
                }
            )
        ).toThrow(/requires enabled component/)
    })

    it('rejects malformed localized resource surface titles', () => {
        expect(() =>
            normalizeEntityResourceSurfaceDefinitions([
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    title: {
                        locales: {
                            en: { content: 'Properties' }
                        }
                    }
                }
            ])
        ).toThrow(/primary locale/)

        expect(() =>
            normalizeEntityResourceSurfaceDefinitions([
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    title: {
                        _primary: 'en',
                        locales: {
                            ru: { content: 'Свойства' }
                        }
                    }
                }
            ])
        ).toThrow(/primary locale entry/)

        expect(() =>
            normalizeEntityResourceSurfaceDefinitions([
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    title: {
                        _primary: 'en',
                        locales: {
                            en: { content: 42 }
                        }
                    }
                }
            ])
        ).toThrow(/string content/)
    })
})
