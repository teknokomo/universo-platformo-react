const mockGetPoolExecutor = jest.fn()

jest.mock('@universo-react/database', () => {
    const actual = jest.requireActual('@universo-react/database')
    return {
        __esModule: true,
        ...actual,
        getPoolExecutor: () => mockGetPoolExecutor()
    }
})

import { alignPlayCanvasRuntimeManifestBindings, attachLayoutsToSnapshot } from '../../domains/shared/snapshotLayouts'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'

type MockPoolExecutor = {
    query: jest.Mock<Promise<unknown[]>, [string, unknown[]]>
}

const createPoolExecutor = (): MockPoolExecutor => ({
    query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('_mhb_layouts')) {
            return [
                {
                    id: 'layout-global-active',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Global active' },
                    description: null,
                    config: { showHeader: true },
                    is_active: true,
                    is_default: true,
                    sort_order: 0
                },
                {
                    id: 'layout-global-inactive',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Global inactive' },
                    description: null,
                    config: { showHeader: false },
                    is_active: false,
                    is_default: false,
                    sort_order: 1
                },
                {
                    id: 'layout-object-active',
                    scope_entity_id: 'object-1',
                    base_layout_id: 'layout-global-active',
                    template_key: 'dashboard',
                    name: { en: 'Object active' },
                    description: null,
                    config: { showHeader: false },
                    is_active: true,
                    is_default: true,
                    sort_order: 0
                },
                {
                    id: 'layout-object-inactive',
                    scope_entity_id: 'object-2',
                    base_layout_id: 'layout-global-inactive',
                    template_key: 'dashboard',
                    name: { en: 'Object inactive' },
                    description: null,
                    config: { showHeader: true },
                    is_active: false,
                    is_default: false,
                    sort_order: 1
                }
            ]
        }

        if (sql.includes('information_schema.tables') && params[1] === '_mhb_widgets') {
            return [{ exists: true }]
        }

        if (sql.includes('_mhb_widgets')) {
            return [
                {
                    id: 'widget-global-active',
                    layout_id: 'layout-global-active',
                    zone: 'left',
                    widget_key: 'menuWidget',
                    sort_order: 1,
                    config: { showTitle: true },
                    is_active: true
                },
                {
                    id: 'widget-global-inactive',
                    layout_id: 'layout-global-inactive',
                    zone: 'right',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: {},
                    is_active: true
                },
                {
                    id: 'widget-object-active',
                    layout_id: 'layout-object-active',
                    zone: 'top',
                    widget_key: 'statsOverview',
                    sort_order: 1,
                    config: {},
                    is_active: true
                },
                {
                    id: 'widget-object-inactive',
                    layout_id: 'layout-object-inactive',
                    zone: 'bottom',
                    widget_key: 'infoCard',
                    sort_order: 2,
                    config: {},
                    is_active: false
                }
            ]
        }

        if (sql.includes('information_schema.tables') && params[1] === '_mhb_layout_widget_overrides') {
            return [{ exists: true }]
        }

        if (sql.includes('_mhb_layout_widget_overrides')) {
            return [
                {
                    id: 'override-active',
                    layout_id: 'layout-object-active',
                    base_widget_id: 'widget-global-active',
                    zone: 'center',
                    sort_order: 2,
                    config: { ignored: true },
                    is_active: true,
                    is_deleted_override: false
                },
                {
                    id: 'override-inactive',
                    layout_id: 'layout-object-inactive',
                    base_widget_id: 'widget-global-inactive',
                    zone: 'left',
                    sort_order: 1,
                    config: null,
                    is_active: false,
                    is_deleted_override: false
                },
                {
                    id: 'override-orphan',
                    layout_id: 'layout-missing',
                    base_widget_id: 'widget-global-active',
                    zone: 'right',
                    sort_order: 9,
                    config: null,
                    is_active: true,
                    is_deleted_override: false
                }
            ]
        }

        throw new Error(`Unexpected query: ${sql}`)
    })
})

describe('attachLayoutsToSnapshot', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('exports the full design-time layout set and keeps override rows scoped to exported entity layouts', async () => {
        const poolExecutor = createPoolExecutor()
        mockGetPoolExecutor.mockReturnValue(poolExecutor)

        const schemaService = {
            ensureSchema: jest.fn(async () => 'mhb_018f8a787b8f7c1da111222233334444_b1')
        }

        const snapshot = {} as MetahubSnapshot

        await attachLayoutsToSnapshot({
            schemaService: schemaService as any,
            snapshot,
            metahubId: 'metahub-1',
            userId: 'user-1'
        })

        expect(schemaService.ensureSchema).toHaveBeenCalledWith('metahub-1', 'user-1')

        expect(snapshot.layouts).toEqual([
            expect.objectContaining({ id: 'layout-global-active', isActive: true, isDefault: true }),
            expect.objectContaining({ id: 'layout-global-inactive', isActive: false, isDefault: false })
        ])

        expect(snapshot.scopedLayouts).toEqual([
            expect.objectContaining({ id: 'layout-object-active', scopeEntityId: 'object-1', baseLayoutId: 'layout-global-active' }),
            expect.objectContaining({
                id: 'layout-object-inactive',
                scopeEntityId: 'object-2',
                baseLayoutId: 'layout-global-inactive'
            })
        ])

        expect(snapshot.defaultLayoutId).toBe('layout-global-active')
        expect(snapshot.layoutConfig).toEqual({ showHeader: true })

        expect(snapshot.layoutZoneWidgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'widget-global-active', layoutId: 'layout-global-active' }),
                expect.objectContaining({ id: 'widget-global-inactive', layoutId: 'layout-global-inactive' }),
                expect.objectContaining({ id: 'widget-object-active', layoutId: 'layout-object-active' }),
                expect.objectContaining({ id: 'widget-object-inactive', layoutId: 'layout-object-inactive', isActive: false })
            ])
        )

        expect(snapshot.layoutWidgetOverrides).toEqual([
            expect.objectContaining({
                id: 'override-active',
                layoutId: 'layout-object-active',
                baseWidgetId: 'widget-global-active',
                config: null
            }),
            expect.objectContaining({
                id: 'override-inactive',
                layoutId: 'layout-object-inactive',
                baseWidgetId: 'widget-global-inactive',
                isActive: false
            })
        ])
    })
})

describe('alignPlayCanvasRuntimeManifestBindings', () => {
    const editorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`

    it('updates layout widget runtime manifest checksums to the final publication manifest checksum', () => {
        const snapshot = {
            version: 1,
            generatedAt: '2026-06-10T00:00:00.000Z',
            metahubId: 'metahub-1',
            entities: {},
            playcanvasRuntimeManifests: [
                {
                    schemaVersion: '1',
                    projectId: 'project-1',
                    sceneId: 'scene-1',
                    checksum: 'final-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                }
            ],
            layoutConfig: {
                nested: {
                    runtimeManifest: {
                        projectId: 'project-1',
                        sceneId: 'scene-1',
                        checksum: 'stale-checksum'
                    }
                }
            },
            layoutZoneWidgets: [
                {
                    id: 'widget-1',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 1,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'project-1',
                            sceneId: 'scene-1',
                            checksum: 'stale-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                },
                {
                    id: 'widget-2',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 2,
                    config: {
                        runtimeManifest: {
                            projectId: 'project-missing',
                            sceneId: 'scene-missing',
                            checksum: 'keep-this-checksum'
                        }
                    },
                    isActive: true
                }
            ],
            layoutWidgetOverrides: [
                {
                    id: 'override-1',
                    layoutId: 'layout-entity',
                    baseWidgetId: 'widget-1',
                    config: {
                        nested: [
                            {
                                runtimeManifest: {
                                    projectId: 'project-1',
                                    sceneId: 'scene-1',
                                    checksum: 'stale-checksum'
                                }
                            }
                        ]
                    }
                }
            ]
        } as unknown as MetahubSnapshot

        alignPlayCanvasRuntimeManifestBindings(snapshot)

        expect(snapshot.layoutConfig?.nested).toEqual({
            runtimeManifest: {
                projectId: 'project-1',
                sceneId: 'scene-1',
                checksum: 'final-checksum'
            }
        })
        expect(snapshot.layoutZoneWidgets?.[0]?.config.runtimeManifest).toMatchObject({
            projectId: 'project-1',
            sceneId: 'scene-1',
            checksum: 'final-checksum',
            failClosed: true
        })
        expect(snapshot.layoutZoneWidgets?.[1]?.config.runtimeManifest).toMatchObject({
            projectId: 'project-missing',
            sceneId: 'scene-missing',
            checksum: 'keep-this-checksum'
        })
        expect(snapshot.layoutWidgetOverrides?.[0]?.config).toEqual({
            nested: [
                {
                    runtimeManifest: {
                        projectId: 'project-1',
                        sceneId: 'scene-1',
                        checksum: 'final-checksum'
                    }
                }
            ]
        })
    })

    it('keeps only runtime manifests referenced by package defaults or active PlayCanvas widgets', () => {
        const snapshot = {
            version: 1,
            generatedAt: '2026-06-10T00:00:00.000Z',
            metahubId: 'metahub-1',
            entities: {},
            packages: [
                {
                    packageName: editorPackageName,
                    version: '0.1.0',
                    source: {
                        kind: 'workspace',
                        packageName: editorPackageName,
                        importName: 'PlayCanvasEditor',
                        upstreamPackageName: 'playcanvas-editor',
                        upstreamVersion: '0.1.0',
                        runtimeTargets: ['client']
                    },
                    config: {
                        schemaVersion: '1',
                        kind: 'display',
                        display: {
                            mode: 'embeddedIframe',
                            developmentUrl: null,
                            showArtifactOnlyNotice: true
                        },
                        playcanvasProject: {
                            defaultProjectId: 'authoring-project'
                        }
                    }
                }
            ],
            playcanvasRuntimeManifests: [
                {
                    schemaVersion: '1',
                    projectId: 'authoring-project',
                    sceneId: 'authoring-scene',
                    checksum: 'authoring-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                },
                {
                    schemaVersion: '1',
                    projectId: 'visual-lab-project',
                    sceneId: 'visual-lab-scene',
                    checksum: 'visual-lab-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                },
                {
                    schemaVersion: '1',
                    projectId: 'draft-design-time-project',
                    sceneId: 'draft-scene',
                    checksum: 'draft-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'widget-authoring',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 1,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'authoring-project',
                            sceneId: 'authoring-scene',
                            checksum: 'stale-authoring-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                },
                {
                    id: 'widget-visual-lab',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 2,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'visual-lab-project',
                            sceneId: 'visual-lab-scene',
                            checksum: 'stale-visual-lab-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                },
                {
                    id: 'widget-inactive-draft',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 3,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'draft-design-time-project',
                            sceneId: 'draft-scene',
                            checksum: 'draft-checksum',
                            failClosed: true
                        }
                    },
                    isActive: false
                }
            ]
        } as unknown as MetahubSnapshot

        alignPlayCanvasRuntimeManifestBindings(snapshot)

        expect(snapshot.playcanvasRuntimeManifests?.map((manifest) => manifest.projectId)).toEqual([
            'authoring-project',
            'visual-lab-project'
        ])
        expect(snapshot.layoutZoneWidgets?.[0]?.config.runtimeManifest).toMatchObject({
            projectId: 'authoring-project',
            sceneId: 'authoring-scene',
            checksum: 'authoring-checksum'
        })
        expect(snapshot.layoutZoneWidgets?.[1]?.config.runtimeManifest).toMatchObject({
            projectId: 'visual-lab-project',
            sceneId: 'visual-lab-scene',
            checksum: 'visual-lab-checksum'
        })
    })

    it('aligns stale null-scene widget bindings to the selected scene id from the final manifest', () => {
        const snapshot = {
            version: 1,
            generatedAt: '2026-06-10T00:00:00.000Z',
            metahubId: 'metahub-1',
            entities: {},
            playcanvasRuntimeManifests: [
                {
                    schemaVersion: '1',
                    projectId: 'project-1',
                    sceneId: 'scene-final',
                    checksum: 'final-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'widget-1',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 1,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'project-1',
                            sceneId: null,
                            checksum: 'stale-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                }
            ]
        } as unknown as MetahubSnapshot

        alignPlayCanvasRuntimeManifestBindings(snapshot)

        expect(snapshot.layoutZoneWidgets?.[0]?.config.runtimeManifest).toMatchObject({
            source: 'publishedManifest',
            projectId: 'project-1',
            sceneId: 'scene-final',
            checksum: 'final-checksum',
            failClosed: true
        })
    })

    it('does not rebind a missing explicit scene binding to another scene from the same project', () => {
        const snapshot = {
            version: 1,
            generatedAt: '2026-06-10T00:00:00.000Z',
            metahubId: 'metahub-1',
            entities: {},
            playcanvasRuntimeManifests: [
                {
                    schemaVersion: '1',
                    projectId: 'project-1',
                    sceneId: 'scene-a',
                    checksum: 'scene-a-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                },
                {
                    schemaVersion: '1',
                    projectId: 'project-1',
                    sceneId: 'scene-b',
                    checksum: 'scene-b-checksum',
                    assets: [],
                    scripts: [],
                    metadata: {}
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'widget-1',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 1,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'project-1',
                            sceneId: 'scene-deleted',
                            checksum: 'deleted-scene-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                },
                {
                    id: 'widget-2',
                    layoutId: 'layout-1',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 2,
                    config: {
                        runtimeManifest: {
                            source: 'publishedManifest',
                            projectId: 'project-1',
                            sceneId: null,
                            checksum: 'ambiguous-null-scene-checksum',
                            failClosed: true
                        }
                    },
                    isActive: true
                }
            ]
        } as unknown as MetahubSnapshot

        alignPlayCanvasRuntimeManifestBindings(snapshot)

        expect(snapshot.layoutZoneWidgets?.[0]?.config.runtimeManifest).toMatchObject({
            projectId: 'project-1',
            sceneId: 'scene-deleted',
            checksum: 'deleted-scene-checksum'
        })
        expect(snapshot.layoutZoneWidgets?.[1]?.config.runtimeManifest).toMatchObject({
            projectId: 'project-1',
            sceneId: null,
            checksum: 'ambiguous-null-scene-checksum'
        })
    })
})
