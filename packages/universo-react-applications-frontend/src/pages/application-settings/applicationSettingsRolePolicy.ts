import type { ApplicationRolePolicySettings, RoleCapabilityRule } from '@universo-react/types'
import type { ApplicationRole } from '../../types'
import { APPLICATION_CAPABILITIES, APPLICATION_ROLE_ORDER, type ApplicationCapabilityKey } from './SettingsPanels'

const BASE_ROLE_PERMISSIONS: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> = {
    owner: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    admin: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    editor: {
        manageMembers: false,
        manageApplication: false,
        createContent: true,
        editContent: true,
        deleteContent: false,
        readReports: true
    },
    member: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: false
    }
}

const cloneRoleMatrix = (): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> =>
    Object.fromEntries(
        APPLICATION_ROLE_ORDER.map((role) => [
            role,
            Object.fromEntries(APPLICATION_CAPABILITIES.map((capability) => [capability.key, BASE_ROLE_PERMISSIONS[role][capability.key]]))
        ])
    ) as Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>

const roleMatchesTemplate = (template: { codename?: string; baseRole?: ApplicationRole }, role: ApplicationRole): boolean =>
    template.baseRole === role || template.codename === role || template.codename === `${role}Policy`

const capabilityMatchesRule = (rule: RoleCapabilityRule, capability: (typeof APPLICATION_CAPABILITIES)[number]): boolean =>
    capability.aliases.includes(rule.capability)

export const resolveRolePolicyMatrix = (
    rolePolicies?: ApplicationRolePolicySettings
): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> => {
    const matrix = cloneRoleMatrix()
    for (const template of rolePolicies?.templates ?? []) {
        for (const role of APPLICATION_ROLE_ORDER) {
            if (!roleMatchesTemplate(template, role)) continue

            for (const rule of template.rules) {
                if (rule.scope !== 'application' && rule.scope !== 'workspace') continue
                for (const capability of APPLICATION_CAPABILITIES) {
                    if (capabilityMatchesRule(rule, capability)) {
                        matrix[role][capability.key] = rule.effect === 'allow'
                    }
                }
            }
        }
    }
    return matrix
}

export const buildRolePoliciesFromMatrix = (
    currentPolicies: ApplicationRolePolicySettings | undefined,
    matrix: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>
): ApplicationRolePolicySettings => {
    const unmanagedTemplates = (currentPolicies?.templates ?? []).filter(
        (template) => !APPLICATION_ROLE_ORDER.some((role) => roleMatchesTemplate(template, role))
    )
    const templates = APPLICATION_ROLE_ORDER.map((role) => {
        const existingTemplate = (currentPolicies?.templates ?? []).find((template) => roleMatchesTemplate(template, role))
        const managedRules = APPLICATION_CAPABILITIES.flatMap(
            (capability) => existingTemplate?.rules.filter((rule) => capabilityMatchesRule(rule, capability)) ?? []
        )
        const rulesToReplace = new Set(managedRules)
        const preservedRules = (existingTemplate?.rules ?? []).filter((rule) => !rulesToReplace.has(rule))
        const rules: RoleCapabilityRule[] = [
            ...preservedRules,
            ...APPLICATION_CAPABILITIES.map((capability) => ({
                capability: capability.capability,
                effect: matrix[role][capability.key] ? ('allow' as const) : ('deny' as const),
                scope: 'workspace' as const
            }))
        ]

        return {
            codename: existingTemplate?.codename ?? `${role}Policy`,
            title: existingTemplate?.title ?? `${role} permissions`,
            baseRole: role,
            rules
        }
    })

    return { templates: [...unmanagedTemplates, ...templates] }
}
