import type {
    AssignSystemRoleInput,
    GlobalRoleInfo,
    GlobalUserMember,
    GlobalUserRoleAssignment,
    RoleMetadata,
    VersionedLocalizedContent
} from '@universo/types'
import {
    isGlobalRolesEnabled,
    isSuperuserEnabled,
    type DbSession,
    type DbExecutor,
    type SqlQueryable,
    activeAppRowCondition,
    softDeleteSetClause
} from '@universo/utils'
import { escapeLikeWildcards } from '@universo/utils/database'

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

interface DashboardRoleCountRow {
    role_codename: string
    count: string
}

interface RoleMutationGuardRow {
    id: string
    codename: string
    is_superuser: boolean
    is_system: boolean
}

const PROTECTED_ROLE_ASSIGNMENT_ERROR = 'Only superusers can modify superuser or system-role assignments'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const roleCodenameTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const isProtectedRoleAssignment = (role: Pick<RoleMutationGuardRow, 'is_superuser' | 'is_system'>): boolean =>
    role.is_superuser || role.is_system

const compareGlobalRoles = (left: GlobalRoleInfo, right: GlobalRoleInfo): number => {
    if (left.metadata.isSuperuser !== right.metadata.isSuperuser) {
        return left.metadata.isSuperuser ? -1 : 1
    }

    return left.codename.localeCompare(right.codename)
}

interface GlobalUserListRow {
    user_id: string
    email: string | null
    nickname: string | null
    onboarding_completed: boolean | null
    registered_at: Date | string | null
    first_assignment_at: Date | string | null
    roles: GlobalUserRoleAssignment[] | string
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

function toGlobalUserRoleAssignment(row: {
    id: string
    codename: string
    name: VersionedLocalizedContent<string> | null
    color: string | null
    is_superuser?: boolean
    is_system?: boolean
}): GlobalUserRoleAssignment {
    return {
        id: row.id,
        codename: row.codename,
        name:
            row.name && typeof row.name === 'object' && '_schema' in row.name
                ? row.name
                : {
                      _schema: '1',
                      _primary: 'en',
                      locales: {
                          en: {
                              content: row.codename,
                              version: 1,
                              isActive: true,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString()
                          }
                      }
                  },
        color: row.color || '#9e9e9e',
        isSuperuser: Boolean(row.is_superuser),
        isSystem: Boolean(row.is_system)
    }
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) {
        return null
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    return String(value)
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

    const isUserSuperuserWithQueryable = async (queryable: SqlQueryable, userId: string): Promise<boolean> => {
        const result = await queryable.query<{ is_super: boolean }>(
            `
            SELECT admin.is_superuser($1::uuid) as is_super
        `,
            [userId]
        )

        return result[0]?.is_super ?? false
    }

    const listActiveRolesForUser = async (queryable: SqlQueryable, userId: string): Promise<RoleMutationGuardRow[]> => {
        return queryable.query<RoleMutationGuardRow>(
            `SELECT r.id, ${roleCodenameTextSql('r.codename')} AS codename, r.is_superuser, r.is_system
             FROM admin.rel_user_roles ur
             JOIN admin.cat_roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1
               AND ${activeAppRowCondition('ur')}
               AND ${activeAppRowCondition('r')}`,
            [userId]
        )
    }

    const assertCanMutateProtectedRoles = async (
        queryable: SqlQueryable,
        {
            actorUserId,
            targetUserId,
            requestedRoles
        }: {
            actorUserId?: string | null
            targetUserId: string
            requestedRoles: Array<Pick<RoleMutationGuardRow, 'is_superuser' | 'is_system'>>
        }
    ): Promise<void> => {
        if (!actorUserId) {
            return
        }

        const actorIsSuperuser = await isUserSuperuserWithQueryable(queryable, actorUserId)
        if (actorIsSuperuser) {
            return
        }

        const currentTargetRoles = await listActiveRolesForUser(queryable, targetUserId)
        const touchesProtectedCurrentRole = currentTargetRoles.some(isProtectedRoleAssignment)
        const touchesProtectedRequestedRole = requestedRoles.some(isProtectedRoleAssignment)

        if (touchesProtectedCurrentRole || touchesProtectedRequestedRole) {
            throw Object.assign(new Error(PROTECTED_ROLE_ASSIGNMENT_ERROR), { statusCode: 403 })
        }
    }

    /**
     * Get all roles with metadata (SQL)
     */
    async function getAllRoles(): Promise<RoleMetadata[]> {
        const rows = await getDbExecutor().query<RoleRow>(
            `SELECT id, ${roleCodenameTextSql(
                'codename'
            )} AS codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at
             FROM admin.cat_roles
             WHERE ${activeAppRowCondition()}
             ORDER BY is_system DESC, ${roleCodenameTextSql('codename')} ASC, id ASC`
        )

        return rows.map(toRoleMetadata)
    }

    /**
     * Get role by codename (SQL)
     */
    async function getRoleByCodename(codename: string): Promise<RoleMetadata | null> {
        const rows = await getDbExecutor().query<RoleRow>(
            `SELECT id, ${roleCodenameTextSql(
                'codename'
            )} AS codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at
             FROM admin.cat_roles WHERE ${roleCodenameTextSql('codename')} = $1 AND ${activeAppRowCondition()}`,
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
     * Check whether the user may enter the shared workspace shell or shared dashboard.
     * This is intentionally capability-based, not codename-based.
     */
    async function hasWorkspaceAccess(userId: string, dbSession?: DbSession): Promise<boolean> {
        const [isSuperuserFlag, canAccessAdminFlag] = await Promise.all([isSuperuser(userId, dbSession), canAccessAdmin(userId, dbSession)])

        if (isSuperuserFlag || canAccessAdminFlag) {
            return true
        }

        const queryable = dbSession && !dbSession.isReleased() ? dbSession : getDbExecutor()
        const roleScope = await queryable.query<{ has_registered_role: boolean; has_non_registered_role: boolean }>(
            `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM admin.rel_user_roles ur
                    JOIN admin.cat_roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1::uuid
                      AND ur._upl_deleted = false AND ur._app_deleted = false
                      AND r._upl_deleted = false AND r._app_deleted = false
                                            AND ${roleCodenameTextSql('r.codename')} = 'Registered'
                ) AS has_registered_role,
                EXISTS (
                    SELECT 1
                    FROM admin.rel_user_roles ur
                    JOIN admin.cat_roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1::uuid
                      AND ur._upl_deleted = false AND ur._app_deleted = false
                      AND r._upl_deleted = false AND r._app_deleted = false
                                            AND ${roleCodenameTextSql('r.codename')} <> 'Registered'
                ) AS has_non_registered_role
            `,
            [userId]
        )

        if (roleScope[0]?.has_registered_role && !roleScope[0]?.has_non_registered_role) {
            return false
        }

        const result = await queryable.query<{ has_workspace_access: boolean }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM admin.rel_user_roles ur
                JOIN admin.cat_roles r ON ur.role_id = r.id
                JOIN admin.rel_role_permissions rp ON r.id = rp.role_id
                WHERE ur.user_id = $1::uuid
                  AND ur._upl_deleted = false AND ur._app_deleted = false
                  AND r._upl_deleted = false AND r._app_deleted = false
                  AND rp._upl_deleted = false AND rp._app_deleted = false
                  AND rp.subject IN ('applications', 'metahubs', 'profile')
                  AND rp.action IN ('*', 'manage', 'read', 'create', 'update', 'delete')
            ) AS has_workspace_access
            `,
            [userId]
        )

        return result[0]?.has_workspace_access ?? false
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
            const superuserRole = globalRoles.find((r) => r.codename === 'Superuser')
            if (superuserRole) {
                superuserRole.metadata.isSuperuser = true
            }
        }

        globalRoles.sort(compareGlobalRoles)

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
        return info.globalRoles.find((role) => role.metadata.isSuperuser)?.codename ?? info.globalRoles[0]?.codename ?? null
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
            roleId,
            hasGlobalAccess = 'all'
        } = params || {}

        const conditions: string[] = ['u.deleted_at IS NULL']
        const queryParams: unknown[] = []
        let paramIndex = 1

        if (roleId) {
            conditions.push(`EXISTS (
                SELECT 1
                FROM admin.rel_user_roles fur
                WHERE fur.user_id = u.id
                  AND fur.role_id = $${paramIndex}
                  AND ${activeAppRowCondition('fur')}
            )`)
            queryParams.push(roleId)
            paramIndex++
        } else if (roleCodename) {
            conditions.push(`EXISTS (
                SELECT 1
                FROM admin.rel_user_roles fur
                JOIN admin.cat_roles fr ON fr.id = fur.role_id AND ${activeAppRowCondition('fr')}
                WHERE fur.user_id = u.id
                                    AND ${roleCodenameTextSql('fr.codename')} = $${paramIndex}
                  AND ${activeAppRowCondition('fur')}
            )`)
            queryParams.push(roleCodename)
            paramIndex++
        }

        if (search) {
            conditions.push(`(
                LOWER(COALESCE(u.email, '')) LIKE $${paramIndex}
                OR LOWER(COALESCE(p.nickname, '')) LIKE $${paramIndex}
            )`)
            queryParams.push(`%${escapeLikeWildcards(search.toLowerCase())}%`)
            paramIndex++
        }

        if (hasGlobalAccess === 'true') {
            conditions.push(`EXISTS (
                SELECT 1
                FROM admin.rel_user_roles gur
                WHERE gur.user_id = u.id AND ${activeAppRowCondition('gur')}
            )`)
        } else if (hasGlobalAccess === 'false') {
            conditions.push(`NOT EXISTS (
                SELECT 1
                FROM admin.rel_user_roles gur
                WHERE gur.user_id = u.id AND ${activeAppRowCondition('gur')}
            )`)
        }

        const whereClause = conditions.join(' AND ')

        const sortExpressions: Record<string, string> = {
            created: 'registered_at',
            role: `COALESCE(MIN(${roleCodenameTextSql('r.codename')}), '')`,
            email: `LOWER(COALESCE(u.email, ''))`
        }
        const orderBy = sortExpressions[sortBy] || 'ur._upl_created_at'
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC'

        const countResult = await exec.query<{ count: string }>(
            `
            SELECT COUNT(DISTINCT u.id) as count
            FROM auth.users u
            LEFT JOIN profiles.cat_profiles p ON p.user_id = u.id AND ${activeAppRowCondition('p')}
            LEFT JOIN admin.rel_user_roles ur ON ur.user_id = u.id AND ${activeAppRowCondition('ur')}
            LEFT JOIN admin.cat_roles r ON r.id = ur.role_id AND ${activeAppRowCondition('r')}
            WHERE ${whereClause}
        `,
            queryParams
        )
        const total = parseInt(countResult[0]?.count ?? '0', 10)

        if (total === 0) {
            return { users: [], total: 0 }
        }

        const rows = await exec.query<GlobalUserListRow>(
            `
            SELECT 
                u.id AS user_id,
                u.email,
                p.nickname,
                COALESCE(p.onboarding_completed, false) AS onboarding_completed,
                COALESCE(p._upl_created_at, MIN(ur._upl_created_at)) AS registered_at,
                MIN(ur._upl_created_at) AS first_assignment_at,
                COALESCE(
                    json_agg(
                        jsonb_build_object(
                            'id', r.id,
                            'codename', ${roleCodenameTextSql('r.codename')},
                            'name', r.name,
                            'color', r.color,
                            'isSuperuser', r.is_superuser,
                            'isSystem', r.is_system
                        )
                        ORDER BY r.is_superuser DESC, ${roleCodenameTextSql('r.codename')} ASC, r.id ASC
                    ) FILTER (WHERE r.id IS NOT NULL),
                    '[]'::json
                ) AS roles
            FROM auth.users u
            LEFT JOIN profiles.cat_profiles p ON p.user_id = u.id AND ${activeAppRowCondition('p')}
            LEFT JOIN admin.rel_user_roles ur ON ur.user_id = u.id AND ${activeAppRowCondition('ur')}
            LEFT JOIN admin.cat_roles r ON r.id = ur.role_id AND ${activeAppRowCondition('r')}
            WHERE ${whereClause}
            GROUP BY u.id, u.email, p.nickname, p.onboarding_completed, p._upl_created_at
            ORDER BY ${orderBy} ${direction}, u.id ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
            [...queryParams, limit, offset]
        )

        if (rows.length === 0) {
            return { users: [], total }
        }

        const users: GlobalUserMember[] = rows.map((row) => {
            const parsedRoles = Array.isArray(row.roles) ? row.roles : JSON.parse(String(row.roles || '[]'))
            const roles = parsedRoles.map((role) =>
                toGlobalUserRoleAssignment({
                    id: role.id,
                    codename: role.codename,
                    name: role.name ?? null,
                    color: role.color ?? null,
                    is_superuser: role.isSuperuser,
                    is_system: role.isSystem
                })
            )
            const primaryRole = roles[0] ?? null

            return {
                id: row.user_id,
                userId: row.user_id,
                email: row.email,
                nickname: row.nickname,
                roles,
                roleCodename: primaryRole?.codename ?? null,
                roleMetadata: primaryRole
                    ? {
                          codename: primaryRole.codename,
                          name: primaryRole.name,
                          color: primaryRole.color,
                          isSuperuser: primaryRole.isSuperuser
                      }
                    : null,
                comment: null,
                grantedBy: null,
                createdAt: toIsoString(row.first_assignment_at) ?? undefined,
                registeredAt: toIsoString(row.registered_at),
                onboardingCompleted: Boolean(row.onboarding_completed)
            }
        })

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

    async function assignSystemRole({ userId, roleCodename, reason }: AssignSystemRoleInput): Promise<void> {
        const exec = getDbExecutor()
        const roleRows = await exec.query<{ id: string }>(
            `SELECT id FROM admin.cat_roles WHERE ${roleCodenameTextSql('codename')} = $1 AND ${activeAppRowCondition()} LIMIT 1`,
            [roleCodename]
        )

        if (roleRows.length === 0) {
            throw new Error(`System role '${roleCodename}' not found`)
        }

        const hasSuperuser = await exec.query<{ id: string }>(
            `SELECT ur.id
             FROM admin.rel_user_roles ur
             JOIN admin.cat_roles r ON r.id = ur.role_id AND ${activeAppRowCondition('r')}
             WHERE ur.user_id = $1
               AND ${activeAppRowCondition('ur')}
               AND r.is_superuser = true
             LIMIT 1`,
            [userId]
        )

        if (hasSuperuser.length > 0) {
            return
        }

        await exec.query(
            `INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
             VALUES ($1, $2, NULL, $3)
             ON CONFLICT (user_id, role_id) WHERE _upl_deleted = false AND _app_deleted = false
             DO UPDATE SET comment = EXCLUDED.comment, granted_by = EXCLUDED.granted_by, _upl_updated_at = NOW()`,
            [userId, roleRows[0].id, reason]
        )
    }

    async function setUserRoles(
        userId: string,
        roleIds: string[],
        grantedBy: string | null,
        comment?: string
    ): Promise<GlobalUserRoleAssignment[]> {
        const exec = getDbExecutor()
        const requestedRoleIds = Array.from(new Set(roleIds))

        return exec.transaction(async (trx) => {
            let normalizedRoleIds = requestedRoleIds

            if (requestedRoleIds.length > 0) {
                const validRoles = await trx.query<{
                    id: string
                    codename: string
                    name: VersionedLocalizedContent<string> | null
                    color: string | null
                    is_superuser: boolean
                    is_system: boolean
                }>(
                    `SELECT id, ${roleCodenameTextSql('codename')} AS codename, name, color, is_superuser, is_system
                     FROM admin.cat_roles
                     WHERE id = ANY($1::uuid[])
                       AND ${activeAppRowCondition()}`,
                    [requestedRoleIds]
                )

                if (validRoles.length !== requestedRoleIds.length) {
                    throw Object.assign(new Error('One or more role IDs are invalid'), { statusCode: 400 })
                }

                await assertCanMutateProtectedRoles(trx, {
                    actorUserId: grantedBy,
                    targetUserId: userId,
                    requestedRoles: validRoles
                })

                const superuserRole = validRoles.find((role) => role.is_superuser)
                if (superuserRole) {
                    normalizedRoleIds = [superuserRole.id]
                }
            } else {
                await assertCanMutateProtectedRoles(trx, {
                    actorUserId: grantedBy,
                    targetUserId: userId,
                    requestedRoles: []
                })
            }

            await trx.query(
                `UPDATE admin.rel_user_roles
                 SET ${softDeleteSetClause('$2')}
                 WHERE user_id = $1 AND ${activeAppRowCondition()}`,
                [userId, grantedBy]
            )

            if (normalizedRoleIds.length > 0) {
                await trx.query(
                    `INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
                     SELECT $1, unnest($2::uuid[]), $3, $4`,
                    [userId, normalizedRoleIds, grantedBy, comment ?? 'bulk role assignment']
                )
            }

            const rows = await trx.query<{
                id: string
                codename: string
                name: VersionedLocalizedContent<string> | null
                color: string | null
                is_superuser: boolean
                is_system: boolean
            }>(
                `SELECT r.id, ${roleCodenameTextSql('r.codename')} AS codename, r.name, r.color, r.is_superuser, r.is_system
                 FROM admin.rel_user_roles ur
                 JOIN admin.cat_roles r ON r.id = ur.role_id
                 WHERE ur.user_id = $1
                   AND ${activeAppRowCondition('ur')}
                   AND ${activeAppRowCondition('r')}
                                 ORDER BY r.is_superuser DESC, ${roleCodenameTextSql('r.codename')} ASC, r.id ASC`,
                [userId]
            )

            return rows.map((row) => toGlobalUserRoleAssignment(row))
        })
    }

    /**
     * Grant a global role to a user
     */
    async function grantRole(userId: string, roleCodename: string, grantedBy: string, comment?: string): Promise<GlobalUserMember> {
        const exec = getDbExecutor()

        // Get role ID (any role, not filtered by can_access_admin)
        const roleResult = await exec.query<{
            id: string
            name: VersionedLocalizedContent<string>
            color: string
            is_superuser: boolean
            is_system: boolean
        }>(
            `
            SELECT id, name, color, is_superuser
                   , is_system
            FROM admin.cat_roles
            WHERE ${roleCodenameTextSql('codename')} = $1 AND ${activeAppRowCondition()}
        `,
            [roleCodename]
        )

        if (roleResult.length === 0) {
            throw new Error(`Role '${roleCodename}' not found`)
        }

        const roleId = roleResult[0].id

        const assignmentId = await exec.transaction(async (trx) => {
            await assertCanMutateProtectedRoles(trx, {
                actorUserId: grantedBy,
                targetUserId: userId,
                requestedRoles: [{ is_superuser: roleResult[0].is_superuser, is_system: roleResult[0].is_system }]
            })

            if (roleResult[0].is_superuser) {
                await trx.query(
                    `UPDATE admin.rel_user_roles
                     SET ${softDeleteSetClause('$2')}
                     WHERE user_id = $1 AND ${activeAppRowCondition()}`,
                    [userId, grantedBy]
                )

                const insertResult = await trx.query<{ id: string }>(
                    `INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id`,
                    [userId, roleId, grantedBy, comment ?? null]
                )

                return insertResult[0].id
            }

            const existingSuperuser = await trx.query<{ id: string }>(
                `SELECT ur.id
                 FROM admin.rel_user_roles ur
                 JOIN admin.cat_roles r ON r.id = ur.role_id AND ${activeAppRowCondition('r')}
                 WHERE ur.user_id = $1
                   AND r.is_superuser = true
                   AND ${activeAppRowCondition('ur')}`,
                [userId]
            )

            if (existingSuperuser.length > 0) {
                throw Object.assign(new Error('Cannot add another role to a superuser via legacy grant route'), { statusCode: 409 })
            }

            const existing = await trx.query<UserRoleRow>(
                `SELECT id FROM admin.rel_user_roles
                 WHERE user_id = $1 AND role_id = $2 AND ${activeAppRowCondition()}`,
                [userId, roleId]
            )

            if (existing.length > 0) {
                await trx.query(
                    `UPDATE admin.rel_user_roles
                     SET granted_by = $1, comment = $2
                     WHERE user_id = $3 AND role_id = $4 AND ${activeAppRowCondition()}`,
                    [grantedBy, comment ?? null, userId, roleId]
                )
                return existing[0].id
            }

            const insertResult = await trx.query<{ id: string }>(
                `INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [userId, roleId, grantedBy, comment ?? null]
            )

            return insertResult[0].id
        })

        // Get user info
        const authUsers = await exec.query<{ id: string; email: string | null }>(`SELECT id, email FROM auth.users WHERE id = $1`, [userId])
        const profileRows = await exec.query<{
            user_id: string
            nickname: string | null
            onboarding_completed: boolean
            _upl_created_at: Date | string | null
        }>(
            `SELECT user_id, nickname, onboarding_completed, _upl_created_at FROM profiles.cat_profiles WHERE user_id = $1 AND ${activeAppRowCondition()}`,
            [userId]
        )

        const assignedRole = toGlobalUserRoleAssignment({
            id: roleId,
            codename: roleCodename,
            name: (roleResult[0].name || null) as VersionedLocalizedContent<string> | null,
            color: roleResult[0].color || '#9e9e9e',
            is_superuser: roleResult[0].is_superuser,
            is_system: roleResult[0].is_system
        })

        return {
            id: assignmentId,
            userId,
            email: authUsers[0]?.email ?? null,
            nickname: profileRows[0]?.nickname ?? null,
            roles: [assignedRole],
            roleCodename,
            roleMetadata: {
                codename: roleCodename,
                name: (roleResult[0].name || {}) as VersionedLocalizedContent<string>,
                color: roleResult[0].color || '#9e9e9e',
                isSuperuser: roleResult[0].is_superuser || false
            },
            comment: comment ?? null,
            grantedBy,
            createdAt: new Date().toISOString(),
            registeredAt: toIsoString(profileRows[0]?._upl_created_at),
            onboardingCompleted: Boolean(profileRows[0]?.onboarding_completed)
        }
    }

    /**
     * Update a global role assignment (change role or comment)
     */
    async function updateAssignment(
        assignmentId: string,
        updates: { roleCodename?: string; comment?: string },
        changedBy?: string | null
    ): Promise<GlobalUserMember | null> {
        const exec = getDbExecutor()

        // Get current assignment
        const current = await exec.query<UserRoleRow & { role_codename: string }>(
            `
            SELECT ur.*, ${roleCodenameTextSql('r.codename')} as role_codename
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
        const currentRoleRows = await exec.query<RoleMutationGuardRow>(
            `SELECT r.id, ${roleCodenameTextSql('r.codename')} AS codename, r.is_superuser, r.is_system
             FROM admin.cat_roles r
             WHERE r.id = $1
               AND ${activeAppRowCondition('r')}`,
            [assignment.role_id]
        )
        const nextRoleRows =
            updates.roleCodename && updates.roleCodename !== assignment.role_codename
                ? await exec.query<RoleMutationGuardRow>(
                      `SELECT id, ${roleCodenameTextSql('codename')} AS codename, is_superuser, is_system
                       FROM admin.cat_roles
                       WHERE ${roleCodenameTextSql('codename')} = $1 AND ${activeAppRowCondition()}`,
                      [updates.roleCodename]
                  )
                : currentRoleRows

        if (nextRoleRows.length === 0) {
            throw new Error(`Role '${updates.roleCodename}' not found`)
        }

        await assertCanMutateProtectedRoles(exec, {
            actorUserId: changedBy,
            targetUserId: assignment.user_id,
            requestedRoles: nextRoleRows
        })

        if (updates.roleCodename && updates.roleCodename !== assignment.role_codename) {
            await exec.query(
                `
                UPDATE admin.rel_user_roles
                SET role_id = $1, comment = $2
                WHERE id = $3 AND ${activeAppRowCondition()}
            `,
                [nextRoleRows[0].id, updates.comment ?? assignment.comment, assignmentId]
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
                ${roleCodenameTextSql('r.codename')} as role_codename,
                r.name,
                r.color,
                r.is_superuser,
                r.is_system
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
        const profileRows = await exec.query<{
            user_id: string
            nickname: string | null
            onboarding_completed: boolean
            _upl_created_at: Date | string | null
        }>(
            `SELECT user_id, nickname, onboarding_completed, _upl_created_at FROM profiles.cat_profiles WHERE user_id = $1 AND ${activeAppRowCondition()}`,
            [row.user_id]
        )

        const assignedRole = toGlobalUserRoleAssignment({
            id: row.role_id,
            codename: row.role_codename,
            name: (row.name || null) as VersionedLocalizedContent<string> | null,
            color: row.color || '#9e9e9e',
            is_superuser: row.is_superuser,
            is_system: row.is_system
        })

        return {
            id: row.id,
            userId: row.user_id,
            email: authUsers[0]?.email ?? null,
            nickname: profileRows[0]?.nickname ?? null,
            roles: [assignedRole],
            roleCodename: row.role_codename,
            roleMetadata: {
                codename: row.role_codename,
                name: (row.name || {}) as VersionedLocalizedContent<string>,
                color: row.color || '#9e9e9e',
                isSuperuser: row.is_superuser
            },
            comment: row.comment ?? null,
            grantedBy: row.granted_by ?? null,
            createdAt: row._upl_created_at instanceof Date ? row._upl_created_at.toISOString() : String(row._upl_created_at),
            registeredAt: toIsoString(profileRows[0]?._upl_created_at),
            onboardingCompleted: Boolean(profileRows[0]?.onboarding_completed)
        }
    }

    async function updateLegacyUserAccess(
        userId: string,
        updates: { roleCodename?: string; comment?: string },
        grantedBy: string
    ): Promise<GlobalUserMember | null> {
        const exec = getDbExecutor()
        const currentAssignments = await exec.query<{
            id: string
            role_id: string
            role_codename: string
            comment: string | null
            granted_by: string | null
            _upl_created_at: Date | string | null
        }>(
            `SELECT
                ur.id,
                ur.role_id,
                ur.comment,
                ur.granted_by,
                ur._upl_created_at,
                                ${roleCodenameTextSql('r.codename')} AS role_codename
             FROM admin.rel_user_roles ur
             JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
             WHERE ur.user_id = $1
               AND ${activeAppRowCondition('ur')}
                         ORDER BY r.is_superuser DESC, ${roleCodenameTextSql('r.codename')} ASC, r.id ASC`,
            [userId]
        )

        if (currentAssignments.length === 0) {
            return null
        }

        if (currentAssignments.length > 1) {
            throw Object.assign(new Error('Legacy global-user route cannot modify multi-role users; use the /roles endpoint'), {
                statusCode: 409
            })
        }

        let roleIds = [currentAssignments[0].role_id]
        if (updates.roleCodename && updates.roleCodename !== currentAssignments[0].role_codename) {
            const nextRole = await exec.query<{ id: string }>(
                `SELECT id
                 FROM admin.cat_roles
                 WHERE ${roleCodenameTextSql('codename')} = $1 AND ${activeAppRowCondition()}`,
                [updates.roleCodename]
            )

            if (nextRole.length === 0) {
                throw new Error(`Role '${updates.roleCodename}' not found`)
            }

            roleIds = [nextRole[0].id]
        }

        const updatedRoles = await setUserRoles(userId, roleIds, grantedBy, updates.comment ?? currentAssignments[0].comment ?? undefined)
        const authUsers = await exec.query<{ id: string; email: string | null }>(`SELECT id, email FROM auth.users WHERE id = $1`, [userId])
        const profileRows = await exec.query<{
            user_id: string
            nickname: string | null
            onboarding_completed: boolean
            _upl_created_at: Date | string | null
        }>(
            `SELECT user_id, nickname, onboarding_completed, _upl_created_at FROM profiles.cat_profiles WHERE user_id = $1 AND ${activeAppRowCondition()}`,
            [userId]
        )

        const primaryRole = updatedRoles[0] ?? null

        return {
            id: userId,
            userId,
            email: authUsers[0]?.email ?? null,
            nickname: profileRows[0]?.nickname ?? null,
            roles: updatedRoles,
            roleCodename: primaryRole?.codename ?? null,
            roleMetadata: primaryRole
                ? {
                      codename: primaryRole.codename,
                      name: primaryRole.name,
                      color: primaryRole.color,
                      isSuperuser: primaryRole.isSuperuser
                  }
                : null,
            comment: updates.comment ?? currentAssignments[0].comment ?? null,
            grantedBy,
            createdAt: toIsoString(currentAssignments[0]._upl_created_at) ?? new Date().toISOString(),
            registeredAt: toIsoString(profileRows[0]?._upl_created_at),
            onboardingCompleted: Boolean(profileRows[0]?.onboarding_completed)
        }
    }

    /**
     * Revoke global access from a user (remove all global roles)
     */
    async function revokeGlobalAccess(userId: string, revokedBy?: string | null): Promise<boolean> {
        const exec = getDbExecutor()

        return exec.transaction(async (trx) => {
            await assertCanMutateProtectedRoles(trx, {
                actorUserId: revokedBy,
                targetUserId: userId,
                requestedRoles: []
            })

            const result = await trx.query<{ id: string }>(
                `
                UPDATE admin.rel_user_roles
                SET ${softDeleteSetClause('$2')}
                WHERE user_id = $1
                  AND ${activeAppRowCondition()}
                RETURNING id
            `,
                [userId, revokedBy ?? null]
            )

            return result.length > 0
        })
    }

    /**
     * Revoke specific role assignment (SQL)
     */
    async function revokeAssignment(assignmentId: string, revokedBy?: string | null): Promise<boolean> {
        const exec = getDbExecutor()

        return exec.transaction(async (trx) => {
            const assignmentRows = await trx.query<{
                user_id: string
                role_id: string
            }>(
                `SELECT user_id, role_id
                 FROM admin.rel_user_roles
                 WHERE id = $1
                   AND ${activeAppRowCondition()}`,
                [assignmentId]
            )

            if (assignmentRows.length === 0) {
                return false
            }

            const targetRoleRows = await trx.query<RoleMutationGuardRow>(
                `SELECT id, ${roleCodenameTextSql('codename')} AS codename, is_superuser, is_system
                 FROM admin.cat_roles
                 WHERE id = $1
                   AND ${activeAppRowCondition()}`,
                [assignmentRows[0].role_id]
            )

            await assertCanMutateProtectedRoles(trx, {
                actorUserId: revokedBy,
                targetUserId: assignmentRows[0].user_id,
                requestedRoles: targetRoleRows
            })

            const result = await trx.query<{ id: string }>(
                `UPDATE admin.rel_user_roles
                 SET ${softDeleteSetClause('$2')}
                 WHERE id = $1
                   AND ${activeAppRowCondition()}
                 RETURNING id`,
                [assignmentId, revokedBy ?? null]
            )

            return result.length > 0
        })
    }

    /**
     * Get statistics for admin dashboard
     */
    async function getStats(): Promise<{
        totalGlobalUsers: number
        byRole: Record<string, number>
        totalRoles: number
        totalApplications: number
        totalMetahubs: number
    }> {
        const exec = getDbExecutor()
        const [roleCounts, totalUsersRows, totalRolesRows, totalApplicationsRows, totalMetahubsRows] = await Promise.all([
            exec.query<DashboardRoleCountRow>(
                `SELECT ${roleCodenameTextSql('r.codename')} AS role_codename, COUNT(DISTINCT ur.user_id)::text AS count
                 FROM admin.rel_user_roles ur
                 JOIN admin.cat_roles r ON ur.role_id = r.id AND ${activeAppRowCondition('r')}
                 WHERE ${activeAppRowCondition('ur')}
                  GROUP BY ${roleCodenameTextSql('r.codename')}`
            ),
            exec.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count
                 FROM auth.users`
            ),
            exec.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count
                 FROM admin.cat_roles
                 WHERE ${activeAppRowCondition()}`
            ),
            exec.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count
                 FROM applications.cat_applications
                 WHERE ${activeAppRowCondition()}`
            ),
            exec.query<{ count: string }>(
                `SELECT COUNT(*)::text AS count
                 FROM metahubs.cat_metahubs
                 WHERE ${activeAppRowCondition()}`
            )
        ])

        const byRole: Record<string, number> = {}
        for (const row of roleCounts) {
            const count = parseInt(row.count, 10)
            byRole[row.role_codename] = count
        }

        return {
            totalGlobalUsers: parseInt(totalUsersRows[0]?.count ?? '0', 10),
            byRole,
            totalRoles: parseInt(totalRolesRows[0]?.count ?? '0', 10),
            totalApplications: parseInt(totalApplicationsRows[0]?.count ?? '0', 10),
            totalMetahubs: parseInt(totalMetahubsRows[0]?.count ?? '0', 10)
        }
    }

    return {
        // Role queries
        getAllRoles,
        getRoleByCodename,

        // User access checks
        isSuperuser,
        canAccessAdmin,
        hasWorkspaceAccess,
        getGlobalAccessInfo,
        getGlobalRoleCodename,

        // User management
        listGlobalUsers,
        findUserIdByEmail,
        assignSystemRole,
        grantRole,
        setUserRoles,
        updateAssignment,
        updateLegacyUserAccess,
        revokeGlobalAccess,
        revokeAssignment,

        // Stats
        getStats
    }
}

export type GlobalAccessService = ReturnType<typeof createGlobalAccessService>

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
        `SELECT ${roleCodenameTextSql('r.codename')} as role_codename
         FROM admin.rel_user_roles ur
         JOIN admin.cat_roles r ON ur.role_id = r.id AND r._upl_deleted = false AND r._app_deleted = false
         WHERE ur.user_id = $1 AND ur._upl_deleted = false AND ur._app_deleted = false
         ORDER BY CASE WHEN r.is_superuser THEN 0 ELSE 1 END, LOWER(${roleCodenameTextSql('r.codename')}), r.id
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
