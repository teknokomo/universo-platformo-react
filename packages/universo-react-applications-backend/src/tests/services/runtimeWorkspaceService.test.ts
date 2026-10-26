import {
    addWorkspaceMember,
    createSharedWorkspace,
    deleteSharedWorkspace,
    getUserWorkspace,
    getWorkspaceMembership,
    listUserWorkspaces,
    listWorkspaceMembers,
    removeWorkspaceMember,
    setDefaultWorkspace,
    updateWorkspace
} from '../../services/runtimeWorkspaceService'
import { createMockDbExecutor } from '../utils/dbMocks'

const mockRevokeGuestSessionSecretsForWorkspace = jest.fn()
const mockRevokeGuestAssessmentAttemptsForWorkspace = jest.fn()

jest.mock('../../services/guestAssessmentApplicationRevocation', () => ({
    revokeGuestSessionSecretsForWorkspace: (...args: unknown[]) => mockRevokeGuestSessionSecretsForWorkspace(...args),
    revokeGuestAssessmentAttemptsForWorkspace: (...args: unknown[]) => mockRevokeGuestAssessmentAttemptsForWorkspace(...args)
}))

const vlc = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en' as const,
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
                name: vlc('Personal workspace'),
                description: vlc('Personal description'),
                workspace_type: 'personal',
                personal_user_id: 'user-1',
                status: 'active',
                is_default_workspace: true,
                role_codename: 'owner',
                window_total: '1'
            }
        ])

        const result = await listUserWorkspaces(executor, {
            schemaName,
            userId: 'user-1',
            limit: 20,
            offset: 0
        })

        expect(result).toEqual({
            items: [
                expect.objectContaining({
                    id: 'workspace-1',
                    workspaceType: 'personal',
                    isDefault: true,
                    roleCodename: 'owner'
                })
            ],
            total: 1
        })
    })

    it('returns an accessible workspace by id without depending on list pagination', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                id: 'workspace-42',
                name: vlc('Class Z'),
                description: vlc('Class Z description'),
                workspace_type: 'shared',
                personal_user_id: null,
                status: 'active',
                is_default_workspace: false,
                role_codename: 'member',
                window_total: '1'
            }
        ])

        const result = await getUserWorkspace(executor, {
            schemaName,
            userId: 'user-2',
            workspaceId: 'workspace-42'
        })

        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('w.id = $2'), ['user-2', 'workspace-42', false])
        expect(result).toEqual(
            expect.objectContaining({
                id: 'workspace-42',
                workspaceType: 'shared',
                isDefault: false,
                roleCodename: 'member'
            })
        )
    })

    it('returns null when direct workspace lookup is not accessible to the user', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([])

        await expect(
            getUserWorkspace(executor, {
                schemaName,
                userId: 'user-2',
                workspaceId: 'workspace-404'
            })
        ).resolves.toBeNull()
    })

    it('allows an application administrator to inspect an unassigned shared workspace without granting membership', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                id: 'workspace-admin',
                name: vlc('Admin workspace'),
                description: vlc('Admin workspace description'),
                workspace_type: 'shared',
                personal_user_id: null,
                status: 'active',
                is_default_workspace: false,
                role_codename: 'admin',
                window_total: '1'
            }
        ])

        await expect(
            getUserWorkspace(executor, {
                schemaName,
                userId: 'admin-1',
                workspaceId: 'workspace-admin',
                allowUnassigned: true
            })
        ).resolves.toEqual(expect.objectContaining({ id: 'workspace-admin', roleCodename: 'admin' }))
        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('$3::boolean = true'), ['admin-1', 'workspace-admin', true])
    })

    it('never resolves another user personal workspace for application administrators without membership', async () => {
        const { executor } = createMockDbExecutor()
        // Simulate the isolation-safe lookup: unassigned admins may only reach
        // non-personal workspaces, even with allowUnassigned enabled.
        executor.query.mockResolvedValue([])

        await expect(
            getUserWorkspace(executor, {
                schemaName,
                userId: 'admin-1',
                workspaceId: 'workspace-personal-other',
                allowUnassigned: true
            })
        ).resolves.toBeNull()
    })

    it('creates a shared workspace and promotes it to the default workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-1', 'relation-1']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
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
                expect(params[1]).toEqual(JSON.stringify(vlc('Class A')))
                expect(params[2]).toEqual(JSON.stringify(vlc('Class A description')))
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
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
            name: vlc('Class A'),
            description: vlc('Class A description'),
            userId: 'user-1',
            actorUserId: 'user-1'
        })

        expect(result).toEqual({ id: 'workspace-1' })
        const queryText = txExecutor.query.mock.calls.map(([sql]) => String(sql))
        const workspaceInsertIndex = queryText.findIndex((sql) => sql.includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))
        const seedTemplateReadIndex = queryText.findIndex((sql) => sql.includes(`FROM "${schemaName}"."_app_settings"`))
        expect(workspaceInsertIndex).toBeGreaterThanOrEqual(0)
        expect(seedTemplateReadIndex).toBeGreaterThan(workspaceInsertIndex)
    })

    it('updates workspace metadata with fail-closed row confirmation', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: 'workspace-1' }]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspaces"`)) {
                expect(params).toEqual([
                    'workspace-1',
                    JSON.stringify(vlc('Class B')),
                    JSON.stringify(vlc('Class B description')),
                    'user-1'
                ])
                return [{ id: 'workspace-1' }]
            }

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await updateWorkspace(executor, {
            schemaName,
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334441',
            workspaceId: 'workspace-1',
            name: vlc('Class B'),
            description: vlc('Class B description'),
            actorUserId: 'user-1'
        })
    })

    it('blocks direct deletion of a personal workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, workspace_type')) {
                return [{ id: 'workspace-personal', workspace_type: 'personal' }]
            }

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            deleteSharedWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334441',
                workspaceId: 'workspace-personal',
                actorUserId: '550e8400-e29b-41d4-a716-446655440000'
            })
        ).rejects.toThrow('Personal workspace cannot be deleted')
    })

    it('clears the public-entry marker when a shared workspace is deleted', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const applicationSettings = { publicRuntime: { guest: {} } }
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const actorUserId = '550e8400-e29b-41d4-a716-446655440000'

        mockRevokeGuestSessionSecretsForWorkspace.mockResolvedValue(0)
        mockRevokeGuestAssessmentAttemptsForWorkspace.mockResolvedValue(1)
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, workspace_type')) {
                return [{ id: workspaceId, workspace_type: 'shared' }]
            }
            if (sql.includes('UPDATE') && sql.includes('RETURNING id')) {
                return [{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312274' }]
            }
            return []
        })

        await deleteSharedWorkspace(executor, {
            schemaName,
            applicationId,
            workspaceId,
            applicationSettings,
            actorUserId
        })

        expect(mockRevokeGuestSessionSecretsForWorkspace).toHaveBeenCalledWith(
            txExecutor,
            schemaName,
            applicationId,
            applicationSettings,
            workspaceId
        )
        expect(mockRevokeGuestAssessmentAttemptsForWorkspace).toHaveBeenCalledWith(txExecutor, schemaName, applicationSettings, workspaceId)
        const linkReleaseIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('UPDATE "applications"."obj_global_short_links"')
        )
        const tableDiscoveryIndex = txExecutor.query.mock.calls.findIndex(([sql]) => String(sql).includes('information_schema.columns'))
        expect(linkReleaseIndex).toBeGreaterThanOrEqual(0)
        expect(txExecutor.query.mock.calls[linkReleaseIndex]?.[1]).toEqual([applicationId, workspaceId, actorUserId])
        expect(tableDiscoveryIndex).toBeGreaterThanOrEqual(0)
        expect(linkReleaseIndex).toBeLessThan(tableDiscoveryIndex)
        expect(mockRevokeGuestSessionSecretsForWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
            txExecutor.query.mock.invocationCallOrder[tableDiscoveryIndex]
        )
        expect(mockRevokeGuestAssessmentAttemptsForWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
            txExecutor.query.mock.invocationCallOrder[tableDiscoveryIndex]
        )

        const workspaceUpdate = txExecutor.query.mock.calls
            .map(([sql]) => String(sql))
            .find((sql) => sql.includes("SET status = 'archived'"))
        expect(workspaceUpdate).toBeDefined()
        expect(workspaceUpdate).toContain('is_public_entry')
        expect(workspaceUpdate).toContain('= false')
    })

    it('stops workspace archival when guest session-secret cleanup fails', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const cleanupError = new Error('guest session-secret cleanup failed')
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const actorUserId = '550e8400-e29b-41d4-a716-446655440000'
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, workspace_type')) {
                return [{ id: workspaceId, workspace_type: 'shared' }]
            }
            return []
        })
        mockRevokeGuestSessionSecretsForWorkspace.mockRejectedValue(cleanupError)

        await expect(
            deleteSharedWorkspace(executor, {
                schemaName,
                applicationId,
                workspaceId,
                actorUserId
            })
        ).rejects.toBe(cleanupError)

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(mockRevokeGuestSessionSecretsForWorkspace.mock.invocationCallOrder[0]).toBeGreaterThan(
            txExecutor.query.mock.invocationCallOrder[0]
        )
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('information_schema.columns'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'archived'"))).toBe(false)
    })

    it('stops workspace archival when active quiz attempts cannot be finalized', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const finalizationError = new Error('guest assessment finalization failed')
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const actorUserId = '550e8400-e29b-41d4-a716-446655440000'
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id, workspace_type')) {
                return [{ id: workspaceId, workspace_type: 'shared' }]
            }
            return []
        })
        mockRevokeGuestSessionSecretsForWorkspace.mockResolvedValue(0)
        mockRevokeGuestAssessmentAttemptsForWorkspace.mockRejectedValue(finalizationError)

        await expect(
            deleteSharedWorkspace(executor, {
                schemaName,
                applicationId,
                workspaceId,
                actorUserId
            })
        ).rejects.toBe(finalizationError)

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(mockRevokeGuestSessionSecretsForWorkspace).toHaveBeenCalledTimes(1)
        expect(mockRevokeGuestAssessmentAttemptsForWorkspace).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('information_schema.columns'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'archived'"))).toBe(false)
    })

    it('fails closed when setting a default workspace for a non-member', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValue([])

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
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334401'

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
                expect(params[3]).toBe(applicationId)
                return [{ id: 'membership-2' }]
            }

            return []
        })

        executor.query.mockImplementation(async (sql: string) => {
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
                return [{ id: 'membership-2' }]
            }

            return []
        })

        await addWorkspaceMember(executor, {
            schemaName,
            applicationId,
            workspaceId: 'workspace-1',
            userId: 'user-2',
            roleCodename: 'member',
            actorUserId: 'user-1'
        })

        await removeWorkspaceMember(executor, {
            schemaName,
            applicationId,
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

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await addWorkspaceMember(executor, {
            schemaName,
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334404',
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

    it('preserves the baseline member row of an active application member during workspace removal', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334405'

        let preserveSql = ''
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) return []

            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes('INNER JOIN') && sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                return [
                    {
                        id: 'membership-member',
                        role_id: 'role-member',
                        is_default_workspace: true,
                        role_codename: 'member'
                    }
                ]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                preserveSql = sql
                expect(params[0]).toBe('workspace-1')
                expect(params[1]).toBe('user-4')
                expect(params[3]).toBe(applicationId)
                // Nothing deleted: the user's only row is the platform-owned baseline.
                return []
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            removeWorkspaceMember(executor, {
                schemaName,
                applicationId,
                workspaceId: 'workspace-1',
                userId: 'user-4',
                actorUserId: 'user-1'
            })
        ).resolves.toBeUndefined()

        expect(preserveSql).toContain(`applications.rel_application_users au`)
        expect(preserveSql).toContain(`r.codename = 'member'`)
    })

    it('fails closed when removing the last workspace owner', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes('wur.user_id <>')) {
                return []
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

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            removeWorkspaceMember(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334404',
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
                is_default_workspace: true,
                email: 'owner@example.com',
                nickname: 'Owner',
                can_remove: false,
                window_total: '2'
            },
            {
                user_id: 'user-2',
                role_id: 'role-member',
                role_codename: 'member',
                is_default_workspace: false,
                email: 'member@example.com',
                nickname: 'Member',
                can_remove: true,
                window_total: '2'
            }
        ])

        const result = await listWorkspaceMembers(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            limit: 20,
            offset: 0,
            search: 'member@example.com',
            canViewEmails: true
        })

        expect(result).toEqual({
            items: [
                { userId: 'user-1', roleCodename: 'owner', email: 'owner@example.com', nickname: 'Owner', canRemove: false },
                { userId: 'user-2', roleCodename: 'member', email: 'member@example.com', nickname: 'Member', canRemove: true }
            ],
            total: 2
        })
        const lastCall = executor.query.mock.calls[executor.query.mock.calls.length - 1]
        expect(String(lastCall?.[0])).toContain('u.email ILIKE $4')
        expect(lastCall?.[1]).toEqual(['workspace-1', 20, 0, '%member@example.com%'])
    })

    it('keeps ordinary workspace member search and counts independent of email', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([
            {
                user_id: 'user-2',
                role_id: 'role-member',
                role_codename: 'member',
                is_default_workspace: false,
                email: 'private@example.com',
                nickname: 'Member',
                can_remove: true,
                window_total: '1'
            }
        ])

        const result = await listWorkspaceMembers(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            limit: 20,
            offset: 0,
            search: 'Member',
            canViewEmails: false
        })

        expect(result).toEqual({
            items: [{ userId: 'user-2', roleCodename: 'member', email: null, nickname: 'Member', canRemove: true }],
            total: 1
        })
        const lastCall = executor.query.mock.calls[executor.query.mock.calls.length - 1]
        expect(String(lastCall?.[0])).toContain('p.nickname ILIKE $4')
        expect(String(lastCall?.[0])).not.toContain('auth.users')
        expect(String(lastCall?.[0])).not.toContain('u.email')
        expect(String(lastCall?.[0])).not.toContain('COALESCE(email, nickname')
        expect(lastCall?.[1]).toEqual(['workspace-1', 20, 0, '%Member%'])
    })

    it('does not match or count an email search for an ordinary workspace member', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([])

        const result = await listWorkspaceMembers(executor, {
            schemaName,
            workspaceId: 'workspace-1',
            limit: 20,
            offset: 0,
            search: 'private@example.com',
            canViewEmails: false
        })

        expect(result).toEqual({ items: [], total: 0 })
        const lastCall = executor.query.mock.calls[executor.query.mock.calls.length - 1]
        expect(String(lastCall?.[0])).not.toContain('auth.users')
        expect(String(lastCall?.[0])).not.toContain('u.email')
        expect(lastCall?.[1]).toEqual(['workspace-1', 20, 0, '%private@example.com%'])
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

    it('allows owners to invite members into a personal workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['relation-personal-member']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: 'workspace-1' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-member' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
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

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await addWorkspaceMember(executor, {
            schemaName,
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            userId: 'user-2',
            roleCodename: 'member',
            actorUserId: 'user-1'
        })

        expect(txExecutor.query).toHaveBeenCalledWith(
            expect.stringContaining(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`),
            expect.any(Array)
        )
    })

    it('blocks demoting the last owner row through the invite path', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes('wur.user_id <>')) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-member' }]
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

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            addWorkspaceMember(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334404',
                workspaceId: 'workspace-1',
                userId: 'user-1',
                roleCodename: 'member',
                actorUserId: 'user-1'
            })
        ).rejects.toThrow('Cannot demote the last workspace owner')

        // Failed-guard path must not mutate the role of the last owner.
        expect(txExecutor.query).not.toHaveBeenCalledWith(expect.stringContaining(`UPDATE "${schemaName}"."_app_workspace_user_roles"`))
    })

    it('allows demoting an owner when another active owner row exists with application membership', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ workspace_type: 'shared', personal_user_id: null }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-member' }]
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

            if (sql.includes('wur.user_id <>')) {
                return [{ id: 'other-owner-row' }]
            }

            if (sql.includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`)) {
                return []
            }

            if (sql.includes('pg_advisory_xact_lock')) return []

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            addWorkspaceMember(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334404',
                workspaceId: 'workspace-1',
                userId: 'user-1',
                roleCodename: 'member',
                actorUserId: 'user-2'
            })
        ).resolves.toBeUndefined()

        // Stale owner rows no longer count: the remaining-owner query
        // requires the other owner to still be an active application member.
        const remainingOwnerSql = txExecutor.query.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes('wur.user_id <>'))
        expect(remainingOwnerSql).toBeDefined()
        expect(remainingOwnerSql).toContain('applications.rel_application_users au')
        expect(txExecutor.query).toHaveBeenCalledWith(
            expect.stringContaining(`UPDATE "${schemaName}"."_app_workspace_user_roles"`),
            expect.any(Array)
        )
    })
})
