import { Router } from 'express'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess, type RequestWithGlobalRole } from '../guards/ensureGlobalAccess'
import { isAdminPanelEnabled } from '@universo/utils'
import { GrantRoleSchema, UpdateGlobalUserSchema, formatZodError, validateListQuery } from '../schemas'

export interface GlobalUsersRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
}

/**
 * Create routes for global users management
 * Uses new GlobalAccessService with RBAC and role metadata
 */
export function createGlobalUsersRoutes({ globalAccessService, permissionService }: GlobalUsersRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

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
                    data: { role: null, hasGlobalAccess: false, roleMetadata: null }
                })
            }

            const userId = (req as RequestWithGlobalRole).user?.id
            if (!userId) {
                return res.json({
                    success: true,
                    data: { role: null, hasGlobalAccess: false, roleMetadata: null }
                })
            }

            // Get full global access info with metadata
            const globalInfo = await globalAccessService.getGlobalAccessInfo(userId)

            if (!globalInfo || !globalInfo.hasGlobalAccess) {
                return res.json({
                    success: true,
                    data: { role: null, hasGlobalAccess: false, roleMetadata: null }
                })
            }

            // Get primary role info
            const primaryRole = globalInfo.globalRoles[0]

            res.json({
                success: true,
                data: {
                    role: primaryRole?.name ?? null,
                    hasGlobalAccess: globalInfo.hasGlobalAccess,
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

            // Check if already has access
            if (await globalAccessService.hasGlobalAccess(targetUserId)) {
                return res.status(409).json({
                    success: false,
                    error: 'User already has global access',
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

            // Transform payload to new API: role -> roleName
            const updates: { roleName?: string; comment?: string } = {}
            if (parsed.data.role) {
                updates.roleName = parsed.data.role
            }
            if (parsed.data.comment !== undefined) {
                updates.comment = parsed.data.comment
            }

            const record = await globalAccessService.updateAssignment(memberId, updates)
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

            const success = await globalAccessService.revokeAssignment(memberId)
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
