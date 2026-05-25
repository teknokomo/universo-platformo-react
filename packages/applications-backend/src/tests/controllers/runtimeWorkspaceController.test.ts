import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockRuntimeQuery = jest.fn()
const mockCreateQueryHelper = jest.fn(() => mockRuntimeQuery)
const mockListUserWorkspaces = jest.fn()
const mockGetUserWorkspace = jest.fn()
const mockCreateSharedWorkspace = jest.fn()
const mockUpdateWorkspace = jest.fn()
const mockCopyWorkspace = jest.fn()
const mockDeleteSharedWorkspace = jest.fn()
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
        userNotMember: 'USER_NOT_MEMBER',
        roleNotFound: 'WORKSPACE_ROLE_NOT_FOUND',
        memberNotFound: 'WORKSPACE_MEMBER_NOT_FOUND',
        personalWorkspaceMutationBlocked: 'PERSONAL_WORKSPACE_MUTATION_BLOCKED',
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
    getUserWorkspace: (...args: unknown[]) => mockGetUserWorkspace(...args),
    createSharedWorkspace: (...args: unknown[]) => mockCreateSharedWorkspace(...args),
    updateWorkspace: (...args: unknown[]) => mockUpdateWorkspace(...args),
    copyWorkspace: (...args: unknown[]) => mockCopyWorkspace(...args),
    deleteSharedWorkspace: (...args: unknown[]) => mockDeleteSharedWorkspace(...args),
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

const vlc = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
        }
    }
})

describe('runtimeWorkspaceController', () => {
    const manager = { query: jest.fn() }
    const workspaceId = '2a15af4d-54ef-4b65-b5fd-8274d0d1de1a'
    const inaccessibleWorkspaceId = '2a15af4d-54ef-4b65-b5fd-8274d0d1de1c'
    const baseCtx = {
        schemaName: 'app_018f8a787b8f7c1da111222233334440',
        manager,
        userId: 'user-1',
        role: 'owner',
        workspacesEnabled: true,
        currentWorkspaceId: workspaceId
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
        mockResolveRuntimeSchema.mockResolvedValue(baseCtx)
    })

    it('lists workspaces for a workspace-enabled application', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockListUserWorkspaces.mockResolvedValue({
            items: [
                {
                    id: workspaceId,
                    name: vlc('Main workspace'),
                    description: vlc('Main workspace description'),
                    workspaceType: 'personal',
                    status: 'active',
                    isDefault: true,
                    roleCodename: 'owner'
                }
            ],
            total: 1
        })

        await controller.listWorkspaces(
            {
                params: { applicationId: 'app-1' },
                query: { limit: '25', offset: '0', search: 'main' }
            } as unknown as Request,
            res
        )

        expect(mockListUserWorkspaces).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            userId: baseCtx.userId,
            limit: 25,
            offset: 0,
            search: 'main'
        })
        expect(res.json).toHaveBeenCalledWith({
            items: [
                expect.objectContaining({
                    id: workspaceId,
                    isDefault: true
                })
            ],
            total: 1,
            limit: 25,
            offset: 0,
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
                body: { name: vlc('Class A'), description: vlc('Class A description') }
            } as unknown as Request,
            res
        )

        expect(mockCreateSharedWorkspace).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            name: vlc('Class A'),
            description: vlc('Class A description'),
            userId: baseCtx.userId,
            actorUserId: baseCtx.userId
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ id: 'workspace-2' })
    })

    it('returns a route workspace detail only when it belongs to the current runtime user', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetUserWorkspace.mockResolvedValue({
            id: workspaceId,
            name: vlc('Class Z'),
            description: vlc('Class Z description'),
            workspaceType: 'shared',
            personalUserId: null,
            status: 'active',
            isDefault: false,
            roleCodename: 'member'
        })

        await controller.getWorkspace(
            {
                params: { applicationId: 'app-1', workspaceId }
            } as unknown as Request,
            res
        )

        expect(mockGetUserWorkspace).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            userId: baseCtx.userId,
            workspaceId
        })
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                id: workspaceId,
                roleCodename: 'member'
            })
        )
    })

    it('does not reveal inaccessible route workspace details', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetUserWorkspace.mockResolvedValue(null)

        await controller.getWorkspace(
            {
                params: { applicationId: 'app-1', workspaceId: inaccessibleWorkspaceId }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' })
        )
    })

    it('rejects missing workspace names before resolving runtime schema', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()

        await controller.createWorkspace(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Invalid request body'
            })
        )
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(mockCreateSharedWorkspace).not.toHaveBeenCalled()
    })

    it('rejects invalid workspace route ids before service access', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()

        await controller.getMembers(
            {
                params: { applicationId: 'app-1', workspaceId: 'not-a-uuid' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Invalid route parameters'
            })
        )
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(mockGetWorkspaceMembership).not.toHaveBeenCalled()
    })

    it('returns workspace members for an accessible workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
            roleCodename: 'owner',
            isDefault: true
        })
        mockListWorkspaceMembers.mockResolvedValue({
            items: [
                { userId: 'user-1', roleCodename: 'owner', email: 'owner@example.com', nickname: 'Owner', canRemove: false },
                { userId: 'user-2', roleCodename: 'member', email: 'member@example.com', nickname: 'Member', canRemove: true }
            ],
            total: 2
        })

        await controller.getMembers(
            {
                params: { applicationId: 'app-1', workspaceId },
                query: { limit: '10', offset: '20', search: 'member' }
            } as unknown as Request,
            res
        )

        expect(mockListWorkspaceMembers).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            workspaceId,
            limit: 10,
            offset: 20,
            search: 'member'
        })
        expect(res.json).toHaveBeenCalledWith({
            items: [
                { userId: 'user-1', roleCodename: 'owner', email: 'owner@example.com', nickname: 'Owner', canRemove: false },
                { userId: 'user-2', roleCodename: 'member', email: 'member@example.com', nickname: 'Member', canRemove: true }
            ],
            total: 2,
            limit: 10,
            offset: 20
        })
    })

    it('rejects member invitations when the caller is not an owner of the target workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
            roleCodename: 'member',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Only workspace owners can manage members', code: 'WORKSPACE_OWNER_REQUIRED' })
        )
        expect(mockAddWorkspaceMember).not.toHaveBeenCalled()
    })

    it('allows owner invitations for personal workspaces', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'personal',
            personalUserId: 'user-1'
        })
        mockRuntimeQuery.mockImplementation(async (_req: Request, sql: string) => {
            if (sql.includes('FROM applications.rel_application_users')) {
                return [
                    {
                        id: 'app-member-1',
                        applicationId: 'app-1',
                        userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b',
                        role: 'member',
                        comment: null,
                        createdAt: new Date(),
                        email: 'target@example.com',
                        nickname: 'Target'
                    }
                ]
            }
            return []
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(mockAddWorkspaceMember).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            workspaceId,
            userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b',
            roleCodename: 'member',
            actorUserId: baseCtx.userId
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ ok: true })
    })

    it('adds workspace members by email only when the target user is an application member', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })
        mockRuntimeQuery.mockImplementation(async (_req: Request, sql: string) => {
            if (sql.includes('FROM auth.users')) {
                return [{ id: 'target-user-id', email: 'target@example.com' }]
            }
            if (sql.includes('FROM applications.rel_application_users')) {
                return [
                    {
                        id: 'app-member-1',
                        applicationId: 'app-1',
                        userId: 'target-user-id',
                        role: 'member',
                        comment: null,
                        createdAt: new Date(),
                        email: 'target@example.com',
                        nickname: 'Target'
                    }
                ]
            }
            return []
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId },
                body: { email: 'target@example.com', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(mockAddWorkspaceMember).toHaveBeenCalledWith(manager, {
            schemaName: baseCtx.schemaName,
            workspaceId,
            userId: 'target-user-id',
            roleCodename: 'member',
            actorUserId: baseCtx.userId
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ ok: true })
    })

    it('rejects member list access when the caller is not a member of the target workspace', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue(null)

        await controller.getMembers(
            {
                params: { applicationId: 'app-1', workspaceId: inaccessibleWorkspaceId }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'You do not have access to this workspace', code: 'WORKSPACE_ACCESS_DENIED' })
        )
        expect(mockListWorkspaceMembers).not.toHaveBeenCalled()
    })

    it('maps last-owner removal failures to conflict responses', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
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
                    workspaceId,
                    userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b'
                }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Cannot remove the last workspace owner',
                code: 'LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED'
            })
        )
    })

    it('rejects invalid member removal route ids before service access', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()

        await controller.deleteMember(
            {
                params: {
                    applicationId: 'app-1',
                    workspaceId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b',
                    userId: 'not-a-uuid'
                }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Invalid route parameters'
            })
        )
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(mockRemoveWorkspaceMember).not.toHaveBeenCalled()
    })

    it('maps missing role failures for member invites to not found responses', async () => {
        const controller = createRuntimeWorkspaceController(() => manager as never)
        const res = createResponse()
        mockGetWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId,
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })
        mockAddWorkspaceMember.mockRejectedValue(
            new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.roleNotFound, 'Role "member" not found')
        )
        mockRuntimeQuery.mockImplementation(async (_req: Request, sql: string) => {
            if (sql.includes('FROM applications.rel_application_users')) {
                return [
                    {
                        id: 'app-member-1',
                        applicationId: 'app-1',
                        userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b',
                        role: 'member',
                        comment: null,
                        createdAt: new Date(),
                        email: 'target@example.com',
                        nickname: 'Target'
                    }
                ]
            }
            return []
        })

        await controller.inviteMember(
            {
                params: { applicationId: 'app-1', workspaceId },
                body: { userId: '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', roleCodename: 'member' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Role "member" not found', code: 'WORKSPACE_ROLE_NOT_FOUND' })
        )
    })
})
