jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

const mockEnsureMetahubAccess = jest.fn(async () => undefined)
jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args),
    createEnsureMetahubRouteAccess: () => async (req: any, res: any, metahubId: string, permission?: string) => {
        const user = (req as any).user
        const userId = user?.id ?? user?.sub ?? user?.user_id ?? user?.userId
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        await mockEnsureMetahubAccess({}, userId, metahubId, permission)
        return userId
    }
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createRequestDbContext } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'
import { createEntityComponentRoutes } from '../../domains/entities/metadata/component/routes'
import { testCodenameVlc } from '../utils/codenameTestHelpers'

const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn((value: string) => value)

const mockKnexInstance = { transaction: jest.fn() }

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => mockKnexInstance),
    qSchema: jest.requireActual('@universo-react/database').qSchema,
    qTable: jest.requireActual('@universo-react/database').qTable,
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable,
    qColumn: jest.requireActual('@universo-react/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo-react/database').createKnexExecutor
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    acquirePoolAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releasePoolAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args)
}))

const mockComponentsService = {
    findAll: jest.fn(),
    findAllMerged: jest.fn(),
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    moveComponent: jest.fn(),
    ensureSequentialSortOrder: jest.fn(),
    update: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findChildComponents: jest.fn(),
    findChildComponentsByParentIds: jest.fn(),
    findAllFlat: jest.fn(),
    reorderComponent: jest.fn(),
    reorderComponentMergedOrder: jest.fn(),
    setDisplayComponent: jest.fn(),
    clearDisplayAttribute: jest.fn()
}

const mockObjectsService = {
    findById: jest.fn()
}

const mockFixedValuesService = {
    belongsToSet: jest.fn()
}

const mockEntityTypeService = {
    resolveType: jest.fn()
}

const mockEnumerationValuesService = {
    findById: jest.fn()
}

const mockSyncMetahubSchema = jest.fn(async () => undefined)

jest.mock('../../domains/metahubs/services/schemaSync', () => ({
    __esModule: true,
    syncMetahubSchema: (...args: unknown[]) => mockSyncMetahubSchema(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubComponentsService', () => ({
    __esModule: true,
    MetahubComponentsService: jest.fn().mockImplementation(() => mockComponentsService)
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubOptionValuesService', () => ({
    __esModule: true,
    MetahubOptionValuesService: jest.fn().mockImplementation(() => mockEnumerationValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubFixedValuesService', () => ({
    __esModule: true,
    MetahubFixedValuesService: jest.fn().mockImplementation(() => mockFixedValuesService)
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async () => null),
    findAll: jest.fn(async () => [
        { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
        { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
        { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
        { key: 'entity.object.componentCodenameScope', value: { _value: 'per-level' } },
        {
            key: 'entity.object.allowedComponentTypes',
            value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
        }
    ])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Field Definition Routes', () => {
    const questionsTableId = '11111111-1111-4111-8111-111111111111'
    const blocksTableId = '22222222-2222-4222-8222-222222222222'

    const resetMockCollection = (collection: Record<string, jest.Mock>) => {
        Object.values(collection).forEach((mockFn) => mockFn.mockReset())
    }

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        const executor = mockExecutor
        ;(req as unknown as { dbContext?: unknown }).dbContext = createRequestDbContext(
            { query: executor.query, isReleased: executor.isReleased },
            executor
        )
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (
        err: Error & { status?: number; statusCode?: number; code?: string; details?: Record<string, unknown> },
        _req: Request,
        res: Response,
        next: NextFunction
    ) => {
        if (res.headersSent) {
            return next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        res.status(statusCode).json({
            error: err.message || 'Internal Server Error',
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ?? {})
        })
    }

    const siblingTableMetadata = () => [
        {
            id: questionsTableId,
            objectCollectionId: 'object-1',
            codename: 'Questions',
            dataType: 'TABLE',
            parentComponentId: null
        },
        {
            id: blocksTableId,
            objectCollectionId: 'object-1',
            codename: 'Blocks',
            dataType: 'TABLE',
            parentComponentId: null
        },
        {
            id: '33333333-3333-4333-8333-333333333333',
            objectCollectionId: 'object-1',
            codename: 'BlockKey',
            dataType: 'STRING',
            parentComponentId: blocksTableId,
            uiConfig: { siblingRowSelectKey: true, generateUuidV7: true }
        },
        {
            id: '44444444-4444-4444-8444-444444444444',
            objectCollectionId: 'object-1',
            codename: 'Title',
            dataType: 'STRING',
            parentComponentId: blocksTableId
        }
    ]

    const siblingSelectorMetadata = () => [
        ...siblingTableMetadata(),
        {
            id: '55555555-5555-4555-8555-555555555555',
            objectCollectionId: 'object-1',
            codename: 'BlockKey',
            dataType: 'STRING',
            parentComponentId: questionsTableId,
            uiConfig: {
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                }
            }
        }
    ]

    let mockExecutor: ReturnType<typeof createMockDbExecutor>

    const buildApp = () => {
        mockExecutor = createMockDbExecutor()
        mockExecutor.query.mockImplementation(async (sql: string) =>
            sql.includes('pg_try_advisory_xact_lock') ? [{ acquired: true }] : []
        )
        const app = express()
        app.use(express.json())
        app.use(createEntityComponentRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        resetMockCollection(mockComponentsService)
        resetMockCollection(mockObjectsService)
        resetMockCollection(mockFixedValuesService)
        resetMockCollection(mockEntityTypeService)
        resetMockCollection(mockEnumerationValuesService)
        resetMockCollection(mockSettingsService)
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockComponentsService.findAll.mockResolvedValue([])
        mockComponentsService.findAllMerged.mockResolvedValue([])
        mockComponentsService.countByObjectId.mockResolvedValue(0)
        mockComponentsService.findById.mockResolvedValue(null)
        mockComponentsService.moveComponent.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: 'object-1',
            sortOrder: 1,
            parentComponentId: null
        })
        mockComponentsService.ensureSequentialSortOrder.mockResolvedValue(undefined)
        mockComponentsService.update.mockResolvedValue({})
        mockComponentsService.findByCodename.mockResolvedValue(null)
        mockComponentsService.create.mockResolvedValue({})
        mockComponentsService.findChildComponents.mockResolvedValue([])
        mockComponentsService.findChildComponentsByParentIds.mockResolvedValue(new Map())
        mockComponentsService.findAllFlat.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue({
            id: 'object-1',
            kind: 'object'
        })
        mockFixedValuesService.belongsToSet.mockResolvedValue(true)
        mockSettingsService.findByKey.mockResolvedValue(null)
        mockSettingsService.findAll.mockResolvedValue([
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'entity.object.componentCodenameScope', value: { _value: 'per-level' } },
            {
                key: 'entity.object.allowedComponentTypes',
                value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
            }
        ])
        mockEntityTypeService.resolveType.mockImplementation(async (_metahubId: string, kind: string) => {
            if (kind === 'enumeration') {
                return { kindKey: 'enumeration', capabilities: { dataSchema: false } }
            }

            if (kind === 'object' || kind === 'set' || kind === 'custom.invoice') {
                return { kindKey: kind, capabilities: { dataSchema: { enabled: true } } }
            }

            return null
        })
        mockComponentsService.reorderComponent.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            sortOrder: 1,
            parentComponentId: null
        })
        mockComponentsService.reorderComponentMergedOrder.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            effectiveSortOrder: 1,
            isShared: true,
            parentComponentId: null
        })
        mockEnumerationValuesService.findById.mockResolvedValue(null)
    })

    describe('POST /metahub/:metahubId/object/:objectCollectionId/components', () => {
        it('preserves generic sibling selector, row ordering, and generated-key metadata on create', async () => {
            const uiConfig = {
                hidden: true,
                serverOwned: true,
                generateUuidV7: true,
                siblingRowSelectKey: true,
                resetOnCopy: true,
                defaultValue: null,
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title',
                    requiredWithRows: true,
                    requireEachTargetReferenced: true
                },
                rowOrdering: {
                    orderFieldCodename: 'SortOrder',
                    labelFieldCodename: 'Title'
                }
            }
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-generic-table-ui',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                uiConfig,
                validationRules: {}
            })
            mockComponentsService.findById.mockResolvedValueOnce({
                id: questionsTableId,
                objectCollectionId: 'object-1',
                codename: 'Questions',
                dataType: 'TABLE',
                parentComponentId: null
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(siblingTableMetadata())

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/entities/object/instance/object-1/component/${questionsTableId}/children`)
                .send({
                    codename: testCodenameVlc('BlockKey'),
                    dataType: 'STRING',
                    name: { en: 'Block key' },
                    uiConfig
                })
                .expect(201)

            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({ uiConfig }),
                'test-user-id',
                expect.any(Object)
            )
            expect(response.body.uiConfig).toEqual(uiConfig)
        })

        it('accepts generic sibling selector and row ordering metadata on component update', async () => {
            const uiConfig = {
                hidden: true,
                serverOwned: true,
                generateUuidV7: true,
                siblingRowSelectKey: true,
                resetOnCopy: true,
                defaultValue: null,
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title',
                    requiredWithRows: true,
                    requireEachTargetReferenced: true
                },
                rowOrdering: {
                    orderFieldCodename: 'SortOrder',
                    labelFieldCodename: 'Title'
                }
            }
            mockComponentsService.findById.mockResolvedValueOnce({
                id: 'attr-question-block',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                parentComponentId: questionsTableId,
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {}
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(siblingTableMetadata())
            mockComponentsService.update.mockResolvedValueOnce({ id: 'attr-question-block', uiConfig })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-question-block')
                .send({ uiConfig, validationRules: {} })
                .expect(200)

            expect(mockComponentsService.update).toHaveBeenCalledWith(
                'metahub-1',
                'attr-question-block',
                expect.objectContaining({ uiConfig }),
                'test-user-id',
                expect.any(Object)
            )
            expect(response.body.uiConfig).toEqual(uiConfig)
        })

        it.each([
            {
                description: 'unknown sibling table',
                siblingRowSelect: {
                    tableCodename: 'MissingBlocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                }
            },
            {
                description: 'missing sibling value field',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'MissingKey',
                    labelFieldCodename: 'Title'
                }
            },
            {
                description: 'missing sibling label field',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'MissingTitle'
                }
            },
            {
                description: 'generated UUID v7 key used as the sibling label field',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'BlockKey'
                }
            },
            {
                description: 'value field without server-generated UUID v7 metadata',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                },
                targetKeyUiConfig: { siblingRowSelectKey: true }
            },
            {
                description: 'localized UUID v7 target field',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                },
                targetKeyValidationRules: { localized: true }
            },
            {
                description: 'versioned UUID v7 target field',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                },
                targetKeyValidationRules: { versioned: true }
            },
            {
                description: 'nested sibling tables',
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title'
                },
                nestedTables: true
            }
        ])(
            'rejects sibling selector metadata with $description',
            async ({ siblingRowSelect, targetKeyUiConfig, targetKeyValidationRules, nestedTables }) => {
                const metadata = siblingTableMetadata()
                if (targetKeyUiConfig || targetKeyValidationRules || nestedTables) {
                    const targetKey = metadata.find((component) => component.codename === 'BlockKey')
                    if (targetKey && targetKeyUiConfig) targetKey.uiConfig = targetKeyUiConfig
                    if (targetKey && targetKeyValidationRules) targetKey.validationRules = targetKeyValidationRules
                    if (nestedTables) {
                        metadata.forEach((component) => {
                            if (component.codename === 'Questions' || component.codename === 'Blocks') {
                                component.parentComponentId = 'nested-table-id'
                            }
                        })
                    }
                }
                mockComponentsService.findById.mockResolvedValueOnce({
                    id: questionsTableId,
                    objectCollectionId: 'object-1',
                    codename: 'Questions',
                    dataType: 'TABLE',
                    parentComponentId: null
                })
                mockComponentsService.findAllFlat.mockResolvedValueOnce(metadata)

                const app = buildApp()
                const response = await request(app)
                    .post(`/metahub/metahub-1/entities/object/instance/object-1/component/${questionsTableId}/children`)
                    .send({
                        codename: testCodenameVlc('InvalidBlockKey'),
                        dataType: 'STRING',
                        name: { en: 'Invalid block key' },
                        uiConfig: { siblingRowSelect }
                    })
                    .expect(400)

                expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
                expect(mockComponentsService.create).not.toHaveBeenCalled()
            }
        )

        it('rejects updating a sibling selector to an ungenerated or nested target key', async () => {
            const metadata = siblingTableMetadata()
            const targetKey = metadata.find((component) => component.codename === 'BlockKey')
            if (targetKey) targetKey.uiConfig = { siblingRowSelectKey: true }
            mockComponentsService.findById.mockResolvedValueOnce({
                id: 'attr-question-block',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                parentComponentId: questionsTableId,
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {}
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(metadata)

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-question-block')
                .send({
                    uiConfig: {
                        siblingRowSelect: {
                            tableCodename: 'Blocks',
                            valueFieldCodename: 'BlockKey',
                            labelFieldCodename: 'Title'
                        }
                    }
                })
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
        })

        it.each([
            {
                description: 'disabling generated-key metadata',
                componentId: '33333333-3333-4333-8333-333333333333',
                component: {
                    id: '33333333-3333-4333-8333-333333333333',
                    objectCollectionId: 'object-1',
                    codename: 'BlockKey',
                    dataType: 'STRING',
                    parentComponentId: blocksTableId,
                    isRequired: false,
                    isDisplayComponent: false,
                    uiConfig: { siblingRowSelectKey: true, generateUuidV7: true },
                    validationRules: {}
                },
                patch: { uiConfig: { siblingRowSelectKey: false } }
            },
            {
                description: 'renaming the generated key field',
                componentId: '33333333-3333-4333-8333-333333333333',
                component: {
                    id: '33333333-3333-4333-8333-333333333333',
                    objectCollectionId: 'object-1',
                    codename: 'BlockKey',
                    dataType: 'STRING',
                    parentComponentId: blocksTableId,
                    isRequired: false,
                    isDisplayComponent: false,
                    uiConfig: { siblingRowSelectKey: true, generateUuidV7: true },
                    validationRules: {}
                },
                patch: { codename: testCodenameVlc('BlockKeyNew') }
            },
            {
                description: 'renaming a referenced label field',
                componentId: '44444444-4444-4444-8444-444444444444',
                component: {
                    id: '44444444-4444-4444-8444-444444444444',
                    objectCollectionId: 'object-1',
                    codename: 'Title',
                    dataType: 'STRING',
                    parentComponentId: blocksTableId,
                    isRequired: false,
                    isDisplayComponent: false,
                    uiConfig: {},
                    validationRules: {}
                },
                patch: { codename: testCodenameVlc('DisplayTitle') }
            },
            {
                description: 'renaming the referenced root table',
                componentId: blocksTableId,
                component: {
                    id: blocksTableId,
                    objectCollectionId: 'object-1',
                    codename: 'Blocks',
                    dataType: 'TABLE',
                    parentComponentId: null,
                    isRequired: false,
                    isDisplayComponent: false,
                    uiConfig: {},
                    validationRules: {}
                },
                patch: { codename: testCodenameVlc('QuizBlocks') }
            }
        ])('rejects $description while sibling selectors reference the target', async ({ componentId, component, patch }) => {
            const metadata = siblingTableMetadata()
            metadata.push({
                id: '55555555-5555-4555-8555-555555555555',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                parentComponentId: questionsTableId,
                uiConfig: {
                    siblingRowSelect: {
                        tableCodename: 'Blocks',
                        valueFieldCodename: 'BlockKey',
                        labelFieldCodename: 'Title'
                    }
                }
            })
            mockComponentsService.findById.mockResolvedValueOnce(component)
            mockComponentsService.findAllFlat.mockResolvedValueOnce(metadata)

            const app = buildApp()
            const response = await request(app)
                .patch(`/metahub/metahub-1/entities/object/instance/object-1/component/${componentId}`)
                .send(patch)
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.findAllFlat).toHaveBeenCalledWith(
                'metahub-1',
                'object-1',
                'test-user-id',
                'business',
                expect.any(Object)
            )
            expect(mockComponentsService.update).not.toHaveBeenCalled()
        })

        it('round-trips assessmentOptions widget bounds and JSON defaults on create and update', async () => {
            const uiConfig = {
                widget: 'assessmentOptions',
                minOptions: 2,
                maxOptions: 20,
                resetOnCopy: true,
                defaultValue: [{ id: 'option-1', label: 'First option', isCorrect: true }]
            }
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-assessment-options',
                objectCollectionId: 'object-1',
                codename: 'Options',
                dataType: 'JSON',
                uiConfig,
                validationRules: {}
            })
            mockComponentsService.findById.mockResolvedValueOnce({
                id: 'attr-assessment-options',
                objectCollectionId: 'object-1',
                codename: 'Options',
                dataType: 'JSON',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {}
            })
            mockComponentsService.update.mockResolvedValueOnce({ id: 'attr-assessment-options', uiConfig })

            const app = buildApp()
            const createResponse = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('Options'),
                    dataType: 'JSON',
                    name: { en: 'Options' },
                    uiConfig
                })
                .expect(201)

            expect(createResponse.body.uiConfig).toEqual(uiConfig)
            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({ uiConfig }),
                'test-user-id',
                expect.any(Object)
            )

            const updateResponse = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-assessment-options')
                .send({ uiConfig, validationRules: {} })
                .expect(200)

            expect(updateResponse.body.uiConfig).toEqual(uiConfig)
            expect(mockComponentsService.update).toHaveBeenCalledWith(
                'metahub-1',
                'attr-assessment-options',
                expect.objectContaining({ uiConfig }),
                'test-user-id',
                expect.any(Object)
            )
        })

        it.each([
            {
                description: 'reversed option bounds',
                uiConfig: { widget: 'assessmentOptions', minOptions: 5, maxOptions: 2 }
            },
            {
                description: 'option bounds without the matching widget',
                uiConfig: { widget: 'text', minOptions: 2, maxOptions: 20 }
            }
        ])('rejects invalid assessment option metadata: $description', async ({ uiConfig }) => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('Options'),
                    dataType: 'JSON',
                    name: { en: 'Options' },
                    uiConfig
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
        })

        it('rejects non-boolean siblingRowSelectKey metadata', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('BlockKey'),
                    dataType: 'STRING',
                    name: { en: 'Block key' },
                    uiConfig: { siblingRowSelectKey: 'true' }
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
        })

        it('rejects deeply nested JSON defaults in component metadata', async () => {
            let defaultValue: unknown = 'leaf'
            for (let depth = 0; depth < 17; depth += 1) {
                defaultValue = { child: defaultValue }
            }

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('NestedDefault'),
                    dataType: 'JSON',
                    name: { en: 'Nested default' },
                    uiConfig: { defaultValue }
                })
                .expect(400)

            expect(response.body.error).toBe('Validation failed')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
        })

        it('accepts JSON defaults up to the configured nesting boundary', async () => {
            let defaultValue: unknown = 'leaf'
            for (let depth = 0; depth < 15; depth += 1) {
                defaultValue = { child: defaultValue }
            }

            const app = buildApp()
            await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('NestedDefaultAtBoundary'),
                    dataType: 'JSON',
                    name: { en: 'Nested default at boundary' },
                    uiConfig: { defaultValue }
                })
                .expect(201)

            expect(mockComponentsService.create).toHaveBeenCalledTimes(1)
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/components/reorder', () => {
        it('blocks moving a generated sibling key away from its referenced TABLE', async () => {
            mockComponentsService.findById.mockResolvedValueOnce({
                id: '33333333-3333-4333-8333-333333333333',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                parentComponentId: blocksTableId,
                uiConfig: { siblingRowSelectKey: true, generateUuidV7: true }
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(siblingSelectorMetadata())

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/components/reorder')
                .send({
                    componentId: '33333333-3333-4333-8333-333333333333',
                    newSortOrder: 2,
                    newParentComponentId: questionsTableId
                })
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.reorderComponent).not.toHaveBeenCalled()
        })
    })

    describe('DELETE /metahub/:metahubId/object/:objectCollectionId/component/:componentId', () => {
        it('blocks deleting a root TABLE while sibling selectors reference its generated keys', async () => {
            mockComponentsService.findById.mockResolvedValueOnce({
                id: blocksTableId,
                objectCollectionId: 'object-1',
                codename: 'Blocks',
                dataType: 'TABLE',
                parentComponentId: null,
                isDisplayComponent: false,
                uiConfig: {}
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(siblingSelectorMetadata())

            const app = buildApp()
            const response = await request(app)
                .delete(`/metahub/metahub-1/entities/object/instance/object-1/component/${blocksTableId}`)
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.delete).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('blocks deleting a field used as a sibling selector label', async () => {
            mockComponentsService.findById.mockResolvedValueOnce({
                id: '44444444-4444-4444-8444-444444444444',
                objectCollectionId: 'object-1',
                codename: 'Title',
                dataType: 'STRING',
                parentComponentId: blocksTableId,
                isDisplayComponent: false,
                uiConfig: {}
            })
            mockComponentsService.findAllFlat.mockResolvedValueOnce(siblingSelectorMetadata())

            const app = buildApp()
            const response = await request(app)
                .delete('/metahub/metahub-1/entities/object/instance/object-1/component/44444444-4444-4444-8444-444444444444')
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.delete).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId', () => {
        it('fails closed when the per-object component metadata lock cannot be acquired', async () => {
            const app = buildApp()
            mockExecutor.query.mockResolvedValueOnce([{ acquired: false }])
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1')
                .send({ uiConfig: { siblingRowSelectKey: false } })
                .expect(409)

            expect(response.body.code).toBe('COMPONENT_METADATA_LOCKED')
            expect(mockExecutor.query).toHaveBeenCalledWith('SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 0)) AS acquired', [
                'component-metadata-sibling-reference:metahub-1:object-1'
            ])
            expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
            expect(mockComponentsService.findById).not.toHaveBeenCalled()
            expect(mockComponentsService.update).not.toHaveBeenCalled()
        })

        it('requires an active request transaction instead of falling back to a pool connection', async () => {
            mockExecutor = createMockDbExecutor()
            const app = express()
            app.use(express.json())
            app.use(
                createEntityComponentRoutes(
                    (_req, _res, next) => next(),
                    () => mockExecutor,
                    mockRateLimiter,
                    mockRateLimiter
                )
            )
            app.use(errorHandler)

            await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1')
                .send({ uiConfig: { siblingRowSelectKey: false } })
                .expect(500)

            expect(mockExecutor.query).not.toHaveBeenCalled()
            expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/object/:objectCollectionId/component/:componentId/copy', () => {
        it('rejects a copied sibling selector override that targets its own table', async () => {
            const invalidSelectorConfig = {
                tableCodename: 'Questions',
                valueFieldCodename: 'BlockKey',
                labelFieldCodename: 'Title'
            }
            mockComponentsService.findById.mockResolvedValue({
                id: 'selector-field',
                objectCollectionId: 'object-1',
                codename: 'BlockKey',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Block' } } },
                uiConfig: {
                    siblingRowSelect: {
                        tableCodename: 'Blocks',
                        valueFieldCodename: 'BlockKey',
                        labelFieldCodename: 'Title'
                    }
                },
                validationRules: {},
                isRequired: false,
                parentComponentId: questionsTableId,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockComponentsService.findAllFlat.mockResolvedValue(siblingSelectorMetadata())

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/selector-field/copy')
                .send({ uiConfig: { siblingRowSelect: invalidSelectorConfig } })
                .expect(400)

            expect(response.body.code).toBe('INVALID_SIBLING_ROW_SELECT_REFERENCE')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
            expect(mockExecutor.transaction).not.toHaveBeenCalled()
        })
    })
})
