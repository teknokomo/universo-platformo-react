import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockListModules = jest.fn()
const mockCreateModule = jest.fn()
const mockGetModuleById = jest.fn()
const mockUpdateModule = jest.fn()
const mockDeleteModule = jest.fn()

const mockDbSession = { isReleased: () => false }

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo-react/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession
}))

jest.mock('../../domains/shared/routeAuth', () => ({
    __esModule: true,
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/modules/services/MetahubModulesService', () => ({
    __esModule: true,
    MetahubModulesService: jest.fn().mockImplementation(() => ({
        listModules: (...args: unknown[]) => mockListModules(...args),
        createModule: (...args: unknown[]) => mockCreateModule(...args),
        getModuleById: (...args: unknown[]) => mockGetModuleById(...args),
        updateModule: (...args: unknown[]) => mockUpdateModule(...args),
        deleteModule: (...args: unknown[]) => mockDeleteModule(...args)
    }))
}))

import { createModulesRoutes } from '../../domains/modules/routes/modulesRoutes'

const createModuleRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'module-1',
    codename: {
        _schema: 'vlc:1',
        _primary: 'en',
        locales: {
            en: { content: 'quiz-widget' }
        }
    },
    presentation: {
        name: {
            _schema: 'vlc:1',
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        },
        description: {
            _schema: 'vlc:1',
            _primary: 'en',
            locales: {
                en: { content: 'Runtime quiz widget' }
            }
        }
    },
    attachedToKind: 'object',
    attachedToId: '018f8a78-7b8f-7c1d-a111-222233334499',
    moduleRole: 'widget',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    sourceCode: 'export default class QuizWidget extends ExtensionModule {}',
    manifest: {
        className: 'QuizWidget',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['metadata.read', 'rpc.client'],
        methods: [{ name: 'mount', target: 'client' }],
        checksum: 'manifest-checksum'
    },
    serverBundle: null,
    clientBundle: 'module.exports = class QuizWidget {}',
    checksum: 'bundle-checksum',
    isActive: true,
    config: {},
    version: 1,
    updatedAt: '2026-04-05T12:00:00.000Z',
    ...overrides
})

describe('Modules Routes', () => {
    const ensureAuth = (_req: Request, _res: Response, next: NextFunction) => next()
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const mockExec = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockExec)),
        isReleased: jest.fn(() => false)
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createModulesRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
            res.status(500).json({ error: error.message })
        })
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: { role: 'owner' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })
        mockListModules.mockResolvedValue([createModuleRecord()])
        mockCreateModule.mockResolvedValue(createModuleRecord({ attachedToKind: 'metahub', attachedToId: null }))
        mockGetModuleById.mockResolvedValue(createModuleRecord())
        mockUpdateModule.mockResolvedValue(createModuleRecord({ isActive: false }))
        mockDeleteModule.mockResolvedValue(undefined)
    })

    it('lists modules through the manageMetahub route guard and forwards query filters', async () => {
        const app = buildApp()
        const attachedToId = '018f8a78-7b8f-7c1d-a111-222233334499'

        const response = await request(app)
            .get(`/metahub/metahub-1/modules?attachedToKind=object&attachedToId=${attachedToId}&onlyActive=true`)
            .expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockListModules).toHaveBeenCalledWith(
            'metahub-1',
            {
                attachedToKind: 'object',
                attachedToId,
                onlyActive: true
            },
            'user-1'
        )
    })

    it('creates metahub-level modules with attachedToId normalized to null', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/modules')
            .send({
                codename: 'quiz-widget',
                name: 'Quiz widget',
                description: 'Runtime quiz widget',
                attachedToKind: 'metahub',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334498',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                sourceCode:
                    "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class QuizWidget extends ExtensionModule {}"
            })
            .expect(201)

        expect(response.body.id).toBe('module-1')
        expect(mockCreateModule).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                attachedToKind: 'metahub',
                attachedToId: null,
                codename: 'quiz-widget',
                moduleRole: 'widget',
                sourceKind: 'embedded'
            }),
            'user-1'
        )
    })

    it('accepts custom entity attachment kinds through the route schema', async () => {
        mockCreateModule.mockResolvedValueOnce(
            createModuleRecord({
                attachedToKind: 'custom.invoice',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334400'
            })
        )

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/modules')
            .send({
                codename: 'invoice-widget',
                name: 'Invoice widget',
                attachedToKind: 'custom.invoice',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334400',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                sourceCode:
                    "import { ExtensionModule } from '@universo-react/extension-sdk'\nexport default class InvoiceWidget extends ExtensionModule {}"
            })
            .expect(201)

        expect(response.body.attachedToKind).toBe('custom.invoice')
        expect(mockCreateModule).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                attachedToKind: 'custom.invoice',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334400'
            }),
            'user-1'
        )
    })

    it('rejects invalid create payloads before hitting the service layer', async () => {
        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/modules')
            .send({
                codename: 'quiz-widget',
                attachedToKind: 'object',
                sourceCode: 'export default class BrokenModule {}'
            })
            .expect(400)

        expect(mockCreateModule).not.toHaveBeenCalled()
    })

    it('updates modules through the route layer and normalizes metahub attachment changes', async () => {
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/module/module-1')
            .send({
                attachedToKind: 'metahub',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334497',
                isActive: false
            })
            .expect(200)

        expect(response.body.isActive).toBe(false)
        expect(mockUpdateModule).toHaveBeenCalledWith(
            'metahub-1',
            'module-1',
            expect.objectContaining({
                attachedToKind: 'metahub',
                attachedToId: null,
                isActive: false
            }),
            'user-1'
        )
    })

    it('returns 404 when a requested module is missing', async () => {
        mockGetModuleById.mockResolvedValueOnce(null)
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/module/missing-module').expect(404)

        expect(response.body).toEqual({ error: 'Module not found' })
    })

    it('deletes modules through the guarded route surface', async () => {
        const app = buildApp()

        await request(app).delete('/metahub/metahub-1/module/module-1').expect(204)

        expect(mockDeleteModule).toHaveBeenCalledWith('metahub-1', 'module-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })
})
