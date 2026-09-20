import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('@universo-react/admin-backend', () => ({
    isSuperuser: jest.fn(),
    hasSubjectPermission: jest.fn()
}))

jest.mock('../../services/applicationAliases', () => ({
    ApplicationAliasServiceError: class ApplicationAliasServiceError extends Error {},
    createApplicationAliasesService: jest.fn()
}))

jest.mock('../../persistence/applicationAliasesStore', () => ({
    listApplicationAliasApplicationOptions: jest.fn()
}))

import { hasSubjectPermission, isSuperuser } from '@universo-react/admin-backend'
import { createApplicationAliasesService } from '../../services/applicationAliases'
import { listApplicationAliasApplicationOptions } from '../../persistence/applicationAliasesStore'
import { createApplicationAliasesRoutes } from '../../routes/applicationAliasesRoutes'
import { createMockDbExecutor } from '../utils/dbMocks'

const mockedIsSuperuser = jest.mocked(isSuperuser)
const mockedHasSubjectPermission = jest.mocked(hasSubjectPermission)
const mockedCreateService = jest.mocked(createApplicationAliasesService)
const mockedListApplicationAliasApplicationOptions = jest.mocked(listApplicationAliasApplicationOptions)

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler

describe('applicationAliases routes', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const aliasId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
    const { executor } = createMockDbExecutor()

    const service = {
        list: jest.fn(),
        create: jest.fn(),
        rename: jest.fn(),
        setPrimary: jest.fn(),
        release: jest.fn(),
        listByApplication: jest.fn(),
        getPolicy: jest.fn(),
        updatePolicy: jest.fn()
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
            ;(req as Request & { user?: { id: string } }).user = { id: userId }
            next()
        }
        app.use(
            '/',
            createApplicationAliasesRoutes(
                ensureAuth,
                () => executor,
                mockRateLimiter,
                mockRateLimiter,
                () => executor
            )
        )
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockedCreateService.mockReturnValue(service as never)
        mockedIsSuperuser.mockResolvedValue(false)
        mockedHasSubjectPermission.mockResolvedValue(true)
        service.list.mockResolvedValue({ items: [], total: 0 })
        service.release.mockResolvedValue(undefined)
        service.updatePolicy.mockResolvedValue({ applicationId, routingMode: 'canonical' })
        mockedListApplicationAliasApplicationOptions.mockResolvedValue({ items: [], total: 0 })
    })

    it('authorizes reads only through Superuser or applicationAliases subject permission', async () => {
        const response = await request(buildApp()).get('/application-aliases')

        expect(response.status).toBe(200)
        expect(mockedHasSubjectPermission).toHaveBeenCalledWith(executor, userId, 'applicationAliases', 'read')
        expect(response.body).toEqual({ items: [], total: 0, limit: 100, offset: 0 })
    })

    it('lets Superuser bypass the subject permission lookup', async () => {
        mockedIsSuperuser.mockResolvedValue(true)

        const response = await request(buildApp()).get('/application-aliases')

        expect(response.status).toBe(200)
        expect(mockedHasSubjectPermission).not.toHaveBeenCalled()
    })

    it('loads application selector options through the capability-gated alias boundary', async () => {
        mockedListApplicationAliasApplicationOptions.mockResolvedValue({
            items: [
                {
                    id: applicationId,
                    nameValue: { locales: { en: { content: 'Meridian' } } },
                    contextValue: { locales: { en: { content: 'Eurasian corridor programme' } } }
                }
            ],
            total: 1
        })

        const response = await request(buildApp()).get('/application-aliases/application-options?search=meridian')

        expect(response.status).toBe(200)
        expect(mockedListApplicationAliasApplicationOptions).toHaveBeenCalledWith(executor, {
            limit: 50,
            offset: 0,
            search: 'meridian'
        })
        // The selector contract projects the persisted row into the frontend
        // `name`/`context` option fields and never leaks the raw store shape.
        expect(response.body).toEqual({
            items: [
                {
                    id: applicationId,
                    name: { locales: { en: { content: 'Meridian' } } },
                    context: 'Eurasian corridor programme'
                }
            ],
            total: 1,
            limit: 50,
            offset: 0
        })
    })

    it('fails closed when a persisted option identity is not a UUID v7 row id', async () => {
        mockedListApplicationAliasApplicationOptions.mockResolvedValue({
            items: [{ id: 'not-a-uuid', nameValue: { locales: { en: { content: 'Meridian' } } }, contextValue: null }],
            total: 1
        })

        const response = await request(buildApp()).get('/application-aliases/application-options')

        expect(response.status).toBe(500)
        expect(response.body.items).toBeUndefined()
    })

    it('fails closed when applicationAliases permission is absent', async () => {
        mockedHasSubjectPermission.mockResolvedValue(false)

        const response = await request(buildApp()).get('/application-aliases')

        expect(response.status).toBe(403)
        expect(service.list).not.toHaveBeenCalled()
    })

    it('uses delete permission for the canonical DELETE release endpoint', async () => {
        const response = await request(buildApp()).delete(`/application-aliases/${aliasId}`)

        expect(response.status).toBe(204)
        expect(mockedHasSubjectPermission).toHaveBeenCalledWith(executor, userId, 'applicationAliases', 'delete')
        expect(service.release).toHaveBeenCalledWith(aliasId, userId)
    })

    it('keeps the explicit Release action endpoint used by the current frontend', async () => {
        const response = await request(buildApp()).post(`/application-aliases/${aliasId}/release`)

        expect(response.status).toBe(204)
        expect(service.release).toHaveBeenCalledWith(aliasId, userId)
    })

    it('uses update permission for routing policy changes', async () => {
        const response = await request(buildApp()).patch(`/applications/${applicationId}/aliases/policy`).send({ routingMode: 'canonical' })

        expect(response.status).toBe(200)
        expect(mockedHasSubjectPermission).toHaveBeenCalledWith(executor, userId, 'applicationAliases', 'update')
        expect(service.updatePolicy).toHaveBeenCalledWith(applicationId, 'canonical', userId)
    })

    it('requires update permission before creating an alias as primary', async () => {
        mockedHasSubjectPermission.mockImplementation(async (_executor, _userId, _subject, action) => action === 'create')

        const response = await request(buildApp()).post('/application-aliases').send({
            applicationId,
            alias: 'meridian-73',
            makePrimary: true
        })

        expect(response.status).toBe(403)
        expect(mockedHasSubjectPermission).toHaveBeenCalledWith(executor, userId, 'applicationAliases', 'create')
        expect(mockedHasSubjectPermission).toHaveBeenCalledWith(executor, userId, 'applicationAliases', 'update')
        expect(service.create).not.toHaveBeenCalled()
    })
})
