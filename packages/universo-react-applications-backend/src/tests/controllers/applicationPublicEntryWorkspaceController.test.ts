jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: jest.fn()
}))

jest.mock('../../persistence/applicationsStore', () => ({
    findApplicationSchemaInfo: jest.fn()
}))

jest.mock('../../services/applicationWorkspaces', () => ({
    PublicEntryWorkspaceError: class PublicEntryWorkspaceError extends Error {
        code: string

        constructor(code: string) {
            super(code)
            this.name = 'PublicEntryWorkspaceError'
            this.code = code
        }
    },
    resolvePublicEntryWorkspace: jest.fn(),
    runtimeWorkspaceTablesExist: jest.fn(),
    setPublicEntryWorkspace: jest.fn()
}))

jest.mock('../../utils', () => ({
    getRequestDbExecutor: jest.fn()
}))

jest.mock('../../shared/runtimeHelpers', () => ({
    IDENTIFIER_REGEX: /^[a-z_][a-z0-9_]*$/,
    resolveUserId: jest.fn()
}))

import type { Request, Response } from 'express'
import { createApplicationPublicEntryWorkspaceController } from '../../controllers/applicationPublicEntryWorkspaceController'
import { ensureApplicationAccess } from '../../routes/guards'
import { findApplicationSchemaInfo } from '../../persistence/applicationsStore'
import { resolvePublicEntryWorkspace, runtimeWorkspaceTablesExist, setPublicEntryWorkspace } from '../../services/applicationWorkspaces'
import { getRequestDbExecutor } from '../../utils'
import { resolveUserId } from '../../shared/runtimeHelpers'

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334499'
const workspaceId = '018f8a78-7b8f-7c1d-a111-2222333344aa'

const createResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    return response as unknown as jest.Mocked<Response>
}

describe('application public entry workspace controller', () => {
    const executor = { query: jest.fn() }
    const application = { schemaName: 'app_demo', workspacesEnabled: true }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(resolveUserId as jest.Mock).mockReturnValue('018f8a78-7b8f-7c1d-a111-2222333344bb')
        ;(getRequestDbExecutor as jest.Mock).mockReturnValue(executor)
        ;(findApplicationSchemaInfo as jest.Mock).mockResolvedValue(application)
        ;(runtimeWorkspaceTablesExist as jest.Mock).mockResolvedValue(true)
        ;(ensureApplicationAccess as jest.Mock).mockResolvedValue(undefined)
    })

    it('returns only the selected workspace token to an authorized application administrator', async () => {
        ;(resolvePublicEntryWorkspace as jest.Mock).mockResolvedValue({ workspaceId })
        const response = createResponse()
        const controller = createApplicationPublicEntryWorkspaceController(() => executor as never)

        await controller.get({ params: { applicationId } } as unknown as Request, response)

        expect(ensureApplicationAccess).toHaveBeenCalledWith(executor, expect.any(String), applicationId, ['admin', 'owner'])
        expect(resolvePublicEntryWorkspace).toHaveBeenCalledWith(executor, 'app_demo')
        expect(response.json).toHaveBeenCalledWith({ workspaceId })
    })

    it('updates the server-owned marker and does not accept a client supplied workspace name or schema', async () => {
        ;(setPublicEntryWorkspace as jest.Mock).mockResolvedValue({ workspaceId })
        const response = createResponse()
        const controller = createApplicationPublicEntryWorkspaceController(() => executor as never)

        await controller.update({ params: { applicationId }, body: { workspaceId } } as unknown as Request, response)

        expect(setPublicEntryWorkspace).toHaveBeenCalledWith(executor, {
            schemaName: 'app_demo',
            workspaceId,
            actorUserId: expect.any(String)
        })
        expect(response.json).toHaveBeenCalledWith({ workspaceId })
    })

    it('rejects malformed workspace identifiers before application access or database mutation', async () => {
        const response = createResponse()
        const controller = createApplicationPublicEntryWorkspaceController(() => executor as never)

        await controller.update({ params: { applicationId }, body: { workspaceId: 'not-a-uuid' } } as unknown as Request, response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(setPublicEntryWorkspace).not.toHaveBeenCalled()
        expect(ensureApplicationAccess).not.toHaveBeenCalled()
    })

    it('allows clearing the marker with an explicit null', async () => {
        ;(setPublicEntryWorkspace as jest.Mock).mockResolvedValue(null)
        const response = createResponse()
        const controller = createApplicationPublicEntryWorkspaceController(() => executor as never)

        await controller.update({ params: { applicationId }, body: { workspaceId: null } } as unknown as Request, response)

        expect(setPublicEntryWorkspace).toHaveBeenCalledWith(executor, {
            schemaName: 'app_demo',
            workspaceId: null,
            actorUserId: expect.any(String)
        })
        expect(response.json).toHaveBeenCalledWith({ workspaceId: null })
    })
})
