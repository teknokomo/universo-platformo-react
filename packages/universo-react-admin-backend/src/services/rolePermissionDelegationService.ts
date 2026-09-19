import type { DbExecutor } from '@universo-react/utils'
import {
    listEffectivePermissionsForUser,
    lockRoleMutation,
    lockRoleForPermissionUpdate,
    replacePermissions,
    type RolePermissionInput,
    type RolePermissionRow,
    type RoleRow
} from '../persistence/rolesStore'
import { isSuperuser } from './globalAccessService'
import { RoleDelegationError, assertSupportedAliasPermissionShape, permissionCovers } from './roleDelegationPolicy'

export interface AssertRoleDelegationCeilingInput {
    actorUserId?: string | null
    requestedPermissions?: RolePermissionInput[]
    requestedIsSuperuser?: boolean
    targetRole?: Pick<RoleRow, 'is_superuser'> | null
}

/**
 * Enforce the permission delegation ceiling for every role mutation path.
 * Call this only inside the same transaction that persists the role mutation.
 */
export async function assertRoleDelegationCeiling(exec: DbExecutor, input: AssertRoleDelegationCeilingInput): Promise<void> {
    const requestedPermissions = input.requestedPermissions ?? []
    assertSupportedAliasPermissionShape(requestedPermissions)

    if (!input.actorUserId) {
        throw new RoleDelegationError('Authenticated actor is required for role delegation')
    }

    if (input.requestedIsSuperuser === true) {
        throw new RoleDelegationError('Only a Superuser can create or promote a superuser role')
    }

    if (input.targetRole?.is_superuser) {
        throw new RoleDelegationError('The Superuser role is immutable')
    }

    const actorIsSuperuser = await isSuperuser(exec, input.actorUserId)
    if (actorIsSuperuser) return

    if (requestedPermissions.length === 0) return

    const actorPermissions = await listEffectivePermissionsForUser(exec, input.actorUserId)
    for (const requestedPermission of requestedPermissions) {
        if (!actorPermissions.some((actorPermission) => permissionCovers(actorPermission, requestedPermission))) {
            throw new RoleDelegationError(
                `Cannot grant permission outside the actor privilege envelope: ${requestedPermission.subject}:${requestedPermission.action}`
            )
        }
    }
}

export interface ReplaceRolePermissionsWithDelegationCeilingInput {
    roleId: string
    actorUserId?: string | null
    permissions: RolePermissionInput[]
    deletedBy?: string
}

/**
 * Lock, authorize, and replace one complete role permission set atomically.
 */
export async function replaceRolePermissionsWithDelegationCeiling(
    exec: DbExecutor,
    input: ReplaceRolePermissionsWithDelegationCeilingInput
): Promise<RolePermissionRow[]> {
    await lockRoleMutation(exec)

    const targetRole = await lockRoleForPermissionUpdate(exec, input.roleId)
    if (!targetRole) {
        throw Object.assign(new Error('Role not found'), { statusCode: 404 })
    }

    await assertRoleDelegationCeiling(exec, {
        actorUserId: input.actorUserId,
        requestedPermissions: input.permissions,
        targetRole
    })

    return replacePermissions(exec, input.roleId, input.permissions, input.deletedBy)
}
