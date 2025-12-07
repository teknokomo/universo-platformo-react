import type { Request, Response, NextFunction } from 'express'
import * as httpErrors from 'http-errors'
import type { GlobalAccessService } from '../services/globalAccessService'
import { isAdminPanelEnabled } from '@universo/utils'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

/**
 * Extended request with global role info
 */
export interface RequestWithGlobalRole extends Request {
    user?: { id: string }
    globalRole?: string
    hasGlobalAccess?: boolean
}

/**
 * Middleware factory for global access control
 *
 * Uses ADMIN_PANEL_ENABLED environment variable to enable/disable admin panel.
 * When enabled, users with has_global_access=true roles can access admin features.
 * Permission checking is based on role permissions in database.
 */
export function createEnsureGlobalAccess(globalAccessService: GlobalAccessService) {
    /**
     * @param permission - 'view' for read-only, 'manage' for full access
     */
    return function ensureGlobalAccess(permission: 'view' | 'manage' = 'view') {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Check if admin panel is enabled
                if (!isAdminPanelEnabled()) {
                    throw createError(403, 'Admin panel is disabled')
                }

                const userId = (req as RequestWithGlobalRole).user?.id

                if (!userId) {
                    throw createError(401, 'Authentication required')
                }

                // Use service to check global access
                const hasAccess = await globalAccessService.hasGlobalAccess(userId)

                if (!hasAccess) {
                    throw createError(403, 'Access denied: not a global user')
                }

                // Get role name for permission checks
                const roleName = await globalAccessService.getGlobalRoleName(userId)

                // For 'manage' permission, only superadmin is allowed
                // (supermoderator has read, update, delete but not create/manage)
                if (permission === 'manage' && roleName !== 'superadmin') {
                    throw createError(403, 'Access denied: superadmin role required')
                }

                // Attach role info to request
                ;(req as RequestWithGlobalRole).globalRole = roleName ?? undefined
                ;(req as RequestWithGlobalRole).hasGlobalAccess = true
                next()
            } catch (error) {
                next(error)
            }
        }
    }
}
