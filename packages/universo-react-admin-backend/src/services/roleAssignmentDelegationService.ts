import type { DbExecutor } from '@universo-react/utils'

import { findRoleByIdForUpdate, listEffectivePermissionsForUser } from '../persistence/rolesStore'
import { RoleDelegationError, permissionCovers } from './roleDelegationPolicy'

/**
 * Enforce the privilege-envelope ceiling for role assignment.
 *
 * A non-Superuser actor may assign only roles whose effective permissions are
 * already inside the actor's own privilege envelope. Root Superuser keeps the
 * platform-level bypass. Call this inside the same transaction that persists
 * the assignment so concurrently widened roles cannot slip through.
 */
export async function assertRoleAssignmentWithinCeiling(
    exec: DbExecutor,
    input: { actorUserId?: string | null; roleIds: readonly string[] }
): Promise<void> {
    const uniqueRoleIds = Array.from(new Set(input.roleIds))
    if (uniqueRoleIds.length === 0) return

    if (!input.actorUserId) {
        throw new RoleDelegationError('Authenticated actor is required for role assignment')
    }

    const superuserRows = await exec.query<{ is_super: boolean }>(`SELECT admin.is_superuser($1::uuid) as is_super`, [input.actorUserId])
    if (superuserRows[0]?.is_super === true) return

    const actorPermissions = await listEffectivePermissionsForUser(exec, input.actorUserId)

    for (const roleId of uniqueRoleIds) {
        // Row lock + FOR SHARE on permissions keeps the checked set stable for
        // this transaction, matching the permission-replacement locking model.
        const role = await findRoleByIdForUpdate(exec, roleId)
        if (!role) {
            throw new RoleDelegationError(`Role '${roleId}' is not available for assignment`)
        }

        for (const permission of role.permissions) {
            const covered = actorPermissions.some((actorPermission) => permissionCovers(actorPermission, permission))
            if (!covered) {
                throw new RoleDelegationError(
                    `Cannot assign a role with permissions outside the actor privilege envelope: ${permission.subject}:${permission.action}`
                )
            }
        }
    }
}
