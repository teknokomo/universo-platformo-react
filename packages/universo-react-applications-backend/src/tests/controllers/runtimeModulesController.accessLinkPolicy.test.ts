import type { Request, Response } from 'express'

const mockCallServerMethod = jest.fn()
const mockResolveRuntimeSchema = jest.fn()
const mockCreateQueryHelper = jest.fn(() => jest.fn())

jest.mock('../../shared/runtimeHelpers', () => ({
    __esModule: true,
    createQueryHelper: (...args: unknown[]) => (mockCreateQueryHelper as (...callArgs: unknown[]) => unknown)(...args),
    resolveRuntimeSchema: (...args: unknown[]) => (mockResolveRuntimeSchema as (...callArgs: unknown[]) => unknown)(...args)
}))

jest.mock('../../services/runtimeModulesService', () => ({
    RuntimeModulesService: jest.fn().mockImplementation(() => ({
        callServerMethod: (...args: unknown[]) => mockCallServerMethod(...args)
    }))
}))

import { createRuntimeModulesController } from '../../controllers/runtimeModulesController'
import { RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID } from '../../services/guestAccessLinkIntakePolicy'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312200'
const moduleId = '019ccefc-2f7b-7b36-82f4-85cdb1312201'

const createResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const createRequest = () =>
    ({
        params: { applicationId, moduleId },
        body: { methodName: 'createAccessLink', args: [] }
    } as unknown as Request)

describe('runtimeModulesController callMethod error mapping', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312200',
            manager: { query: jest.fn() },
            currentWorkspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312202',
            userId: '019ccefc-2f7b-7b36-82f4-85cdb1312203',
            permissions: {}
        })
    })

    it('forwards the stable AccessLinks policy code with HTTP 400', async () => {
        mockCallServerMethod.mockRejectedValue(
            Object.assign(new Error('Access link intake policy is invalid'), {
                statusCode: 400,
                code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID
            })
        )
        const controller = createRuntimeModulesController(() => ({ query: jest.fn() } as never))
        const response = createResponse()

        await controller.callMethod(createRequest(), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID }))
    })

    it('returns a generic HTTP 500 for SQLSTATE errors without exposing database details', async () => {
        mockCallServerMethod.mockRejectedValue(
            Object.assign(new Error('duplicate key violates private constraint'), {
                code: '23505',
                detail: 'Key (email)=(learner@example.test) already exists'
            })
        )
        const controller = createRuntimeModulesController(() => ({ query: jest.fn() } as never))
        const response = createResponse()

        await controller.callMethod(createRequest(), response)

        expect(response.json).toHaveBeenCalledWith({ error: 'Runtime module call failed' })
        const responseBody = JSON.stringify(response.json.mock.calls[0]?.[0])
        expect(responseBody).not.toContain('23505')
        expect(responseBody).not.toContain('private constraint')
        expect(responseBody).not.toContain('learner@example.test')
        expect(response.status).toHaveBeenCalledWith(500)
    })
})
