import type { Actions, AppAbility, Subjects } from '@universo-react/types'

export const APPLICATION_ALIAS_SUBJECT = 'ApplicationAlias' as Subjects

export const canUseApplicationAliasAbility = (ability: AppAbility | null | undefined, isSuperuser: boolean, action: Actions): boolean => {
    if (isSuperuser) return true
    if (!ability) return false
    return ability.can('manage', APPLICATION_ALIAS_SUBJECT) || ability.can(action, APPLICATION_ALIAS_SUBJECT)
}
