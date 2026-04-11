import { describe, expect, it } from 'vitest'

import { buildEntityTypePresetFormPatch, isEntityTypePresetManifest } from '../entityTypePreset'

const presetManifest = {
    $schema: 'entity-type-preset/v1' as const,
    codename: 'catalog-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: {
        _schema: '1' as const,
        _primary: 'en',
        locales: {
            en: {
                content: 'Catalogs V2',
                version: 1,
                isActive: true,
                createdAt: '2026-04-09T00:00:00.000Z',
                updatedAt: '2026-04-09T00:00:00.000Z'
            },
            ru: {
                content: 'Каталоги V2',
                version: 1,
                isActive: true,
                createdAt: '2026-04-09T00:00:00.000Z',
                updatedAt: '2026-04-09T00:00:00.000Z'
            }
        }
    },
    entityType: {
        kindKey: 'custom.catalog-v2',
        codename: {
            _schema: '1' as const,
            _primary: 'en',
            locales: {
                en: {
                    content: 'CatalogV2',
                    version: 1,
                    isActive: true,
                    createdAt: '2026-04-09T00:00:00.000Z',
                    updatedAt: '2026-04-09T00:00:00.000Z'
                }
            }
        },
        components: {
            dataSchema: { enabled: true },
            predefinedElements: { enabled: true },
            hubAssignment: { enabled: true },
            enumerationValues: false,
            constants: false,
            hierarchy: { enabled: true, supportsFolders: true },
            nestedCollections: false,
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            actions: { enabled: true },
            events: { enabled: true },
            scripting: { enabled: true },
            layoutConfig: { enabled: true },
            runtimeBehavior: { enabled: true },
            physicalTable: { enabled: true, prefix: 'catx' }
        },
        ui: {
            iconName: 'IconDatabase',
            tabs: ['general', 'hubs', 'layout', 'scripts'],
            sidebarSection: 'objects' as const,
            nameKey: 'Catalogs V2',
            descriptionKey: 'Catalog-compatible preset'
        },
        presentation: {
            name: {
                _schema: '1' as const,
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Catalogs V2',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    },
                    ru: {
                        content: 'Каталоги V2',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    }
                }
            },
            description: {
                _schema: '1' as const,
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Catalog-compatible preset',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    },
                    ru: {
                        content: 'Пресет каталога',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    }
                }
            }
        },
        config: {}
    }
}

describe('entityTypePreset helpers', () => {
    it('recognizes entity-type preset manifests', () => {
        expect(isEntityTypePresetManifest(presetManifest)).toBe(true)
        expect(isEntityTypePresetManifest({ $schema: 'metahub-template/v1' })).toBe(false)
    })

    it('builds form patches from preset manifests', () => {
        const patch = buildEntityTypePresetFormPatch(presetManifest, 'en', 'pascal-case', 'en-ru')

        expect(patch).toMatchObject({
            kindKey: 'custom.catalog-v2',
            iconName: 'IconDatabase',
            tabs: ['general', 'hubs', 'layout', 'scripts'],
            customTabsInput: '',
            sidebarSection: 'objects',
            codenameTouched: false,
            published: true
        })
        expect((patch.nameVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.en?.content).toBe(
            'Catalogs V2'
        )
        expect((patch.nameVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.ru?.content).toBe(
            'Каталоги V2'
        )
        expect((patch.descriptionVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.ru?.content).toBe(
            'Пресет каталога'
        )
        expect(patch.components).toMatchObject({
            physicalTable: { enabled: true, prefix: 'catx' }
        })
    })
})
