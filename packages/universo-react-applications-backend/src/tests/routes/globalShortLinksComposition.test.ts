import type { NextFunction, Request, Response } from 'express'
import type { GlobalShortLinkTarget } from '@universo-react/types'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('../../persistence/globalShortLinksStore', () => ({
    createGlobalShortLink: jest.fn(),
    findActiveGlobalShortLinkTarget: jest.fn(),
    listGlobalShortLinks: jest.fn(),
    releaseGlobalShortLink: jest.fn()
}))

jest.mock('../../services/publicApplicationRuntime', () => {
    const actual = jest.requireActual('../../services/publicApplicationRuntime')
    return { ...actual, resolvePublicApplication: jest.fn() }
})

import { findActiveGlobalShortLinkTarget } from '../../persistence/globalShortLinksStore'
import { resolvePublicApplication } from '../../services/publicApplicationRuntime'
import { createApplicationsServiceRoutes, initializeRateLimiters } from '../../routes'
import { createMockDbExecutor } from '../utils/dbMocks'

const mockFindActiveGlobalShortLinkTarget = jest.mocked(findActiveGlobalShortLinkTarget)
const mockResolvePublicApplication = jest.mocked(resolvePublicApplication)
const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const target: GlobalShortLinkTarget = { kind: 'application-entry', applicationId }

const rejectingEnsureAuth = (_req: Request, res: Response, _next: NextFunction) => {
    return res.status(401).json({ error: 'Unauthorized' })
}

const buildApp = () => {
    const { executor, txExecutor } = createMockDbExecutor()
    const app = express()
    app.use(express.json())
    app.use(
        '/api/v1',
        createApplicationsServiceRoutes(
            rejectingEnsureAuth,
            () => executor,
            async () => null,
            {
                getRequestDbExecutor: () => executor
            }
        )
    )
    return { app, txExecutor }
}

describe('global short-link route composition', () => {
    beforeAll(async () => {
        await initializeRateLimiters()
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(target)
        mockResolvePublicApplication.mockResolvedValue({ application: { id: applicationId } } as never)
    })

    it('mounts anonymous resolution before authenticated subrouters and keeps management protected', async () => {
        const { app, txExecutor } = buildApp()

        const resolved = await request(app).get('/api/v1/public/l/meridian').expect(200)
        expect(resolved.body).toEqual({ target })
        expect(mockFindActiveGlobalShortLinkTarget).toHaveBeenCalledWith(txExecutor, 'meridian')
        expect(mockResolvePublicApplication).toHaveBeenCalledWith(txExecutor, applicationId)

        await request(app).post('/api/v1/global-short-links').send({ slug: 'meridian', target }).expect(401)
    })
})
