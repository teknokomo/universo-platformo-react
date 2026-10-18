import type { Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'

jest.mock('../../services/publicApplicationRuntime', () => {
    const actual = jest.requireActual('../../services/publicApplicationRuntime')
    return { ...actual, resolvePublicApplication: jest.fn() }
})

jest.mock('../../shared/publicRuntimeAccess', () => {
    const actual = jest.requireActual('../../shared/publicRuntimeAccess')
    return { ...actual, resolvePublicRuntimeSchema: jest.fn() }
})

import { PublicApplicationUnavailableError, resolvePublicApplication } from '../../services/publicApplicationRuntime'
import { resolvePublicRuntimeSchema } from '../../shared/publicRuntimeAccess'
import { createPublicRuntimeContextRunner } from '../../controllers/runtimeGuest/contextRunner'

const mockResolvePublicApplication = jest.mocked(resolvePublicApplication)
const mockResolvePublicRuntimeSchema = jest.mocked(resolvePublicRuntimeSchema)
const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'

const createResponse = (events: string[] = []) => {
    const response = {
        headersSent: false,
        statusCode: 200,
        status: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
        setHeader: jest.fn(),
        removeHeader: jest.fn()
    }
    response.status.mockImplementation((statusCode: number) => {
        response.statusCode = statusCode
        return response
    })
    response.json.mockImplementation(() => {
        events.push('json')
        response.headersSent = true
        return response
    })
    response.send.mockImplementation(() => {
        events.push('send')
        response.headersSent = true
        return response
    })
    response.setHeader.mockImplementation(() => {
        events.push('header')
        return response
    })
    response.removeHeader.mockImplementation(() => response)
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const executor = {
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn().mockReturnValue(false)
} as unknown as DbExecutor

describe('public guest runtime context errors', () => {
    beforeEach(() => jest.clearAllMocks())

    it('maps an unavailable public application to the existing safe 404 response', async () => {
        mockResolvePublicApplication.mockRejectedValue(new PublicApplicationUnavailableError('application_deleted'))
        const response = createResponse()
        const runner = createPublicRuntimeContextRunner(() => executor)

        await runner.withPublicRuntimeContext(applicationId, response, jest.fn())

        expect(response.status).toHaveBeenCalledWith(404)
        expect(response.json).toHaveBeenCalledWith({ error: 'Public guest runtime is unavailable' })
    })

    it('propagates an unexpected public application lookup failure', async () => {
        const databaseError = new Error('database connection failed')
        mockResolvePublicApplication.mockRejectedValue(databaseError)
        const response = createResponse()
        const runner = createPublicRuntimeContextRunner(() => executor)

        await expect(runner.withPublicRuntimeContext(applicationId, response, jest.fn())).rejects.toBe(databaseError)
        expect(response.status).not.toHaveBeenCalled()
        expect(response.json).not.toHaveBeenCalled()
    })

    it('propagates an unexpected public schema lookup failure', async () => {
        const databaseError = new Error('schema metadata query failed')
        mockResolvePublicApplication.mockResolvedValue({ application: { id: applicationId } } as never)
        mockResolvePublicRuntimeSchema.mockRejectedValue(databaseError)
        const response = createResponse()
        const runner = createPublicRuntimeContextRunner(() => executor)

        await expect(runner.withPublicRuntimeContext(applicationId, response, jest.fn())).rejects.toBe(databaseError)
        expect(response.status).not.toHaveBeenCalled()
        expect(response.json).not.toHaveBeenCalled()
    })

    it('commits the public application read lock before sending the response', async () => {
        const events: string[] = []
        const transaction = jest.fn(async (work: (tx: DbExecutor) => Promise<void>) => {
            const tx = {
                query: jest.fn(async () => {
                    events.push('application-lock')
                    return [{ id: applicationId }]
                })
            } as unknown as DbExecutor
            await work(tx)
            events.push('commit')
        })
        const manager = { transaction } as unknown as DbExecutor
        mockResolvePublicApplication.mockResolvedValue({
            application: { id: applicationId, schemaName: 'app_guest_test', workspacesEnabled: false }
        } as never)
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            applicationId,
            schemaName: 'app_guest_test',
            schemaIdent: 'app_guest_test',
            settings: {},
            manager,
            workspacesEnabled: false,
            currentWorkspaceId: null
        } as never)
        const response = createResponse(events)
        const jsonSpy = response.json
        const headerSpy = response.setHeader
        const runner = createPublicRuntimeContextRunner(() => executor)

        await runner.withPublicRuntimeContext(applicationId, response, async () => {
            events.push('guest-work')
            response.setHeader('X-Guest-Test', 'committed')
            response.status(201).json({ ok: true })
            expect(jsonSpy).not.toHaveBeenCalled()
        })

        expect(events).toEqual(['application-lock', 'guest-work', 'commit', 'header', 'json'])
        expect(jsonSpy).toHaveBeenCalledWith({ ok: true })
        expect(headerSpy).toHaveBeenCalledWith('X-Guest-Test', 'committed')
        expect(response.statusCode).toBe(201)
    })

    it('defers binary-safe public bundle sends and response headers until commit', async () => {
        const events: string[] = []
        const transaction = jest.fn(async (work: (tx: DbExecutor) => Promise<void>) => {
            const tx = { query: jest.fn().mockResolvedValue([{ id: applicationId }]) } as unknown as DbExecutor
            await work(tx)
            events.push('commit')
        })
        const manager = { transaction } as unknown as DbExecutor
        mockResolvePublicApplication.mockResolvedValue({
            application: { id: applicationId, schemaName: 'app_guest_test', workspacesEnabled: false }
        } as never)
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            applicationId,
            schemaName: 'app_guest_test',
            schemaIdent: 'app_guest_test',
            settings: {},
            manager,
            workspacesEnabled: false,
            currentWorkspaceId: null
        } as never)
        const response = createResponse(events)
        const sendSpy = response.send
        const headerSpy = response.setHeader
        const runner = createPublicRuntimeContextRunner(() => executor)

        await runner.withPublicRuntimeContext(applicationId, response, async () => {
            response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            response.status(200).send('export default true')
            expect(sendSpy).not.toHaveBeenCalled()
        })

        expect(events).toEqual(['commit', 'header', 'send'])
        expect(sendSpy).toHaveBeenCalledWith('export default true')
        expect(headerSpy).toHaveBeenCalledWith('Content-Type', 'application/javascript; charset=utf-8')
    })

    it('does not send a staged response or headers when the public transaction fails to commit', async () => {
        const transaction = jest.fn(async (work: (tx: DbExecutor) => Promise<void>) => {
            const tx = { query: jest.fn().mockResolvedValue([{ id: applicationId }]) } as unknown as DbExecutor
            await work(tx)
            throw new Error('public runtime commit failed')
        })
        const manager = { transaction } as unknown as DbExecutor
        mockResolvePublicApplication.mockResolvedValue({
            application: { id: applicationId, schemaName: 'app_guest_test', workspacesEnabled: false }
        } as never)
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            applicationId,
            schemaName: 'app_guest_test',
            schemaIdent: 'app_guest_test',
            settings: {},
            manager,
            workspacesEnabled: false,
            currentWorkspaceId: null
        } as never)
        const response = createResponse()
        const jsonSpy = response.json
        const headerSpy = response.setHeader
        const runner = createPublicRuntimeContextRunner(() => executor)

        await expect(
            runner.withPublicRuntimeContext(applicationId, response, async () => {
                response.setHeader('X-Guest-Test', 'uncommitted')
                response.status(503).json({ ok: false })
            })
        ).rejects.toThrow('public runtime commit failed')

        expect(jsonSpy).not.toHaveBeenCalled()
        expect(headerSpy).not.toHaveBeenCalled()
        expect(response.statusCode).toBe(200)
    })

    it('rejects anonymous runtime work when the application was withdrawn before the row lock', async () => {
        const work = jest.fn()
        const transaction = jest.fn(async (callback: (tx: DbExecutor) => Promise<void>) => {
            const tx = { query: jest.fn().mockResolvedValue([]) } as unknown as DbExecutor
            await callback(tx)
        })
        const manager = { transaction } as unknown as DbExecutor
        mockResolvePublicApplication.mockResolvedValue({
            application: { id: applicationId, schemaName: 'app_guest_test', workspacesEnabled: false }
        } as never)
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            applicationId,
            schemaName: 'app_guest_test',
            schemaIdent: 'app_guest_test',
            settings: {},
            manager,
            workspacesEnabled: false,
            currentWorkspaceId: null
        } as never)
        const response = createResponse()
        const runner = createPublicRuntimeContextRunner(() => executor)

        await runner.withPublicRuntimeContext(applicationId, response, work)

        expect(work).not.toHaveBeenCalled()
        expect(response.status).toHaveBeenCalledWith(404)
        expect(response.json).toHaveBeenCalledWith({ error: 'Public guest runtime is unavailable' })
    })
})
