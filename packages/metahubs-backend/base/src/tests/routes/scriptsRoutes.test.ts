import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockListScripts = jest.fn()
const mockCreateScript = jest.fn()
const mockGetScriptById = jest.fn()
const mockUpdateScript = jest.fn()
const mockDeleteScript = jest.fn()

const mockDbSession = { isReleased: () => false }

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo/utils/database', () => ({
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

jest.mock('../../domains/scripts/services/MetahubScriptsService', () => ({
    __esModule: true,
    MetahubScriptsService: jest.fn().mockImplementation(() => ({
        listScripts: (...args: unknown[]) => mockListScripts(...args),
        createScript: (...args: unknown[]) => mockCreateScript(...args),
        getScriptById: (...args: unknown[]) => mockGetScriptById(...args),
        updateScript: (...args: unknown[]) => mockUpdateScript(...args),
        deleteScript: (...args: unknown[]) => mockDeleteScript(...args)
    }))
}))

import { createScriptsRoutes } from '../../domains/scripts/routes/scriptsRoutes'

const createScriptRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'script-1',
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
    attachedToKind: 'catalog',
    attachedToId: '018f8a78-7b8f-7c1d-a111-222233334499',
    moduleRole: 'widget',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    sourceCode: 'export default class QuizWidget extends ExtensionScript {}',
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

describe('Scripts Routes', () => {
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
        app.use('/', createScriptsRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter))
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
        mockListScripts.mockResolvedValue([createScriptRecord()])
        mockCreateScript.mockResolvedValue(createScriptRecord({ attachedToKind: 'metahub', attachedToId: null }))
        mockGetScriptById.mockResolvedValue(createScriptRecord())
        mockUpdateScript.mockResolvedValue(createScriptRecord({ isActive: false }))
        mockDeleteScript.mockResolvedValue(undefined)
    })

    it('lists scripts through the manageMetahub route guard and forwards query filters', async () => {
        const app = buildApp()
        const attachedToId = '018f8a78-7b8f-7c1d-a111-222233334499'

        const response = await request(app)
            .get(`/metahub/metahub-1/scripts?attachedToKind=catalog&attachedToId=${attachedToId}&onlyActive=true`)
            .expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockListScripts).toHaveBeenCalledWith(
            'metahub-1',
            {
                attachedToKind: 'catalog',
                attachedToId,
                onlyActive: true
            },
            'user-1'
        )
    })

    it('creates metahub-level scripts with attachedToId normalized to null', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/scripts')
            .send({
                codename: 'quiz-widget',
                name: 'Quiz widget',
                description: 'Runtime quiz widget',
                attachedToKind: 'metahub',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334498',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                sourceCode: "import { ExtensionScript } from '@universo/extension-sdk'\nexport default class QuizWidget extends ExtensionScript {}"
            })
            .expect(201)

        expect(response.body.id).toBe('script-1')
        expect(mockCreateScript).toHaveBeenCalledWith(
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

    it('rejects invalid create payloads before hitting the service layer', async () => {
        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/scripts')
            .send({
                codename: 'quiz-widget',
                attachedToKind: 'catalog',
                sourceCode: 'export default class BrokenScript {}'
            })
            .expect(400)

        expect(mockCreateScript).not.toHaveBeenCalled()
    })

    it('updates scripts through the route layer and normalizes metahub attachment changes', async () => {
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/script/script-1')
            .send({
                attachedToKind: 'metahub',
                attachedToId: '018f8a78-7b8f-7c1d-a111-222233334497',
                isActive: false
            })
            .expect(200)

        expect(response.body.isActive).toBe(false)
        expect(mockUpdateScript).toHaveBeenCalledWith(
            'metahub-1',
            'script-1',
            expect.objectContaining({
                attachedToKind: 'metahub',
                attachedToId: null,
                isActive: false
            }),
            'user-1'
        )
    })

    it('returns 404 when a requested script is missing', async () => {
        mockGetScriptById.mockResolvedValueOnce(null)
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/script/missing-script').expect(404)

        expect(response.body).toEqual({ error: 'Script not found' })
    })

    it('deletes scripts through the guarded route surface', async () => {
        const app = buildApp()

        await request(app).delete('/metahub/metahub-1/script/script-1').expect(204)

        expect(mockDeleteScript).toHaveBeenCalledWith('metahub-1', 'script-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })
})