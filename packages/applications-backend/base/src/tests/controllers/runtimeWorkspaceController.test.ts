import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockCreateQueryHelper = jest.fn(() => jest.fn())
const mockListUserWorkspaces = jest.fn()
const mockCreateSharedWorkspace = jest.fn()
const mockSetDefaultWorkspace = jest.fn()
const mockAddWorkspaceMember = jest.fn()
const mockRemoveWorkspaceMember = jest.fn()
const mockListWorkspaceMembers = jest.fn()
const mockGetWorkspaceMembership = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    __esModule: true,
    createQueryHelper: (...args: unknown[]) => mockCreateQueryHelper(...args),
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))

jest.mock('../../services/runtimeWorkspaceService', () => ({
    __esModule: true,
    RUNTIME_WORKSPACE_ERROR_CODES: {
        workspaceNotFound: 'WORKSPACE_NOT_FOUND',
        personalMemberManagementUnsupported: 'PERSONAL_WORKSPACE_MEMBER_MANAGEMENT_UNSUPPORTED',
        userNotMember: 'USER_NOT_MEMBER',
        roleNotFound: 'WORKSPACE_ROLE_NOT_FOUND',
        memberNotFound: 'WORKSPACE_MEMBER_NOT_FOUND',
        lastOwnerRemovalBlocked: 'LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED'
    },
    RuntimeWorkspaceError: class RuntimeWorkspaceError extends Error {
        code: string

        constructor(code: string, message: string) {
            super(message)
            this.name = 'RuntimeWorkspaceError'
            this.code = code
        }
    },
    listUserWorkspaces: (...args: unknown[]) => mockListUserWorkspaces(...args),
    createSharedWorkspace: (...args: unknown[]) => mockCreateSharedWorkspace(...args),
    setDefaultWorkspace: (...args: unknown[]) => mockSetDefaultWorkspace(...args),
    addWorkspaceMember: (...args: unknown[]) => mockAddWorkspaceMember(...args),
    removeWorkspaceMember: (...args: unknown[]) => mockRemoveWorkspaceMember(...args),
    listWorkspaceMembers: (...args: unknown[]) => mockListWorkspaceMembers(...args),
    getWorkspaceMembership: (...args: unknown[]) => mockGetWorkspaceMembership(...args)
}))

import { createRuntimeWorkspaceController } from '../../controllers/runtimeWorkspaceController'
import { RuntimeWorkspaceError, RUNTIME_WORKSPACE_ERROR_CODES } from '../../services/runtimeWorkspaceService'

function createResponse() {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return {
        status,
        json
    } as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

describe('runtimeWorkspaceController', () => {
    const manager = { query: jest.fn() }
    const baseCtx = {
        schemaName: 'app_018f8a787b8f7c1da111222233334440',
        manager,
        userId: 'user-1',
        role: 'owner',
        workspacesEnabled: true,
        currentWorkspaceId: 'workspace-1'
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue(baseCtx)
    })

    it('lists workspaces for a workspace-enabled application', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockListUserWorkspaces.mockResolvedValue([
            {
                id: 'workspace-1',
                codename: 'main',
                name: 'Main workspace',
                workspaceType: 'personal',
                status: 'active',
                isDefault: true,
                roleCodename: 'owner'
            }
        ])

        await controller.listWorkspaces(
            {
                params: { applicationId: 'app-1' }
            } as unknown as Request,
            res
        )

        expect(mockListUserWorkspaces).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            userId: baseCtx.userId
        })
        expect(res.json).toHaveBeenCalledWith({
            items: [
                expect.objectContaining({
                    id: 'workspace-1',
                    isDefault: true
                })
            ],
            currentWorkspaceId: baseCtx.currentWorkspaceId
        })
    })

    it('creates a shared workspace through the service layer', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockCreateSharedWorkspace.mockResolvedValue({ id: 'workspace-2' })

        await controller.createWorkspace(
            {
                params: { applicationId: 'app-1' },
                body: { codename: 'class-a', name: 'Class A' }
            } as unknown as Request,
            res
        )

        expect(mockCreateSharedWorkspace).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            codename: 'class-a',
            name: 'Class A',
            userId: baseCtx.userId,
            actorUserId: baseCtx.userId
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ id: 'workspace-2' })
    })

    it('returns workspace members for an accessible workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'owner',
            isDefault: true
        })
        mockListWorkspaceMembers.mockResolvedValue([
            { userId: 'user-1', roleCodename: 'owner' },
            { userId: 'user-2', roleCodename: 'member' }
        ])

        await controller.getMembers(
            {
                params: { applicationId: 'app-1', workspaceId: 'workspace-1' }
            } as unknown as Request,
            res
        )

        expect(mockListWorkspaceMembers).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            workspaceId: 'workspace-1'
        })
        expect(res.json).toHaveBeenCalledWith({
            items: [
                { userId: 'user-1', roleCodename: 'owner' },
                { userId: 'user-2', roleCodename: 'member' }
            ]
        })
    })

    it('rejects member invitations when the caller is not an owner of the target workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'member',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId: 'workspace-1' },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'Only workspace owners can manage members' })
        expect(mockAddWorkspaceMember).not.toHaveBeenCalled()
    })

    it('rejects member invitations for personal workspaces even when the caller is an owner', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'personal',
            personalUserId: 'user-1'
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId: 'workspace-1' },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'Personal workspaces do not support member management' })
        expect(mockAddWorkspaceMember).not.toHaveBeenCalled()
    })

    it('rejects member list access when the caller is not a member of the target workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue(null)

        await controller.getMembers(
            {
                params: { applicationId: 'app-1', workspaceId: 'workspace-404' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'You do not have access to this workspace' })
        expect(mockListWorkspaceMembers).not.toHaveBeenCalled()
    })

    it('maps last-owner removal failures to conflict responses', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'owner',
            isDefault: true
        })
        mockRemoveWorkspaceMember.mockRejectedValue(
            new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.lastOwnerRemovalBlocked, 'Cannot remove the last workspace owner')
        )

        await controller.deleteMember(
            {
                params: {
                    applicationId: 'app-1',
                    workspaceId: 'workspace-1',
                    userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b'
                }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'Cannot remove the last workspace owner' })
    })

    it('maps missing role failures for member invites to not found responses', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })
        mockAddWorkspaceMember.mockRejectedValue(
            new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.roleNotFound, 'Role "member" not found')
        )

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId: 'workspace-1' },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'Role "member" not found' })
    })
})
