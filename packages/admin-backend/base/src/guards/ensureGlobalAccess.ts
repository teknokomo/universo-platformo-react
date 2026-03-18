import type { Request, Response, NextFunction } from 'express'
import * as httpErrors from 'http-errors'
import type { GlobalAccessService } from '../services/globalAccessService'
import type { IPermissionService } from '@universo/auth-backend'
import { getRequestDbSession, isAdminPanelEnabled } from '@universo/utils'

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
 * CRUD actions for permission checks
 */
export type CrudAction = 'create' | 'read' | 'update' | 'delete'

/**
 * Options for creating the ensureGlobalAccess middleware factory
 */
export interface EnsureGlobalAccessOptions {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
}

/**
 * Middleware factory for admin panel access control
 *
 * Uses ADMIN_PANEL_ENABLED environment variable to enable/disable admin panel.
 * When enabled, users with can_access_admin=true roles can access admin panel.
 * Permission checking is based on role permissions in database using CRUD model.
 * Users with is_superuser=true bypass all permission checks.
 */
export function createEnsureGlobalAccess(options: EnsureGlobalAccessOptions) {
    const { globalAccessService, permissionService } = options

    /**
     * @param module - The module/resource to check access for (e.g., 'roles', 'instances', 'users')
     * @param action - CRUD action: 'create', 'read', 'update', 'delete'
     */
    return function ensureGlobalAccess(module: string, action: CrudAction) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const dbSession = getRequestDbSession(req)

                // Check if admin panel is enabled
                if (!isAdminPanelEnabled()) {
                    throw createError(403, 'Admin panel is disabled')
                }

                const userId = (req as RequestWithGlobalRole).user?.id

                if (!userId) {
                    throw createError(401, 'Authentication required')
                }

                // Check if user can access admin panel
                const canAccess = await globalAccessService.canAccessAdmin(userId, dbSession)

                if (!canAccess) {
                    throw createError(403, 'Access denied: not an admin user')
                }

                // Check if user is superuser (bypasses permission checks)
                const isSuper = await globalAccessService.isSuperuser(userId, dbSession)
                if (isSuper) {
                    return next()
                }

                // Check specific permission using database-driven RBAC
                const hasPermission = await permissionService.hasPermission(userId, module, action, undefined, dbSession)

                if (!hasPermission) {
                    throw createError(403, `Access denied: requires ${module}:${action} permission`)
                }

                // Get role codename for request context
                const roleCodename = await globalAccessService.getGlobalRoleCodename(userId, dbSession)

                // Attach role info to request
                ;(req as RequestWithGlobalRole).globalRole = roleCodename ?? undefined
                ;(req as RequestWithGlobalRole).hasGlobalAccess = true
                next()
            } catch (error) {
                next(error)
            }
        }
    }
}
