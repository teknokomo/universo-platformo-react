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
import { createRequestDbContext } from '@universo-react/utils'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createEntityComponentRoutes } from '../../domains/entities/metadata/component/routes'

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
        if (res.headersSent) return next(err)
        const statusCode = err.statusCode || err.status || 500
        res.status(statusCode).json({
            error: err.message || 'Internal Server Error',
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ?? {})
        })
    }

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

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId/move', () => {
        it('moves an component only when it belongs to the routed object', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                sortOrder: 2,
                parentComponentId: null,
                isSystem: false
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/move')
                .send({ direction: 'up' })
                .expect(200)

            expect(mockComponentsService.moveComponent).toHaveBeenCalledWith('metahub-1', 'object-1', 'attr-1', 'up', 'test-user-id')
        })

        it('returns 404 when the component belongs to another object', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-foreign',
                objectCollectionId: 'object-2',
                sortOrder: 2,
                parentComponentId: null,
                isSystem: false
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-foreign/move')
                .send({ direction: 'up' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Component not found' })
            expect(mockComponentsService.moveComponent).not.toHaveBeenCalled()
        })

        it('returns 404 when a shared-pool component id is submitted through a object route', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'shared-attr-1',
                objectCollectionId: 'shared-object-pool-1',
                sortOrder: 1,
                parentComponentId: null,
                isSystem: false,
                isShared: true
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/shared-attr-1/move')
                .send({ direction: 'down' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Component not found' })
            expect(mockComponentsService.moveComponent).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId/toggle-required', () => {
        it('returns 400 when trying to make display component optional', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                dataType: 'STRING',
                isDisplayComponent: true,
                isRequired: true,
                uiConfig: {}
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('Display component must be required')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 for enum label mode without default value', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label' }
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('required REF label mode requires defaultEnumValueId')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 when default enum value does not belong to selected enumeration', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label', defaultEnumValueId: 'value-1' }
            })
            mockEnumerationValuesService.findById.mockResolvedValue({
                id: 'value-1',
                objectId: 'enum-2'
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('defaultEnumValueId must reference a value from the selected target enumeration')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/object/:objectCollectionId/component/:componentId/copy', () => {
        it('copies TABLE component and child components inside a transaction', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'TABLE',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: { showTitle: true },
                validationRules: {},
                isRequired: true,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockComponentsService.findByCodename.mockResolvedValue(null)
            mockComponentsService.create
                .mockResolvedValueOnce({
                    id: 'attr-copy',
                    objectCollectionId: 'object-1',
                    codename: 'products-copy',
                    dataType: 'TABLE'
                })
                .mockResolvedValueOnce({
                    id: 'child-copy',
                    objectCollectionId: 'object-1',
                    codename: 'name',
                    dataType: 'STRING'
                })
            mockComponentsService.findChildComponents.mockResolvedValue([
                {
                    id: 'child-1',
                    codename: 'name',
                    dataType: 'STRING',
                    name: { _primary: 'en', locales: { en: { content: 'Name' } } },
                    validationRules: {},
                    uiConfig: {},
                    isRequired: false,
                    sortOrder: 1,
                    targetEntityId: null,
                    targetEntityKind: null
                }
            ])

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(201)

            expect(response.body.id).toBe('attr-copy')
            expect(response.body.copiedChildComponents).toBe(1)
            expect(mockExecutor.transaction).toHaveBeenCalledTimes(1)
            expect(mockComponentsService.findByCodename).toHaveBeenCalledWith(
                'metahub-1',
                'object-1',
                'ProductsCopy',
                null,
                'test-user-id',
                mockExecutor,
                { ignoreParentScope: false }
            )
            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    parentComponentId: 'attr-copy',
                    codename: 'name'
                }),
                'test-user-id',
                mockExecutor
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalled()
        })

        it('returns 409 when unique codename cannot be generated', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockComponentsService.findByCodename.mockResolvedValue({ id: 'existing' })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(409)

            expect(response.body.error).toBe('Unable to generate unique codename for component copy')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 409 when global codename lock cannot be acquired', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                if (key === 'entity.object.componentCodenameScope') {
                    return { key, value: { _value: 'global' } }
                }
                const defaults: Record<string, unknown> = {
                    'general.codenameStyle': 'pascal-case',
                    'general.codenameAlphabet': 'en-ru',
                    'general.codenameAllowMixedAlphabets': false
                }
                return key in defaults ? { key, value: { _value: defaults[key] } } : null
            })
            mockAcquireAdvisoryLock.mockResolvedValueOnce(false)
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(409)

            expect(response.body.error).toContain('Could not acquire component codename lock')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
            expect(mockReleaseAdvisoryLock).not.toHaveBeenCalledWith('component-metadata-sibling-reference:metahub-1:object-1')
            expect(mockReleaseAdvisoryLock).not.toHaveBeenCalledWith('component-codename-global:metahub-1:object-1')
        })
    })
})
