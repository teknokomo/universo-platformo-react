import type { Request, Response } from 'express'

const mockEnsureApplicationAccess = jest.fn()
const mockResolveEffectiveRolePermissions = jest.fn()
const mockResolveEffectiveRoleCapabilities = jest.fn()
const mockFindApplicationSchemaInfo = jest.fn()
const mockAcquireWorkspaceBaselineLock = jest.fn()
const mockAcquireWorkspaceBaselineSharedLock = jest.fn()
const mockAcquireWorkspaceCopyLocks = jest.fn()
const mockLockApplicationMembershipForRuntimeMutation = jest.fn()
const mockLockActiveRuntimeWorkspaceContext = jest.fn()
const mockValidateActiveRuntimeWorkspaceContext = jest.fn()
const mockResolveRuntimeWorkspaceAccess = jest.fn()
const mockSetRuntimeWorkspaceContext = jest.fn()
const mockGetRequestDbExecutor = jest.fn()
const mockResolveEffectiveApplicationSettingsForWorkspace = jest.fn()

jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args),
    resolveEffectiveRolePermissions: (...args: unknown[]) => mockResolveEffectiveRolePermissions(...args),
    resolveEffectiveRoleCapabilities: (...args: unknown[]) => mockResolveEffectiveRoleCapabilities(...args)
}))

jest.mock('../../persistence/applicationsStore', () => ({
    findApplicationSchemaInfo: (...args: unknown[]) => mockFindApplicationSchemaInfo(...args)
}))

jest.mock('../../services/applicationWorkspaces', () => ({
    acquireWorkspaceBaselineLock: (...args: unknown[]) => mockAcquireWorkspaceBaselineLock(...args),
    lockActiveRuntimeWorkspaceContext: (...args: unknown[]) => mockLockActiveRuntimeWorkspaceContext(...args),
    validateActiveRuntimeWorkspaceContext: (...args: unknown[]) => mockValidateActiveRuntimeWorkspaceContext(...args),
    resolveRuntimeWorkspaceAccess: (...args: unknown[]) => mockResolveRuntimeWorkspaceAccess(...args),
    setRuntimeWorkspaceContext: (...args: unknown[]) => mockSetRuntimeWorkspaceContext(...args)
}))

jest.mock('../../services/runtimeWorkspaceContext', () => ({
    acquireWorkspaceBaselineLock: (...args: unknown[]) => mockAcquireWorkspaceBaselineLock(...args),
    acquireWorkspaceBaselineSharedLock: (...args: unknown[]) => mockAcquireWorkspaceBaselineSharedLock(...args),
    acquireWorkspaceCopyLocks: (...args: unknown[]) => mockAcquireWorkspaceCopyLocks(...args),
    lockApplicationMembershipForRuntimeMutation: (...args: unknown[]) => mockLockApplicationMembershipForRuntimeMutation(...args)
}))

jest.mock('../../services/workspaceSettingsApplicationService', () => ({
    resolveEffectiveApplicationSettingsForWorkspace: (...args: unknown[]) => mockResolveEffectiveApplicationSettingsForWorkspace(...args)
}))

jest.mock('../../utils', () => ({
    getRequestDbExecutor: (...args: unknown[]) => mockGetRequestDbExecutor(...args),
    getRequestDbSession: jest.fn()
}))

import { resolveRuntimeSchema } from '../../shared/runtimeHelpers'

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
const userId = '018f8a78-7b8f-7c1d-a111-222233334442'
const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334443'
const executor = { query: jest.fn() }

function createRequest(method: string): Request {
    return {
        method,
        query: {},
        user: { id: userId }
    } as unknown as Request
}

function createResponse(): Response {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    return response as unknown as Response
}

describe('resolveRuntimeSchema workspace lock strategy', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetRequestDbExecutor.mockReturnValue(executor)
        mockEnsureApplicationAccess.mockResolvedValue({ membership: { role: 'member' } })
        mockResolveEffectiveRolePermissions.mockReturnValue({ manageApplication: false })
        mockResolveEffectiveRoleCapabilities.mockReturnValue({})
        mockFindApplicationSchemaInfo.mockResolvedValue({ schemaName: 'app_runtime_test', workspacesEnabled: true, settings: {} })
        mockResolveRuntimeWorkspaceAccess.mockResolvedValue({ defaultWorkspaceId: workspaceId, allowedWorkspaceIds: [workspaceId] })
        mockLockActiveRuntimeWorkspaceContext.mockResolvedValue(true)
        mockValidateActiveRuntimeWorkspaceContext.mockResolvedValue(true)
        mockSetRuntimeWorkspaceContext.mockResolvedValue(undefined)
        mockAcquireWorkspaceBaselineLock.mockResolvedValue(undefined)
        mockAcquireWorkspaceBaselineSharedLock.mockResolvedValue(undefined)
        mockAcquireWorkspaceCopyLocks.mockResolvedValue(undefined)
        mockLockApplicationMembershipForRuntimeMutation.mockResolvedValue(true)
        mockResolveEffectiveApplicationSettingsForWorkspace.mockResolvedValue({})
    })

    it('retains the shared workspace lock for a mutating request by default', async () => {
        const response = createResponse()

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('POST'),
            response,
            applicationId
        )

        expect(context?.currentWorkspaceId).toBe(workspaceId)
        expect(mockLockActiveRuntimeWorkspaceContext).toHaveBeenCalledWith(executor, 'app_runtime_test', workspaceId)
        expect(mockValidateActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
        expect(mockAcquireWorkspaceBaselineLock).not.toHaveBeenCalled()
        expect(mockAcquireWorkspaceBaselineSharedLock).toHaveBeenCalledWith(executor, 'app_runtime_test', applicationId)
        expect(mockLockApplicationMembershipForRuntimeMutation).toHaveBeenCalledWith(executor, applicationId, userId)
        expect(mockEnsureApplicationAccess).toHaveBeenCalledTimes(2)
    })

    it('revalidates application membership under the baseline lock before a validate-only mutation', async () => {
        const response = createResponse()

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('PATCH'),
            response,
            applicationId,
            workspaceId,
            { workspaceLockStrategy: 'validate-only' }
        )

        expect(context?.currentWorkspaceId).toBe(workspaceId)
        expect(mockAcquireWorkspaceBaselineLock).toHaveBeenCalledWith(executor, 'app_runtime_test', applicationId)
        expect(mockAcquireWorkspaceBaselineSharedLock).not.toHaveBeenCalled()
        expect(mockLockApplicationMembershipForRuntimeMutation).toHaveBeenCalledWith(executor, applicationId, userId)
        expect(mockEnsureApplicationAccess).toHaveBeenCalledTimes(2)
        expect(mockValidateActiveRuntimeWorkspaceContext).toHaveBeenCalledWith(executor, 'app_runtime_test', workspaceId)
        expect(mockLockActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
        expect(mockAcquireWorkspaceBaselineLock.mock.invocationCallOrder[0]).toBeLessThan(
            mockLockApplicationMembershipForRuntimeMutation.mock.invocationCallOrder[0]
        )
        expect(mockLockApplicationMembershipForRuntimeMutation.mock.invocationCallOrder[0]).toBeLessThan(
            mockEnsureApplicationAccess.mock.invocationCallOrder[1]
        )
    })

    it('uses schema-first shared locks and avoids personal-workspace provisioning for a copy mutation', async () => {
        const response = createResponse()

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('POST'),
            response,
            applicationId,
            workspaceId,
            { workspaceLockStrategy: 'schema-first-copy' }
        )

        expect(context?.currentWorkspaceId).toBe(workspaceId)
        expect(mockAcquireWorkspaceCopyLocks).toHaveBeenCalledWith(executor, 'app_runtime_test', applicationId)
        expect(mockAcquireWorkspaceBaselineLock).not.toHaveBeenCalled()
        expect(mockAcquireWorkspaceBaselineSharedLock).not.toHaveBeenCalled()
        expect(mockResolveRuntimeWorkspaceAccess).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({ ensurePersonalWorkspace: false })
        )
        expect(mockValidateActiveRuntimeWorkspaceContext).toHaveBeenCalledWith(executor, 'app_runtime_test', workspaceId)
        expect(mockLockActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
    })

    it('keeps read-only requests outside lifecycle locks while setting the workspace context', async () => {
        const response = createResponse()

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('GET'),
            response,
            applicationId,
            workspaceId,
            { workspaceLockStrategy: 'validate-only' }
        )

        expect(context?.currentWorkspaceId).toBe(workspaceId)
        expect(mockEnsureApplicationAccess).toHaveBeenCalledTimes(1)
        expect(mockAcquireWorkspaceBaselineLock).not.toHaveBeenCalled()
        expect(mockAcquireWorkspaceBaselineSharedLock).not.toHaveBeenCalled()
        expect(mockLockApplicationMembershipForRuntimeMutation).not.toHaveBeenCalled()
        expect(mockValidateActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
        expect(mockLockActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
        expect(mockSetRuntimeWorkspaceContext).toHaveBeenCalledWith(executor, workspaceId)
    })

    it('fails closed when application membership is removed while resolving a lifecycle mutation', async () => {
        const response = createResponse()
        mockEnsureApplicationAccess
            .mockResolvedValueOnce({ membership: { role: 'member' } })
            .mockRejectedValueOnce(new Error('access revoked'))

        await expect(
            resolveRuntimeSchema(
                () => executor as never,
                jest.fn().mockResolvedValue([]),
                createRequest('DELETE'),
                response,
                applicationId,
                workspaceId,
                { workspaceLockStrategy: 'validate-only' }
            )
        ).rejects.toThrow('access revoked')

        expect(mockResolveRuntimeWorkspaceAccess).not.toHaveBeenCalled()
        expect(mockLockApplicationMembershipForRuntimeMutation).toHaveBeenCalledWith(executor, applicationId, userId)
    })

    it.each(['owner', 'admin'] as const)('retains %s effective permissions after the locked membership recheck', async (role) => {
        const response = createResponse()
        const { resolveEffectiveRolePermissions } = jest.requireActual('../../routes/guards') as typeof import('../../routes/guards')
        const permissions = resolveEffectiveRolePermissions(role)
        mockEnsureApplicationAccess.mockResolvedValue({ membership: { role } })
        mockResolveEffectiveRolePermissions.mockImplementation(resolveEffectiveRolePermissions)

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('POST'),
            response,
            applicationId,
            workspaceId
        )

        expect(context?.role).toBe(role)
        expect(context?.permissions).toEqual(permissions)
        expect(mockResolveEffectiveRolePermissions).toHaveBeenNthCalledWith(2, role, {})
        expect(mockResolveRuntimeWorkspaceAccess).toHaveBeenCalledWith(executor, expect.objectContaining({ userId, allowUnassigned: true }))
    })

    it('still rejects an application administrator requesting a workspace outside their authorized set', async () => {
        const response = createResponse()
        mockEnsureApplicationAccess.mockResolvedValue({ membership: { role: 'admin' } })
        mockResolveEffectiveRolePermissions.mockReturnValue({ manageApplication: true })
        mockResolveRuntimeWorkspaceAccess.mockResolvedValue({
            defaultWorkspaceId: '018f8a78-7b8f-7c1d-a111-222233334444',
            allowedWorkspaceIds: ['018f8a78-7b8f-7c1d-a111-222233334444']
        })

        const context = await resolveRuntimeSchema(
            () => executor as never,
            jest.fn().mockResolvedValue([]),
            createRequest('POST'),
            response,
            applicationId,
            workspaceId
        )

        expect(context).toBeNull()
        expect(response.status).toHaveBeenCalledWith(403)
        expect(mockResolveRuntimeWorkspaceAccess).toHaveBeenCalledWith(executor, expect.objectContaining({ userId, allowUnassigned: true }))
        expect(mockLockActiveRuntimeWorkspaceContext).not.toHaveBeenCalled()
    })
})
