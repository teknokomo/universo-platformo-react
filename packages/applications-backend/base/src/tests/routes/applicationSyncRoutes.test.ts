import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockSchemaHasTable = jest.fn(async () => false)
const createNoopQueryBuilder = () => {
    let result: unknown = []
    const builder = {
        withSchema: jest.fn(() => builder),
        from: jest.fn(() => builder),
        table: jest.fn(() => builder),
        into: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        orWhere: jest.fn(() => builder),
        whereIn: jest.fn(() => builder),
        whereNotIn: jest.fn(() => builder),
        select: jest.fn(() => {
            result = []
            return builder
        }),
        orderBy: jest.fn(() => builder),
        first: jest.fn(() => {
            result = undefined
            return builder
        }),
        update: jest.fn(() => {
            result = 0
            return builder
        }),
        insert: jest.fn(() => {
            result = []
            return builder
        }),
        del: jest.fn(() => {
            result = 0
            return builder
        }),
        onConflict: jest.fn(() => builder),
        merge: jest.fn(() => {
            result = []
            return builder
        }),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
        catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
        finally: (callback: () => void) => Promise.resolve(result).finally(callback)
    }

    return builder
}
const mockTransactionContext = {
    schema: {
        withSchema: jest.fn(() => ({
            hasTable: mockSchemaHasTable
        }))
    },
    withSchema: jest.fn(() => createNoopQueryBuilder()),
    raw: jest.fn((value: unknown) => value)
}

const mockKnex = {
    transaction: jest.fn(async (callback: (trx: Record<string, unknown>) => Promise<unknown>) => callback(mockTransactionContext)),
    schema: {
        withSchema: jest.fn(() => ({
            hasTable: mockSchemaHasTable
        }))
    }
}

const mockEnsureApplicationAccess = jest.fn()
const mockFindApplicationCopySource = jest.fn()
const mockFindFirstConnectorByApplicationId = jest.fn()
const mockFindFirstConnectorPublicationLinkByConnectorId = jest.fn()
const mockUpdateApplicationSyncFields = jest.fn()
const mockAcquireAdvisoryLock = jest.fn()
const mockReleaseAdvisoryLock = jest.fn()
const mockPersistApplicationSchemaSyncState = jest.fn()
const mockPersistConnectorSyncTouch = jest.fn()

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => mockKnex)
}))

jest.mock('@universo/schema-ddl', () => ({
    __esModule: true,
    createDDLServices: jest.fn(),
    buildSchemaSnapshot: jest.fn((entities: unknown[]) => ({
        version: 1,
        generatedAt: '2026-03-13T10:00:00.000Z',
        hasSystemTables: true,
        entities: Object.fromEntries((entities as Array<{ id?: string }>).map((entity, index) => [entity.id ?? String(index), entity]))
    })),
    calculateSchemaDiff: jest.fn((oldSnapshot: { entities?: Record<string, unknown> } | null, entities: unknown[]) => {
        const previousEntities = Object.values(oldSnapshot?.entities ?? {})
        const hasChanges = JSON.stringify(previousEntities) !== JSON.stringify(entities)

        return {
            hasChanges,
            destructive: [],
            additive: hasChanges ? [{ description: 'Apply release bundle diff' }] : [],
            summary: hasChanges ? 'Apply release bundle diff' : 'No schema changes'
        }
    }),
    generateSchemaName: jest.fn((id: string) => `app_${id.replace(/-/g, '')}`),
    generateTableName: jest.fn(),
    generateColumnName: jest.fn(),
    generateChildTableName: jest.fn(),
    generateMigrationName: jest.fn(),
    uuidToLockKey: jest.fn((value: string) => value),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args)
}))

jest.mock('../../routes/guards', () => ({
    __esModule: true,
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args)
}))

jest.mock('../../persistence/applicationsStore', () => ({
    __esModule: true,
    updateApplicationSyncFields: (...args: unknown[]) => mockUpdateApplicationSyncFields(...args),
    findApplicationCopySource: (...args: unknown[]) => mockFindApplicationCopySource(...args)
}))

jest.mock('../../persistence/connectorsStore', () => ({
    __esModule: true,
    findFirstConnectorByApplicationId: (...args: unknown[]) => mockFindFirstConnectorByApplicationId(...args),
    findFirstConnectorPublicationLinkByConnectorId: (...args: unknown[]) => mockFindFirstConnectorPublicationLinkByConnectorId(...args)
}))

jest.mock('../../services/ApplicationSchemaSyncStateStore', () => ({
    __esModule: true,
    persistApplicationSchemaSyncState: (...args: unknown[]) => mockPersistApplicationSchemaSyncState(...args)
}))

jest.mock('../../services/ConnectorSyncTouchStore', () => ({
    __esModule: true,
    persistConnectorSyncTouch: (...args: unknown[]) => mockPersistConnectorSyncTouch(...args)
}))

import { createApplicationSyncRoutes } from '../../routes/applicationSyncRoutes'
import { calculateSchemaDiff, createDDLServices } from '@universo/schema-ddl'
import {
    calculateApplicationReleaseChecksum,
    calculateCanonicalApplicationReleaseSnapshotHash,
    createApplicationReleaseBundle,
    resolveApplicationReleaseSnapshotHash
} from '../../services/applicationReleaseBundle'

describe('applicationSyncRoutes', () => {
    const mockedCreateDDLServices = createDDLServices as jest.Mock
    const mockedCalculateSchemaDiff = calculateSchemaDiff as jest.Mock

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as Request & { user?: { id: string } }).user = { id: 'user-1' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) {
            return _next(err)
        }

        const statusCode = err.statusCode ?? err.status ?? 500
        res.status(statusCode).json({ error: err.message || 'Internal Server Error' })
    }

    const exec = {
        query: jest.fn(),
        schema: {
            withSchema: jest.fn(() => ({
                hasTable: mockSchemaHasTable
            }))
        }
    }
    const baseCatalogEntity = {
        id: 'catalog-products',
        codename: 'products',
        kind: 'catalog',
        fields: [],
        presentation: { name: {} },
        config: {},
        physicalTableName: 'products'
    }
    const baseSyncContext = {
        publicationId: 'publication-1',
        publicationVersionId: 'publication-version-1',
        snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(
            {
                versionEnvelope: {
                    structureVersion: '53.0.0',
                    templateVersion: null,
                    snapshotFormatVersion: 1 as const
                },
                entities: {
                    'catalog-products': baseCatalogEntity
                },
                elements: {},
                layouts: []
            },
            'publication'
        ),
        snapshot: {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-products': baseCatalogEntity
            },
            elements: {},
            layouts: []
        },
        entities: [baseCatalogEntity],
        publicationSnapshot: {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-products': baseCatalogEntity
            },
            elements: {},
            layouts: []
        }
    }
    const previousSchemaSnapshot = createApplicationReleaseBundle({
        applicationId: 'application-1',
        applicationKey: 'application-1',
        releaseVersion: 'publication-version-0',
        sourceKind: 'publication',
        snapshot: {
            entities: {}
        },
        snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash({ entities: {} } as never, 'publication'),
        publicationId: 'publication-1',
        publicationVersionId: 'publication-version-0'
    }).incrementalMigration.payload.schemaSnapshot

    const configureDdlServices = (options?: {
        schemaExists?: boolean
        latestMigrations?: unknown[]
        diff?: {
            hasChanges: boolean
            destructive: Array<{ description: string }>
            additive: Array<{ description: string }>
            summary: string
        }
        generateFullSchemaResult?: {
            success: boolean
            schemaName: string
            tablesCreated: string[]
            errors?: string[]
        }
        applyAllChangesResult?: {
            success: boolean
            changesApplied: string[]
            errors?: string[]
        }
    }) => {
        const generator = {
            schemaExists: jest.fn().mockResolvedValue(options?.schemaExists ?? false),
            generateFullSchema: jest.fn().mockResolvedValue(
                options?.generateFullSchemaResult ?? {
                    success: true,
                    schemaName: 'app_application1',
                    tablesCreated: ['products'],
                    errors: []
                }
            ),
            generateSnapshot: jest.fn(() => ({ entities: [] })),
            syncSystemMetadata: jest.fn(),
            ensureSystemTables: jest.fn().mockResolvedValue(undefined)
        }
        const migrator = {
            calculateDiff: jest.fn().mockReturnValue(
                options?.diff ?? {
                    hasChanges: true,
                    destructive: [],
                    additive: [{ description: 'Add products table' }],
                    summary: 'Add products table'
                }
            ),
            applyAllChanges: jest.fn().mockResolvedValue(
                options?.applyAllChangesResult ?? {
                    success: true,
                    changesApplied: ['Add products table'],
                    errors: []
                }
            )
        }
        const latestMigrations = options?.latestMigrations ?? [{ meta: { seedWarnings: [] } }]
        const migrationManager = {
            getLatestMigration: jest.fn(),
            recordMigration: jest.fn().mockResolvedValue('migration-1')
        }

        for (const latestMigration of latestMigrations) {
            migrationManager.getLatestMigration.mockResolvedValueOnce(latestMigration)
        }

        mockedCreateDDLServices.mockReturnValue({ generator, migrator, migrationManager })
        return { generator, migrator, migrationManager }
    }

    const buildApp = (loadPublishedApplicationSyncContext: jest.Mock) => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createApplicationSyncRoutes(
                ensureAuth,
                () => exec as never,
                loadPublishedApplicationSyncContext,
                mockRateLimiter,
                mockRateLimiter
            )
        )
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockedCreateDDLServices.mockReset()
        exec.query.mockReset()
        mockSchemaHasTable.mockReset()
        mockSchemaHasTable.mockResolvedValue(false)
        mockedCalculateSchemaDiff.mockClear()
        mockTransactionContext.schema.withSchema.mockClear()
        mockKnex.transaction.mockImplementation(async (callback: (trx: Record<string, unknown>) => Promise<unknown>) =>
            callback(mockTransactionContext)
        )
        mockEnsureApplicationAccess.mockResolvedValue(undefined)
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: null,
            schemaStatus: 'draft',
            installedReleaseMetadata: null
        })
        mockFindFirstConnectorByApplicationId.mockResolvedValue({ id: 'connector-1' })
        mockFindFirstConnectorPublicationLinkByConnectorId.mockResolvedValue({
            id: 'link-1',
            publicationId: 'publication-1'
        })
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
    })

    it('returns 400 on sync when the publication-owned context seam returns null', async () => {
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(null)

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(400)

        expect(response.body).toEqual({
            error: 'Publication sync context unavailable',
            message: 'Linked publication must exist and have a valid active version to sync.'
        })
        expect(loadPublishedApplicationSyncContext).toHaveBeenCalledWith(exec, 'publication-1')
        expect(mockReleaseAdvisoryLock).toHaveBeenCalledTimes(1)
    })

    it('returns 400 on diff when the publication-owned context seam returns null', async () => {
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(null)

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).get('/application/application-1/diff').expect(400)

        expect(response.body).toEqual({
            error: 'Publication sync context unavailable',
            message: 'Linked publication must exist and have a valid active version to sync.'
        })
        expect(loadPublishedApplicationSyncContext).toHaveBeenCalledWith(exec, 'publication-1')
    })

    it('returns created when the application-owned route provisions a new schema successfully', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft'
        })
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(baseSyncContext)
        const { generator, migrationManager } = configureDdlServices({
            schemaExists: false,
            latestMigrations: [{ meta: { seedWarnings: [] } }],
            generateFullSchemaResult: {
                success: true,
                schemaName: 'app_application1',
                tablesCreated: ['products'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(response.body).toEqual({
            status: 'created',
            schemaName: 'app_application1',
            tablesCreated: ['products'],
            message: 'Schema created with 1 table(s)'
        })
        expect(generator.schemaExists).toHaveBeenCalledWith('app_application1')
        expect(generator.generateFullSchema).toHaveBeenCalledWith(
            'app_application1',
            baseSyncContext.entities,
            expect.objectContaining({
                recordMigration: true,
                migrationDescription: 'initial_schema',
                publicationSnapshot: baseSyncContext.publicationSnapshot,
                afterMigrationRecorded: expect.any(Function)
            })
        )
        expect(migrationManager.getLatestMigration).toHaveBeenCalledWith('app_application1')
        expect(mockUpdateApplicationSyncFields).toHaveBeenNthCalledWith(
            1,
            exec,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaName: 'app_application1',
                userId: 'user-1'
            })
        )
        expect(mockUpdateApplicationSyncFields).toHaveBeenNthCalledWith(
            2,
            exec,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaStatus: 'maintenance',
                userId: 'user-1'
            })
        )
    })

    it('includes TABLE child field metadata in create diff details for preview rendering', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft'
        })

        const tableFieldId = '019d1104-1add-7a40-974a-bd58f6f5e6b2'
        const childFieldId = '019d1105-0d7b-73ea-ab5c-8c513518e0c3'

        const previewSnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-resources': {
                    id: 'catalog-resources',
                    codename: 'resources',
                    kind: 'catalog',
                    fields: [
                        {
                            id: tableFieldId,
                            codename: 'NestedResources',
                            dataType: 'TABLE',
                            isRequired: false,
                            isDisplayAttribute: false,
                            presentation: { name: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1,
                            childFields: [
                                {
                                    id: childFieldId,
                                    codename: 'NestedTitle',
                                    dataType: 'STRING',
                                    isRequired: true,
                                    isDisplayAttribute: true,
                                    presentation: { name: {} },
                                    validationRules: { localized: true },
                                    uiConfig: {},
                                    sortOrder: 1,
                                    parentAttributeId: tableFieldId
                                }
                            ]
                        }
                    ],
                    presentation: { name: {} },
                    config: {},
                    physicalTableName: 'resources'
                }
            },
            elements: {
                'catalog-resources': [
                    {
                        id: 'element-1',
                        sortOrder: 0,
                        data: {
                            NestedResources: [
                                {
                                    NestedTitle: {
                                        _schema: '1',
                                        _primary: 'ru',
                                        locales: {
                                            ru: {
                                                content: 'Чистая вода',
                                                version: 1,
                                                isActive: true
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            layouts: []
        }

        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue({
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(previewSnapshot, 'publication'),
            snapshot: previewSnapshot,
            entities: Object.values(previewSnapshot.entities),
            publicationSnapshot: previewSnapshot
        })

        configureDdlServices({
            schemaExists: false
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).get('/application/application-1/diff').expect(200)

        expect(response.body.diff.details.create.tables[0].fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: childFieldId,
                    parentAttributeId: tableFieldId
                })
            ])
        )
        expect(response.body.diff.details.create.tables[0].predefinedElementsPreview[0].data.NestedResources).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    NestedTitle: expect.objectContaining({
                        _primary: 'ru'
                    })
                })
            ])
        )
    })

    it('hydrates publication lifecycle contract into the generated schema payload', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft'
        })

        const syncContextWithDisabledLifecycleFields = {
            ...baseSyncContext,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(
                {
                    ...baseSyncContext.snapshot,
                    systemFields: {
                        'catalog-products': {
                            fields: [
                                { key: 'app.published', enabled: false },
                                { key: 'app.published_at', enabled: false },
                                { key: 'app.published_by', enabled: false },
                                { key: 'app.archived', enabled: false },
                                { key: 'app.archived_at', enabled: false },
                                { key: 'app.archived_by', enabled: false },
                                { key: 'app.deleted', enabled: false },
                                { key: 'app.deleted_at', enabled: false },
                                { key: 'app.deleted_by', enabled: false }
                            ],
                            lifecycleContract: {
                                publish: { enabled: false, trackAt: false, trackBy: false },
                                archive: { enabled: false, trackAt: false, trackBy: false },
                                delete: { mode: 'hard', trackAt: false, trackBy: false }
                            }
                        }
                    }
                },
                'publication'
            ),
            snapshot: {
                ...baseSyncContext.snapshot,
                systemFields: {
                    'catalog-products': {
                        fields: [
                            { key: 'app.published', enabled: false },
                            { key: 'app.published_at', enabled: false },
                            { key: 'app.published_by', enabled: false },
                            { key: 'app.archived', enabled: false },
                            { key: 'app.archived_at', enabled: false },
                            { key: 'app.archived_by', enabled: false },
                            { key: 'app.deleted', enabled: false },
                            { key: 'app.deleted_at', enabled: false },
                            { key: 'app.deleted_by', enabled: false }
                        ],
                        lifecycleContract: {
                            publish: { enabled: false, trackAt: false, trackBy: false },
                            archive: { enabled: false, trackAt: false, trackBy: false },
                            delete: { mode: 'hard', trackAt: false, trackBy: false }
                        }
                    }
                }
            },
            publicationSnapshot: {
                ...baseSyncContext.publicationSnapshot,
                systemFields: {
                    'catalog-products': {
                        fields: [
                            { key: 'app.published', enabled: false },
                            { key: 'app.published_at', enabled: false },
                            { key: 'app.published_by', enabled: false },
                            { key: 'app.archived', enabled: false },
                            { key: 'app.archived_at', enabled: false },
                            { key: 'app.archived_by', enabled: false },
                            { key: 'app.deleted', enabled: false },
                            { key: 'app.deleted_at', enabled: false },
                            { key: 'app.deleted_by', enabled: false }
                        ],
                        lifecycleContract: {
                            publish: { enabled: false, trackAt: false, trackBy: false },
                            archive: { enabled: false, trackAt: false, trackBy: false },
                            delete: { mode: 'hard', trackAt: false, trackBy: false }
                        }
                    }
                }
            }
        }
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(syncContextWithDisabledLifecycleFields)
        const { generator } = configureDdlServices({
            schemaExists: false,
            latestMigrations: [{ meta: { seedWarnings: [] } }],
            generateFullSchemaResult: {
                success: true,
                schemaName: 'app_application1',
                tablesCreated: ['products'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(generator.generateFullSchema).toHaveBeenCalledWith(
            'app_application1',
            [
                expect.objectContaining({
                    id: 'catalog-products',
                    config: expect.objectContaining({
                        systemFields: expect.objectContaining({
                            lifecycleContract: {
                                publish: { enabled: false, trackAt: false, trackBy: false },
                                archive: { enabled: false, trackAt: false, trackBy: false },
                                delete: { mode: 'hard', trackAt: false, trackBy: false }
                            }
                        })
                    })
                })
            ],
            expect.objectContaining({
                recordMigration: true
            })
        )
    })

    it('normalizes publication TABLE child fields and set constants before initial schema generation', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft'
        })

        const tableFieldId = '019d1104-1add-7a40-974a-bd58f6f5e6b2'
        const childFieldId = '019d1105-0d7b-73ea-ab5c-8c513518e0c3'
        const setFieldId = '019d10e2-8c41-7725-813e-598731237ab2'
        const setId = '019d0d8e-ddb0-7c8f-93f4-11048896d993'
        const constantId = '019d10d1-79ec-78bf-a0d9-1768ee647b33'

        const rawCatalogEntity = {
            id: 'catalog-resources',
            codename: 'resources',
            kind: 'catalog',
            fields: [
                {
                    id: tableFieldId,
                    codename: 'NestedResources',
                    dataType: 'TABLE',
                    isRequired: false,
                    isDisplayAttribute: false,
                    presentation: { name: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 1,
                    childFields: [
                        {
                            id: childFieldId,
                            codename: 'NestedTitle',
                            dataType: 'STRING',
                            isRequired: true,
                            isDisplayAttribute: true,
                            presentation: { name: {} },
                            validationRules: { localized: true, versioned: true },
                            uiConfig: {},
                            sortOrder: 1,
                            parentAttributeId: tableFieldId
                        }
                    ]
                },
                {
                    id: setFieldId,
                    codename: 'Motto',
                    dataType: 'REF',
                    isRequired: false,
                    isDisplayAttribute: false,
                    targetEntityId: setId,
                    targetEntityKind: 'set',
                    targetConstantId: constantId,
                    presentation: { name: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 2
                }
            ],
            presentation: { name: {} },
            config: {},
            physicalTableName: 'resources'
        }

        const complexSyncSnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-resources': rawCatalogEntity
            },
            constants: {
                [setId]: [
                    {
                        id: constantId,
                        objectId: setId,
                        codename: 'MottoConstant',
                        dataType: 'STRING',
                        presentation: {
                            name: {
                                _schema: '1',
                                _primary: 'ru',
                                locales: {
                                    ru: { content: 'Девиз', version: 1, isActive: true }
                                }
                            }
                        },
                        validationRules: {},
                        uiConfig: {},
                        value: {
                            _schema: '1',
                            _primary: 'ru',
                            locales: {
                                ru: { content: 'Все миры будут нашими!', version: 1, isActive: true }
                            }
                        },
                        sortOrder: 0
                    }
                ]
            },
            elements: {},
            layouts: []
        }

        const syncContextWithNestedPublicationFields = {
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(complexSyncSnapshot, 'publication'),
            snapshot: complexSyncSnapshot,
            entities: [rawCatalogEntity],
            publicationSnapshot: complexSyncSnapshot
        }

        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(syncContextWithNestedPublicationFields)
        const { generator } = configureDdlServices({
            schemaExists: false,
            latestMigrations: [{ meta: { seedWarnings: [] } }],
            generateFullSchemaResult: {
                success: true,
                schemaName: 'app_application1',
                tablesCreated: ['resources'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(generator.generateFullSchema).toHaveBeenCalledWith(
            'app_application1',
            [
                expect.objectContaining({
                    id: 'catalog-resources',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            id: tableFieldId,
                            dataType: 'TABLE',
                            childFields: [
                                expect.objectContaining({
                                    id: childFieldId,
                                    parentAttributeId: tableFieldId
                                })
                            ]
                        }),
                        expect.objectContaining({
                            id: childFieldId,
                            parentAttributeId: tableFieldId,
                            dataType: 'STRING'
                        }),
                        expect.objectContaining({
                            id: setFieldId,
                            targetConstantId: constantId,
                            uiConfig: expect.objectContaining({
                                targetConstantId: constantId,
                                setConstantRef: expect.objectContaining({
                                    id: constantId,
                                    codename: 'MottoConstant',
                                    dataType: 'STRING',
                                    value: expect.objectContaining({
                                        _primary: 'ru'
                                    })
                                })
                            })
                        })
                    ])
                })
            ],
            expect.objectContaining({
                recordMigration: true
            })
        )
    })

    it('migrates an existing schema even when publication hash matches but the executable payload changed', async () => {
        const tableFieldId = '019d1104-1add-7a40-974a-bd58f6f5e6b2'
        const childFieldId = '019d1105-0d7b-73ea-ab5c-8c513518e0c3'
        const setFieldId = '019d10e2-8c41-7725-813e-598731237ab2'
        const setId = '019d0d8e-ddb0-7c8f-93f4-11048896d993'
        const constantId = '019d10d1-79ec-78bf-a0d9-1768ee647b33'

        const rawCatalogEntity = {
            id: 'catalog-resources',
            codename: 'resources',
            kind: 'catalog',
            fields: [
                {
                    id: tableFieldId,
                    codename: 'NestedResources',
                    dataType: 'TABLE',
                    isRequired: false,
                    isDisplayAttribute: false,
                    presentation: { name: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 1,
                    childFields: [
                        {
                            id: childFieldId,
                            codename: 'NestedTitle',
                            dataType: 'STRING',
                            isRequired: true,
                            isDisplayAttribute: true,
                            presentation: { name: {} },
                            validationRules: { localized: true, versioned: true },
                            uiConfig: {},
                            sortOrder: 1,
                            parentAttributeId: tableFieldId
                        }
                    ]
                },
                {
                    id: setFieldId,
                    codename: 'Motto',
                    dataType: 'REF',
                    isRequired: false,
                    isDisplayAttribute: false,
                    targetEntityId: setId,
                    targetEntityKind: 'set',
                    targetConstantId: constantId,
                    presentation: { name: {} },
                    validationRules: {},
                    uiConfig: {},
                    sortOrder: 2
                }
            ],
            presentation: { name: {} },
            config: {},
            physicalTableName: 'resources'
        }

        const publicationSnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-resources': rawCatalogEntity
            },
            constants: {
                [setId]: [
                    {
                        id: constantId,
                        objectId: setId,
                        codename: 'MottoConstant',
                        dataType: 'STRING',
                        presentation: {
                            name: {
                                _schema: '1',
                                _primary: 'ru',
                                locales: {
                                    ru: { content: 'Девиз', version: 1, isActive: true }
                                }
                            }
                        },
                        validationRules: {},
                        uiConfig: {},
                        value: {
                            _schema: '1',
                            _primary: 'ru',
                            locales: {
                                ru: { content: 'Все миры будут нашими!', version: 1, isActive: true }
                            }
                        },
                        sortOrder: 0
                    }
                ]
            },
            elements: {},
            layouts: []
        }
        const publicationSnapshotHash = calculateCanonicalApplicationReleaseSnapshotHash(publicationSnapshot, 'publication')

        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: {
                version: 1,
                generatedAt: '2026-03-13T09:00:00.000Z',
                hasSystemTables: true,
                entities: {
                    'catalog-resources': {
                        id: 'catalog-resources',
                        codename: 'resources',
                        kind: 'catalog',
                        fields: [
                            {
                                id: tableFieldId,
                                codename: 'NestedResources',
                                dataType: 'TABLE',
                                childFields: [
                                    {
                                        id: childFieldId,
                                        codename: 'NestedTitle',
                                        dataType: 'STRING',
                                        parentAttributeId: tableFieldId
                                    }
                                ]
                            },
                            {
                                id: setFieldId,
                                codename: 'Motto',
                                dataType: 'REF',
                                targetEntityId: setId,
                                targetEntityKind: 'set',
                                targetConstantId: constantId,
                                uiConfig: {
                                    setConstantRef: {
                                        id: constantId
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            schemaStatus: 'ready',
            installedReleaseMetadata: {
                releaseVersion: 'publication-version-1',
                snapshotHash: publicationSnapshotHash
            }
        })

        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue({
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            snapshotHash: publicationSnapshotHash,
            snapshot: publicationSnapshot,
            entities: [rawCatalogEntity],
            publicationSnapshot
        })
        const { migrator } = configureDdlServices({
            schemaExists: true,
            latestMigrations: [{ meta: { publicationSnapshotHash } }, { meta: { seedWarnings: [] } }],
            applyAllChangesResult: {
                success: true,
                changesApplied: ['Repair resources schema'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(response.body).toEqual({
            status: 'migrated',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            changesApplied: ['Repair resources schema'],
            message: 'Schema migration applied successfully'
        })
        expect(migrator.applyAllChanges).toHaveBeenCalledWith(
            'app_019ccefc2f7b7b3682f485cdb1312268',
            expect.objectContaining({
                hasChanges: true
            }),
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'catalog-resources',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            id: childFieldId,
                            parentAttributeId: tableFieldId
                        }),
                        expect.objectContaining({
                            id: setFieldId,
                            uiConfig: expect.objectContaining({
                                setConstantRef: expect.objectContaining({
                                    id: constantId,
                                    codename: 'MottoConstant'
                                })
                            })
                        })
                    ])
                })
            ]),
            false,
            expect.objectContaining({
                migrationDescription: 'schema_sync',
                publicationSnapshot,
                afterMigrationRecorded: expect.any(Function)
            })
        )
    })

    it('returns pending_confirmation when destructive changes are detected without confirmation', async () => {
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(baseSyncContext)
        const { migrator } = configureDdlServices({
            schemaExists: true,
            latestMigrations: [{ meta: { publicationSnapshotHash: 'old-hash' } }],
            diff: {
                hasChanges: true,
                destructive: [{ description: 'Drop products table' }],
                additive: [{ description: 'Add products table' }],
                summary: 'Needs destructive confirmation'
            }
        })
        const destructiveDiff = {
            hasChanges: true,
            destructive: [{ description: 'Drop products table' }],
            additive: [{ description: 'Add products table' }],
            summary: 'Needs destructive confirmation'
        }
        mockedCalculateSchemaDiff.mockReturnValueOnce(destructiveDiff)
        mockedCalculateSchemaDiff.mockReturnValueOnce(destructiveDiff)

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(response.body).toEqual({
            status: 'pending_confirmation',
            diff: {
                hasChanges: true,
                hasDestructiveChanges: true,
                additive: ['Add products table'],
                destructive: ['Drop products table'],
                summary: 'Needs destructive confirmation'
            },
            message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
        })
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
        expect(mockUpdateApplicationSyncFields).toHaveBeenNthCalledWith(
            1,
            exec,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaStatus: 'maintenance',
                userId: 'user-1'
            })
        )
        expect(mockUpdateApplicationSyncFields).toHaveBeenNthCalledWith(
            2,
            exec,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaStatus: 'outdated',
                userId: 'user-1'
            })
        )
    })

    it('returns migrated when schema changes are applied successfully by the application-owned route', async () => {
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(baseSyncContext)
        const { migrator } = configureDdlServices({
            schemaExists: true,
            latestMigrations: [{ meta: { publicationSnapshotHash: 'old-hash' } }, { meta: { seedWarnings: [] } }],
            diff: {
                hasChanges: true,
                destructive: [],
                additive: [{ description: 'Add products table' }],
                summary: 'Add products table'
            },
            applyAllChangesResult: {
                success: true,
                changesApplied: ['Add products table'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(response.body).toEqual({
            status: 'migrated',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            changesApplied: ['Add products table'],
            message: 'Schema migration applied successfully'
        })
        expect(migrator.applyAllChanges).toHaveBeenCalledWith(
            'app_019ccefc2f7b7b3682f485cdb1312268',
            expect.objectContaining({
                hasChanges: true,
                destructive: []
            }),
            baseSyncContext.entities,
            false,
            expect.objectContaining({
                recordMigration: true,
                migrationDescription: 'schema_sync',
                publicationSnapshot: baseSyncContext.publicationSnapshot,
                afterMigrationRecorded: expect.any(Function)
            })
        )
        expect(mockUpdateApplicationSyncFields).toHaveBeenCalledWith(
            exec,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaStatus: 'maintenance',
                userId: 'user-1'
            })
        )
    })

    it('exports the canonical application release bundle from the linked publication', async () => {
        const loadPublishedApplicationSyncContext = jest.fn().mockResolvedValue(baseSyncContext)

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).get('/application/application-1/release-bundle').expect(200)

        expect(response.body.bundle).toEqual(
            expect.objectContaining({
                kind: 'application_release_bundle',
                bundleVersion: 1,
                applicationKey: 'application-1',
                releaseVersion: 'publication-version-1',
                manifest: expect.objectContaining({
                    publicationId: 'publication-1',
                    publicationVersionId: 'publication-version-1',
                    snapshotHash: baseSyncContext.snapshotHash
                })
            })
        )
    })

    it('exports the canonical application release bundle from the existing application runtime', async () => {
        const installedReleaseSchemaSnapshot = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot
        }).incrementalMigration.payload.schemaSnapshot

        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            slug: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: null,
            schemaStatus: 'ready',
            appStructureVersion: 7,
            installedReleaseMetadata: {
                sourceKind: 'publication',
                releaseVersion: 'publication-version-1',
                snapshotHash: 'publication-snapshot-hash',
                baseSchemaSnapshot: previousSchemaSnapshot,
                releaseSchemaSnapshot: installedReleaseSchemaSnapshot
            }
        })
        exec.query.mockImplementation(async (sql: string) => {
            if (sql.includes('._app_objects')) {
                return [
                    {
                        id: 'catalog-1',
                        kind: 'catalog',
                        codename: 'products',
                        table_name: 'products',
                        presentation: { name: {} },
                        config: {}
                    },
                    {
                        id: 'set-1',
                        kind: 'set',
                        codename: 'statuses',
                        table_name: 'set_statuses',
                        presentation: { name: {} },
                        config: {}
                    }
                ]
            }
            if (sql.includes('._app_attributes')) {
                return [
                    {
                        id: 'field-1',
                        object_id: 'catalog-1',
                        codename: 'title',
                        sort_order: 0,
                        column_name: 'col_title',
                        data_type: 'STRING',
                        is_required: false,
                        is_display_attribute: true,
                        target_object_id: null,
                        target_object_kind: null,
                        parent_attribute_id: null,
                        presentation: { name: {} },
                        validation_rules: {},
                        ui_config: {}
                    },
                    {
                        id: 'field-2',
                        object_id: 'catalog-1',
                        codename: 'status',
                        sort_order: 1,
                        column_name: 'col_status',
                        data_type: 'REF',
                        is_required: false,
                        is_display_attribute: false,
                        target_object_id: 'set-1',
                        target_object_kind: 'set',
                        parent_attribute_id: null,
                        presentation: { name: {} },
                        validation_rules: {},
                        ui_config: {
                            targetConstantId: 'constant-1',
                            setConstantRef: {
                                id: 'constant-1',
                                codename: 'active',
                                dataType: 'STRING',
                                value: 'active',
                                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Active', version: 1, isActive: true } } }
                            }
                        }
                    }
                ]
            }
            if (sql.includes('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."products"')) {
                return [
                    {
                        id: 'element-1',
                        col_title: 'Hello runtime',
                        col_status: 'constant-1'
                    }
                ]
            }
            return []
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).get('/application/application-1/release-bundle?source=application').expect(200)

        expect(response.body.bundle).toEqual(
            expect.objectContaining({
                kind: 'application_release_bundle',
                bundleVersion: 1,
                applicationKey: 'application-1',
                releaseVersion: expect.stringMatching(/^application-runtime-v7-/),
                incrementalMigration: expect.objectContaining({
                    fromVersion: 'publication-version-1'
                }),
                manifest: expect.objectContaining({
                    sourceKind: 'application',
                    publicationId: null,
                    publicationVersionId: null
                }),
                snapshot: expect.objectContaining({
                    entities: expect.objectContaining({
                        'catalog-1': expect.objectContaining({
                            codename: 'products'
                        })
                    }),
                    elements: expect.objectContaining({
                        'catalog-1': [
                            expect.objectContaining({
                                id: 'element-1',
                                data: expect.objectContaining({
                                    title: 'Hello runtime',
                                    status: 'constant-1'
                                })
                            })
                        ]
                    }),
                    constants: expect.objectContaining({
                        'set-1': [
                            expect.objectContaining({
                                id: 'constant-1',
                                codename: 'active',
                                value: 'active'
                            })
                        ]
                    })
                })
            })
        )
        expect(response.body.bundle.incrementalMigration.fromVersion).toBe('publication-version-1')
        expect(response.body.bundle.incrementalMigration.baseSchemaSnapshot).toEqual(installedReleaseSchemaSnapshot)
        expect(mockFindFirstConnectorByApplicationId).not.toHaveBeenCalled()
        expect(loadPublishedApplicationSyncContext).not.toHaveBeenCalled()
    })

    it('reuses stored runtime release lineage when re-exporting an unchanged application-origin bundle', async () => {
        const expectedSnapshot = {
            versionEnvelope: {
                structureVersion: '7',
                templateVersion: 'application-runtime-v7-snapshot-hash',
                snapshotFormatVersion: 1
            },
            entities: {
                'catalog-1': {
                    id: 'catalog-1',
                    kind: 'catalog',
                    codename: 'products',
                    presentation: { name: {} },
                    fields: [
                        {
                            id: 'field-1',
                            codename: 'title',
                            dataType: 'STRING',
                            isRequired: false,
                            isDisplayAttribute: true,
                            targetEntityId: null,
                            targetEntityKind: null,
                            targetConstantId: null,
                            parentAttributeId: null,
                            presentation: { name: {} },
                            validationRules: {},
                            uiConfig: {},
                            physicalColumnName: 'col_title'
                        }
                    ],
                    physicalTableName: 'products',
                    config: {}
                }
            },
            elements: {
                'catalog-1': [
                    {
                        id: 'element-1',
                        data: {
                            title: 'Hello runtime'
                        },
                        sortOrder: 0
                    }
                ]
            }
        }
        const expectedSnapshotHash = resolveApplicationReleaseSnapshotHash(expectedSnapshot as never)
        const expectedBaseSchemaSnapshot = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: expectedSnapshot as never,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(expectedSnapshot as never, 'publication'),
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        }).incrementalMigration.payload.schemaSnapshot

        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            slug: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: null,
            schemaStatus: 'ready',
            appStructureVersion: 7,
            installedReleaseMetadata: {
                sourceKind: 'release_bundle',
                releaseVersion: 'application-runtime-v7-snapshot-hash',
                previousReleaseVersion: 'publication-version-1',
                snapshotHash: expectedSnapshotHash,
                baseSchemaSnapshot: expectedBaseSchemaSnapshot,
                releaseSchemaSnapshot: expectedBaseSchemaSnapshot
            }
        })
        exec.query.mockImplementation(async (sql: string) => {
            if (sql.includes('._app_objects')) {
                return [
                    {
                        id: 'catalog-1',
                        kind: 'catalog',
                        codename: 'products',
                        table_name: 'products',
                        presentation: { name: {} },
                        config: {}
                    }
                ]
            }
            if (sql.includes('._app_attributes')) {
                return [
                    {
                        id: 'field-1',
                        object_id: 'catalog-1',
                        codename: 'title',
                        sort_order: 0,
                        column_name: 'col_title',
                        data_type: 'STRING',
                        is_required: false,
                        is_display_attribute: true,
                        target_object_id: null,
                        target_object_kind: null,
                        parent_attribute_id: null,
                        presentation: { name: {} },
                        validation_rules: {},
                        ui_config: {}
                    }
                ]
            }
            if (sql.includes('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."products"')) {
                return [
                    {
                        id: 'element-1',
                        col_title: 'Hello runtime'
                    }
                ]
            }
            return []
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app).get('/application/application-1/release-bundle?source=application').expect(200)

        expect(response.body.bundle.releaseVersion).toBe('application-runtime-v7-snapshot-hash')
        expect(response.body.bundle.incrementalMigration.fromVersion).toBe('publication-version-1')
        expect(response.body.bundle.incrementalMigration.baseSchemaSnapshot).toEqual(expectedBaseSchemaSnapshot)
        expect(response.body.bundle.bootstrap.payload.entities).toEqual(expect.any(Array))
        expect(response.body.bundle.incrementalMigration.payload.schemaSnapshot).toEqual(
            expect.objectContaining({ entities: expect.any(Object) })
        )
    })

    it('applies a release bundle through the fresh-install baseline path without entering the legacy diff path', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft',
            installedReleaseMetadata: null
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const { generator, migrator } = configureDdlServices({
            schemaExists: false,
            latestMigrations: [{ meta: { seedWarnings: [] } }],
            generateFullSchemaResult: {
                success: true,
                schemaName: 'app_application1',
                tablesCreated: ['products'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(200)

        expect(response.body).toEqual({
            status: 'created',
            schemaName: 'app_application1',
            tablesCreated: ['products'],
            message: 'Schema created with 1 table(s)'
        })
        expect(generator.generateFullSchema).toHaveBeenCalledWith(
            'app_application1',
            bundle.bootstrap.payload.entities,
            expect.objectContaining({
                migrationDescription: 'initial_schema',
                publicationSnapshot: bundle.snapshot,
                afterMigrationRecorded: expect.any(Function)
            })
        )
        expect(loadPublishedApplicationSyncContext).not.toHaveBeenCalled()
        expect(generator.schemaExists).toHaveBeenCalledWith('app_application1')
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
    })

    it('applies a release bundle through the upgrade migration path', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: previousSchemaSnapshot,
            schemaStatus: 'draft',
            installedReleaseMetadata: {
                releaseVersion: 'publication-version-0'
            }
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const { migrator } = configureDdlServices({
            schemaExists: true,
            latestMigrations: [{ meta: { publicationSnapshotHash: 'old-hash' } }, { meta: { seedWarnings: [] } }],
            diff: {
                hasChanges: true,
                destructive: [],
                additive: [{ description: 'Add products table' }],
                summary: 'Add products table'
            },
            applyAllChangesResult: {
                success: true,
                changesApplied: ['Add products table'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(200)

        expect(response.body).toEqual({
            status: 'migrated',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            changesApplied: ['Add products table'],
            message: 'Schema migration applied successfully'
        })
        expect(migrator.applyAllChanges).toHaveBeenCalledWith(
            'app_019ccefc2f7b7b3682f485cdb1312268',
            bundle.incrementalMigration.diff,
            bundle.incrementalMigration.payload.entities,
            false,
            expect.objectContaining({
                migrationDescription: 'schema_sync',
                publicationSnapshot: bundle.snapshot,
                afterMigrationRecorded: expect.any(Function)
            })
        )
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
    })

    it('applies an application-origin release bundle through the upgrade migration path with preserved lineage', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: previousSchemaSnapshot,
            schemaStatus: 'draft',
            installedReleaseMetadata: {
                releaseVersion: 'publication-version-1'
            }
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'application-runtime-v53-abcdef123456',
            sourceKind: 'application',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(baseSyncContext.snapshot, 'application'),
            previousReleaseVersion: 'publication-version-1',
            previousSchemaSnapshot
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const { migrator } = configureDdlServices({
            schemaExists: true,
            latestMigrations: [{ meta: { publicationSnapshotHash: 'old-hash' } }, { meta: { seedWarnings: [] } }],
            diff: {
                hasChanges: true,
                destructive: [],
                additive: [{ description: 'Add products table' }],
                summary: 'Add products table'
            },
            applyAllChangesResult: {
                success: true,
                changesApplied: ['Add products table'],
                errors: []
            }
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(200)

        expect(response.body).toEqual({
            status: 'migrated',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            changesApplied: ['Add products table'],
            message: 'Schema migration applied successfully'
        })
        expect(migrator.applyAllChanges).toHaveBeenCalledTimes(1)
        expect(migrator.applyAllChanges).toHaveBeenCalledWith(
            'app_019ccefc2f7b7b3682f485cdb1312268',
            bundle.incrementalMigration.diff,
            bundle.incrementalMigration.payload.entities,
            false,
            expect.any(Object)
        )
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
    })

    it('rejects a release bundle when an executable artifact checksum is corrupted', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft',
            installedReleaseMetadata: null
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        })

        const corruptedBundle = {
            ...bundle,
            incrementalMigration: {
                ...bundle.incrementalMigration,
                checksum: 'corrupted'
            }
        }

        const loadPublishedApplicationSyncContext = jest.fn()
        const { generator, migrator } = configureDdlServices({
            schemaExists: true
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle: corruptedBundle })
            .expect(400)

        expect(response.body).toEqual({
            error: 'Invalid release bundle',
            message: 'Release bundle incremental checksum does not match the embedded executable payload'
        })
        expect(generator.schemaExists).not.toHaveBeenCalled()
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
    })

    it('rejects a release bundle when the manifest snapshot hash is tampered even if artifact checksums are recomputed', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: null,
            schemaSnapshot: null,
            schemaStatus: 'draft',
            installedReleaseMetadata: null
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        })

        const tamperedSnapshotHash = 'f'.repeat(64)
        const tamperedBundle = {
            ...bundle,
            manifest: {
                ...bundle.manifest,
                snapshotHash: tamperedSnapshotHash
            },
            bootstrap: {
                ...bundle.bootstrap,
                checksum: calculateApplicationReleaseChecksum({
                    applicationKey: bundle.applicationKey,
                    releaseVersion: bundle.releaseVersion,
                    snapshotHash: tamperedSnapshotHash,
                    bootstrap: bundle.bootstrap.payload
                })
            },
            incrementalMigration: {
                ...bundle.incrementalMigration,
                checksum: calculateApplicationReleaseChecksum({
                    applicationKey: bundle.applicationKey,
                    fromVersion: bundle.incrementalMigration.fromVersion,
                    toVersion: bundle.releaseVersion,
                    snapshotHash: tamperedSnapshotHash,
                    incrementalMigration: bundle.incrementalMigration.payload
                })
            }
        }

        const loadPublishedApplicationSyncContext = jest.fn()
        const { generator, migrator } = configureDdlServices({
            schemaExists: true
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle: tamperedBundle })
            .expect(400)

        expect(response.body).toEqual({
            error: 'Invalid release bundle',
            message: 'Application release snapshot hash does not match the embedded snapshot state'
        })
        expect(generator.schemaExists).not.toHaveBeenCalled()
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
    })

    it('rejects a release bundle when the expected prior release does not match the installed release metadata', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: previousSchemaSnapshot,
            schemaStatus: 'draft',
            installedReleaseMetadata: {
                releaseVersion: 'publication-version-9'
            }
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(409)

        expect(response.body).toEqual({
            error: 'Release version mismatch',
            message: 'Bundle expects installed release publication-version-0, but application currently has publication-version-9.'
        })
    })

    it('rejects an incremental bundle when the tracked schema snapshot diverges from the embedded base snapshot', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: {
                ...previousSchemaSnapshot,
                generatedAt: '2026-03-13T11:00:00.000Z',
                entities: {
                    existing_catalog: {
                        id: 'existing-catalog',
                        codename: 'existing',
                        kind: 'catalog',
                        fields: []
                    }
                }
            },
            schemaStatus: 'draft',
            installedReleaseMetadata: {
                releaseVersion: 'publication-version-0'
            }
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const { migrator } = configureDdlServices({
            schemaExists: true
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(409)

        expect(response.body).toEqual({
            status: 'error',
            error: 'Release schema snapshot mismatch',
            message:
                'Bundle incremental apply expects the tracked application schema snapshot to match the embedded base snapshot of the release.'
        })
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
    })

    it('rejects a baseline bundle for an existing schema when no installed release metadata is tracked yet', async () => {
        mockFindApplicationCopySource.mockResolvedValue({
            id: 'application-1',
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            schemaSnapshot: null,
            schemaStatus: 'draft',
            installedReleaseMetadata: null
        })

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'application-1',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: baseSyncContext.snapshot,
            snapshotHash: baseSyncContext.snapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        })

        const loadPublishedApplicationSyncContext = jest.fn()
        const { generator, migrator } = configureDdlServices({
            schemaExists: true
        })

        const app = buildApp(loadPublishedApplicationSyncContext)
        const response = await request(app)
            .post('/application/application-1/release-bundle/apply')
            .send({ confirmDestructive: false, bundle })
            .expect(409)

        expect(response.body).toEqual({
            error: 'Release version mismatch',
            message:
                'Bundle install is ambiguous for an existing schema without tracked installed_release_metadata. Resync from the publication source or initialize release metadata before applying a baseline bundle.'
        })
        expect(generator.schemaExists).not.toHaveBeenCalled()
        expect(migrator.calculateDiff).not.toHaveBeenCalled()
        expect(migrator.applyAllChanges).not.toHaveBeenCalled()
    })
})
