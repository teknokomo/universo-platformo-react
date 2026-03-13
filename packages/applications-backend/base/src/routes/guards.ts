import { activeAppRowCondition, type DbExecutor } from '@universo/utils'
import * as httpErrors from 'http-errors'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuser, getGlobalRoleCodename, hasSubjectPermission } from '@universo/admin-backend'
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
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageApplication: false,
        createContent: true,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
}

export type RolePermission = 'manageMembers' | 'manageApplication' | 'createContent' | 'editContent' | 'deleteContent'

export interface ApplicationMembershipContext {
    membership: ApplicationMembershipRecord
    applicationId: string
    entityId?: string
    isSynthetic?: boolean
    globalRole?: string | null
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
    // First check if user has global applications permission / superuser bypass
    const isSuper = await isSuperuser(executor, userId)
    const hasGlobalApplicationsAccess = await hasSubjectPermission(executor, userId, 'applications', 'read')

    if (isSuper || hasGlobalApplicationsAccess) {
        // User has global access - create synthetic membership with owner role
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
