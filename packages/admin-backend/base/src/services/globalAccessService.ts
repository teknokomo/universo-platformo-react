import { In } from 'typeorm'
import type { DataSource } from 'typeorm'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import type {
    RoleMetadata,
    GlobalRoleInfo,
    GlobalUserMember,
    LocalizedString
} from '@universo/types'
import { isGlobalAdminEnabled } from '@universo/utils'
import { Role } from '../database/entities/Role'
import { UserRole } from '../database/entities/UserRole'

/**
 * Raw role row from database
 */
interface RoleRow {
    id: string
    name: string
    description: string | null
    display_name: Record<string, string> | null
    color: string
    has_global_access: boolean
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
 * Pagination and filtering parameters
 */
export interface ListGlobalUsersParams {
    limit?: number
    offset?: number
    sortBy?: 'created' | 'email' | 'role'
    sortOrder?: 'asc' | 'desc'
    search?: string
    roleName?: string
}

/**
 * Global access check result
 */
export interface GlobalAccessInfo {
    hasGlobalAccess: boolean
    globalRoles: GlobalRoleInfo[]
}

export interface GlobalAccessServiceDeps {
    getDataSource: () => DataSource
}

/**
 * Converts Role entity or raw row to RoleMetadata
 */
function toRoleMetadata(role: Role | RoleRow): RoleMetadata {
    return {
        name: role.name,
        displayName: (role.display_name || {}) as LocalizedString,
        color: role.color || '#9e9e9e',
        hasGlobalAccess: role.has_global_access
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
    /**
     * Get all roles with metadata (TypeORM Repository)
     */
    async function getAllRoles(): Promise<RoleMetadata[]> {
        const ds = getDataSource()
        const roleRepo = ds.getRepository(Role)

        const roles = await roleRepo.find({
            order: {
                is_system: 'DESC',
                name: 'ASC'
            }
        })

        return roles.map(toRoleMetadata)
    }

    /**
     * Get roles that grant global access (TypeORM Repository)
     */
    async function getGlobalAccessRoles(): Promise<RoleMetadata[]> {
        const ds = getDataSource()
        const roleRepo = ds.getRepository(Role)

        const roles = await roleRepo.find({
            where: { has_global_access: true },
            order: {
                is_system: 'DESC',
                name: 'ASC'
            }
        })

        return roles.map(toRoleMetadata)
    }

    /**
     * Get role by name (TypeORM Repository)
     */
    async function getRoleByName(name: string): Promise<RoleMetadata | null> {
        const ds = getDataSource()
        const roleRepo = ds.getRepository(Role)

        const role = await roleRepo.findOne({ where: { name } })
        return role ? toRoleMetadata(role) : null
    }

    /**
     * Check if user has global access (any role with has_global_access=true)
     */
    async function hasGlobalAccess(userId: string): Promise<boolean> {
        const ds = getDataSource()
        const result = (await ds.query(`
            SELECT admin.has_global_access($1::uuid) as has_access
        `, [userId])) as { has_access: boolean }[]
        return result[0]?.has_access ?? false
    }

    /**
     * Get user's global access info (roles with metadata)
     */
    async function getGlobalAccessInfo(userId: string): Promise<GlobalAccessInfo> {
        const ds = getDataSource()

        // Get user's global roles with metadata
        const rows = (await ds.query(`
            SELECT role_name, display_name, color
            FROM admin.get_user_global_roles($1::uuid)
        `, [userId])) as { role_name: string; display_name: Record<string, string>; color: string }[]

        const globalRoles: GlobalRoleInfo[] = rows.map(row => ({
            name: row.role_name,
            metadata: {
                name: row.role_name,
                displayName: row.display_name || {},
                color: row.color || '#9e9e9e',
                hasGlobalAccess: true
            }
        }))

        return {
            hasGlobalAccess: globalRoles.length > 0,
            globalRoles
        }
    }

    /**
     * Get user's primary global role name (for backward compatibility)
     * Returns the first global role or null
     */
    async function getGlobalRoleName(userId: string): Promise<string | null> {
        const info = await getGlobalAccessInfo(userId)
        return info.globalRoles[0]?.name ?? null
    }

    /**
     * List all users with global access roles
     */
    async function listGlobalUsers(params?: ListGlobalUsersParams): Promise<{
        users: GlobalUserMember[]
        total: number
    }> {
        const ds = getDataSource()
        const { limit = 20, offset = 0, sortBy = 'created', sortOrder = 'desc', search, roleName } = params || {}

        // Build dynamic WHERE conditions
        const conditions: string[] = ['r.has_global_access = true']
        const queryParams: unknown[] = []
        let paramIndex = 1

        if (roleName) {
            conditions.push(`r.name = $${paramIndex}`)
            queryParams.push(roleName)
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

        const whereClause = conditions.join(' AND ')

        // Build ORDER BY
        const sortExpressions: Record<string, string> = {
            created: 'ur.created_at',
            role: 'r.name',
            email: '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)'
        }
        const orderBy = sortExpressions[sortBy] || 'ur.created_at'
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC'

        // Get total count
        const countResult = (await ds.query(`
            SELECT COUNT(*) as count
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ${whereClause}
        `, queryParams)) as { count: string }[]
        const total = parseInt(countResult[0]?.count ?? '0', 10)

        if (total === 0) {
            return { users: [], total: 0 }
        }

        // Get paginated results
        const rows = (await ds.query(`
            SELECT 
                ur.id,
                ur.user_id,
                ur.role_id,
                ur.granted_by,
                ur.comment,
                ur.created_at,
                r.name as role_name,
                r.display_name,
                r.color,
                r.has_global_access
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ${whereClause}
            ORDER BY ${orderBy} ${direction}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, limit, offset])) as (UserRoleRow & RoleRow)[]

        if (rows.length === 0) {
            return { users: [], total }
        }

        // Load user emails and nicknames
        const userIds = rows.map(r => r.user_id)

        const authUsers = await ds.manager.find(AuthUser, {
            where: { id: In(userIds) }
        })

        const profiles = await ds.manager.find(Profile, {
            where: { user_id: In(userIds) }
        })

        const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? null]))
        const nicknameMap = new Map(profiles.map(p => [p.user_id, p.nickname ?? null]))

        const users: GlobalUserMember[] = rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            email: emailMap.get(row.user_id) ?? null,
            nickname: nicknameMap.get(row.user_id) ?? null,
            roleName: (row as unknown as { role_name: string }).role_name,
            roleMetadata: {
                name: (row as unknown as { role_name: string }).role_name,
                displayName: (row.display_name || {}) as LocalizedString,
                color: row.color || '#9e9e9e',
                hasGlobalAccess: row.has_global_access
            },
            comment: row.comment,
            grantedBy: row.granted_by,
            createdAt: row.created_at
        }))

        return { users, total }
    }

    /**
     * Find user by email
     */
    async function findUserIdByEmail(email: string): Promise<string | null> {
        const ds = getDataSource()
        const result = await ds.manager
            .createQueryBuilder(AuthUser, 'user')
            .where('LOWER(user.email) = LOWER(:email)', { email })
            .getOne()
        return result?.id ?? null
    }

    /**
     * Grant a global role to a user
     */
    async function grantRole(
        userId: string,
        roleName: string,
        grantedBy: string,
        comment?: string
    ): Promise<GlobalUserMember> {
        const ds = getDataSource()

        // Get role ID
        const roleResult = (await ds.query(`
            SELECT id, display_name, color
            FROM admin.roles
            WHERE name = $1 AND has_global_access = true
        `, [roleName])) as { id: string; display_name: Record<string, string>; color: string }[]

        if (roleResult.length === 0) {
            throw new Error(`Role '${roleName}' not found or does not grant global access`)
        }

        const roleId = roleResult[0].id

        // Check if user already has this role
        const existing = (await ds.query(`
            SELECT id FROM admin.user_roles
            WHERE user_id = $1 AND role_id = $2
        `, [userId, roleId])) as UserRoleRow[]

        let assignmentId: string

        if (existing.length > 0) {
            // Update existing assignment
            await ds.query(`
                UPDATE admin.user_roles
                SET granted_by = $1, comment = $2
                WHERE user_id = $3 AND role_id = $4
            `, [grantedBy, comment ?? null, userId, roleId])
            assignmentId = existing[0].id
        } else {
            // Remove any other global roles first (one global role per user)
            await ds.query(`
                DELETE FROM admin.user_roles ur
                USING admin.roles r
                WHERE ur.role_id = r.id
                  AND ur.user_id = $1
                  AND r.has_global_access = true
            `, [userId])

            // Insert new assignment
            const insertResult = (await ds.query(`
                INSERT INTO admin.user_roles (user_id, role_id, granted_by, comment)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [userId, roleId, grantedBy, comment ?? null])) as { id: string }[]
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
            roleName,
            roleMetadata: {
                name: roleName,
                displayName: roleResult[0].display_name || {},
                color: roleResult[0].color || '#9e9e9e',
                hasGlobalAccess: true
            },
            comment: comment ?? null,
            grantedBy,
            createdAt: new Date()
        }
    }

    /**
     * Update a global role assignment (change role or comment)
     */
    async function updateAssignment(
        assignmentId: string,
        updates: { roleName?: string; comment?: string }
    ): Promise<GlobalUserMember | null> {
        const ds = getDataSource()

        // Get current assignment
        const current = (await ds.query(`
            SELECT ur.*, r.name as role_name
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ur.id = $1
        `, [assignmentId])) as (UserRoleRow & { role_name: string })[]

        if (current.length === 0) {
            return null
        }

        const assignment = current[0]

        if (updates.roleName && updates.roleName !== assignment.role_name) {
            // Get new role ID
            const newRole = (await ds.query(`
                SELECT id FROM admin.roles
                WHERE name = $1 AND has_global_access = true
            `, [updates.roleName])) as { id: string }[]

            if (newRole.length === 0) {
                throw new Error(`Role '${updates.roleName}' not found or does not grant global access`)
            }

            await ds.query(`
                UPDATE admin.user_roles
                SET role_id = $1, comment = $2
                WHERE id = $3
            `, [newRole[0].id, updates.comment ?? assignment.comment, assignmentId])
        } else if (updates.comment !== undefined) {
            await ds.query(`
                UPDATE admin.user_roles
                SET comment = $1
                WHERE id = $2
            `, [updates.comment, assignmentId])
        }

        // Get updated assignment with full info
        const result = (await ds.query(`
            SELECT 
                ur.*,
                r.name as role_name,
                r.display_name,
                r.color,
                r.has_global_access
            FROM admin.user_roles ur
            JOIN admin.roles r ON ur.role_id = r.id
            WHERE ur.id = $1
        `, [assignmentId])) as (UserRoleRow & RoleRow)[]

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
            roleName: (row as unknown as { role_name: string }).role_name,
            roleMetadata: {
                name: (row as unknown as { role_name: string }).role_name,
                displayName: (row.display_name || {}) as LocalizedString,
                color: row.color || '#9e9e9e',
                hasGlobalAccess: row.has_global_access
            },
            comment: row.comment,
            grantedBy: row.granted_by,
            createdAt: row.created_at
        }
    }

    /**
     * Revoke global access from a user (remove all global roles)
     */
    async function revokeGlobalAccess(userId: string): Promise<boolean> {
        const ds = getDataSource()
        const result = await ds.query(`
            DELETE FROM admin.user_roles ur
            USING admin.roles r
            WHERE ur.role_id = r.id
              AND ur.user_id = $1
              AND r.has_global_access = true
        `, [userId])
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
            WHERE r.has_global_access = true
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
        getGlobalAccessRoles,
        getRoleByName,

        // User global access
        hasGlobalAccess,
        getGlobalAccessInfo,
        getGlobalRoleName,

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
 * Standalone function to check global access by DataSource
 * Used by access guards in other modules for superadmin bypass
 * Returns false if GLOBAL_ADMIN_ENABLED=false
 */
export async function hasGlobalAccessByDataSource(ds: DataSource, userId: string): Promise<boolean> {
    // If global admin privileges are disabled, no one has global access
    if (!isGlobalAdminEnabled()) {
        return false
    }

    const result = (await ds.query(`
        SELECT admin.has_global_access($1::uuid) as has_access
    `, [userId])) as { has_access: boolean }[]
    return result[0]?.has_access ?? false
}

/**
 * Standalone function to get global role name (for backward compatibility)
 * Used by access guards for synthetic membership creation
 */
export async function getGlobalRoleNameByDataSource(ds: DataSource, userId: string): Promise<string | null> {
    const result = (await ds.query(`
        SELECT r.name as role_name
        FROM admin.user_roles ur
        JOIN admin.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.has_global_access = true
        LIMIT 1
    `, [userId])) as { role_name: string }[]
    return result[0]?.role_name ?? null
}
