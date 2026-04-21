import {
    addWorkspaceMember,
    createSharedWorkspace,
    getWorkspaceMembership,
    listUserWorkspaces,
    listWorkspaceMembers,
    removeWorkspaceMember,
    setDefaultWorkspace
} from '../../services/runtimeWorkspaceService'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeWorkspaceService', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334441'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('lists user workspaces with role metadata', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                id: 'workspace-1',
                codename: 'personal',
                name: { locales: { en: { content: 'Personal workspace' } } },
                workspace_type: 'personal',
                personal_user_id: 'user-1',
                status: 'active',
                is_default_workspace: true,
                role_codename: 'owner'
            }
        ])

        const result = await listUserWorkspaces(executor, {
            schemaName,
            userId: 'user-1'
        })

        expect(result).toEqual([
            expect.objectContaining({
                id: 'workspace-1',
                workspaceType: 'personal',
                isDefault: true,
                roleCodename: 'owner'
            })
        ])
    })

    it('creates a shared workspace and promotes it to the default workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-1', 'relation-1']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                return []
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspaces"`)) {
                expect(params[1]).toBe('shared-class-a')
                return []
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`)) {
                expect(params[1]).toBe('workspace-1')
                expect(params[2]).toBe('user-1')
                return []
            }

            return []
        })

        const result = await createSharedWorkspace(executor, {
            schemaName,
            codename: 'shared-class-a',
            name: { locales: { en: { content: 'Class A' } } },
            userId: 'user-1',
            actorUserId: 'user-1'
        })

        expect(result).toEqual({ id: 'workspace-1' })
    })

    it('fails closed when setting a default workspace for a non-member', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([])

        await expect(
            setDefaultWorkspace(executor, {
                schemaName,
                userId: 'user-1',
                workspaceId: 'workspace-404',
                actorUserId: 'user-1'
            })
        ).rejects.toThrow('User is not a member of this workspace')
    })

    it('adds and removes workspace members using role codenames', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['relation-2']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-member' }]
            }

            if (sql.includes(`SELECT id FROM "${schemaName}"."_app_workspace_user_roles"`)) {
                return []
            }

            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`)) {
                expect(params[1]).toBe('workspace-1')
                expect(params[2]).toBe('user-2')
                expect(params[3]).toBe('role-member')
                return []
            }

            if (sql.includes('INNER JOIN') && sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                return [
                    {
                        id: 'membership-2',
                        role_id: 'role-member',
                        is_default_workspace: false,
                        role_codename: 'member'
                    }
                ]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                expect(params[0]).toBe('workspace-1')
                expect(params[1]).toBe('user-2')
                return []
            }

            return []
        })

        executor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes('INNER JOIN') && sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                return [
                    {
                        id: 'membership-2',
                        role_id: 'role-member',
                        is_default_workspace: false,
                        role_codename: 'member'
                    }
                ]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                expect(params[0]).toBe('workspace-1')
                expect(params[1]).toBe('user-2')
                return []
            }

            return []
        })

        await addWorkspaceMember(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            userId: 'user-2',
            roleCodename: 'member',
            actorUserId: 'user-1'
        })

        await removeWorkspaceMember(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            userId: 'user-2',
            actorUserId: 'user-1'
        })

        expect(txExecutor.query).toHaveBeenCalled()
    })

    it('updates an existing workspace membership instead of inserting a duplicate role row', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
                return [
                    {
                        id: 'membership-1',
                        role_id: 'role-member',
                        is_default_workspace: false,
                        role_codename: 'member'
                    }
                ]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                expect(params[0]).toBe('role-owner')
                expect(params[1]).toBe('membership-1')
                return []
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await addWorkspaceMember(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            userId: 'user-2',
            roleCodename: 'owner',
            actorUserId: 'user-1'
        })

        expect(txExecutor.query).not.toHaveBeenCalledWith(
            expect.stringContaining(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`),
            expect.anything()
        )
    })

    it('fails closed when removing the last workspace owner', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
                return [
                    {
                        id: 'membership-1',
                        role_id: 'role-owner',
                        is_default_workspace: true,
                        role_codename: 'owner'
                    }
                ]
            }

            if (sql.includes('COUNT(*) AS total')) {
                return [{ total: '0' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            removeWorkspaceMember(executor, {
                schemaName,
                workspaceId: 'workspace-1',
                userId: 'user-1',
                actorUserId: 'user-2'
            })
        ).rejects.toThrow('Cannot remove the last workspace owner')
    })

    it('lists workspace members with role codenames', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                user_id: 'user-1',
                role_id: 'role-owner',
                role_codename: 'owner',
                is_default_workspace: true
            },
            {
                user_id: 'user-2',
                role_id: 'role-member',
                role_codename: 'member',
                is_default_workspace: false
            }
        ])

        const result = await listWorkspaceMembers(executor, {
            schemaName,
            workspaceId: 'workspace-1'
        })

        expect(result).toEqual([
            { userId: 'user-1', roleCodename: 'owner' },
            { userId: 'user-2', roleCodename: 'member' }
        ])
    })

    it('returns a single workspace membership descriptor for authorization checks', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                id: 'membership-1',
                role_id: 'role-owner',
                role_codename: 'owner',
                is_default_workspace: true,
                workspace_type: 'shared',
                personal_user_id: null
            }
        ])

        const result = await getWorkspaceMembership(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            userId: 'user-1'
        })

        expect(result).toEqual({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roleCodename: 'owner',
            isDefault: true,
            workspaceType: 'shared',
            personalUserId: null
        })
    })

    it('fails closed when inviting members into a personal workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'personal', personal_user_id: 'user-1' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            addWorkspaceMember(executor, {
                schemaName,
                workspaceId: 'workspace-1',
                userId: 'user-2',
                roleCodename: 'member',
                actorUserId: 'user-1'
            })
        ).rejects.toThrow('Personal workspaces do not support member management')
    })
})
