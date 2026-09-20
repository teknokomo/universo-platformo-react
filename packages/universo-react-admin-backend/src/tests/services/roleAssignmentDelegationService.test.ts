import type { DbExecutor } from '@universo-react/utils'

import { assertRoleAssignmentWithinCeiling } from '../../services/roleAssignmentDelegationService'
import { RoleDelegationError } from '../../services/roleDelegationPolicy'

const ROLE_ID = '00000000-0000-4000-a000-000000000010'
const OTHER_ROLE_ID = '00000000-0000-4000-a000-000000000011'

const buildRole = (permissions: Array<{ subject: string; action: string; conditions?: unknown; fields?: string[] }>) => ({
    id: ROLE_ID,
    codename: { _schema: '1', _primary: 'en', locales: {} },
    description: null,
    name: {},
    color: '#000000',
    is_superuser: false,
    is_system: false,
    _upl_created_at: '2026-01-01T00:00:00.000Z',
    _upl_updated_at: '2026-01-01T00:00:00.000Z',
    permissions
})

const createExecutor = ({
    actorIsSuperuser = false,
    actorPermissions = [],
    rolePermissions = [{ subject: 'applicationAliases', action: 'read' }],
    roleFound = true
}: {
    actorIsSuperuser?: boolean
    actorPermissions?: Array<{ subject: string; action: string; conditions?: unknown; fields?: string[] }>
    rolePermissions?: Array<{ subject: string; action: string; conditions?: unknown; fields?: string[] }>
    roleFound?: boolean
} = {}) => {
    const query = jest.fn(async (sql: string) => {
        const normalized = sql.replace(/\s+/g, ' ').trim()

        if (normalized.includes('SELECT admin.is_superuser')) return [{ is_super: actorIsSuperuser }]
        if (normalized.includes('FROM admin.rel_user_roles ur') && normalized.includes('JOIN admin.rel_role_permissions rp')) {
            return actorPermissions
        }
        if (normalized.includes('FROM admin.obj_roles r') && normalized.includes('FOR UPDATE')) {
            return roleFound ? [buildRole(rolePermissions)] : []
        }
        if (normalized.includes('FROM admin.rel_role_permissions')) return rolePermissions
        return []
    })

    return { exec: { query } as unknown as DbExecutor, query }
}

describe('role assignment delegation ceiling', () => {
    it('lets a Superuser assign any role without loading the privilege envelope', async () => {
        const { exec, query } = createExecutor({ actorIsSuperuser: true })

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: 'actor-1', roleIds: [ROLE_ID] })).resolves.toBeUndefined()

        const normalizedCalls = query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' '))
        expect(normalizedCalls.some((sql) => sql.includes('SELECT admin.is_superuser'))).toBe(true)
        expect(normalizedCalls.some((sql) => sql.includes('FROM admin.rel_user_roles ur'))).toBe(false)
    })

    it('allows assignment when the role permissions are inside the actor envelope', async () => {
        const { exec } = createExecutor({
            actorPermissions: [{ subject: 'applicationAliases', action: 'read' }],
            rolePermissions: [{ subject: 'applicationAliases', action: 'read' }]
        })

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: 'actor-1', roleIds: [ROLE_ID] })).resolves.toBeUndefined()
    })

    it('rejects assignment when the role carries permissions outside the actor envelope', async () => {
        const { exec } = createExecutor({
            actorPermissions: [{ subject: 'applicationAliases', action: 'read' }],
            rolePermissions: [{ subject: 'roles', action: 'update' }]
        })

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: 'actor-1', roleIds: [ROLE_ID] })).rejects.toBeInstanceOf(
            RoleDelegationError
        )
    })

    it('rejects assignment when the actor cannot be authenticated', async () => {
        const { exec } = createExecutor()

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: null, roleIds: [ROLE_ID] })).rejects.toBeInstanceOf(
            RoleDelegationError
        )
    })

    it('fails closed when one of the requested roles no longer exists', async () => {
        const { exec } = createExecutor({ roleFound: false })

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: 'actor-1', roleIds: [OTHER_ROLE_ID] })).rejects.toThrow(
            /is not available for assignment/
        )
    })

    it('ignores an empty role set', async () => {
        const { exec, query } = createExecutor()

        await expect(assertRoleAssignmentWithinCeiling(exec, { actorUserId: 'actor-1', roleIds: [] })).resolves.toBeUndefined()
        expect(query).not.toHaveBeenCalled()
    })
})
