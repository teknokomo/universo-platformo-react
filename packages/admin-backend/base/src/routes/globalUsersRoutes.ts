import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess, type RequestWithGlobalRole } from '../guards/ensureGlobalAccess'
import { activeAppRowCondition, getRequestDbSession, isAdminPanelEnabled, softDeleteSetClause } from '@universo/utils'
import { GrantRoleSchema, UpdateGlobalUserSchema, formatZodError, validateListQuery } from '../schemas'
import { z } from 'zod'

export interface GlobalUsersRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    supabaseAdmin?: SupabaseClient
}

const SetUserRolesSchema = z.object({
    roleIds: z.array(z.string().uuid()).max(20),
    comment: z.string().max(500).optional()
})

const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128).optional(),
    roleIds: z.array(z.string().uuid()).min(1).max(20),
    comment: z.string().max(500).optional()
})

/**
 * Create routes for global users management
 * Uses new GlobalAccessService with RBAC and role metadata
 */
export function createGlobalUsersRoutes({ globalAccessService, permissionService, supabaseAdmin }: GlobalUsersRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const cleanupProvisionedUser = async (
        userId: string,
        dbSession?: { query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>; isReleased(): boolean } | null
    ) => {
        const cleanupErrors: string[] = []

        if (dbSession && !dbSession.isReleased()) {
            try {
                await dbSession.query(
                    `UPDATE profiles.cat_profiles
                     SET ${softDeleteSetClause('$2')}
                     WHERE user_id = $1 AND ${activeAppRowCondition()}`,
                    [userId, null]
                )
            } catch (profileCleanupError) {
                cleanupErrors.push(
                    `profile cleanup failed: ${
                        profileCleanupError instanceof Error ? profileCleanupError.message : String(profileCleanupError)
                    }`
                )
            }
        }

        if (!supabaseAdmin) {
            cleanupErrors.push('auth cleanup skipped: Supabase Admin API is not configured')
            return {
                cleaned: false,
                cleanupErrors
            }
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (error) {
            cleanupErrors.push(`auth cleanup failed: ${error.message}`)
        }

        return {
            cleaned: cleanupErrors.length === 0,
            cleanupErrors
        }
    }

    /**
     * GET /api/v1/admin/global-users
     * List all global users with details (view permission required)
     * Supports pagination and search
     */
    router.get('/', ensureGlobalAccess('users', 'read'), async (req, res, next) => {
        try {
            // Parse and validate query parameters
            const params = validateListQuery(req.query)

            const { users, total } = await globalAccessService.listGlobalUsers(params)

            // Set pagination headers (compatible with clusters pattern)
            const hasMore = params.offset + users.length < total
            res.setHeader('X-Pagination-Limit', params.limit.toString())
            res.setHeader('X-Pagination-Offset', params.offset.toString())
            res.setHeader('X-Pagination-Count', users.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({ success: true, data: users })
        } catch (error) {
            console.error('[Admin] GET /global-users - error:', error)
            next(error)
        }
    })

    /**
     * GET /api/v1/admin/global-users/me
     * Get current user's effective global role and role metadata
     */
    router.get('/me', async (req, res, next) => {
        try {
            const enabled = isAdminPanelEnabled()

            // If admin panel is disabled, don't reveal any role info
            if (!enabled) {
                return res.json({
                    success: true,
                    data: { role: null, hasGlobalAccess: false, isSuperuser: false, roleMetadata: null }
                })
            }

            const userId = (req as RequestWithGlobalRole).user?.id
            if (!userId) {
                return res.json({
                    success: true,
                    data: { role: null, hasGlobalAccess: false, isSuperuser: false, roleMetadata: null }
                })
            }

            const dbSession = getRequestDbSession(req)
            // Get full global access info with metadata
            const globalInfo = await globalAccessService.getGlobalAccessInfo(userId, dbSession)

            if (!globalInfo || !globalInfo.canAccessAdmin) {
                return res.json({
                    success: true,
                    data: { role: null, hasGlobalAccess: false, isSuperuser: false, roleMetadata: null }
                })
            }

            const primaryRole = globalInfo.globalRoles.find((role) => role.metadata.isSuperuser) ?? globalInfo.globalRoles[0]

            res.json({
                success: true,
                data: {
                    role: primaryRole?.codename ?? null,
                    hasGlobalAccess: globalInfo.canAccessAdmin,
                    isSuperuser: globalInfo.isSuperuser,
                    roleMetadata: primaryRole?.metadata ?? null
                }
            })
        } catch (error) {
            next(error)
        }
    })

    /**
     * GET /api/v1/admin/global-users/stats
     * Get statistics for admin dashboard
     */
    router.get('/stats', ensureGlobalAccess('users', 'read'), async (req, res, next) => {
        try {
            const stats = await globalAccessService.getStats()
            res.json({ success: true, data: stats })
        } catch (error) {
            next(error)
        }
    })

    router.post('/create-user', ensureGlobalAccess('users', 'create'), async (req, res, next) => {
        try {
            if (!supabaseAdmin) {
                return res.status(503).json({
                    success: false,
                    error: 'Supabase Admin API is not configured on the backend'
                })
            }

            const parsed = CreateUserSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
            }

            const { email, password, roleIds, comment } = parsed.data
            const grantedBy = (req as RequestWithGlobalRole).user!.id
            const adminResponse = password
                ? await supabaseAdmin.auth.admin.createUser({
                      email,
                      password,
                      email_confirm: true
                  })
                : await supabaseAdmin.auth.admin.inviteUserByEmail(email)

            if (adminResponse.error || !adminResponse.data.user) {
                return res.status(400).json({
                    success: false,
                    error: adminResponse.error?.message || 'Failed to create user'
                })
            }

            let roles

            try {
                roles = await globalAccessService.setUserRoles(
                    adminResponse.data.user.id,
                    roleIds,
                    grantedBy,
                    comment || 'created from admin panel'
                )
            } catch (roleAssignmentError) {
                const cleanupResult = await cleanupProvisionedUser(adminResponse.data.user.id, getRequestDbSession(req))
                const cleanupSuffix = cleanupResult.cleaned
                    ? ' Newly created auth account was rolled back.'
                    : ` Cleanup failed: ${cleanupResult.cleanupErrors.join('; ')}`

                const wrappedError = new Error(`Failed to assign roles to the newly created user.${cleanupSuffix}`)
                ;(wrappedError as Error & { cause?: unknown }).cause = roleAssignmentError
                throw wrappedError
            }

            res.status(201).json({
                success: true,
                data: {
                    userId: adminResponse.data.user.id,
                    email: adminResponse.data.user.email ?? email,
                    roles
                }
            })
        } catch (error) {
            next(error)
        }
    })

    router.put('/:memberId/roles', ensureGlobalAccess('users', 'update'), async (req, res, next) => {
        try {
            const { memberId } = req.params
            const currentUserId = (req as RequestWithGlobalRole).user!.id

            if (memberId === currentUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot modify your own roles'
                })
            }

            const parsed = SetUserRolesSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
            }

            const { roleIds, comment } = parsed.data
            const updatedRoles = await globalAccessService.setUserRoles(memberId, roleIds, currentUserId, comment)

            res.json({
                success: true,
                data: {
                    userId: memberId,
                    roles: updatedRoles
                }
            })
        } catch (error) {
            next(error)
        }
    })

    /**
     * POST /api/v1/admin/global-users
     * Grant global role to user by email (manage permission required - superadmin only)
     */
    router.post('/', ensureGlobalAccess('users', 'create'), async (req, res, next) => {
        try {
            const parsed = GrantRoleSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
            }

            const { email, role, comment } = parsed.data
            const grantedBy = (req as RequestWithGlobalRole).user!.id

            // Find user by email
            const targetUserId = await globalAccessService.findUserIdByEmail(email)
            if (!targetUserId) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                })
            }

            // Check if already has admin access
            const dbSession = getRequestDbSession(req)
            if (await globalAccessService.canAccessAdmin(targetUserId, dbSession)) {
                return res.status(409).json({
                    success: false,
                    error: 'User already has admin access',
                    code: 'GLOBAL_USER_EXISTS'
                })
            }

            const record = await globalAccessService.grantRole(targetUserId, role, grantedBy, comment)

            res.status(201).json({ success: true, data: record })
        } catch (error) {
            next(error)
        }
    })

    /**
     * PATCH /api/v1/admin/global-users/:memberId
     * Update global user's role and/or comment (manage permission required - superadmin only)
     */
    router.patch('/:memberId', ensureGlobalAccess('users', 'update'), async (req, res, next) => {
        try {
            const { memberId } = req.params
            const currentUserId = (req as RequestWithGlobalRole).user!.id

            // Cannot update own role
            if (memberId === currentUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update your own global role'
                })
            }

            const parsed = UpdateGlobalUserSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
            }

            const updates: { roleCodename?: string; comment?: string } = {}
            if (parsed.data.role) {
                updates.roleCodename = parsed.data.role
            }
            if (parsed.data.comment !== undefined) {
                updates.comment = parsed.data.comment
            }

            const record = await globalAccessService.updateLegacyUserAccess(memberId, updates, currentUserId)
            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: 'Global user not found'
                })
            }
            res.json({ success: true, data: record })
        } catch (error) {
            next(error)
        }
    })

    /**
     * DELETE /api/v1/admin/global-users/:memberId
     * Revoke global role from user (manage permission required - superadmin only)
     */
    router.delete('/:memberId', ensureGlobalAccess('users', 'delete'), async (req, res, next) => {
        try {
            const { memberId } = req.params
            const currentUserId = (req as RequestWithGlobalRole).user!.id

            // Cannot revoke own role
            if (memberId === currentUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot revoke your own global role'
                })
            }

            const success = await globalAccessService.revokeGlobalAccess(memberId)
            if (!success) {
                return res.status(404).json({
                    success: false,
                    error: 'Global user not found'
                })
            }

            res.json({ success: true })
        } catch (error) {
            next(error)
        }
    })

    return router
}
