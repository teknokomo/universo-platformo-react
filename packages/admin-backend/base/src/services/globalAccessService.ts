import type { RoleMetadata, GlobalRoleInfo, GlobalUserMember, VersionedLocalizedContent } from '@universo/types'
import {
    isGlobalRolesEnabled,
    isSuperuserEnabled,
    type DbSession,
    type DbExecutor,
    activeAppRowCondition,
    softDeleteSetClause
} from '@universo/utils'

/**
 * Raw role row from database
 */
interface RoleRow {
    id: string
    codename: string
    description: VersionedLocalizedContent<string> | null
    name: VersionedLocalizedContent<string> | null
    color: string
    is_superuser: boolean
    is_system: boolean
    _upl_created_at: Date
    _upl_updated_at: Date
}

/**
 * Raw user_role row from database
 */
interface UserRoleRow {
    id: string
    user_id: string
    role_id: string
    granted_by: string | null
    comment: string | null
    _upl_created_at: Date
}

/**
 * Pagination and filtering parameters for users list
 */
export interface ListGlobalUsersParams {
    limit?: number
    offset?: number
    sortBy?: 'created' | 'email' | 'role'
    sortOrder?: 'asc' | 'desc'
    search?: string
    /** @deprecated Use roleId instead */
    roleCodename?: string
    /** Filter by specific role ID */
    roleId?: string
    /** Filter by global access status: 'true' = only global, 'false' = only non-global, 'all' = no filter */
    hasGlobalAccess?: 'true' | 'false' | 'all'
}

/**
 * Global access check result
 */
export interface GlobalAccessInfo {
    isSuperuser: boolean
    canAccessAdmin: boolean
    globalRoles: GlobalRoleInfo[]
}

export interface GlobalAccessServiceDeps {
    getDbExecutor: () => DbExecutor
}

/**
 * Converts raw role row to RoleMetadata
 */
function toRoleMetadata(role: RoleRow): RoleMetadata {
    // Ensure we have a valid VLC structure, even if null/empty from DB
    const name: VersionedLocalizedContent<string> =
        role.name && typeof role.name === 'object' && '_schema' in role.name
            ? role.name
            : {
                  _schema: '1',
                  _primary: 'en',
                  locales: {
                      en: {
                          content: role.codename,
                          version: 1,
                          isActive: true,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                      }
                  }
              }

    return {
        codename: role.codename,
        name,
        color: role.color || '#9e9e9e',
        isSuperuser: role.is_superuser
    }
}

/**
 * Factory for Global Access service
 * Uses SQL-first approach with DbExecutor for all database operations
 */
export function createGlobalAccessService({ getDbExecutor }: GlobalAccessServiceDeps) {
    const runQuery = async <T = unknown>(sql: string, params: unknown[], dbSession?: DbSession): Promise<T[]> => {
        if (dbSession && !dbSession.isReleased()) {
            return dbSession.query<T>(sql, params)
        }

        return getDbExecutor().query<T>(sql, params)
    }

    /**
     * Get all roles with metadata (SQL)
     */
    async function getAllRoles(): Promise<RoleMetadata[]> {
        const rows = await getDbExecutor().query<RoleRow>(
            `SELECT id, codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at
             FROM admin.cat_roles
             WHERE ${activeAppRowCondition()}
             ORDER BY is_system DESC, codename ASC`
        )

        return rows.map(toRoleMetadata)
    }

    /**
     * Get role by codename (SQL)
     */
    async function getRoleByCodename(codename: string): Promise<RoleMetadata | null> {
        const rows = await getDbExecutor().query<RoleRow>(
            `SELECT id, codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at
             FROM admin.cat_roles WHERE codename = $1 AND ${activeAppRowCondition()}`,
            [codename]
        )

        return rows.length > 0 ? toRoleMetadata(rows[0]) : null
    }

    /**
     * Check if user is superuser (has is_superuser=true role)
     */
    async function isSuperuser(userId: string, dbSession?: DbSession): Promise<boolean> {
        const result = await runQuery<{ is_super: boolean }>(
            `
            SELECT admin.is_superuser($1::uuid) as is_super
        `,
            [userId],
            dbSession
        )
        return result[0]?.is_super ?? false
    }

    /**
     * Check if user can access admin panel (has admin-related permissions)
     */
    async function canAccessAdmin(userId: string, dbSession?: DbSession): Promise<boolean> {
        const result = await runQuery<{ can_access: boolean }>(
            `
            SELECT admin.has_admin_permission($1::uuid) as can_access
        `,
            [userId],
            dbSession
        )
        return result[0]?.can_access ?? false
    }

    /**
     * Get user's global access info (roles with metadata)
     */
    async function getGlobalAccessInfo(userId: string, dbSession?: DbSession): Promise<GlobalAccessInfo> {
        // Get all user's roles with metadata
        const rows = await runQuery<{ role_codename: string; name: VersionedLocalizedContent<string>; color: string }>(
            `
            SELECT role_codename, name, color
            FROM admin.get_user_global_roles($1::uuid)
        `,
            [userId],
            dbSession
        )

        const globalRoles: GlobalRoleInfo[] = rows.map((row) => ({
            codename: row.role_codename,
            metadata: {
                codename: row.role_codename,
                name: row.name || ({} as VersionedLocalizedContent<string>),
                color: row.color || '#9e9e9e',
                isSuperuser: false // Will be set below
            }
        }))

        // Check if user is superuser
        const isSuperuserFlag = await isSuperuser(userId, dbSession)
        const canAccessAdminFlag = await canAccessAdmin(userId, dbSession)

        // Mark superuser role
        if (isSuperuserFlag) {
            const superuserRole = globalRoles.find((r) => r.codename === 'superuser')
            if (superuserRole) {
                superuserRole.metadata.isSuperuser = true
            }
        }

        return {
            isSuperuser: isSuperuserFlag,
            canAccessAdmin: canAccessAdminFlag,
            globalRoles
        }
    }

    /**
     * Get user's primary global role codename (for backward compatibility)
     * Returns the first global role or null
     */
    async function getGlobalRoleCodename(userId: string, dbSession?: DbSession): Promise<string | null> {
        const info = await getGlobalAccessInfo(userId, dbSession)
        return info.globalRoles[0]?.codename ?? null
    }

    /**
     * List all users with admin access roles
     */
    async function listGlobalUsers(params?: ListGlobalUsersParams): Promise<{
        users: GlobalUserMember[]
        total: number
    }> {
        const exec = getDbExecutor()
        const {
            limit = 20,
            offset = 0,
            sortBy = 'created',
            sortOrder = 'desc',
            search,
            roleCodename,
            roleId
            // Note: hasGlobalAccess filter removed since we no longer have can_access_admin column
            // All users with roles are returned; frontend can filter by computed hasAdminAccess
        } = params || {}

        // Build dynamic WHERE conditions
        const conditions: string[] = []
        const queryParams: unknown[] = []
        let paramIndex = 1

        // Filter by specific role ID
        if (roleId) {
            conditions.push(`r.id = $${paramIndex}`)
            queryParams.push(roleId)
            paramIndex++
        } else if (roleCodename) {
            // Legacy support for roleCodename
            conditions.push(`r.codename = $${paramIndex}`)
            queryParams.push(roleCodename)
            paramIndex++
        }

        if (search) {
            conditions.push(`(
                EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id AND LOWER(u.email) LIKE $${paramIndex})
                OR EXISTS (SELECT 1 FROM profiles.cat_profiles p WHERE p.user_id = ur.user_id AND ${activeAppRowCondition(
                    'p'
                )} AND LOWER(p.nickname) LIKE $${paramIndex})
            )`)
            queryParams.push(`%${search.toLowerCase()}%`)
            paramIndex++
        }

        // Build WHERE clause (handle empty conditions)
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

        // Build ORDER BY
        const sortExpressions: Record<string, string> = {
            created: 'ur._upl_created_at',
            role: 'r.codename',
            email: '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)'
        }
        const orderBy = sortExpressions[sortBy] || 'ur._upl_created_at'
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC'

        // Get total count
        const countResult = await exec.query<{ count: string }>(
            `
            SELECT COUNT(*) as count
            FROM admin.rel_user_roles ur
            JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
            WHERE ${whereClause}
        `,
            queryParams
        )
        const total = parseInt(countResult[0]?.count ?? '0', 10)

        if (total === 0) {
            return { users: [], total: 0 }
        }

        // Get paginated results
        const rows = await exec.query<UserRoleRow & RoleRow & { role_codename: string }>(
            `
            SELECT 
                ur.id,
                ur.user_id,
                ur.role_id,
                ur.granted_by,
                ur.comment,
                ur._upl_created_at,
                r.codename as role_codename,
                r.name,
                r.color,
                r.is_superuser
            FROM admin.rel_user_roles ur
            JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
            WHERE ${whereClause}
            ORDER BY ${orderBy} ${direction}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
            [...queryParams, limit, offset]
        )

        if (rows.length === 0) {
            return { users: [], total }
        }

        // Load user emails and nicknames
        const userIds = rows.map((r) => r.user_id)

        const authUsers = await exec.query<{ id: string; email: string | null }>(
            `SELECT id, email FROM auth.users WHERE id = ANY($1::uuid[])`,
            [userIds]
        )

        const profiles = await exec.query<{ user_id: string; nickname: string | null }>(
            `SELECT user_id, nickname FROM profiles.cat_profiles WHERE user_id = ANY($1::uuid[]) AND ${activeAppRowCondition()}`,
            [userIds]
        )

        const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? null]))
        const nicknameMap = new Map(profiles.map((p) => [p.user_id, p.nickname ?? null]))

        const users: GlobalUserMember[] = rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            email: emailMap.get(row.user_id) ?? null,
            nickname: nicknameMap.get(row.user_id) ?? null,
            roleCodename: row.role_codename,
            roleMetadata: {
                codename: row.role_codename,
                name: (row.name || {}) as VersionedLocalizedContent<string>,
                color: row.color || '#9e9e9e',
                isSuperuser: row.is_superuser
            },
            comment: row.comment ?? null,
            grantedBy: row.granted_by ?? null,
            createdAt: row._upl_created_at instanceof Date ? row._upl_created_at.toISOString() : String(row._upl_created_at)
        }))

        return { users, total }
    }

    /**
     * Find user by email
     */
    async function findUserIdByEmail(email: string): Promise<string | null> {
        const rows = await getDbExecutor().query<{ id: string }>(`SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
            email
        ])
        return rows[0]?.id ?? null
    }

    /**
     * Grant a global role to a user
     */
    async function grantRole(userId: string, roleCodename: string, grantedBy: string, comment?: string): Promise<GlobalUserMember> {
        const exec = getDbExecutor()

        // Get role ID (any role, not filtered by can_access_admin)
        const roleResult = await exec.query<{ id: string; name: VersionedLocalizedContent<string>; color: string; is_superuser: boolean }>(
            `
            SELECT id, name, color, is_superuser
            FROM admin.cat_roles
            WHERE codename = $1 AND ${activeAppRowCondition()}
        `,
            [roleCodename]
        )

        if (roleResult.length === 0) {
            throw new Error(`Role '${roleCodename}' not found`)
        }

        const roleId = roleResult[0].id

        // Check if user already has this role
        const existing = await exec.query<UserRoleRow>(
            `
            SELECT id FROM admin.rel_user_roles
            WHERE user_id = $1 AND role_id = $2 AND ${activeAppRowCondition()}
        `,
            [userId, roleId]
        )

        let assignmentId: string

        if (existing.length > 0) {
            // Update existing assignment
            await exec.query(
                `
                UPDATE admin.rel_user_roles
                SET granted_by = $1, comment = $2
                WHERE user_id = $3 AND role_id = $4 AND ${activeAppRowCondition()}
            `,
                [grantedBy, comment ?? null, userId, roleId]
            )
            assignmentId = existing[0].id
        } else {
            // Insert new assignment (allowing multiple roles per user)
            const insertResult = await exec.query<{ id: string }>(
                `
                INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `,
                [userId, roleId, grantedBy, comment ?? null]
            )
            assignmentId = insertResult[0].id
        }

        // Get user info
        const authUsers = await exec.query<{ id: string; email: string | null }>(`SELECT id, email FROM auth.users WHERE id = $1`, [userId])
        const profileRows = await exec.query<{ user_id: string; nickname: string | null }>(
            `SELECT user_id, nickname FROM profiles.cat_profiles WHERE user_id = $1 AND ${activeAppRowCondition()}`,
            [userId]
        )

        return {
            id: assignmentId,
            userId,
            email: authUsers[0]?.email ?? null,
            nickname: profileRows[0]?.nickname ?? null,
            roleCodename,
            roleMetadata: {
                codename: roleCodename,
                name: (roleResult[0].name || {}) as VersionedLocalizedContent<string>,
                color: roleResult[0].color || '#9e9e9e',
                isSuperuser: roleResult[0].is_superuser || false
            },
            comment: comment ?? null,
            grantedBy,
            createdAt: new Date().toISOString()
        }
    }

    /**
     * Update a global role assignment (change role or comment)
     */
    async function updateAssignment(
        assignmentId: string,
        updates: { roleCodename?: string; comment?: string }
    ): Promise<GlobalUserMember | null> {
        const exec = getDbExecutor()

        // Get current assignment
        const current = await exec.query<UserRoleRow & { role_codename: string }>(
            `
            SELECT ur.*, r.codename as role_codename
            FROM admin.rel_user_roles ur
            JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
            WHERE ur.id = $1 AND ${activeAppRowCondition('ur')}
        `,
            [assignmentId]
        )

        if (current.length === 0) {
            return null
        }

        const assignment = current[0]

        if (updates.roleCodename && updates.roleCodename !== assignment.role_codename) {
            // Get new role ID (allow any role)
            const newRole = await exec.query<{ id: string }>(
                `
                SELECT id FROM admin.cat_roles
                WHERE codename = $1 AND ${activeAppRowCondition()}
            `,
                [updates.roleCodename]
            )

            if (newRole.length === 0) {
                throw new Error(`Role '${updates.roleCodename}' not found`)
            }

            await exec.query(
                `
                UPDATE admin.rel_user_roles
                SET role_id = $1, comment = $2
                WHERE id = $3 AND ${activeAppRowCondition()}
            `,
                [newRole[0].id, updates.comment ?? assignment.comment, assignmentId]
            )
        } else if (updates.comment !== undefined) {
            await exec.query(
                `
                UPDATE admin.rel_user_roles
                SET comment = $1
                WHERE id = $2 AND ${activeAppRowCondition()}
            `,
                [updates.comment, assignmentId]
            )
        }

        // Get updated assignment with full info
        const result = await exec.query<UserRoleRow & RoleRow & { role_codename: string }>(
            `
            SELECT 
                ur.*,
                r.codename as role_codename,
                r.name,
                r.color,
                r.is_superuser
            FROM admin.rel_user_roles ur
            JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
            WHERE ur.id = $1
        `,
            [assignmentId]
        )

        if (result.length === 0) {
            return null
        }

        const row = result[0]
        const authUsers = await exec.query<{ id: string; email: string | null }>(`SELECT id, email FROM auth.users WHERE id = $1`, [
            row.user_id
        ])
        const profileRows = await exec.query<{ user_id: string; nickname: string | null }>(
            `SELECT user_id, nickname FROM profiles.cat_profiles WHERE user_id = $1 AND ${activeAppRowCondition()}`,
            [row.user_id]
        )

        return {
            id: row.id,
            userId: row.user_id,
            email: authUsers[0]?.email ?? null,
            nickname: profileRows[0]?.nickname ?? null,
            roleCodename: row.role_codename,
            roleMetadata: {
                codename: row.role_codename,
                name: (row.name || {}) as VersionedLocalizedContent<string>,
                color: row.color || '#9e9e9e',
                isSuperuser: row.is_superuser
            },
            comment: row.comment ?? null,
            grantedBy: row.granted_by ?? null,
            createdAt: row._upl_created_at instanceof Date ? row._upl_created_at.toISOString() : String(row._upl_created_at)
        }
    }

    /**
     * Revoke global access from a user (remove all global roles)
     */
    async function revokeGlobalAccess(userId: string): Promise<boolean> {
        const result = await getDbExecutor().query<{ id: string }>(
            `
            UPDATE admin.rel_user_roles
            SET ${softDeleteSetClause('$2')}
            WHERE user_id = $1
              AND ${activeAppRowCondition()}
            RETURNING id
        `,
            [userId, null]
        )
        return result.length > 0
    }

    /**
     * Revoke specific role assignment (SQL)
     */
    async function revokeAssignment(assignmentId: string): Promise<boolean> {
        const result = await getDbExecutor().query<{ id: string }>(
            `UPDATE admin.rel_user_roles
             SET ${softDeleteSetClause('$2')}
             WHERE id = $1
               AND ${activeAppRowCondition()}
             RETURNING id`,
            [assignmentId, null]
        )
        return result.length > 0
    }

    /**
     * Get statistics for admin dashboard
     */
    async function getStats(): Promise<{
        totalGlobalUsers: number
        byRole: Record<string, number>
    }> {
        const stats = await getDbExecutor().query<{ role_name: string; count: string }>(`
            SELECT r.name as role_name, COUNT(ur.id)::text as count
            FROM admin.rel_user_roles ur
            JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
            GROUP BY r.name
        `)

        const byRole: Record<string, number> = {}
        let totalGlobalUsers = 0

        for (const row of stats) {
            const count = parseInt(row.count, 10)
            byRole[row.role_name] = count
            totalGlobalUsers += count
        }

        return { totalGlobalUsers, byRole }
    }

    return {
        // Role queries
        getAllRoles,
        getRoleByCodename,

        // User access checks
        isSuperuser,
        canAccessAdmin,
        getGlobalAccessInfo,
        getGlobalRoleCodename,

        // User management
        listGlobalUsers,
        findUserIdByEmail,
        grantRole,
        updateAssignment,
        revokeGlobalAccess,
        revokeAssignment,

        // Stats
        getStats
    }
}

export type GlobalAccessService = ReturnType<typeof createGlobalAccessService>

/** Minimal interface for SQL query execution — satisfied by DbSession, DbExecutor, and DataSource */
interface SqlQueryable {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
}

// ── Neutral versions (accept any SqlQueryable) ──

/**
 * Check if user is superuser using a neutral queryable.
 * Accepts DbSession, DbExecutor, or any object with `.query()`.
 */
export async function isSuperuser(queryable: SqlQueryable, userId: string): Promise<boolean> {
    if (!isSuperuserEnabled()) return false
    const result = await queryable.query<{ is_super: boolean }>(`SELECT admin.is_superuser($1::uuid) as is_super`, [userId])
    return result[0]?.is_super ?? false
}

/**
 * Get global role codename using a neutral queryable.
 */
export async function getGlobalRoleCodename(queryable: SqlQueryable, userId: string): Promise<string | null> {
    const result = await queryable.query<{ role_codename: string }>(
        `SELECT r.codename as role_codename
         FROM admin.rel_user_roles ur
         JOIN admin.cat_roles r ON ur.role_id = r.id AND r._upl_deleted = false AND r._app_deleted = false
         WHERE ur.user_id = $1 AND ur._upl_deleted = false AND ur._app_deleted = false
         LIMIT 1`,
        [userId]
    )
    return result[0]?.role_codename ?? null
}

/**
 * Check if user has permission for a specific subject using a neutral queryable.
 * Returns false if GLOBAL_ROLES_ENABLED=false.
 */
export async function hasSubjectPermission(queryable: SqlQueryable, userId: string, subject: string, action = 'read'): Promise<boolean> {
    if (!isGlobalRolesEnabled()) return false
    const result = await queryable.query<{ has_perm: boolean }>(
        `SELECT admin.has_permission($1::uuid, $2::varchar, $3::varchar) as has_perm`,
        [userId, subject, action]
    )
    return result[0]?.has_perm ?? false
}
