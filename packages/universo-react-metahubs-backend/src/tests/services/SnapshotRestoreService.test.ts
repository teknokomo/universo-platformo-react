const mockReadPlatformSystemComponentsPolicy = jest.fn(async () => ({
    publishEnabled: true,
    archiveEnabled: true,
    deleteEnabled: true
}))
const mockEnsureCatalogSystemComponentsSeed = jest.fn(async () => undefined)

jest.mock('../../domains/templates/services/systemComponentSeed', () => ({
    __esModule: true,
    readPlatformSystemComponentsPolicyWithKnex: mockReadPlatformSystemComponentsPolicy,
    ensureObjectSystemComponentsSeed: mockEnsureCatalogSystemComponentsSeed
}))

const mockResolveWidgetTableName = jest.fn(async () => '_mhb_widgets')

jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: mockResolveWidgetTableName
}))

const mockReplaceMetahubPackagesFromSnapshot = jest.fn(async () => 0)

jest.mock('../../persistence', () => ({
    __esModule: true,
    replaceMetahubPackagesFromSnapshot: (...args: unknown[]) => mockReplaceMetahubPackagesFromSnapshot(...args)
}))

import { SnapshotRestoreService } from '../../domains/metahubs/services/SnapshotRestoreService'
import { computeModuleSourceChecksum } from '../../domains/modules/services/ModuleSourceFileService'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'
import { createLocalizedContent } from '@universo-react/utils'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
    PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
    type PlayCanvasProjectSnapshotSection
} from '@universo-react/types'

function createMockKnex(
    options: {
        storageColumnsAvailable?: boolean
        existingModuleSourcePaths?: Array<string | { sourcePath: string; sourceChecksum?: string | null }>
    } = {}
) {
    const insertedRows: Record<string, unknown[]> = {}
    const deletedTables: string[] = []
    let idCounter = 1
    const existingModuleSourceRows = (options.existingModuleSourcePaths ?? []).map((candidate) =>
        typeof candidate === 'string'
            ? { source_path: candidate, source_checksum: 'old-source-checksum' }
            : { source_path: candidate.sourcePath, source_checksum: candidate.sourceChecksum ?? null }
    )

    const mockBuilder = {
        withSchema: jest.fn().mockReturnThis(),
        from: jest.fn().mockImplementation(function (this: any, tableName: string) {
            this._currentTable = tableName
            return this
        }),
        into: jest.fn().mockImplementation(function (this: any, tableName: string) {
            this._currentTable = tableName
            return this
        }),
        insert: jest.fn().mockImplementation(function (this: any, row: Record<string, unknown>) {
            const table = this._currentTable || '_unknown'
            if (!insertedRows[table]) insertedRows[table] = []
            insertedRows[table].push(row)
            return this
        }),
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockImplementation(() => Promise.resolve(existingModuleSourceRows)),
        first: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(1),
        raw: jest.fn((sql: string) => {
            if (sql.includes('information_schema.columns')) {
                return { rows: [{ available: options.storageColumnsAvailable === true }] }
            }
            return { raw: sql }
        }),
        returning: jest.fn().mockImplementation(function (this: any) {
            const newId = `generated-id-${idCounter++}`
            const table = this._currentTable || '_unknown'
            const tableRows = insertedRows[table]
            const lastInsertedRow = Array.isArray(tableRows) ? tableRows[tableRows.length - 1] : null
            if (lastInsertedRow && typeof lastInsertedRow === 'object') {
                ;(lastInsertedRow as Record<string, unknown>).id = newId
            }
            return Promise.resolve([{ id: newId }])
        }),
        del: jest.fn().mockImplementation(function (this: any) {
            const table = this._currentTable || '_unknown'
            deletedTables.push(table)
            return Promise.resolve(1)
        })
    }

    const trxFn = jest.fn().mockImplementation(async (cb: (trx: any) => Promise<void>) => {
        await cb(mockBuilder)
    })

    const knex = {
        raw: jest.fn(async () => ({ rows: [] })),
        transaction: trxFn
    }

    return { knex, mockBuilder, insertedRows, deletedTables, trxFn }
}

describe('SnapshotRestoreService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockReplaceMetahubPackagesFromSnapshot.mockResolvedValue(0)
    })

    const makeMinimalSnapshot = (overrides?: Partial<MetahubSnapshot>): MetahubSnapshot =>
        ({
            version: '1.0.0',
            metahubId: '00000000-0000-0000-0000-000000000001',
            entities: {
                'old-object-id': {
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'old-field-id',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayComponent: true,
                            presentation: { name: { en: 'Title' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ]
                }
            },
            fixedValues: {},
            optionValues: {},
            elements: {},
            systemFields: {},
            ...overrides
        } as unknown as MetahubSnapshot)

    const deletedTablesWithLayouts = ['_mhb_modules', '_mhb_widgets', '_mhb_layout_widget_overrides', '_mhb_layouts']
    const getCodenameText = (row: Record<string, unknown>): string => {
        const codename = row.codename
        if (typeof codename === 'string') return codename
        const locales = (codename as { locales?: Record<string, { content?: string }> } | undefined)?.locales
        return locales?.en?.content ?? ''
    }

    it('creates entities and components from a minimal snapshot', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'object',
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(insertedRows['_mhb_components']).toHaveLength(1)
        expect(insertedRows['_mhb_components']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING'
        })
        expect(mockEnsureCatalogSystemComponentsSeed).toHaveBeenCalled()
    })

    it('restores package dependencies from snapshot through the package registry', async () => {
        const { knex } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                packages: [
                    {
                        packageName: '@universo-react/colyseus-server',
                        version: '0.1.0',
                        source: {
                            kind: 'workspace',
                            packageName: '@universo-react/colyseus-server',
                            importName: '@universo-react/colyseus-server',
                            upstreamPackageName: '@colyseus/core',
                            upstreamVersion: '0.17.43',
                            runtimeTargets: ['server']
                        }
                    }
                ]
            }),
            'user-1'
        )

        expect(mockReplaceMetahubPackagesFromSnapshot).toHaveBeenCalledWith(expect.anything(), {
            metahubId: 'metahub-1',
            packages: [
                expect.objectContaining({
                    packageName: '@universo-react/colyseus-server',
                    version: '0.1.0'
                })
            ],
            userId: 'user-1'
        })
    })

    it('remaps PlayCanvas package default project pointers during snapshot restore', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        const sourceProjectId = '019e8afa-0000-7000-8000-000000000001'
        const playcanvasProjects: PlayCanvasProjectSnapshotSection = {
            schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
            projects: [
                {
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    id: sourceProjectId,
                    codename: createLocalizedContent('en', 'playcanvas_project'),
                    displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                    description: null,
                    packageRef: {
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        version: '0.1.0',
                        compatibilityStatus: 'compatible'
                    },
                    settings: {},
                    defaultSceneId: null,
                    publicationConfig: {}
                }
            ],
            scenes: [],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: []
        }

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                playcanvasProjects,
                packages: [
                    {
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        version: '0.1.0',
                        source: {
                            kind: 'workspace',
                            packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                            importName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                            upstreamPackageName: 'playcanvas/editor',
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
                                defaultProjectId: sourceProjectId
                            }
                        }
                    }
                ]
            }),
            'user-1'
        )

        const restoredProjectId = (insertedRows['_mhb_playcanvas_projects']?.[0] as { id?: string } | undefined)?.id
        const restoredPackagesArg = mockReplaceMetahubPackagesFromSnapshot.mock.calls[0]?.[1] as
            | { packages?: Array<{ config?: { playcanvasProject?: { defaultProjectId?: string | null } } }> }
            | undefined

        expect(restoredProjectId).toBeTruthy()
        expect(restoredProjectId).not.toBe(sourceProjectId)
        expect(restoredPackagesArg?.packages?.[0]?.config?.playcanvasProject?.defaultProjectId).toBe(restoredProjectId)
    })

    it('remaps config.projectBinding.projectId on restored Projects instances to the new project id', async () => {
        const { knex, mockBuilder, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        const sourceProjectId = '019e8afa-0000-7000-8000-000000000001'
        const playcanvasProjects: PlayCanvasProjectSnapshotSection = {
            schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
            projects: [
                {
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    id: sourceProjectId,
                    codename: createLocalizedContent('en', 'mmoomm_authoring'),
                    displayName: createLocalizedContent('en', 'MMOOMM Authoring'),
                    description: null,
                    packageRef: {
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        version: '0.1.0',
                        compatibilityStatus: 'compatible'
                    },
                    settings: {},
                    defaultSceneId: null,
                    publicationConfig: {}
                }
            ],
            scenes: [],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: []
        }

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                entities: {
                    'old-project-instance': {
                        kind: 'project',
                        codename: 'MMOOMMAuthoring',
                        presentation: { name: { en: 'MMOOMM Authoring' }, description: {} },
                        // The exported binding references the SOURCE project id, which
                        // must be remapped to the restored project id on import.
                        config: {
                            projectBinding: {
                                provider: 'playcanvasEditor',
                                projectId: sourceProjectId,
                                projectCodename: 'mmoomm_authoring'
                            }
                        },
                        fields: []
                    }
                } as unknown as MetahubSnapshot['entities'],
                playcanvasProjects
            }),
            'user-1'
        )

        const restoredProjectId = (insertedRows['_mhb_playcanvas_projects']?.[0] as { id?: string } | undefined)?.id
        expect(restoredProjectId).toBeTruthy()
        expect(restoredProjectId).not.toBe(sourceProjectId)

        // The post-pass issues an UPDATE on _mhb_objects with a jsonb_set raw that
        // writes the remapped project id into config.projectBinding.projectId.
        const updateCalls = mockBuilder.update.mock.calls as Array<[Record<string, unknown>]>
        const bindingUpdate = updateCalls.find((call) => {
            const config = call[0]?.config as { raw?: string } | undefined
            return typeof config?.raw === 'string' && config.raw.includes('projectBinding,projectId')
        })
        expect(bindingUpdate).toBeTruthy()
        // The remapped id was bound into the raw jsonb_set parameters.
        const rawCall = mockBuilder.raw.mock.calls.find(
            (call) => typeof call[0] === 'string' && (call[0] as string).includes('projectBinding,projectId')
        )
        expect(rawCall?.[1]).toEqual([restoredProjectId])
    })

    it('remaps PlayCanvas runtime manifest bindings inside restored layout widget configs', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        const sourceProjectId = '019e8afa-0000-7000-8000-000000000001'
        const sourceSceneId = '019e8afa-0000-7000-8000-000000000002'
        const sourceChecksum = 'a'.repeat(64)
        const playcanvasProjects: PlayCanvasProjectSnapshotSection = {
            schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
            projects: [
                {
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    id: sourceProjectId,
                    codename: createLocalizedContent('en', 'playcanvas_project'),
                    displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                    description: null,
                    packageRef: {
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        version: '0.1.0',
                        compatibilityStatus: 'compatible'
                    },
                    settings: {},
                    defaultSceneId: sourceSceneId,
                    publicationConfig: {}
                }
            ],
            scenes: [
                {
                    id: sourceSceneId,
                    projectId: sourceProjectId,
                    codename: createLocalizedContent('en', 'scene'),
                    displayName: createLocalizedContent('en', 'Scene'),
                    payloadSchemaVersion: '1',
                    payload: {
                        schemaVersion: '1',
                        entities: [],
                        metadata: { mmoomm: { scene: { controlledObjectId: 'ship' } } }
                    },
                    payloadFile: null,
                    checksum: sourceChecksum,
                    sortOrder: 0,
                    publish: true
                }
            ],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: [],
            runtimeManifests: [
                {
                    schemaVersion: PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
                    projectId: sourceProjectId,
                    sceneId: sourceSceneId,
                    checksum: sourceChecksum,
                    assets: [],
                    scripts: [],
                    metadata: { mmoomm: { scene: { controlledObjectId: 'ship' } } }
                }
            ]
        }

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                playcanvasProjects,
                layouts: [
                    {
                        id: 'layout-1',
                        templateKey: 'dashboard',
                        name: { en: 'Default' },
                        description: null,
                        config: {},
                        isActive: true,
                        isDefault: true,
                        sortOrder: 0
                    }
                ],
                layoutZoneWidgets: [
                    {
                        id: 'widget-1',
                        layoutId: 'layout-1',
                        zone: 'center',
                        widgetKey: 'playcanvasCanvas',
                        sortOrder: 0,
                        config: {
                            runtimeManifest: {
                                projectId: sourceProjectId,
                                sceneId: sourceSceneId,
                                checksum: sourceChecksum,
                                failClosed: true
                            }
                        },
                        isActive: true
                    }
                ]
            } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        const restoredProjectId = (insertedRows['_mhb_playcanvas_projects']?.[0] as { id?: string } | undefined)?.id
        const restoredSceneId = (insertedRows['_mhb_playcanvas_scenes']?.[0] as { id?: string } | undefined)?.id
        const restoredManifest = insertedRows['_mhb_playcanvas_publication_manifests']?.[0] as { manifest_checksum?: string } | undefined
        const restoredWidget = insertedRows['_mhb_widgets']?.[0] as { config?: { runtimeManifest?: Record<string, unknown> } } | undefined

        expect(restoredProjectId).toBeTruthy()
        expect(restoredSceneId).toBeTruthy()
        expect(restoredProjectId).not.toBe(sourceProjectId)
        expect(restoredSceneId).not.toBe(sourceSceneId)
        expect(restoredManifest?.manifest_checksum).toEqual(expect.any(String))
        expect(restoredManifest?.manifest_checksum).not.toBe(sourceChecksum)
        expect(restoredWidget?.config?.runtimeManifest).toMatchObject({
            projectId: restoredProjectId,
            sceneId: restoredSceneId,
            checksum: restoredManifest?.manifest_checksum,
            failClosed: true
        })
    })

    it('preserves file-backed PlayCanvas scene-local material assets during snapshot restore', async () => {
        const sourceProjectId = '019e8afa-0000-7000-8000-000000000001'
        const sourceSceneId = '019e8afa-0000-7000-8000-000000000002'
        const materialData = { diffuse: [1, 1, 1], opacity: 0.42, useFog: true, shader: 'blinn' }
        const scenePayload = {
            schemaVersion: '1',
            entities: [
                {
                    id: 'entity-1',
                    name: 'Scene Local Material Owner',
                    parentId: null,
                    enabled: true,
                    components: { render: { materialAssets: [920000001] } },
                    children: []
                }
            ],
            assets: [
                {
                    id: '920000001',
                    stableAssetId: 'mmoomm-visual-linkup-920000001',
                    name: 'Scene Local Material',
                    type: 'material',
                    data: materialData,
                    metadata: { data: materialData, mmoomm: { visualMaterial: { blendType: 'normal' } } }
                }
            ]
        }
        const sceneContent = Buffer.from(JSON.stringify(scenePayload))
        const sceneHash = 'b'.repeat(64)
        const playcanvasProjects: PlayCanvasProjectSnapshotSection = {
            schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
            projects: [
                {
                    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    id: sourceProjectId,
                    codename: createLocalizedContent('en', 'playcanvas_project'),
                    displayName: createLocalizedContent('en', 'PlayCanvas Project'),
                    description: null,
                    packageRef: {
                        packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                        version: '0.1.0',
                        compatibilityStatus: 'compatible'
                    },
                    settings: {},
                    defaultSceneId: sourceSceneId,
                    publicationConfig: {}
                }
            ],
            scenes: [
                {
                    id: sourceSceneId,
                    projectId: sourceProjectId,
                    codename: createLocalizedContent('en', 'scene'),
                    displayName: createLocalizedContent('en', 'Scene'),
                    payloadSchemaVersion: '1',
                    payload: scenePayload,
                    payloadFile: {
                        provider: 'local',
                        root: 'playcanvas-projects',
                        path: `playcanvas-projects/${sourceProjectId}/scenes/${sourceSceneId}.json`,
                        hash: sceneHash,
                        mime: 'application/json',
                        size: sceneContent.length,
                        status: 'ready',
                        snapshotContentBase64: sceneContent.toString('base64')
                    },
                    checksum: sceneHash,
                    sortOrder: 0,
                    publish: true
                }
            ],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: []
        }
        const missingFileError = Object.assign(new Error('missing scene'), { code: 'ENOENT' })
        const playCanvasProjectFileService = {
            buildDefaultScenePath: jest.fn(
                (projectId: string, sceneId: string) => `playcanvas-projects/${projectId}/scenes/${sceneId}.json`
            ),
            read: jest.fn().mockRejectedValue(missingFileError),
            write: jest.fn().mockResolvedValue({ checksum: sceneHash }),
            delete: jest.fn()
        }
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(
            knex as any,
            'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
            undefined as any,
            playCanvasProjectFileService as any
        )

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({ playcanvasProjects } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        const restoredProjectId = (insertedRows['_mhb_playcanvas_projects']?.[0] as { id?: string } | undefined)?.id
        const restoredSceneId = (insertedRows['_mhb_playcanvas_scenes']?.[0] as { id?: string } | undefined)?.id
        const restoredScene = insertedRows['_mhb_playcanvas_scenes']?.[0] as
            | { payload?: typeof scenePayload; payload_file?: { path?: string; snapshotContentBase64?: string } }
            | undefined
        expect(restoredProjectId).toBeTruthy()
        expect(restoredSceneId).toBeTruthy()
        expect(restoredScene?.payload?.assets).toHaveLength(1)
        expect(restoredScene?.payload?.assets?.[0]).toMatchObject({
            id: '920000001',
            type: 'material',
            data: expect.objectContaining({ opacity: 0.42 }),
            metadata: expect.objectContaining({ data: expect.objectContaining({ useFog: true }) })
        })
        expect(restoredScene?.payload_file?.path).toBe(`playcanvas-projects/${restoredProjectId}/scenes/${restoredSceneId}.json`)
        expect(restoredScene?.payload_file?.snapshotContentBase64).toBeUndefined()
        expect(playCanvasProjectFileService.write).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            `playcanvas-projects/${restoredProjectId}/scenes/${restoredSceneId}.json`,
            sceneContent,
            { expectedChecksum: sceneHash, mime: 'application/json' }
        )
    })

    it('replaces existing package dependencies when a snapshot explicitly contains no packages', async () => {
        const { knex } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                packages: []
            }),
            'user-1'
        )

        expect(mockReplaceMetahubPackagesFromSnapshot).toHaveBeenCalledWith(expect.anything(), {
            metahubId: 'metahub-1',
            packages: [],
            userId: 'user-1'
        })
    })

    it('rejects imported ledger configs with invalid field references before restoring entities', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-ledger-id': {
                    kind: 'ledger',
                    codename: 'ProgressLedger',
                    presentation: { name: { en: 'Progress Ledger' }, description: {} },
                    config: {
                        ledger: {
                            fieldRoles: [{ fieldCodename: 'MissingField', role: 'dimension' }],
                            projections: [],
                            idempotency: { keyFields: [] }
                        }
                    },
                    fields: []
                }
            },
            entityTypeDefinitions: {
                ledger: {
                    id: 'type-ledger',
                    kindKey: 'ledger',
                    codename: 'ledger',
                    presentation: { name: { en: 'Ledgers' }, description: {} },
                    capabilities: {
                        dataSchema: { enabled: true },
                        physicalTable: { enabled: true },
                        ledgerSchema: { enabled: true }
                    },
                    ui: {
                        iconName: 'IconDatabase',
                        tabs: ['general', 'ledgerSchema'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:ledgers.title'
                    },
                    config: {}
                }
            }
        })

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toMatchObject({
            message: 'Ledger schema config contains invalid field references',
            details: {
                field: 'config.ledger',
                errors: [expect.objectContaining({ code: 'FIELD_NOT_FOUND' })]
            }
        })
        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('updates existing entity type definitions instead of inserting duplicates during snapshot restore', async () => {
        const { knex, mockBuilder, insertedRows } = createMockKnex()
        mockBuilder.first.mockResolvedValueOnce({ id: 'existing-page-type' })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                entityTypeDefinitions: {
                    page: {
                        id: 'old-page-type',
                        kindKey: 'page',
                        codename: 'page',
                        presentation: { name: { en: 'Pages' }, description: {} },
                        capabilities: { blockContent: { enabled: true } },
                        ui: { tabs: ['general'], sidebarSection: 'objects' },
                        config: {},
                        published: true
                    }
                }
            } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        expect(insertedRows['_mhb_entity_type_definitions']).toBeUndefined()
        expect(mockBuilder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                kind_key: 'page',
                _upl_version: { raw: '_upl_version + 1' }
            })
        )
    })

    it('normalizes imported Page block content through the shared storage schema', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot(
            'metahub-1',
            makeMinimalSnapshot({
                entities: {
                    'old-page-id': {
                        id: 'old-page-id',
                        kind: 'page',
                        codename: 'learner-home',
                        presentation: { name: { en: 'Learner Home' }, description: {} },
                        config: {
                            blockContent: {
                                time: 1,
                                version: '2.31.0',
                                blocks: [
                                    {
                                        id: 'welcome-title',
                                        type: 'header',
                                        data: { text: 'Welcome', level: 2 }
                                    }
                                ]
                            }
                        },
                        fields: [],
                        hubs: []
                    }
                },
                entityTypeDefinitions: {
                    page: {
                        id: 'old-page-type',
                        kindKey: 'page',
                        codename: 'page',
                        presentation: { name: { en: 'Pages' }, description: {} },
                        capabilities: {
                            blockContent: {
                                enabled: true,
                                storage: 'objectConfig',
                                defaultFormat: 'editorjs',
                                supportedFormats: ['editorjs'],
                                allowedBlockTypes: ['paragraph', 'header'],
                                maxBlocks: 500
                            }
                        },
                        ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                        config: {},
                        published: true
                    }
                }
            } as unknown as Partial<MetahubSnapshot>),
            'user-1'
        )

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_objects']![0]).toMatchObject({
            kind: 'page',
            config: {
                blockContent: {
                    format: 'editorjs',
                    data: {
                        version: '2.31.0',
                        blocks: [
                            {
                                id: 'welcome-title',
                                type: 'header',
                                data: { text: 'Welcome', level: 2 }
                            }
                        ]
                    }
                }
            }
        })
    })

    it('rejects unsafe imported Page block content before writing objects', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await expect(
            service.restoreFromSnapshot(
                'metahub-1',
                makeMinimalSnapshot({
                    entities: {
                        'old-page-id': {
                            id: 'old-page-id',
                            kind: 'page',
                            codename: 'unsafe-page',
                            presentation: { name: { en: 'Unsafe Page' }, description: {} },
                            config: {
                                blockContent: {
                                    format: 'editorjs',
                                    blocks: [
                                        {
                                            id: 'unsafe-paragraph',
                                            type: 'paragraph',
                                            data: { text: '<script>alert(1)</script>' }
                                        }
                                    ]
                                }
                            },
                            fields: [],
                            hubs: []
                        }
                    },
                    entityTypeDefinitions: {
                        page: {
                            id: 'old-page-type',
                            kindKey: 'page',
                            codename: 'page',
                            presentation: { name: { en: 'Pages' }, description: {} },
                            capabilities: {
                                blockContent: {
                                    enabled: true,
                                    storage: 'objectConfig',
                                    defaultFormat: 'editorjs',
                                    supportedFormats: ['editorjs'],
                                    allowedBlockTypes: ['paragraph'],
                                    maxBlocks: 500
                                }
                            },
                            ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                            config: {},
                            published: true
                        }
                    }
                } as unknown as Partial<MetahubSnapshot>),
                'user-1'
            )
        ).rejects.toThrow('Invalid imported page block content')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('rejects imported Page block content that violates Entity-specific block constraints', async () => {
        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await expect(
            service.restoreFromSnapshot(
                'metahub-1',
                makeMinimalSnapshot({
                    entities: {
                        'old-page-id': {
                            id: 'old-page-id',
                            kind: 'page',
                            codename: 'disallowed-page',
                            presentation: { name: { en: 'Disallowed Page' }, description: {} },
                            config: {
                                blockContent: {
                                    format: 'editorjs',
                                    blocks: [
                                        {
                                            id: 'welcome-title',
                                            type: 'header',
                                            data: { text: 'Welcome', level: 2 }
                                        }
                                    ]
                                }
                            },
                            fields: [],
                            hubs: []
                        }
                    },
                    entityTypeDefinitions: {
                        page: {
                            id: 'old-page-type',
                            kindKey: 'page',
                            codename: 'page',
                            presentation: { name: { en: 'Pages' }, description: {} },
                            capabilities: {
                                blockContent: {
                                    enabled: true,
                                    storage: 'objectConfig',
                                    defaultFormat: 'editorjs',
                                    supportedFormats: ['editorjs'],
                                    allowedBlockTypes: ['paragraph'],
                                    maxBlocks: 500
                                }
                            },
                            ui: { tabs: ['general', 'content'], sidebarSection: 'objects', iconName: 'IconFileText', nameKey: 'Pages' },
                            config: {},
                            published: true
                        }
                    }
                } as unknown as Partial<MetahubSnapshot>),
                'user-1'
            )
        ).rejects.toThrow('Invalid imported page block content')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('restores a snapshot that omits v3 entity metadata sections', async () => {
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'old-module-id',
                    codename: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'module_hook', version: 1, isActive: true }
                        }
                    },
                    presentation: { name: { en: 'Module hook' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'ModuleHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'module',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'metadata.read'],
                        methods: []
                    },
                    serverBundle: 'module-server-bundle',
                    clientBundle: null,
                    checksum: 'module-checksum',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class ModuleHook extends ExtensionModule {}"
                }
            ],
            entityTypeDefinitions: undefined
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toHaveLength(1)
        expect(insertedRows['_mhb_components']).toHaveLength(1)
        expect(insertedRows['_mhb_modules']).toHaveLength(1)
        expect(insertedRows['_mhb_modules']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            source_code: expect.stringContaining('ModuleHook extends ExtensionModule')
        })
        expect(insertedRows['_mhb_entity_type_definitions']).toBeUndefined()
        expect(insertedRows['_mhb_actions']).toBeUndefined()
        expect(insertedRows['_mhb_event_bindings']).toBeUndefined()
    })

    it('remaps hub references in entity config', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-hub-id': {
                    id: 'old-hub-id',
                    kind: 'hub',
                    codename: 'main-hub',
                    presentation: { name: { en: 'Main Hub' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    hubs: ['old-hub-id'],
                    fields: []
                }
            }
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        // Hub is created first, then object references the new hub ID
        expect(insertedRows['_mhb_objects']).toHaveLength(2)
        const catalogRow = insertedRows['_mhb_objects']![1]
        expect((catalogRow as any).config).toHaveProperty('hubs')
        expect((catalogRow as any).config.hubs).toHaveLength(1)
        // The hub ID should be the generated-id, not the old one
        expect((catalogRow as any).config.hubs[0]).toMatch(/^generated-id-/)
    })

    it('restores constants and maps IDs', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-set-id': {
                    kind: 'set',
                    codename: 'sizes',
                    presentation: { name: { en: 'Sizes' }, description: {} },
                    config: {},
                    fields: []
                }
            },
            fixedValues: {
                'old-set-id': [
                    {
                        id: 'old-const-id',
                        codename: 'size-s',
                        dataType: 'STRING',
                        presentation: { name: { en: 'S' } },
                        validationRules: {},
                        uiConfig: {},
                        value: 'small',
                        sortOrder: 0
                    }
                ]
            }
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toHaveLength(1)
        expect(insertedRows['_mhb_constants']![0]).toMatchObject({
            codename: expect.objectContaining({ _schema: '1' }),
            data_type: 'STRING'
        })
    })

    it('restores layouts and zone widgets', async () => {
        const snapshot = makeMinimalSnapshot({
            layouts: [
                {
                    id: 'old-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Default' },
                    description: null,
                    config: { showHeader: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    layoutId: 'old-layout-id',
                    zone: 'main',
                    widgetKey: 'details-table',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(deletedTablesWithLayouts)
        expect(insertedRows['_mhb_layouts']).toHaveLength(1)
        expect(insertedRows['_mhb_layouts']![0]).toMatchObject({
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            is_default: true
        })
        expect(insertedRows['_mhb_widgets']).toHaveLength(1)
        expect(insertedRows['_mhb_widgets']![0]).toMatchObject({
            zone: 'main',
            widget_key: 'details-table'
        })
    })

    it('remaps entity references inside restored layout widget configs', async () => {
        const sourceHubId = 'old-hub-id'
        const sourcePageId = 'old-page-id'
        const sourceObjectId = 'old-object-id'
        const sourceTreeId = 'old-tree-id'
        const snapshot = makeMinimalSnapshot({
            entities: {
                [sourceHubId]: {
                    kind: 'hub',
                    codename: 'main-hub',
                    presentation: { name: { en: 'Main Hub' }, description: {} },
                    config: {},
                    fields: []
                },
                [sourceObjectId]: {
                    kind: 'object',
                    codename: 'sections',
                    presentation: { name: { en: 'Sections' }, description: {} },
                    config: {},
                    fields: []
                },
                [sourcePageId]: {
                    kind: 'page',
                    codename: 'welcome',
                    presentation: { name: { en: 'Welcome' }, description: {} },
                    config: {},
                    fields: []
                },
                [sourceTreeId]: {
                    kind: 'object',
                    codename: 'tree',
                    presentation: { name: { en: 'Tree' }, description: {} },
                    config: {},
                    fields: []
                }
            },
            layouts: [
                {
                    id: 'old-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Default' },
                    description: null,
                    config: {
                        targetEntityId: sourceObjectId,
                        targetSectionId: sourcePageId,
                        targetObjectCollectionId: sourceObjectId,
                        targetSectionIds: [sourcePageId, 'stable-codename'],
                        targetObjectCollectionIds: [sourceObjectId],
                        unrelatedId: sourceObjectId
                    },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'old-menu-widget-id',
                    layoutId: 'old-layout-id',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 0,
                    config: {
                        startPage: sourcePageId,
                        boundHubId: sourceHubId,
                        hubId: sourceHubId,
                        items: [
                            {
                                id: 'menu-item-keeps-own-id',
                                title: 'Welcome',
                                sectionId: sourcePageId,
                                treeEntityId: sourceTreeId,
                                objectCollectionId: sourceObjectId,
                                objectCollectionIds: [sourceObjectId],
                                sectionIds: [sourcePageId, 'stable-codename']
                            }
                        ],
                        metadata: {
                            targetEntityId: sourceObjectId,
                            targetSectionId: sourcePageId,
                            targetObjectCollectionId: sourceObjectId
                        }
                    },
                    isActive: true
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        const objectRows = insertedRows['_mhb_objects'] as Array<Record<string, unknown>>
        const restoredHubId = objectRows.find((row) => getCodenameText(row) === 'main-hub')?.id
        const restoredObjectId = objectRows.find((row) => getCodenameText(row) === 'sections')?.id
        const restoredPageId = objectRows.find((row) => getCodenameText(row) === 'welcome')?.id
        const restoredTreeId = objectRows.find((row) => getCodenameText(row) === 'tree')?.id
        const layoutConfig = (insertedRows['_mhb_layouts']?.[0] as { config?: Record<string, unknown> } | undefined)?.config
        const widgetConfig = (insertedRows['_mhb_widgets']?.[0] as { config?: Record<string, unknown> } | undefined)?.config

        expect(restoredHubId).toBeTruthy()
        expect(restoredObjectId).toBeTruthy()
        expect(restoredPageId).toBeTruthy()
        expect(restoredTreeId).toBeTruthy()
        expect(layoutConfig).toMatchObject({
            targetEntityId: restoredObjectId,
            targetSectionId: restoredPageId,
            targetObjectCollectionId: restoredObjectId,
            targetSectionIds: [restoredPageId, 'stable-codename'],
            targetObjectCollectionIds: [restoredObjectId],
            unrelatedId: sourceObjectId
        })
        expect(widgetConfig).toMatchObject({
            startPage: restoredPageId,
            boundHubId: restoredHubId,
            hubId: restoredHubId,
            items: [
                {
                    id: 'menu-item-keeps-own-id',
                    sectionId: restoredPageId,
                    treeEntityId: restoredTreeId,
                    objectCollectionId: restoredObjectId,
                    objectCollectionIds: [restoredObjectId],
                    sectionIds: [restoredPageId, 'stable-codename']
                }
            ],
            metadata: {
                targetEntityId: restoredObjectId,
                targetSectionId: restoredPageId,
                targetObjectCollectionId: restoredObjectId
            }
        })
    })

    it('restores modules with sourceCode and remaps attachment ids', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'old-field-id',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayComponent: true,
                            presentation: { name: { en: 'Title' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ]
                }
            },
            modules: [
                {
                    id: 'module-metahub-id',
                    codename: 'quiz-widget',
                    presentation: { name: { en: 'Quiz widget' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'widget',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'QuizWidget',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'widget',
                        sourceKind: 'embedded',
                        capabilities: ['metadata.read', 'rpc.client'],
                        methods: []
                    },
                    serverBundle: 'server bundle',
                    clientBundle: 'client bundle',
                    checksum: 'checksum-metahub',
                    isActive: true,
                    config: { moduleCodename: 'quiz-widget' },
                    sourceCode:
                        "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class QuizWidget extends ExtensionModule {}"
                },
                {
                    id: 'module-component-id',
                    codename: 'component-hook',
                    presentation: { name: { en: 'Component hook' } },
                    attachedToKind: 'component',
                    attachedToId: 'old-field-id',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'ComponentHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'lifecycle',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                        methods: []
                    },
                    serverBundle: 'component server bundle',
                    clientBundle: null,
                    checksum: 'checksum-component',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class ComponentHook extends ExtensionModule {}"
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toContain('_mhb_modules')
        expect(insertedRows['_mhb_modules']).toHaveLength(2)
        expect(insertedRows['_mhb_modules']![0]).toMatchObject({
            attached_to_kind: 'metahub',
            attached_to_id: null,
            source_code: expect.stringContaining('QuizWidget extends ExtensionModule'),
            server_bundle: null,
            client_bundle: null,
            _mhb_published: true
        })
        expect(insertedRows['_mhb_modules']![1]).toMatchObject({
            attached_to_kind: 'component',
            attached_to_id: 'generated-id-2',
            source_code: expect.stringContaining('ComponentHook extends ExtensionModule'),
            server_bundle: null,
            client_bundle: null
        })
        expect(insertedRows['_mhb_modules']![0].checksum).not.toBe('checksum-metahub')
        expect(insertedRows['_mhb_modules']![1].checksum).not.toBe('checksum-component')
    })

    it('restores general library modules with null attachment ids', async () => {
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'module-library-id',
                    codename: 'quiz-library',
                    presentation: { name: { en: 'Quiz library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'QuizLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: ['metadata.read'],
                        methods: []
                    },
                    serverBundle: 'library server bundle',
                    clientBundle: 'library client bundle',
                    checksum: 'checksum-library',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class QuizLibrary extends ExtensionModule {}"
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_modules']).toHaveLength(1)
        expect(insertedRows['_mhb_modules']![0]).toMatchObject({
            attached_to_kind: 'general',
            attached_to_id: null,
            module_role: 'library',
            source_code: expect.stringContaining('QuizLibrary extends ExtensionModule'),
            server_bundle: null,
            client_bundle: null
        })
        expect(insertedRows['_mhb_modules']![0].checksum).not.toBe('checksum-library')
    })

    it.each([
        ['unsupported attachment kind', { attachedToKind: 'external' }, 'Snapshot module attachment kind is not supported'],
        [
            'legacy shared role',
            {
                moduleRole: 'shared',
                manifest: { moduleRole: 'shared', sourceKind: 'embedded', sdkApiVersion: '1.0.0', capabilities: [], methods: [] }
            },
            'Snapshot module role is not supported'
        ],
        [
            'general non-library role',
            { attachedToKind: 'general', moduleRole: 'widget' },
            'General snapshot modules must use the library module role'
        ],
        ['library outside general scope', { moduleRole: 'library' }, 'Library snapshot modules must use the general attachment scope'],
        ['manifest role mismatch', { manifest: { moduleRole: 'widget' } }, 'Snapshot module role does not match its manifest'],
        [
            'external source kind',
            { sourceKind: 'external', manifest: { sourceKind: 'external' } },
            'Only embedded snapshot module sources are supported'
        ]
    ])('rejects invalid snapshot module metadata: %s', async (_caseName, overrides, expectedMessage) => {
        const baseModule = {
            id: 'module-invalid-id',
            codename: 'invalid-module',
            presentation: { name: { en: 'Invalid module' } },
            attachedToKind: 'metahub',
            attachedToId: null,
            moduleRole: 'module',
            sourceKind: 'embedded',
            sdkApiVersion: '1.0.0',
            manifest: {
                className: 'InvalidModule',
                sdkApiVersion: '1.0.0',
                moduleRole: 'module',
                sourceKind: 'embedded',
                capabilities: ['records.read', 'metadata.read'],
                methods: []
            },
            serverBundle: 'server bundle',
            clientBundle: null,
            checksum: 'checksum-invalid',
            isActive: true,
            config: {},
            sourceCode:
                "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class InvalidModule extends ExtensionModule {}"
        }

        const snapshot = makeMinimalSnapshot({
            modules: [{ ...baseModule, ...overrides } as never]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toThrow(expectedMessage)
        expect(insertedRows['_mhb_modules']).toBeUndefined()
    })

    it('restores snapshot v3 custom entity definitions with remapped actions and event bindings', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-custom-object-id': {
                    id: 'old-custom-object-id',
                    kind: 'customer_registry',
                    codename: 'customer_registry',
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    config: {},
                    tableName: 'cust_customer_registry',
                    fields: [],
                    hubs: [],
                    actions: [
                        {
                            id: 'old-action-id',
                            codename: 'sync_customer',
                            presentation: { name: { en: 'Sync customer' } },
                            actionType: 'module',
                            moduleId: 'old-module-id',
                            config: { mode: 'sync' },
                            sortOrder: 1
                        }
                    ],
                    eventBindings: [
                        {
                            id: 'old-binding-id',
                            eventName: 'afterCreate',
                            actionId: 'old-action-id',
                            priority: 2,
                            isActive: true,
                            config: { trigger: 'runtime' }
                        }
                    ]
                }
            },
            entityTypeDefinitions: {
                customer_registry: {
                    id: 'old-type-id',
                    kindKey: 'customer_registry',
                    codename: 'customer_registry',
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    capabilities: {
                        dataSchema: { enabled: true },
                        records: false,
                        treeAssignment: false,
                        optionValues: false,
                        fixedValues: false,
                        hierarchy: false,
                        nestedCollections: false,
                        relations: false,
                        actions: { enabled: true },
                        events: { enabled: true },
                        modules: false,
                        layoutConfig: false,
                        runtimeBehavior: false,
                        physicalTable: { enabled: true, prefix: 'cust' }
                    },
                    ui: {
                        iconName: 'IconUsers',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:entities.customerRegistry'
                    },
                    config: { publishedSection: true },
                    published: true
                }
            },
            modules: [
                {
                    id: 'old-module-id',
                    codename: 'customer_hook',
                    presentation: { name: { en: 'Customer hook' } },
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    manifest: {
                        className: 'CustomerHook',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'lifecycle',
                        sourceKind: 'embedded',
                        capabilities: ['records.read', 'records.write', 'metadata.read', 'lifecycle'],
                        methods: []
                    },
                    serverBundle: 'customer hook bundle',
                    clientBundle: null,
                    checksum: 'checksum-customer-hook',
                    isActive: true,
                    config: {},
                    sourceCode:
                        "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class CustomerHook extends ExtensionModule {}"
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_entity_type_definitions']).toHaveLength(1)
        expect(insertedRows['_mhb_entity_type_definitions']![0]).toMatchObject({
            kind_key: 'customer_registry',
            _mhb_published: true
        })

        expect(insertedRows['_mhb_actions']).toHaveLength(1)
        expect(insertedRows['_mhb_event_bindings']).toHaveLength(1)

        const objectRow = insertedRows['_mhb_objects']![0] as Record<string, unknown>
        const moduleRow = insertedRows['_mhb_modules']![0] as Record<string, unknown>
        const actionRow = insertedRows['_mhb_actions']![0] as Record<string, unknown>
        const eventBindingRow = insertedRows['_mhb_event_bindings']![0] as Record<string, unknown>

        expect(objectRow).toMatchObject({
            kind: 'customer_registry',
            table_name: 'cust_customer_registry'
        })
        expect(actionRow).toMatchObject({
            object_id: objectRow.id,
            action_type: 'module',
            module_id: moduleRow.id
        })
        expect(eventBindingRow).toMatchObject({
            object_id: objectRow.id,
            event_name: 'afterCreate',
            action_id: actionRow.id,
            priority: 2,
            is_active: true
        })
    })

    it('clears seeded layouts even when snapshot has no layouts', async () => {
        const snapshot = makeMinimalSnapshot({ layouts: [], layoutZoneWidgets: [] } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows, deletedTables } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(deletedTables).toEqual(deletedTablesWithLayouts)
        expect(insertedRows['_mhb_layouts']).toBeUndefined()
        expect(insertedRows['_mhb_widgets']).toBeUndefined()
    })

    it('does not touch PlayCanvas storage when importing a legacy snapshot without a PlayCanvas section', async () => {
        const { knex } = createMockKnex()
        const playCanvasProjectSnapshotService = {
            collectStoredLocalFileCandidates: jest.fn(),
            restoreSnapshot: jest.fn()
        }
        const service = new SnapshotRestoreService(
            knex as any,
            'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
            undefined as any,
            undefined as any,
            playCanvasProjectSnapshotService as any
        )

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(playCanvasProjectSnapshotService.collectStoredLocalFileCandidates).not.toHaveBeenCalled()
        expect(playCanvasProjectSnapshotService.restoreSnapshot).not.toHaveBeenCalled()
    })

    it('does not delete existing PlayCanvas project files when importing a legacy snapshot without a PlayCanvas section', async () => {
        const { knex } = createMockKnex()
        const playCanvasProjectFileService = {
            read: jest.fn(),
            write: jest.fn(),
            delete: jest.fn()
        }
        const playCanvasProjectSnapshotService = {
            collectStoredLocalFileCandidates: jest.fn(async () => new Map([['playcanvas-projects/project-1/scenes/scene-1.json', {}]])),
            restoreSnapshot: jest.fn()
        }
        const service = new SnapshotRestoreService(
            knex as any,
            'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
            undefined as any,
            playCanvasProjectFileService as any,
            playCanvasProjectSnapshotService as any
        )

        await service.restoreFromSnapshot('metahub-1', makeMinimalSnapshot(), 'user-1')

        expect(playCanvasProjectSnapshotService.collectStoredLocalFileCandidates).not.toHaveBeenCalled()
        expect(playCanvasProjectFileService.delete).not.toHaveBeenCalled()
    })

    it('deletes stale file-backed module source files after a successful snapshot restore', async () => {
        const snapshot = makeMinimalSnapshot({ modules: [] } as unknown as Partial<MetahubSnapshot>)
        const moduleSourceFileService = {
            read: jest.fn().mockResolvedValue({ checksum: 'old-source-checksum' }),
            write: jest.fn(),
            delete: jest.fn().mockResolvedValue(undefined)
        }
        const { knex } = createMockKnex({
            storageColumnsAvailable: true,
            existingModuleSourcePaths: ['modules/general/old-shared.ts']
        })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(moduleSourceFileService.delete).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/old-shared.ts'
        )
    })

    it('skips stale file-backed module source cleanup when the external file changed after the stored checksum', async () => {
        const snapshot = makeMinimalSnapshot({ modules: [] } as unknown as Partial<MetahubSnapshot>)
        const moduleSourceFileService = {
            read: jest.fn().mockResolvedValue({ checksum: 'changed-source-checksum' }),
            write: jest.fn(),
            delete: jest.fn().mockResolvedValue(undefined)
        }
        const { knex } = createMockKnex({
            storageColumnsAvailable: true,
            existingModuleSourcePaths: [{ sourcePath: 'modules/general/old-shared.ts', sourceChecksum: 'old-source-checksum' }]
        })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(moduleSourceFileService.read).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/old-shared.ts'
        )
        expect(moduleSourceFileService.delete).not.toHaveBeenCalled()
    })

    it('keeps snapshot restore successful and does not roll back restored file-backed sources when post-commit stale cleanup fails', async () => {
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'new-module-id',
                    codename: 'shared_library',
                    presentation: { name: { en: 'Shared library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/new-shared.ts',
                        content: "export const shared = 'new'"
                    },
                    manifest: {
                        className: 'SharedLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-new',
                    isActive: true,
                    config: {}
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)
        const missingSourceError = Object.assign(new Error('missing source'), { code: 'ENOENT' })
        const moduleSourceFileService = {
            read: jest.fn().mockRejectedValueOnce(missingSourceError).mockResolvedValueOnce({ checksum: 'old-source-checksum' }),
            write: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockRejectedValue(new Error('cleanup failed'))
        }
        const { knex } = createMockKnex({
            storageColumnsAvailable: true,
            existingModuleSourcePaths: ['modules/general/old-shared.ts']
        })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).resolves.toBeUndefined()

        expect(moduleSourceFileService.write).toHaveBeenCalledTimes(1)
        expect(moduleSourceFileService.write).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/new-shared.ts',
            "export const shared = 'new'"
        )
        expect(moduleSourceFileService.delete).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/old-shared.ts'
        )
        expect(moduleSourceFileService.delete).not.toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/new-shared.ts'
        )
    })

    it('normalizes file-backed snapshot paths before persisting and writing restored sources', async () => {
        const sourceCode = "export const shared = 'new'"
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'new-module-id',
                    codename: 'shared_library',
                    presentation: { name: { en: 'Shared library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: ' modules\\general\\new-shared.ts ',
                        checksum: computeModuleSourceChecksum(sourceCode),
                        content: sourceCode
                    },
                    manifest: {
                        className: 'SharedLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-new',
                    isActive: true,
                    config: {}
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)
        const missingSourceError = Object.assign(new Error('missing source'), { code: 'ENOENT' })
        const moduleSourceFileService = {
            read: jest.fn().mockRejectedValue(missingSourceError),
            write: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined)
        }
        const { knex, insertedRows } = createMockKnex({ storageColumnsAvailable: true })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_modules']?.[0]).toMatchObject({
            source_path: 'modules/general/new-shared.ts',
            source_checksum: computeModuleSourceChecksum(sourceCode)
        })
        expect(moduleSourceFileService.write).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/new-shared.ts',
            sourceCode
        )
    })

    it('rejects file-backed snapshot sources whose declared checksum does not match content', async () => {
        const sourceCode = "export const shared = 'tampered'"
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'new-module-id',
                    codename: 'shared_library',
                    presentation: { name: { en: 'Shared library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/new-shared.ts',
                        checksum: 'snapshot-checksum-before-tamper',
                        content: sourceCode
                    },
                    manifest: {
                        className: 'SharedLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-new',
                    isActive: true,
                    config: {}
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)
        const moduleSourceFileService = {
            read: jest.fn(),
            write: jest.fn(),
            delete: jest.fn()
        }
        const { knex } = createMockKnex({ storageColumnsAvailable: true })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toMatchObject({
            message: 'Snapshot file-backed module source checksum does not match its content',
            details: {
                sourcePath: 'modules/general/new-shared.ts',
                expectedSourceChecksum: 'snapshot-checksum-before-tamper',
                actualSourceChecksum: computeModuleSourceChecksum(sourceCode),
                messageCode: 'modules.sourcePath.snapshotChecksumMismatch'
            }
        })
        expect(moduleSourceFileService.write).not.toHaveBeenCalled()
    })

    it('skips rollback cleanup for restored file-backed sources changed after the restore write', async () => {
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'new-module-id',
                    codename: 'shared_library',
                    presentation: { name: { en: 'Shared library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/new-shared.ts',
                        content: "export const shared = 'new'"
                    },
                    manifest: {
                        className: 'SharedLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-new',
                    isActive: true,
                    config: {}
                }
            ],
            packages: [{ packageName: '@universo-react/broken', version: '0.1.0' } as any]
        } as unknown as Partial<MetahubSnapshot>)
        const missingSourceError = Object.assign(new Error('missing source'), { code: 'ENOENT' })
        const moduleSourceFileService = {
            read: jest.fn().mockRejectedValueOnce(missingSourceError).mockResolvedValueOnce({ checksum: 'changed-after-restore-checksum' }),
            write: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined)
        }
        mockReplaceMetahubPackagesFromSnapshot.mockRejectedValueOnce(new Error('package restore failed'))
        const { knex } = createMockKnex({ storageColumnsAvailable: true })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toThrow('package restore failed')

        expect(moduleSourceFileService.write).toHaveBeenCalledTimes(1)
        expect(moduleSourceFileService.delete).not.toHaveBeenCalled()
    })

    it('continues rollback cleanup for remaining file-backed sources when one rollback delete fails', async () => {
        const firstSource = "export const first = 'restored'"
        const secondSource = "export const second = 'restored'"
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'first-module-id',
                    codename: 'first_library',
                    presentation: { name: { en: 'First library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/first.ts',
                        content: firstSource
                    },
                    manifest: {
                        className: 'FirstLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-first',
                    isActive: true,
                    config: {}
                },
                {
                    id: 'second-module-id',
                    codename: 'second_library',
                    presentation: { name: { en: 'Second library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/second.ts',
                        content: secondSource
                    },
                    manifest: {
                        className: 'SecondLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-second',
                    isActive: true,
                    config: {}
                }
            ],
            packages: [{ packageName: '@universo-react/broken', version: '0.1.0' } as any]
        } as unknown as Partial<MetahubSnapshot>)
        const missingSourceError = Object.assign(new Error('missing source'), { code: 'ENOENT' })
        const moduleSourceFileService = {
            read: jest
                .fn()
                .mockRejectedValueOnce(missingSourceError)
                .mockRejectedValueOnce(missingSourceError)
                .mockResolvedValueOnce({ checksum: computeModuleSourceChecksum(secondSource) })
                .mockResolvedValueOnce({ checksum: computeModuleSourceChecksum(firstSource) }),
            write: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockRejectedValueOnce(new Error('delete failed')).mockResolvedValueOnce(undefined)
        }
        mockReplaceMetahubPackagesFromSnapshot.mockRejectedValueOnce(new Error('package restore failed'))
        const { knex } = createMockKnex({ storageColumnsAvailable: true })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toThrow('package restore failed')

        expect(moduleSourceFileService.delete).toHaveBeenCalledTimes(2)
        expect(moduleSourceFileService.delete).toHaveBeenNthCalledWith(
            1,
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/second.ts'
        )
        expect(moduleSourceFileService.delete).toHaveBeenNthCalledWith(
            2,
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/first.ts'
        )
    })

    it('rolls back previously restored file-backed sources when a later source write fails', async () => {
        const firstSource = "export const first = 'restored'"
        const firstChecksum = computeModuleSourceChecksum(firstSource)
        const snapshot = makeMinimalSnapshot({
            modules: [
                {
                    id: 'first-module-id',
                    codename: 'first_library',
                    presentation: { name: { en: 'First library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/first.ts',
                        content: firstSource
                    },
                    manifest: {
                        className: 'FirstLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-first',
                    isActive: true,
                    config: {}
                },
                {
                    id: 'second-module-id',
                    codename: 'second_library',
                    presentation: { name: { en: 'Second library' } },
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    sdkApiVersion: '1.0.0',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/second.ts',
                        content: "export const second = 'restored'"
                    },
                    manifest: {
                        className: 'SecondLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: [],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'checksum-second',
                    isActive: true,
                    config: {}
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)
        const missingSourceError = Object.assign(new Error('missing source'), { code: 'ENOENT' })
        const moduleSourceFileService = {
            read: jest
                .fn()
                .mockRejectedValueOnce(missingSourceError)
                .mockRejectedValueOnce(missingSourceError)
                .mockRejectedValueOnce(missingSourceError)
                .mockResolvedValueOnce({ checksum: firstChecksum }),
            write: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('write failed')),
            delete: jest.fn().mockResolvedValue(undefined)
        }
        const { knex } = createMockKnex({ storageColumnsAvailable: true })
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1', moduleSourceFileService as any)

        await expect(service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')).rejects.toThrow('write failed')

        expect(moduleSourceFileService.delete).toHaveBeenCalledTimes(1)
        expect(moduleSourceFileService.delete).toHaveBeenCalledWith(
            { metahubId: 'metahub-1', branchSlug: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
            'modules/general/first.ts'
        )
    })

    it('restores scoped layouts and sparse widget overrides with remapped ids', async () => {
        const snapshot = makeMinimalSnapshot({
            layouts: [
                {
                    id: 'old-global-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Global default' },
                    description: null,
                    config: { showHeader: true },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            scopedLayouts: [
                {
                    id: 'old-object-layout-id',
                    scopeEntityId: 'old-object-id',
                    baseLayoutId: 'old-global-layout-id',
                    templateKey: 'dashboard',
                    name: { en: 'Entity override' },
                    description: null,
                    config: { showHeader: false },
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'old-global-widget-id',
                    layoutId: 'old-global-layout-id',
                    zone: 'left',
                    widgetKey: 'menuWidget',
                    sortOrder: 1,
                    config: { showTitle: true },
                    isActive: true
                },
                {
                    id: 'old-owned-widget-id',
                    layoutId: 'old-object-layout-id',
                    zone: 'right',
                    widgetKey: 'statsOverview',
                    sortOrder: 1,
                    config: { compact: true },
                    isActive: true
                }
            ],
            layoutWidgetOverrides: [
                {
                    id: 'old-override-id',
                    layoutId: 'old-object-layout-id',
                    baseWidgetId: 'old-global-widget-id',
                    zone: 'top',
                    sortOrder: 2,
                    config: { showTitle: false },
                    isActive: true,
                    isDeletedOverride: false
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_layouts']).toHaveLength(2)
        const globalLayoutRow = insertedRows['_mhb_layouts']![0] as Record<string, unknown>
        const scopedLayoutRow = insertedRows['_mhb_layouts']![1] as Record<string, unknown>
        const globalWidgetRow = insertedRows['_mhb_widgets']![0] as Record<string, unknown>
        const scopedWidgetRow = insertedRows['_mhb_widgets']![1] as Record<string, unknown>
        const overrideRow = insertedRows['_mhb_layout_widget_overrides']![0] as Record<string, unknown>

        expect(globalLayoutRow).toMatchObject({
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'dashboard',
            is_default: true
        })
        expect(scopedLayoutRow).toMatchObject({
            scope_entity_id: 'generated-id-1',
            base_layout_id: globalLayoutRow.id,
            template_key: 'dashboard',
            is_default: true
        })

        expect(insertedRows['_mhb_widgets']).toHaveLength(2)
        expect(globalWidgetRow).toMatchObject({
            layout_id: globalLayoutRow.id,
            zone: 'left',
            widget_key: 'menuWidget'
        })
        expect(scopedWidgetRow).toMatchObject({
            layout_id: scopedLayoutRow.id,
            zone: 'right',
            widget_key: 'statsOverview'
        })

        expect(insertedRows['_mhb_layout_widget_overrides']).toHaveLength(1)
        expect(overrideRow).toMatchObject({
            layout_id: scopedLayoutRow.id,
            base_widget_id: globalWidgetRow.id,
            zone: 'top',
            sort_order: 2,
            is_active: true,
            is_deleted_override: false
        })
    })

    it('skips entities with missing entityIdMap (with warning)', async () => {
        const snapshot = makeMinimalSnapshot({
            fixedValues: {
                'non-existent-entity-id': [
                    {
                        id: 'const-1',
                        codename: 'orphan',
                        dataType: 'STRING',
                        presentation: { name: { en: 'Orphan' } },
                        validationRules: {},
                        uiConfig: {},
                        value: 'x',
                        sortOrder: 0
                    }
                ]
            }
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        // Should not throw; orphaned constants are skipped with a warning
        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_constants']).toBeUndefined()
    })

    it('restores shared containers, shared entities, and remapped shared overrides', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'old-set-id': {
                    id: 'old-set-id',
                    kind: 'set',
                    codename: 'sizes',
                    presentation: { name: { en: 'Sizes' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                },
                'old-enum-id': {
                    id: 'old-enum-id',
                    kind: 'enumeration',
                    codename: 'statuses',
                    presentation: { name: { en: 'Statuses' }, description: {} },
                    config: {},
                    fields: [],
                    hubs: []
                }
            },
            sharedComponents: [
                {
                    id: 'old-shared-component-id',
                    codename: 'shared_title',
                    dataType: 'STRING',
                    isRequired: false,
                    isDisplayComponent: false,
                    presentation: { name: { en: 'Shared Title' }, description: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 0
                }
            ],
            sharedFixedValues: [
                {
                    id: 'old-shared-constant-id',
                    objectId: 'old-shared-set-container-id',
                    codename: 'shared_size',
                    dataType: 'STRING',
                    presentation: { name: { en: 'Shared Size' } },
                    validationRules: {},
                    uiConfig: {},
                    value: 'shared',
                    sortOrder: 0
                }
            ],
            sharedOptionValues: [
                {
                    id: 'old-shared-value-id',
                    objectId: 'old-shared-enum-container-id',
                    codename: 'shared_default',
                    presentation: { name: { en: 'Shared Default' }, description: {} },
                    sortOrder: 0,
                    isDefault: false
                }
            ],
            sharedEntityOverrides: [
                {
                    id: 'override-component-id',
                    entityKind: 'component',
                    sharedEntityId: 'old-shared-component-id',
                    targetObjectId: 'old-object-id',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0
                },
                {
                    id: 'override-constant-id',
                    entityKind: 'constant',
                    sharedEntityId: 'old-shared-constant-id',
                    targetObjectId: 'old-set-id',
                    isExcluded: false,
                    isActive: true,
                    sortOrder: 0
                },
                {
                    id: 'override-value-id',
                    entityKind: 'value',
                    sharedEntityId: 'old-shared-value-id',
                    targetObjectId: 'old-enum-id',
                    isExcluded: true,
                    isActive: true,
                    sortOrder: 1
                }
            ]
        } as unknown as Partial<MetahubSnapshot>)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        const objectRows = (insertedRows['_mhb_objects'] ?? []) as Record<string, unknown>[]
        expect(objectRows).toHaveLength(6)
        expect(objectRows.slice(3).map((row) => row.kind)).toEqual(['shared-object-pool', 'shared-set-pool', 'shared-enumeration-pool'])

        const sharedComponentRow = insertedRows['_mhb_components']![0] as Record<string, unknown>
        const sharedConstantRow = insertedRows['_mhb_constants']![0] as Record<string, unknown>
        const sharedValueRow = insertedRows['_mhb_values']![0] as Record<string, unknown>
        const overrideRows = insertedRows['_mhb_shared_entity_overrides'] as Record<string, unknown>[]

        expect(sharedComponentRow).toMatchObject({
            object_id: objectRows[3]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(sharedConstantRow).toMatchObject({
            object_id: objectRows[4]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })
        expect(sharedValueRow).toMatchObject({
            object_id: objectRows[5]?.id,
            codename: expect.objectContaining({ _schema: '1' })
        })

        expect(overrideRows).toHaveLength(3)
        expect(overrideRows[0]).toMatchObject({
            entity_kind: 'component',
            shared_entity_id: sharedComponentRow.id,
            target_object_id: objectRows[0]?.id,
            is_excluded: false,
            is_active: true,
            sort_order: 0
        })
        expect(overrideRows[1]).toMatchObject({
            entity_kind: 'constant',
            shared_entity_id: sharedConstantRow.id,
            target_object_id: objectRows[1]?.id,
            is_excluded: false,
            is_active: true,
            sort_order: 0
        })
        expect(overrideRows[2]).toMatchObject({
            entity_kind: 'value',
            shared_entity_id: sharedValueRow.id,
            target_object_id: objectRows[2]?.id,
            is_excluded: true,
            is_active: true,
            sort_order: 1
        })
    })

    it('handles empty snapshot gracefully', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {},
            fixedValues: {},
            optionValues: {},
            elements: {}
        })

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_objects']).toBeUndefined()
    })

    it('preserves snapshot ids for restored enumeration values and elements', async () => {
        const snapshot = makeMinimalSnapshot({
            entities: {
                'old-object-id': {
                    id: 'old-object-id',
                    kind: 'object',
                    codename: 'products',
                    presentation: { name: { en: 'Products' }, description: {} },
                    config: {},
                    fields: [
                        {
                            id: 'status-field-id',
                            codename: 'status',
                            dataType: 'REF',
                            isRequired: true,
                            isDisplayComponent: false,
                            targetEntityId: 'old-enum-id',
                            targetEntityKind: 'enumeration',
                            presentation: { name: { en: 'Status' }, description: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1
                        }
                    ]
                },
                'old-enum-id': {
                    id: 'old-enum-id',
                    kind: 'enumeration',
                    codename: 'moduleStatus',
                    presentation: { name: { en: 'Module status' }, description: {} },
                    config: {},
                    fields: []
                }
            },
            optionValues: {
                'old-enum-id': [
                    {
                        id: 'enum-value-id',
                        objectId: 'old-enum-id',
                        codename: 'Published',
                        presentation: { name: { en: 'Published' } },
                        sortOrder: 1,
                        isDefault: true
                    }
                ]
            },
            elements: {
                'old-object-id': [
                    {
                        id: 'element-id',
                        objectId: 'old-object-id',
                        data: { status: 'enum-value-id' },
                        sortOrder: 1
                    }
                ]
            }
        } as unknown as MetahubSnapshot)

        const { knex, insertedRows } = createMockKnex()
        const service = new SnapshotRestoreService(knex as any, 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')

        await service.restoreFromSnapshot('metahub-1', snapshot, 'user-1')

        expect(insertedRows['_mhb_values']?.[0]).toMatchObject({
            id: 'enum-value-id'
        })
        expect(insertedRows['_mhb_elements']?.[0]).toMatchObject({
            id: 'element-id',
            data: { status: 'enum-value-id' }
        })
    })
})
