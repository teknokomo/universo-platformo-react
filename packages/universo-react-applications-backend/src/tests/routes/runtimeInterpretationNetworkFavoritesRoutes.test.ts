import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { RuntimeSurfaceReady } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'

jest.mock('../../shared/runtimeHelpers', () => ({
    ...jest.requireActual('../../shared/runtimeHelpers'),
    createQueryHelper: jest.fn(() => jest.fn(async () => [])),
    resolveRuntimeSchema: jest.fn()
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    resolveInterpretationNetworkRuntimeSurface: jest.fn()
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites', () => ({
    addInterpretationNetworkFavorite: jest.fn(),
    listInterpretationNetworkFavorites: jest.fn(),
    removeInterpretationNetworkFavorite: jest.fn(),
    InterpretationNetworkFavoriteError: class InterpretationNetworkFavoriteError extends Error {}
}))

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import * as runtimeHelpers from '../../shared/runtimeHelpers'
import * as runtimeSurface from '../../services/interpretationNetwork/runtimeInterpretationNetworkSurface'
import * as favoritesService from '../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites'
import { createApplicationsRoutes } from '../../routes/applicationsRoutes'

const applicationId = '019f7f10-0000-7000-8000-000000000020'
const interpretationId = '019f7f10-0000-7000-8000-000000000012'
const cellId = '019f7f10-0000-7000-8000-000000000014'
const favoriteId = '019f7f10-0000-7000-8000-000000000099'

const context = {
    schemaName: 'app_019f7f10000070008000000000000001',
    schemaIdent: '"app_019f7f10000070008000000000000001"',
    manager: {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (callback: (tx: DbExecutor) => Promise<unknown>) => callback(context.manager as unknown as DbExecutor)),
        isReleased: jest.fn(() => false)
    },
    userId: '019f7f10-0000-7000-8000-000000000010',
    role: 'member',
    permissions: {},
    workflowCapabilities: {},
    currentWorkspaceId: '019f7f10-0000-7000-8000-000000000011',
    workspacesEnabled: true,
    baseApplicationSettings: {},
    applicationSettings: {}
} as unknown as RuntimeSchemaContext

const surface = {
    applicationId,
    schemaName: 'app_019f7f10000070008000000000000001',
    workspaceId: context.currentWorkspaceId,
    layoutId: '019f7f10-0000-7000-8000-000000000021',
    widgetId: '019f7f10-0000-7000-8000-000000000022',
    widgetKey: 'interpretationNetworkWorkspace',
    widgetConfig: {},
    structureMode: 'multiple',
    featureState: 'ready',
    missing: [],
    resolvedObjects: {},
    contracts: {}
} as unknown as RuntimeSurfaceReady

const resolveRuntimeSchemaMock = runtimeHelpers.resolveRuntimeSchema as jest.Mock
const resolveRuntimeSurfaceMock = runtimeSurface.resolveInterpretationNetworkRuntimeSurface as jest.Mock
const addFavoriteMock = favoritesService.addInterpretationNetworkFavorite as jest.Mock
const listFavoritesMock = favoritesService.listInterpretationNetworkFavorites as jest.Mock
const removeFavoriteMock = favoritesService.removeInterpretationNetworkFavorite as jest.Mock

const authenticate: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization !== 'Bearer test-token') return res.status(401).json({ error: 'Unauthorized' })
    ;(req as Request & { user?: { id: string } }).user = { id: context.userId }
    return next()
}

const passThrough: RateLimitRequestHandler = Object.assign((_req: Request, _res: Response, next: NextFunction) => next(), {
    resetKey: (_key: string) => undefined,
    getKey: () => undefined
})

const makeApp = () => {
    const app = express()
    app.use(express.json())
    app.use(
        '/applications',
        createApplicationsRoutes(authenticate, () => context.manager as unknown as DbExecutor, passThrough, passThrough)
    )
    return app
}

describe('Interpretation Network Favorites routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resolveRuntimeSchemaMock.mockResolvedValue(context)
        resolveRuntimeSurfaceMock.mockResolvedValue(surface)
        listFavoritesMock.mockResolvedValue({ items: [], hasMore: false })
        addFavoriteMock.mockImplementation(async (_ctx, _surface, target) => ({ target, created: true }))
        removeFavoriteMock.mockImplementation(async (_ctx, id) => ({ favoriteId: id, removed: false }))
    })

    it('mounts the authenticated list endpoint under the application runtime', async () => {
        const response = await request(makeApp())
            .get(`/applications/${applicationId}/runtime/interpretation-network/favorites?locale=ru`)
            .set('Authorization', 'Bearer test-token')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ items: [], hasMore: false })
        expect(listFavoritesMock).toHaveBeenCalledWith(context, surface, expect.objectContaining({ locale: 'ru' }))
        expect(resolveRuntimeSurfaceMock).toHaveBeenCalledWith(context.manager, {
            applicationId,
            schemaName: context.schemaName,
            workspaceId: context.currentWorkspaceId
        })
    })

    it('accepts only the semantic Interpretation + CellId target and returns an idempotent add result', async () => {
        const app = makeApp()
        const invalid = await request(app)
            .post(`/applications/${applicationId}/runtime/interpretation-network/favorites`)
            .set('Authorization', 'Bearer test-token')
            .send({ interpretationId, cellId, matrixRowId: '019f7f10-0000-7000-8000-000000000099' })
        expect(invalid.status).toBe(400)
        expect(addFavoriteMock).not.toHaveBeenCalled()

        const valid = await request(app)
            .post(`/applications/${applicationId}/runtime/interpretation-network/favorites`)
            .set('Authorization', 'Bearer test-token')
            .send({ interpretationId, cellId })

        expect(valid.status).toBe(201)
        expect(valid.body).toEqual({ target: { interpretationId, cellId }, created: true, status: 'created' })
        expect(addFavoriteMock).toHaveBeenCalledWith(context, surface, { interpretationId, cellId })
    })

    it('removes stale Favorites by owner-scoped identity and rejects tuple-based removal', async () => {
        const invalid = await request(makeApp())
            .delete(`/applications/${applicationId}/runtime/interpretation-network/favorites`)
            .set('Authorization', 'Bearer test-token')
            .send({ interpretationId, cellId })
        expect(invalid.status).toBe(400)
        expect(removeFavoriteMock).not.toHaveBeenCalled()

        const removed = await request(makeApp())
            .delete(`/applications/${applicationId}/runtime/interpretation-network/favorites`)
            .set('Authorization', 'Bearer test-token')
            .send({ favoriteId })
        expect(removed.status).toBe(200)
        expect(removed.body).toEqual({ favoriteId, removed: false, status: 'alreadyAbsent' })
        expect(removeFavoriteMock).toHaveBeenCalledWith(context, favoriteId)
        expect(resolveRuntimeSurfaceMock).not.toHaveBeenCalled()
    })

    it('requires authenticated application access for Favorite requests', async () => {
        const response = await request(makeApp()).get(`/applications/${applicationId}/runtime/interpretation-network/favorites`)
        expect(response.status).toBe(401)
        expect(resolveRuntimeSchemaMock).not.toHaveBeenCalled()
    })
})
