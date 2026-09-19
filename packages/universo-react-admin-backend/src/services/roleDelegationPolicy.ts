import { isDeepStrictEqual } from 'node:util'

import type { RolePermissionInput } from '../persistence/rolesStore'

/**
 * Pure delegation-policy helpers shared by every privilege mutation path
 * (role definition and role assignment). Keeping them free of service imports
 * avoids circular dependencies between the delegation services.
 */

const APPLICATION_ALIASES_SUBJECT = 'applicationAliases'

export class RoleDelegationError extends Error {
    readonly statusCode = 403

    constructor(message: string) {
        super(message)
        this.name = 'RoleDelegationError'
    }
}

export const hasNonEmptyConditions = (permission: RolePermissionInput): boolean => {
    return Boolean(
        permission.conditions &&
            typeof permission.conditions === 'object' &&
            !Array.isArray(permission.conditions) &&
            Object.keys(permission.conditions as Record<string, unknown>).length > 0
    )
}

export const hasFieldRestriction = (permission: RolePermissionInput): boolean => (permission.fields?.length ?? 0) > 0

const restrictionsCover = (actorPermission: RolePermissionInput, requestedPermission: RolePermissionInput): boolean => {
    if (hasNonEmptyConditions(actorPermission)) {
        if (!hasNonEmptyConditions(requestedPermission)) return false
        if (!isDeepStrictEqual(actorPermission.conditions, requestedPermission.conditions)) return false
    }

    if (hasFieldRestriction(actorPermission)) {
        if (!hasFieldRestriction(requestedPermission)) return false
        const actorFields = new Set(actorPermission.fields)
        if (!requestedPermission.fields?.every((field) => actorFields.has(field))) return false
    }

    return true
}

export const assertSupportedAliasPermissionShape = (permissions: RolePermissionInput[]): void => {
    for (const permission of permissions) {
        if (permission.subject !== APPLICATION_ALIASES_SUBJECT && permission.subject !== '*') continue

        if (hasNonEmptyConditions(permission) || hasFieldRestriction(permission)) {
            throw new RoleDelegationError('Application alias permissions do not support conditions or field restrictions')
        }
    }
}

export const permissionCovers = (actorPermission: RolePermissionInput, requestedPermission: RolePermissionInput): boolean => {
    const subjectCovered =
        actorPermission.subject === '*' || (requestedPermission.subject !== '*' && actorPermission.subject === requestedPermission.subject)
    if (!subjectCovered) return false

    if (requestedPermission.subject === '*' && actorPermission.subject !== '*') return false

    if (
        (requestedPermission.subject === APPLICATION_ALIASES_SUBJECT || requestedPermission.subject === '*') &&
        (hasNonEmptyConditions(actorPermission) || hasFieldRestriction(actorPermission))
    ) {
        return false
    }

    if (!restrictionsCover(actorPermission, requestedPermission)) return false

    const actorActionIsWildcard = actorPermission.action === '*' || actorPermission.action === 'manage'
    if (requestedPermission.action === '*') return actorActionIsWildcard

    return actorActionIsWildcard || actorPermission.action === requestedPermission.action
}
