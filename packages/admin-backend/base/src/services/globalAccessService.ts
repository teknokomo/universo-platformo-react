import { In } from 'typeorm'
import type { DataSource, QueryRunner } from 'typeorm'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import type { RoleMetadata, GlobalRoleInfo, GlobalUserMember, VersionedLocalizedContent } from '@universo/types'
import { isAdminPanelEnabled, isGlobalRolesEnabled, isSuperuserEnabled } from '@universo/utils'
import { Role } from '../database/entities/Role'
import { UserRole } from '../database/entities/UserRole'

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
    created_at: Date
    updated_at: Date
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
    created_at: Date
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
    getDataSource: () => DataSource
}

/**
 * Converts Role entity or raw row to RoleMetadata
 */
function toRoleMetadata(role: Role | RoleRow): RoleMetadata {
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
 * Replaces globalUserService with new RBAC-based approach
 *
 * Uses hybrid approach:
 * - TypeORM Repository for simple CRUD (roles queries)
 * - Raw SQL for RLS functions and complex queries (consistency with PostgreSQL policies)
 */
export function createGlobalAccessService({ getDataSource }: GlobalAccessServiceDeps) {
    const runQuery = async <T = unknown>(
        sql: string,
        params: unknown[],
        queryRunner?: QueryRunner
    ): Promise<T[]> => {
        if (queryRunner && !queryRunner.isReleased) {
            return (await queryRunner.query(sql, params)) as T[]
        }

        return (await getDataSource().query(sql, params)) as T[]
    }

    /**
     * Get all roles with metadata (TypeORM Repository)
     */
    async function getAllRoles(): Promise<RoleMetadata[]> {
        const ds = getDataSource()
        const roleRepo = ds.getRepository(Role)

        const roles = await roleRepo.find({
            order: {
                is_system: 'DESC',
                codename: 'ASC'
            }
        })

        return roles.map(toRoleMetadata)
    }

    /**
     * Get role by codename (TypeORM Repository)
     */
    async function getRoleByCodename(codename: string): Promise<RoleMetadata | null> {
        const ds = getDataSource()
        const roleRepo = ds.getRepository(Role)

        const role = await roleRepo.findOne({ where: { codename } })
        return role ? toRoleMetadata(role) : null
    }

    /**
     * Check if user is superuser (has is_superuser=true role)
     */
    async function isSuperuser(userId: string, queryRunner?: QueryRunner): Promise<boolean> {
        const result = await runQuery<{ is_super: boolean }>(
            `
            SELECT admin.is_superuser($1::uuid) as is_super
        `,
            [userId],
            queryRunner
        )
        return result[0]?.is_super ?? false
    }

    /**
     * Check if user can access admin panel (has admin-related permissions)
     */
    async function canAccessAdmin(userId: string, queryRunner?: QueryRunner): Promise<boolean> {
        const result = await runQuery<{ can_access: boolean }>(
            `
            SELECT admin.has_admin_permission($1::uuid) as can_access
        `,
            [userId],
            queryRunner
        )
        return result[0]?.can_access ?? false
    }

    /**
     * Get user's global access info (roles with metadata)
     */
    async function getGlobalAccessInfo(userId: string, queryRunner?: QueryRunner): Promise<GlobalAccessInfo> {
        // Get all user's roles with metadata
        const rows = await runQuery<{ role_codename: string; name: VersionedLocalizedContent<string>; color: string }>(
            `
            SELECT role_codename, name, color
            FROM admin.get_user_global_roles($1::uuid)
        `,
            [userId],
            queryRunner
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
        const isSuperuserFlag = await isSuperuser(userId, queryRunner)
        const canAccessAdminFlag = await canAccessAdmin(userId, queryRunner)

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
    async function getGlobalRoleCodename(userId: string, queryRunner?: QueryRunner): Promise<string | null> {
        const info = await getGlobalAccessInfo(userId, queryRunner)
        return info.globalRoles[0]?.codename ?? null
    }

    /**
     * List all users with admin access roles
     */
    async function listGlobalUsers(params?: ListGlobalUsersParams): Promise<{
        users: GlobalUserMember[]
        total: number
    }> {
        const ds = getDataSource()
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
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id AND LOWER(p.nickname) LIKE $${paramIndex})
            )`)
            queryParams.push(`%${search.toLowerCase()}%`)
            paramIndex++
        }

        // Build WHERE clause (handle empty conditions)
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

        // Build ORDER BY
        const sortExpressions: Record<string, string> = {
            created: 'ur.created_at',
            role: 'r.codename',
            email: '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)'
        }
        const orderBy = sortExpressions[sortBy] || 'ur.created_at'
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC'

        // Get total count
        const countResult = (await ds.query(
            `
            SELECT COUNT(*) as count
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ${whereClause}
        `,
            queryParams
        )) as { count: string }[]
        const total = parseInt(countResult[0]?.count ?? '0', 10)

        if (total === 0) {
            return { users: [], total: 0 }
        }

        // Get paginated results
        const rows = (await ds.query(
            `
            SELECT 
                ur.id,
                ur.user_id,
                ur.role_id,
                ur.granted_by,
                ur.comment,
                ur.created_at,
                r.codename as role_codename,
                r.name,
                r.color,
                r.is_superuser
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ${whereClause}
            ORDER BY ${orderBy} ${direction}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
            [...queryParams, limit, offset]
        )) as (UserRoleRow & RoleRow)[]

        if (rows.length === 0) {
            return { users: [], total }
        }

        // Load user emails and nicknames
        const userIds = rows.map((r) => r.user_id)

        const authUsers = await ds.manager.find(AuthUser, {
            where: { id: In(userIds) }
        })

        const profiles = await ds.manager.find(Profile, {
            where: { user_id: In(userIds) }
        })

        const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? null]))
        const nicknameMap = new Map(profiles.map((p) => [p.user_id, p.nickname ?? null]))

        const users: GlobalUserMember[] = rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            email: emailMap.get(row.user_id) ?? null,
            nickname: nicknameMap.get(row.user_id) ?? null,
            roleCodename: (row as unknown as { role_codename: string }).role_codename,
            roleMetadata: {
                codename: (row as unknown as { role_codename: string }).role_codename,
                name: (row.name || {}) as VersionedLocalizedContent<string>,
                color: row.color || '#9e9e9e',
                isSuperuser: row.is_superuser
            },
            comment: row.comment ?? null,
            grantedBy: row.granted_by ?? null,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
        }))

        return { users, total }
    }

    /**
     * Find user by email
     */
    async function findUserIdByEmail(email: string): Promise<string | null> {
        const ds = getDataSource()
        const result = await ds.manager.createQueryBuilder(AuthUser, 'user').where('LOWER(user.email) = LOWER(:email)', { email }).getOne()
        return result?.id ?? null
    }

    /**
     * Grant a global role to a user
     */
    async function grantRole(userId: string, roleCodename: string, grantedBy: string, comment?: string): Promise<GlobalUserMember> {
        const ds = getDataSource()

        // Get role ID (any role, not filtered by can_access_admin)
        const roleResult = (await ds.query(
            `
            SELECT id, name, color, is_superuser
            FROM admin.roles
            WHERE codename = $1
        `,
            [roleCodename]
        )) as { id: string; name: VersionedLocalizedContent<string>; color: string; is_superuser: boolean }[]

        if (roleResult.length === 0) {
            throw new Error(`Role '${roleCodename}' not found`)
        }

        const roleId = roleResult[0].id

        // Check if user already has this role
        const existing = (await ds.query(
            `
            SELECT id FROM admin.user_roles
            WHERE user_id = $1 AND role_id = $2
        `,
            [userId, roleId]
        )) as UserRoleRow[]

        let assignmentId: string

        if (existing.length > 0) {
            // Update existing assignment
            await ds.query(
                `
                UPDATE admin.user_roles
                SET granted_by = $1, comment = $2
                WHERE user_id = $3 AND role_id = $4
            `,
                [grantedBy, comment ?? null, userId, roleId]
            )
            assignmentId = existing[0].id
        } else {
            // Insert new assignment (allowing multiple roles per user)
            const insertResult = (await ds.query(
                `
                INSERT INTO admin.user_roles (user_id, role_id, granted_by, comment)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `,
                [userId, roleId, grantedBy, comment ?? null]
            )) as { id: string }[]
            assignmentId = insertResult[0].id
        }

        // Get user info
        const authUser = await ds.manager.findOne(AuthUser, { where: { id: userId } })
        const profile = await ds.manager.findOne(Profile, { where: { user_id: userId } })

        return {
            id: assignmentId,
            userId,
            email: authUser?.email ?? null,
            nickname: profile?.nickname ?? null,
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
        const ds = getDataSource()

        // Get current assignment
        const current = (await ds.query(
            `
            SELECT ur.*, r.codename as role_codename
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ur.id = $1
        `,
            [assignmentId]
        )) as (UserRoleRow & { role_codename: string })[]

        if (current.length === 0) {
            return null
        }

        const assignment = current[0]

        if (updates.roleCodename && updates.roleCodename !== assignment.role_codename) {
            // Get new role ID (allow any role)
            const newRole = (await ds.query(
                `
                SELECT id FROM admin.roles
                WHERE codename = $1
            `,
                [updates.roleCodename]
            )) as { id: string }[]

            if (newRole.length === 0) {
                throw new Error(`Role '${updates.roleCodename}' not found`)
            }

            await ds.query(
                `
                UPDATE admin.user_roles
                SET role_id = $1, comment = $2
                WHERE id = $3
            `,
                [newRole[0].id, updates.comment ?? assignment.comment, assignmentId]
            )
        } else if (updates.comment !== undefined) {
            await ds.query(
                `
                UPDATE admin.user_roles
                SET comment = $1
                WHERE id = $2
            `,
                [updates.comment, assignmentId]
            )
        }

        // Get updated assignment with full info
        const result = (await ds.query(
            `
            SELECT 
                ur.*,
                r.codename as role_codename,
                r.name,
                r.color,
                r.is_superuser
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ur.id = $1
        `,
            [assignmentId]
        )) as (UserRoleRow & RoleRow)[]

        if (result.length === 0) {
            return null
        }

        const row = result[0]
        const authUser = await ds.manager.findOne(AuthUser, { where: { id: row.user_id } })
        const profile = await ds.manager.findOne(Profile, { where: { user_id: row.user_id } })

        return {
            id: row.id,
            userId: row.user_id,
            email: authUser?.email ?? null,
            nickname: profile?.nickname ?? null,
            roleCodename: (row as unknown as { role_codename: string }).role_codename,
            roleMetadata: {
                codename: (row as unknown as { role_codename: string }).role_codename,
                name: (row.name || {}) as VersionedLocalizedContent<string>,
                color: row.color || '#9e9e9e',
                isSuperuser: row.is_superuser
            },
            comment: row.comment ?? null,
            grantedBy: row.granted_by ?? null,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
        }
    }

    /**
     * Revoke global access from a user (remove all global roles)
     */
    async function revokeGlobalAccess(userId: string): Promise<boolean> {
        const ds = getDataSource()
        const result = await ds.query(
            `
            DELETE FROM admin.user_roles
            WHERE user_id = $1
        `,
            [userId]
        )
        return (result as unknown as { rowCount: number }).rowCount > 0
    }

    /**
     * Revoke specific role assignment (TypeORM Repository)
     */
    async function revokeAssignment(assignmentId: string): Promise<boolean> {
        const ds = getDataSource()
        const userRoleRepo = ds.getRepository(UserRole)

        const result = await userRoleRepo.delete({ id: assignmentId })
        return (result.affected ?? 0) > 0
    }

    /**
     * Get statistics for admin dashboard
     */
    async function getStats(): Promise<{
        totalGlobalUsers: number
        byRole: Record<string, number>
    }> {
        const ds = getDataSource()

        const stats = (await ds.query(`
            SELECT r.name as role_name, COUNT(ur.id)::text as count
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            GROUP BY r.name
        `)) as { role_name: string; count: string }[]

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

/**
 * Standalone function to check if user is superuser by DataSource
 * Used by access guards in other modules for superuser bypass
 * Returns false if SUPERUSER_ENABLED=false
 */
export async function isSuperuserByDataSource(ds: DataSource, userId: string): Promise<boolean> {
    // If superuser privileges are disabled, no one has RLS bypass
    if (!isSuperuserEnabled()) {
        return false
    }

    const result = (await ds.query(
        `
        SELECT admin.is_superuser($1::uuid) as is_super
    `,
        [userId]
    )) as { is_super: boolean }[]
    return result[0]?.is_super ?? false
}

/**
 * Standalone function to check if user can access admin panel by DataSource
 * Used by access guards and middleware
 * Returns false if ADMIN_PANEL_ENABLED=false or (GLOBAL_ROLES_ENABLED=false AND SUPERUSER_ENABLED=false)
 */
export async function canAccessAdminByDataSource(ds: DataSource, userId: string): Promise<boolean> {
    // If admin panel is disabled, no admin panel access
    if (!isAdminPanelEnabled()) {
        return false
    }

    // If global roles are disabled, only superuser can access (if enabled)
    if (!isGlobalRolesEnabled()) {
        if (!isSuperuserEnabled()) {
            return false
        }
        // Check if user is superuser
        const superResult = (await ds.query(`SELECT admin.is_superuser($1::uuid) as is_super`, [userId])) as { is_super: boolean }[]
        return superResult[0]?.is_super ?? false
    }

    const result = (await ds.query(
        `
        SELECT admin.has_admin_permission($1::uuid) as can_access
    `,
        [userId]
    )) as { can_access: boolean }[]
    return result[0]?.can_access ?? false
}

/**
 * Standalone function to get global role codename (for backward compatibility)
 * Used by access guards for synthetic membership creation
 */
export async function getGlobalRoleCodenameByDataSource(ds: DataSource, userId: string): Promise<string | null> {
    const result = (await ds.query(
        `
        SELECT r.codename as role_codename
        FROM admin.user_roles ur
        JOIN admin.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
        LIMIT 1
    `,
        [userId]
    )) as { role_codename: string }[]
    return result[0]?.role_codename ?? null
}

/**
 * Standalone function to check if user has permission for a specific subject
 * Used by module routes to check global access (e.g., metaverses, clusters)
 * Returns false if GLOBAL_ROLES_ENABLED=false
 *
 * @param ds DataSource instance
 * @param userId User UUID
 * @param subject Subject to check (e.g., 'metaverses', 'clusters')
 * @param action Action to check (default: 'read')
 * @returns true if user has permission, false otherwise
 */
export async function hasSubjectPermissionByDataSource(ds: DataSource, userId: string, subject: string, action = 'read'): Promise<boolean> {
    // If global roles are disabled, no one has subject-based global access
    if (!isGlobalRolesEnabled()) {
        return false
    }

    const result = (await ds.query(
        `
        SELECT admin.has_permission($1::uuid, $2::varchar, $3::varchar) as has_perm
    `,
        [userId, subject, action]
    )) as { has_perm: boolean }[]
    return result[0]?.has_perm ?? false
}
