import { describe, expect, it } from 'vitest'

import { buildEntityTypePresetFormPatch, isEntityTypePresetManifest } from '../entityTypePreset'

const presetManifest = {
    $schema: 'entity-type-preset/v1' as const,
    codename: 'object',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: {
        _schema: '1' as const,
        _primary: 'en',
        locales: {
            en: {
                content: 'Objects',
                version: 1,
                isActive: true,
                createdAt: '2026-04-09T00:00:00.000Z',
                updatedAt: '2026-04-09T00:00:00.000Z'
            },
            ru: {
                content: 'Каталоги',
                version: 1,
                isActive: true,
                createdAt: '2026-04-09T00:00:00.000Z',
                updatedAt: '2026-04-09T00:00:00.000Z'
            }
        }
    },
    entityType: {
        kindKey: 'object',
        codename: {
            _schema: '1' as const,
            _primary: 'en',
            locales: {
                en: {
                    content: 'ObjectCollectionEntity',
                    version: 1,
                    isActive: true,
                    createdAt: '2026-04-09T00:00:00.000Z',
                    updatedAt: '2026-04-09T00:00:00.000Z'
                }
            }
        },
        capabilities: {
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: { enabled: true },
            optionValues: false,
            fixedValues: false,
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
            sidebarOrder: 20,
            resourceSurfaces: [
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    titleKey: 'metahubs:components.resourceTabTitle',
                    fallbackTitle: 'Components'
                }
            ],
            nameKey: 'metahubs:objects.title',
            descriptionKey: 'Standard object preset'
        },
        presentation: {
            name: {
                _schema: '1' as const,
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Objects',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    },
                    ru: {
                        content: 'Каталоги',
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
                        content: 'Standard object preset',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-04-09T00:00:00.000Z',
                        updatedAt: '2026-04-09T00:00:00.000Z'
                    },
                    ru: {
                        content: 'Стандартный пресет каталога',
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
            kindKey: 'object',
            iconName: 'IconDatabase',
            tabs: ['general', 'hubs', 'layout', 'scripts'],
            customTabsInput: '',
            sidebarSection: 'objects',
            sidebarOrder: 20,
            resourceSurfaces: [
                {
                    key: 'components',
                    capability: 'dataSchema',
                    routeSegment: 'components',
                    titleKey: 'metahubs:components.resourceTabTitle',
                    fallbackTitle: 'Components'
                }
            ],
            codenameTouched: false,
            published: true
        })
        expect((patch.nameVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.en?.content).toBe(
            'Objects'
        )
        expect((patch.nameVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.ru?.content).toBe(
            'Каталоги'
        )
        expect((patch.descriptionVlc as { locales?: { en?: { content?: string }; ru?: { content?: string } } }).locales?.ru?.content).toBe(
            'Стандартный пресет каталога'
        )
        expect(patch.capabilities).toMatchObject({
            physicalTable: { enabled: true, prefix: 'catx' }
        })
    })
})
