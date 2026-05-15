import { resolveSystemAppDefinitionSystemTableCapabilities, resolveSystemTableCapabilityOptions } from '../systemAppCapabilities'
import type { SystemAppDefinition, SystemAppStructureCapabilities } from '../types'

const createCapabilities = (overrides: Partial<SystemAppStructureCapabilities> = {}): SystemAppStructureCapabilities => ({
    appCoreTables: true,
    objectTables: true,
    documentTables: false,
    relationTables: true,
    settingsTables: true,
    layoutTables: false,
    widgetTables: false,
   componentValueTables: false,
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
        objectTables: true,
        relationTables: true,
        settingsTables: false
    }),
    targetStructureCapabilities: createCapabilities(),
    currentBusinessTables: [
        { kind: 'object', codename: 'metahubs', tableName: 'metahubs' },
        { kind: 'relation', codename: 'metahub_users', tableName: 'metahubs_users' }
    ],
    targetBusinessTables: [
        { kind: 'object', codename: 'metahubs', tableName: 'obj_metahubs' },
        { kind: 'relation', codename: 'metahub_users', tableName: 'rel_metahub_users' }
    ],
    migrations: [],
    repeatableSeeds: [],
    ...overrides
})

describe('resolveSystemTableCapabilityOptions', () => {
    it('enables attribute metadata for application-like objects and relations', () => {
        expect(resolveSystemTableCapabilityOptions(createCapabilities())).toEqual({
            includeComponents: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('keeps profile-like core schemas minimal when only app core and settings are enabled', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                    objectTables: false,
                    relationTables: false,
                    settingsTables: true
                })
            )
        ).toEqual({
            includeComponents: false,
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
            includeComponents: true,
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
            includeComponents: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('enables component values only for structures that explicitly need value tables', () => {
        expect(
            resolveSystemTableCapabilityOptions(
                createCapabilities({
                   componentValueTables: true
                })
            )
        ).toEqual({
            includeComponents: true,
            includeValues: true,
            includeLayouts: false,
            includeWidgets: false
        })
    })
})

describe('resolveSystemAppDefinitionSystemTableCapabilities', () => {
    it('uses target capabilities by default', () => {
        expect(resolveSystemAppDefinitionSystemTableCapabilities(createSystemAppDefinition())).toEqual({
            includeComponents: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('can resolve current capabilities for legacy fixed schemas', () => {
        expect(resolveSystemAppDefinitionSystemTableCapabilities(createSystemAppDefinition(), 'current')).toEqual({
            includeComponents: false,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })
})
