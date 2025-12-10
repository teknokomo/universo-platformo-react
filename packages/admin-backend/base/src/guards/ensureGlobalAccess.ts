import type { Request, Response, NextFunction } from 'express'
import * as httpErrors from 'http-errors'
import type { GlobalAccessService } from '../services/globalAccessService'
import type { IPermissionService } from '@universo/auth-backend'
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
            console.log('[ensureGlobalAccess] Starting check', { module, action, path: req.path, method: req.method })
            try {
                // Check if admin panel is enabled
                if (!isAdminPanelEnabled()) {
                    console.log('[ensureGlobalAccess] Admin panel disabled')
                    throw createError(403, 'Admin panel is disabled')
                }

                const userId = (req as RequestWithGlobalRole).user?.id
                console.log('[ensureGlobalAccess] User ID:', userId)

                if (!userId) {
                    console.log('[ensureGlobalAccess] No userId found')
                    throw createError(401, 'Authentication required')
                }

                // Check if user can access admin panel
                console.log('[ensureGlobalAccess] Checking admin panel access...')
                const canAccess = await globalAccessService.canAccessAdmin(userId)
                console.log('[ensureGlobalAccess] canAccessAdmin result:', canAccess)

                if (!canAccess) {
                    throw createError(403, 'Access denied: not an admin user')
                }

                // Check if user is superuser (bypasses permission checks)
                const isSuper = await globalAccessService.isSuperuser(userId)
                if (isSuper) {
                    console.log('[ensureGlobalAccess] Superuser detected - bypassing permission check')
                    return next()
                }

                // Check specific permission using database-driven RBAC
                console.log('[ensureGlobalAccess] Checking permission:', { userId, module, action })
                const hasPermission = await permissionService.hasPermission(userId, module, action)
                console.log('[ensureGlobalAccess] hasPermission result:', hasPermission)

                if (!hasPermission) {
                    throw createError(403, `Access denied: requires ${module}:${action} permission`)
                }

                // Get role name for request context
                const roleName = await globalAccessService.getGlobalRoleName(userId)
                console.log('[ensureGlobalAccess] ✅ Access granted', { roleName, module, action })

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
