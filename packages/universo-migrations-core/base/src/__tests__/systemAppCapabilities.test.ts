import { resolveSystemAppDefinitionSystemTableCapabilities, resolveSystemTableCapabilityOptions } from '../systemAppCapabilities'
import type { SystemAppDefinition, SystemAppStructureCapabilities } from '../types'

const createCapabilities = (overrides: Partial<SystemAppStructureCapabilities> = {}): SystemAppStructureCapabilities => ({
    appCoreTables: true,
    catalogTables: true,
    documentTables: false,
    relationTables: true,
    settingsTables: true,
    layoutTables: false,
    widgetTables: false,
    attributeValueTables: false,
    ...overrides
})

const createSystemAppDefinition = (overrides: Partial<SystemAppDefinition> = {}): SystemAppDefinition => ({
    manifestVersion: 1,
    key: 'metahubs',
    displayName: 'Metahubs',
    ownerPackage: '@universo/metahubs-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'metahubs'
    },
    runtimeCapabilities: {
        supportsPublicationSync: true,
        supportsTemplateVersions: true,
        usesCurrentUiShell: 'universo-template-mui'
    },
    currentStorageModel: 'legacy_fixed',
    targetStorageModel: 'application_like',
    currentStructureCapabilities: createCapabilities({
        appCoreTables: false,
        catalogTables: true,
        relationTables: true,
        settingsTables: false
    }),
    targetStructureCapabilities: createCapabilities(),
    currentBusinessTables: [
        { kind: 'catalog', codename: 'metahubs', tableName: 'metahubs' },
        { kind: 'relation', codename: 'metahub_users', tableName: 'metahubs_users' }
    ],
    targetBusinessTables: [
        { kind: 'catalog', codename: 'metahubs', tableName: 'cat_metahubs' },
        { kind: 'relation', codename: 'metahub_users', tableName: 'rel_metahub_users' }
    ],
    migrations: [],
    repeatableSeeds: [],
    ...overrides
})

describe('resolveSystemTableCapabilityOptions', () => {
    it('enables attribute metadata for application-like catalogs and relations', () => {
        expect(resolveSystemTableCapabilityOptions(createCapabilities())).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('keeps profile-like core schemas minimal when only app core and settings are enabled', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                    catalogTables: false,
                    relationTables: false,
                    settingsTables: true
                })
            )
        ).toEqual({
            includeAttributes: false,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('enables layouts and widgets only when the corresponding capabilities are present', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                    layoutTables: true,
                    widgetTables: true
                })
            )
        ).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: true,
            includeWidgets: true
        })
    })

    it('disables widgets when layouts are not available even if widget capability is requested', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                    layoutTables: false,
                    widgetTables: true
                })
            )
        ).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('enables attribute values only for structures that explicitly need value tables', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                    attributeValueTables: true
                })
            )
        ).toEqual({
            includeAttributes: true,
            includeValues: true,
            includeLayouts: false,
            includeWidgets: false
        })
    })
})

describe('resolveSystemAppDefinitionSystemTableCapabilities', () => {
    it('uses target capabilities by default', () => {
        expect(resolveSystemAppDefinitionSystemTableCapabilities(createSystemAppDefinition())).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('can resolve current capabilities for legacy fixed schemas', () => {
        expect(resolveSystemAppDefinitionSystemTableCapabilities(createSystemAppDefinition(), 'current')).toEqual({
            includeAttributes: false,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })
})
