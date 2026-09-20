import type { Actions, AppAbility, Subjects } from '@universo-react/types'

export const APPLICATION_ALIAS_SUBJECT = 'ApplicationAlias' as Subjects

export const canUseApplicationAliasAbility = (ability: AppAbility | null | undefined, isSuperuser: boolean, action: Actions): boolean => {
    if (isSuperuser) return true
    if (!ability) return false
    return ability.can('manage', APPLICATION_ALIAS_SUBJECT) || ability.can(action, APPLICATION_ALIAS_SUBJECT)
}

export interface ApplicationAliasPageCapabilities {
    canRead: boolean
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
}

/**
 * Alias actions are independently grantable. The management page must stay
 * reachable for every alias capability instead of collapsing to a permission
 * wall, while the registry table itself still requires `read`.
 */
export type ApplicationAliasPageAccess = 'denied' | 'read-required' | 'full'

export const resolveApplicationAliasPageAccess = (capabilities: ApplicationAliasPageCapabilities): ApplicationAliasPageAccess => {
    if (capabilities.canRead) return 'full'
    if (capabilities.canCreate || capabilities.canUpdate || capabilities.canDelete) return 'read-required'
    return 'denied'
}
