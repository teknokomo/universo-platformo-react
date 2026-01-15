import type { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { ApplicationUser } from '../database/entities/ApplicationUser'
import { Connector } from '../database/entities/Connector'

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
    membership: ApplicationUser
    applicationId: string
    entityId?: string
    isSynthetic?: boolean
    globalRole?: string | null
}

const getManager = (ds: DataSource, queryRunner?: QueryRunner) => {
    if (queryRunner && !queryRunner.isReleased) {
        return queryRunner.manager
    }
    return ds.manager
}

// Create base guards using generic factory from auth-backend
const baseGuards = createAccessGuards<ApplicationRole, ApplicationUser>({
    entityName: 'application',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, applicationId: string, queryRunner?: QueryRunner) => {
        const repo = getManager(ds, queryRunner).getRepository(ApplicationUser)
        return repo.findOne({ where: { application_id: applicationId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as ApplicationRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.application_id,
    isSuperuser: isSuperuserByDataSource,
    getGlobalRoleName: getGlobalRoleCodenameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            application_id: entityId,
            role: 'owner',
            created_at: new Date()
        } as ApplicationUser)
})

// Re-export base guards
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getApplicationMembership(ds: DataSource, userId: string, applicationId: string): Promise<ApplicationUser | null> {
    return getMembershipSafe(ds, userId, applicationId)
}

export async function ensureApplicationAccess(
    ds: DataSource,
    userId: string,
    applicationId: string,
    requiredRoles?: ApplicationRole[],
    queryRunner?: QueryRunner
): Promise<ApplicationMembershipContext> {
    // First check if user has global applications permission / superuser bypass
    const isSuper = await isSuperuserByDataSource(ds, userId, queryRunner)
    const hasGlobalApplicationsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'applications', 'read', queryRunner)

    if (isSuper || hasGlobalApplicationsAccess) {
        // User has global access - create synthetic membership with owner role
        const globalRoleName = await getGlobalRoleCodenameByDataSource(ds, userId, queryRunner)
        const syntheticMembership: ApplicationUser = {
            user_id: userId,
            application_id: applicationId,
            role: 'owner',
            created_at: new Date()
        } as ApplicationUser

        return {
            membership: syntheticMembership,
            entityId: applicationId,
            applicationId,
            isSynthetic: true,
            globalRole: globalRoleName
        }
    }

    // Otherwise do membership check using request manager (RLS-enabled if available)
    const manager = getManager(ds, queryRunner)
    const membership = await manager.getRepository(ApplicationUser).findOne({ where: { application_id: applicationId, user_id: userId } })
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
export function assertNotOwner(membership: ApplicationUser, message = 'Cannot modify owner'): void {
    if (membership.role === 'owner') {
        throw createError(403, message)
    }
}

// ============ CONNECTOR ACCESS GUARDS ============

export interface ConnectorAccessContext extends ApplicationMembershipContext {
    connector: Connector
}

/**
 * Ensure user has access to a Connector through its parent Application
 */
export async function ensureConnectorAccess(
    ds: DataSource,
    userId: string,
    connectorId: string,
    requiredRoles?: ApplicationRole[],
    queryRunner?: QueryRunner
): Promise<ConnectorAccessContext> {
    const connectorRepo = getManager(ds, queryRunner).getRepository(Connector)
    const connector = await connectorRepo.findOne({ where: { id: connectorId } })

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
    const context = await ensureApplicationAccess(ds, userId, connector.applicationId, requiredRoles, queryRunner)

    return { ...context, connector }
}

// Suppress unused variable warning
void createError
void ensureAccess
