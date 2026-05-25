import { ROLE_MENU_VISIBILITY, type RoleMenuVisibility, type Subjects } from '@universo/types'

interface GlobalRoleLike {
    codename?: string
    name?: string
}

interface ResolveShellAccessInput {
    globalRoles: GlobalRoleLike[]
    isSuperuser: boolean
    ability?: { can(action: string, subject: string): boolean } | null
}

export interface ShellAccessResolution {
    hasWorkspaceAccess: boolean
    isRegisteredOnly: boolean
    visibility: RoleMenuVisibility
}

const getRoleCodename = (role: GlobalRoleLike): string => role.codename ?? role.name ?? ''

const hasOnlyRegisteredRole = (roleCodenames: Set<string>): boolean => roleCodenames.size === 1 && roleCodenames.has('Registered')

const WORKSPACE_ACTIONS = ['manage', 'read', 'create', 'update', 'delete'] as const

const hasSubjectCapability = (
    ability: { can(action: string, subject: string): boolean } | null | undefined,
    subject: Extract<Subjects, 'Application' | 'Metahub' | 'Profile'>
): boolean => {
    if (!ability) {
        return false
    }

    return WORKSPACE_ACTIONS.some((action) => ability.can(action, subject))
}

const buildWorkspaceVisibility = (options: {
    canAccessApplications: boolean
    canAccessMetahubs: boolean
    canAccessProfile: boolean
}): RoleMenuVisibility => {
    const rootMenuIds = ['metapanel']

    if (options.canAccessApplications) {
        rootMenuIds.push('applications')
    }

    if (options.canAccessProfile) {
        rootMenuIds.push('profile')
    }

    rootMenuIds.push('docs')

    return {
        rootMenuIds,
        showMetahubsSection: options.canAccessMetahubs
    }
}

export function resolveShellAccess({ globalRoles, isSuperuser, ability }: ResolveShellAccessInput): ShellAccessResolution {
    const roleCodenames = new Set(globalRoles.map(getRoleCodename).filter(Boolean))

    if (isSuperuser) {
        return {
            hasWorkspaceAccess: true,
            isRegisteredOnly: false,
            visibility: ROLE_MENU_VISIBILITY.Superuser
        }
    }

    if (hasOnlyRegisteredRole(roleCodenames)) {
        return {
            hasWorkspaceAccess: false,
            isRegisteredOnly: true,
            visibility: ROLE_MENU_VISIBILITY.Registered
        }
    }

    if (!ability) {
        const hasWorkspaceAccess = roleCodenames.has('User')
        const isRegisteredOnly = !hasWorkspaceAccess && roleCodenames.has('Registered')

        if (roleCodenames.has('User')) {
            return {
                hasWorkspaceAccess,
                isRegisteredOnly,
                visibility: ROLE_MENU_VISIBILITY.User
            }
        }

        if (isRegisteredOnly) {
            return {
                hasWorkspaceAccess,
                isRegisteredOnly,
                visibility: ROLE_MENU_VISIBILITY.Registered
            }
        }

        return {
            hasWorkspaceAccess: false,
            isRegisteredOnly: false,
            visibility: { rootMenuIds: [] }
        }
    }

    const canAccessApplications = hasSubjectCapability(ability, 'Application')
    const canAccessMetahubs = hasSubjectCapability(ability, 'Metahub')
    const canAccessProfile = hasSubjectCapability(ability, 'Profile')
    const hasWorkspaceAccess = canAccessApplications || canAccessMetahubs || canAccessProfile
    const isRegisteredOnly = !hasWorkspaceAccess && roleCodenames.has('Registered')

    if (isRegisteredOnly) {
        return {
            hasWorkspaceAccess,
            isRegisteredOnly,
            visibility: ROLE_MENU_VISIBILITY.Registered
        }
    }

    return {
        hasWorkspaceAccess,
        isRegisteredOnly: false,
        visibility: hasWorkspaceAccess
            ? buildWorkspaceVisibility({
                  canAccessApplications,
                  canAccessMetahubs,
                  canAccessProfile
              })
            : { rootMenuIds: [] }
    }
}
