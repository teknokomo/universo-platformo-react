import type { DbExecutor } from '@universo-react/utils'
import { assertRoleDelegationCeiling, replaceRolePermissionsWithDelegationCeiling } from '../../services/rolePermissionDelegationService'
import { RoleDelegationError } from '../../services/roleDelegationPolicy'

const TARGET_ROLE = {
    id: '00000000-0000-4000-a000-000000000001',
    codename: { _schema: '1', _primary: 'en', locales: {} },
    description: null,
    name: {},
    color: '#9e9e9e',
    is_superuser: false,
    is_system: false,
    _upl_created_at: '2026-01-01T00:00:00.000Z',
    _upl_updated_at: '2026-01-01T00:00:00.000Z'
}

function createExecutor({
    actorIsSuperuser = false,
    actorPermissions = [],
    targetRole = TARGET_ROLE
}: {
    actorIsSuperuser?: boolean
    actorPermissions?: Array<{ subject: string; action: string; conditions?: unknown; fields?: string[] }>
    targetRole?: typeof TARGET_ROLE
} = {}) {
    const calls: string[] = []
    const query = jest.fn(async (sql: string) => {
        const normalized = sql.replace(/\s+/g, ' ').trim()
        calls.push(normalized)

        if (normalized.includes('SELECT admin.is_superuser')) return [{ is_super: actorIsSuperuser }]
        if (normalized.includes('FROM admin.rel_user_roles ur') && normalized.includes('JOIN admin.rel_role_permissions rp')) {
            return actorPermissions
        }
        if (normalized.includes('FROM admin.obj_roles r') && normalized.includes('FOR UPDATE')) return [targetRole]
        if (normalized.startsWith('UPDATE admin.rel_role_permissions')) return []
        if (normalized.startsWith('INSERT INTO admin.rel_role_permissions')) return []
        return []
    })

    return { exec: { query } as unknown as DbExecutor, query, calls }
}

describe('role permission delegation ceiling', () => {
    it('allows a Superuser to grant application alias permissions', async () => {
        const { exec } = createExecutor({ actorIsSuperuser: true })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applicationAliases', action: 'read' }],
                requestedIsSuperuser: false
            })
        ).resolves.toBeUndefined()
    })

    it('allows a delegated administrator to grant the exact application alias capability in its envelope', async () => {
        const { exec } = createExecutor({
            actorPermissions: [{ subject: 'applicationAliases', action: 'read', conditions: {}, fields: [] }]
        })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applicationAliases', action: 'read' }]
            })
        ).resolves.toBeUndefined()
    })

    it('blocks a delegated administrator that lacks the requested application alias capability', async () => {
        const { exec } = createExecutor({ actorPermissions: [{ subject: 'roles', action: 'update' }] })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applicationAliases', action: 'read' }]
            })
        ).rejects.toThrow('applicationAliases:read')
    })

    it('does not synthesize an action wildcard from individual CRUD capabilities', async () => {
        const { exec } = createExecutor({
            actorPermissions: ['create', 'read', 'update', 'delete'].map((action) => ({ subject: 'applicationAliases', action }))
        })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applicationAliases', action: '*' }]
            })
        ).rejects.toThrow('applicationAliases:*')
    })

    it('does not synthesize a subject wildcard from individual subject capabilities', async () => {
        const { exec } = createExecutor({
            actorPermissions: [
                { subject: 'roles', action: '*' },
                { subject: 'applicationAliases', action: '*' }
            ]
        })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: '*', action: '*' }]
            })
        ).rejects.toThrow('*:*')
    })

    it('does not widen a conditional capability during delegation', async () => {
        const { exec } = createExecutor({
            actorPermissions: [{ subject: 'applications', action: 'read', conditions: { ownerId: 'self' } }]
        })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applications', action: 'read' }]
            })
        ).rejects.toThrow('applications:read')
    })

    it('allows a field-restricted capability to delegate a subset of the same fields', async () => {
        const { exec } = createExecutor({
            actorPermissions: [{ subject: 'applications', action: 'read', fields: ['id', 'name'] }]
        })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions: [{ subject: 'applications', action: 'read', fields: ['id'] }]
            })
        ).resolves.toBeUndefined()
    })

    it('blocks non-Superusers from creating or promoting a Superuser role', async () => {
        const { exec } = createExecutor({ actorPermissions: [{ subject: 'roles', action: 'update' }] })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedIsSuperuser: true
            })
        ).rejects.toThrow('Only a Superuser can create or promote a superuser role')
    })

    it('rejects a Superuser actor from creating or promoting another Superuser role before bypass', async () => {
        const { exec, query } = createExecutor({ actorIsSuperuser: true })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedIsSuperuser: true
            })
        ).rejects.toThrow('Only a Superuser can create or promote a superuser role')

        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('SELECT admin.is_superuser'), expect.anything())
    })

    it('keeps the existing Superuser role immutable even for a Superuser actor', async () => {
        const { exec } = createExecutor({ actorIsSuperuser: true })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                targetRole: { is_superuser: true }
            })
        ).rejects.toThrow('The Superuser role is immutable')
    })

    it.each([
        { requestedPermissions: [{ subject: 'applicationAliases', action: 'read', conditions: { owner: true } }] },
        { requestedPermissions: [{ subject: 'applicationAliases', action: 'read', fields: ['applicationId'] }] },
        { requestedPermissions: [{ subject: '*', action: '*', conditions: { scope: 'restricted' } }] }
    ])('rejects alias-affecting conditions or field restrictions: $requestedPermissions', async ({ requestedPermissions }) => {
        const { exec } = createExecutor({ actorIsSuperuser: true })

        await expect(
            assertRoleDelegationCeiling(exec, {
                actorUserId: 'actor-1',
                requestedPermissions
            })
        ).rejects.toBeInstanceOf(RoleDelegationError)
    })

    it('locks the target role before delegation validation and permission replacement', async () => {
        const { exec, calls } = createExecutor({
            actorPermissions: [{ subject: 'applicationAliases', action: 'read' }]
        })

        await replaceRolePermissionsWithDelegationCeiling(exec, {
            roleId: TARGET_ROLE.id,
            actorUserId: 'actor-1',
            permissions: [{ subject: 'applicationAliases', action: 'read' }],
            deletedBy: 'actor-1'
        })

        const advisoryLockIndex = calls.findIndex((sql) => sql.includes('pg_advisory_xact_lock'))
        const firstLockIndex = calls.findIndex((sql) => sql.includes('FOR UPDATE'))
        const permissionUpdateIndex = calls.findIndex((sql) => sql.startsWith('UPDATE admin.rel_role_permissions'))
        expect(advisoryLockIndex).toBeGreaterThanOrEqual(0)
        expect(firstLockIndex).toBeGreaterThanOrEqual(0)
        expect(firstLockIndex).toBeGreaterThan(advisoryLockIndex)
        expect(permissionUpdateIndex).toBeGreaterThan(firstLockIndex)
    })
})
