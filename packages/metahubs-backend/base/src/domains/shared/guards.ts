import * as httpErrors from 'http-errors'
import { MetahubRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuser, getGlobalRoleCodename } from '@universo/admin-backend'
import type { DbSession, DbExecutor } from '@universo/utils'
import type { SqlQueryable, MetahubUserRow } from '../../persistence/types'
import { activeMetahubRowCondition } from '../../persistence/metahubsQueryHelpers'
import { createLogger } from '../../utils/logger'

const log = createLogger('SECURITY')

// Handle both ESM and CJS imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createError = (httpErrors as any).default || httpErrors

// Re-export MetahubRole for convenience
export type { MetahubRole }

export const ROLE_PERMISSIONS: Record<MetahubRole, Record<string, boolean>> = {
    owner: {
        manageMembers: true,
        manageMetahub: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageMetahub: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageMetahub: false,
        createContent: true,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageMetahub: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
}

export type RolePermission = 'manageMembers' | 'manageMetahub' | 'createContent' | 'editContent' | 'deleteContent'

export interface MetahubMembershipContext {
    membership: MetahubUserRow
    metahubId: string
    entityId?: string
    isSynthetic?: boolean
    globalRole?: string | null
}

const MEMBERSHIP_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.metahub_id AS "metahubId",
    ${alias}.user_id AS "userId",
    ${alias}.active_branch_id AS "activeBranchId",
    ${alias}.role,
    ${alias}.comment
`.trim()

const runQuery = async <TRow = unknown>(exec: SqlQueryable, sql: string, params: unknown[], dbSession?: DbSession): Promise<TRow[]> => {
    if (dbSession && !dbSession.isReleased()) {
        return dbSession.query<TRow>(sql, params)
    }

    return exec.query<TRow>(sql, params)
}

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<MetahubRole, MetahubUserRow, SqlQueryable>({
    entityName: 'metahub',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (exec: SqlQueryable, userId: string, metahubId: string, dbSession?: DbSession) => {
        const rows = await runQuery<MetahubUserRow>(
            exec,
            `
                        SELECT ${MEMBERSHIP_SELECT('mu')}
                        FROM metahubs.rel_metahub_users mu
                        JOIN metahubs.cat_metahubs m ON m.id = mu.metahub_id
                        WHERE mu.metahub_id = $1
                            AND mu.user_id = $2
                            AND ${activeMetahubRowCondition('mu')}
                            AND ${activeMetahubRowCondition('m')}
            LIMIT 1
            `,
            [metahubId, userId],
            dbSession
        )

        return rows[0] ?? null
    },
    extractRole: (m: MetahubUserRow) => (m.role || 'member') as MetahubRole,
    extractUserId: (m: MetahubUserRow) => m.userId,
    extractEntityId: (m: MetahubUserRow) => m.metahubId,
    // Global admin bypass - users with global access get owner-level access
    isSuperuser: (exec: SqlQueryable, userId: string, dbSession?: DbSession) => {
        const q = dbSession && !dbSession.isReleased() ? dbSession : exec
        return isSuperuser(q, userId)
    },
    getGlobalRoleName: (exec: SqlQueryable, userId: string, dbSession?: DbSession) => {
        const q = dbSession && !dbSession.isReleased() ? dbSession : exec
        return getGlobalRoleCodename(q, userId)
    },
    createGlobalAdminMembership: (userId: string, entityId: string, _globalRole: string | null) =>
        ({
            userId,
            metahubId: entityId,
            role: 'owner', // Global admins get owner-level access
            _uplCreatedAt: new Date()
        } as MetahubUserRow)
})

// Re-export base guards
const { getMembershipSafe, assertPermission, hasPermission } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getMetahubMembership(exec: SqlQueryable, userId: string, metahubId: string): Promise<MetahubUserRow | null> {
    return getMembershipSafe(exec, userId, metahubId)
}

export async function ensureMetahubAccess(
    exec: SqlQueryable,
    userId: string,
    metahubId: string,
    permission?: RolePermission,
    dbSession?: DbSession
): Promise<MetahubMembershipContext> {
    // Prefer active dbSession (RLS-enabled) for all queries
    const q = dbSession && !dbSession.isReleased() ? dbSession : exec

    // Only superusers may bypass membership checks for direct metahub access.
    const isSuper = await isSuperuser(q, userId)

    if (isSuper) {
        const globalRoleName = await getGlobalRoleCodename(q, userId)
        const syntheticMembership = {
            userId,
            metahubId,
            role: 'owner',
            _uplCreatedAt: new Date()
        } as MetahubUserRow

        return {
            membership: syntheticMembership,
            entityId: metahubId,
            metahubId,
            isSynthetic: true,
            globalRole: globalRoleName
        }
    }

    // Otherwise do membership check using request-scoped queryable (RLS-enabled if available)
    const membership = await getMembershipSafe(exec, userId, metahubId, dbSession)
    if (!membership) {
        log.warn('Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            metahubId,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this metahub')
    }

    if (permission) {
        assertPermission(membership, permission)
    }

    return { membership, entityId: metahubId, metahubId }
}

/**
 * Assert that the target user is not the owner of the metahub
 * Used to prevent owner from being demoted or removed
 */
export function assertNotOwner(membership: MetahubUserRow, operation: 'modify' | 'remove' = 'modify'): void {
    if (membership.role === 'owner') {
        const action = operation === 'modify' ? 'update role of' : 'remove'
        throw createError(403, `Cannot ${action} the owner of this metahub`)
    }
}

// ============ HUB ACCESS GUARDS ============

/**
 * Hub data shape returned from _mhb_objects table with kind='hub'
 */
export interface HubData {
    id: string
    codename: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    sort_order: number
    created_at: Date
    updated_at: Date
}

export interface HubAccessContext extends MetahubMembershipContext {
    hub: HubData
}

/**
 * Ensure user has access to a Hub through its parent Metahub.
 *
 * NOTE: This function requires knowning the metahubId in advance.
 * For routes that receive hubId without metahubId, the route handler
 * should use MetahubHubsService directly after ensureMetahubAccess.
 */
export async function ensureHubAccess(
    exec: DbExecutor,
    userId: string,
    metahubId: string,
    hubId: string,
    permission?: RolePermission,
    dbSession?: DbSession
): Promise<HubAccessContext> {
    // First check metahub access
    const context = await ensureMetahubAccess(exec, userId, metahubId, permission, dbSession)

    // Import dynamically to avoid circular dependencies
    const { MetahubSchemaService } = await import('../metahubs/services/MetahubSchemaService.js')
    const { MetahubHubsService } = await import('../metahubs/services/MetahubHubsService.js')

    const schemaService = new MetahubSchemaService(exec)
    const hubsService = new MetahubHubsService(exec, schemaService)

    const hubData = await hubsService.findById(metahubId, hubId)

    if (!hubData) {
        log.warn('Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            hubId,
            action: permission || 'access',
            reason: 'hub_not_found'
        })
        throw createError(404, 'Hub not found')
    }

    // Map service response to HubData interface
    const hub: HubData = {
        id: hubData.id as string,
        codename: hubData.codename as string,
        name: hubData.name as Record<string, unknown>,
        description: hubData.description as Record<string, unknown> | null,
        sort_order: hubData.sort_order as number,
        created_at: hubData.created_at as Date,
        updated_at: hubData.updated_at as Date
    }

    return { ...context, hub }
}

// REMOVED Catalog / Attribute guards as they depended on removed entities.
// Access control for dynamic schema objects is handled by MetahubObjectsService logic (using ensureMetahubAccess + manual checks if needed)
// Or by route handlers using ensureMetahubAccess and then checking association.

// ============ ROUTE-LEVEL ACCESS HELPERS ============

import type { Request, Response } from 'express'
import { getRequestDbExecutor, getRequestDbSession } from '@universo/utils/database'
import { resolveUserId } from './routeAuth'

/**
 * Create a route-level metahub access helper bound to a specific DB executor factory.
 * Returns userId on success, sends 401 and returns null on unauthenticated request.
 */
export function createEnsureMetahubRouteAccess(getDbExecutor: () => DbExecutor) {
    return async (req: Request, res: Response, metahubId: string, permission?: RolePermission): Promise<string | null> => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        await ensureMetahubAccess(getRequestDbExecutor(req, getDbExecutor()), userId, metahubId, permission, getRequestDbSession(req))
        return userId
    }
}

// Suppress unused variable warning for createError (used in assertNotOwner)
void createError
