import { activeAppRowCondition, type DbExecutor } from '@universo/utils'
import * as httpErrors from 'http-errors'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuser, getGlobalRoleCodename, hasSubjectPermission } from '@universo/admin-backend'
import { applicationRolePolicySettingsSchema, type RoleCapabilityRule } from '@universo/types'
import type { ApplicationMembershipRecord, ConnectorAccessRecord } from '../persistence/contracts'

// Handle both ESM and CJS imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createError = (httpErrors as any).default || httpErrors

// Application roles type
export type ApplicationRole = 'owner' | 'admin' | 'editor' | 'member'

export const ROLE_PERMISSIONS: Record<ApplicationRole, Record<string, boolean>> = {
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

export type RolePermission = 'manageMembers' | 'manageApplication' | 'createContent' | 'editContent' | 'deleteContent' | 'readReports'

const ROLE_PERMISSION_KEYS: readonly RolePermission[] = [
    'manageMembers',
    'manageApplication',
    'createContent',
    'editContent',
    'deleteContent',
    'readReports'
] as const

const ROLE_PERMISSION_CAPABILITY_ALIASES: Record<RolePermission, readonly string[]> = {
    manageMembers: ['manageMembers', 'members.manage', 'workspace.members.manage'],
    manageApplication: ['manageApplication', 'application.manage', 'settings.manage'],
    createContent: ['createContent', 'content.create', 'records.create'],
    editContent: ['editContent', 'content.edit', 'records.edit', 'workflow.execute'],
    deleteContent: ['deleteContent', 'content.delete', 'records.delete'],
    readReports: ['readReports', 'reports.read', 'report.read']
}

const cloneRolePermissions = (role: ApplicationRole): Record<RolePermission, boolean> => {
    const base = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member
    return Object.fromEntries(ROLE_PERMISSION_KEYS.map((key) => [key, base[key] === true])) as Record<RolePermission, boolean>
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const ruleMatchesPermission = (rule: RoleCapabilityRule, permission: RolePermission): boolean => {
    const aliases = ROLE_PERMISSION_CAPABILITY_ALIASES[permission]
    return aliases.includes(rule.capability)
}

export const resolveEffectiveRolePermissions = (
    role: ApplicationRole,
    settings?: Record<string, unknown> | null
): Record<RolePermission, boolean> => {
    const permissions = cloneRolePermissions(role)
    const rawRolePolicies = isRecord(settings) ? settings.rolePolicies : undefined
    const parsed = applicationRolePolicySettingsSchema.safeParse(rawRolePolicies)
    if (!parsed.success) {
        return permissions
    }

    for (const template of parsed.data.templates) {
        const appliesToRole = template.baseRole === role || template.codename === role || template.codename === `${role}Policy`
        if (!appliesToRole) {
            continue
        }

        for (const rule of template.rules) {
            if (rule.scope !== 'application' && rule.scope !== 'workspace') {
                continue
            }

            for (const permission of ROLE_PERMISSION_KEYS) {
                if (ruleMatchesPermission(rule, permission)) {
                    permissions[permission] = rule.effect === 'allow'
                }
            }
        }
    }

    return permissions
}

export interface ApplicationMembershipContext {
    membership: ApplicationMembershipRecord
    applicationId: string
    entityId?: string
    isSynthetic?: boolean
    globalRole?: string | null
}

const hasGlobalApplicationAdminAccess = async (executor: DbExecutor, userId: string): Promise<boolean> => {
    const [canUpdate, canDelete] = await Promise.all([
        hasSubjectPermission(executor, userId, 'applications', 'update'),
        hasSubjectPermission(executor, userId, 'applications', 'delete')
    ])

    return canUpdate || canDelete
}

const runQuery = async <TRow = unknown>(executor: DbExecutor, sql: string, params: unknown[]): Promise<TRow[]> => {
    return executor.query<TRow>(sql, params)
}

// Create base guards using generic factory from auth-backend
const baseGuards = createAccessGuards<ApplicationRole, ApplicationMembershipRecord, DbExecutor>({
    entityName: 'application',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (executor: DbExecutor, userId: string, applicationId: string) => {
        const rows = await runQuery<ApplicationMembershipRecord>(
            executor,
            `
            SELECT *
            FROM applications.rel_application_users
            WHERE application_id = $1
              AND user_id = $2
                                                        AND ${activeAppRowCondition()}
            LIMIT 1
            `,
            [applicationId, userId]
        )

        return rows[0] ?? null
    },
    extractRole: (m: ApplicationMembershipRecord) => (m.role || 'member') as ApplicationRole,
    extractUserId: (m: ApplicationMembershipRecord) => m.userId,
    extractEntityId: (m: ApplicationMembershipRecord) => m.applicationId,
    isSuperuser: (executor: DbExecutor, userId: string) => isSuperuser(executor, userId),
    getGlobalRoleName: (executor: DbExecutor, userId: string) => getGlobalRoleCodename(executor, userId),
    createGlobalAdminMembership: (visitorUserId: string, entityId: string, _globalRole: string | null) =>
        ({
            userId: visitorUserId,
            applicationId: entityId,
            role: 'owner',
            _uplCreatedAt: new Date()
        } satisfies ApplicationMembershipRecord)
})

// Re-export base guards
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getApplicationMembership(
    executor: DbExecutor,
    userId: string,
    applicationId: string
): Promise<ApplicationMembershipRecord | null> {
    return getMembershipSafe(executor, userId, applicationId)
}

export async function ensureApplicationAccess(
    executor: DbExecutor,
    userId: string,
    applicationId: string,
    requiredRoles?: ApplicationRole[]
): Promise<ApplicationMembershipContext> {
    const isSuper = await isSuperuser(executor, userId)
    const hasGlobalAdminAccess = isSuper ? true : await hasGlobalApplicationAdminAccess(executor, userId)

    if (hasGlobalAdminAccess) {
        const globalRoleName = await getGlobalRoleCodename(executor, userId)
        const syntheticMembership: ApplicationMembershipRecord = {
            userId,
            applicationId,
            role: 'owner',
            _uplCreatedAt: new Date()
        }

        return {
            membership: syntheticMembership,
            entityId: applicationId,
            applicationId,
            isSynthetic: true,
            globalRole: globalRoleName
        }
    }

    // Otherwise do membership check using request-scoped executor (RLS-enabled if available)
    const membership = await getMembershipSafe(executor, userId, applicationId)
    if (!membership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            applicationId,
            action: 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this application')
    }

    // Check required roles if specified
    if (requiredRoles && requiredRoles.length > 0) {
        const userRole = (membership.role || 'member') as ApplicationRole
        if (!requiredRoles.includes(userRole)) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                applicationId,
                userRole,
                requiredRoles,
                reason: 'insufficient_role'
            })
            throw createError(403, 'Insufficient permissions')
        }
    }

    return { membership, entityId: applicationId, applicationId }
}

/**
 * Assert that the target user is not the owner of the application
 * Used to prevent owner from being demoted or removed
 */
export function assertNotOwner(membership: Pick<ApplicationMembershipRecord, 'role'>, message = 'Cannot modify owner'): void {
    if (membership.role === 'owner') {
        throw createError(403, message)
    }
}

// ============ CONNECTOR ACCESS GUARDS ============

export interface ConnectorAccessContext extends ApplicationMembershipContext {
    connector: ConnectorAccessRecord
}

/**
 * Ensure user has access to a Connector through its parent Application
 */
export async function ensureConnectorAccess(
    executor: DbExecutor,
    userId: string,
    connectorId: string,
    requiredRoles?: ApplicationRole[]
): Promise<ConnectorAccessContext> {
    const connectorRows = await runQuery<ConnectorAccessRecord>(
        executor,
        `
        SELECT *
        FROM applications.cat_connectors
        WHERE id = $1
                    AND ${activeAppRowCondition()}
        LIMIT 1
        `,
        [connectorId]
    )
    const connector = connectorRows[0] ?? null

    if (!connector) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            connectorId,
            action: 'access',
            reason: 'connector_not_found'
        })
        throw createError(404, 'Connector not found')
    }

    // Check access to the parent application
    const context = await ensureApplicationAccess(executor, userId, connector.applicationId, requiredRoles)

    return { ...context, connector }
}

// Suppress unused variable warning
void createError
void ensureAccess
