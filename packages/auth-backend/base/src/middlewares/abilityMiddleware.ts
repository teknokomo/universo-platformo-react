/**
 * CASL Ability Middleware
 *
 * Loads user permissions and attaches CASL ability to request object.
 * Should be used AFTER authentication middleware.
 */
import type { Request, Response, NextFunction } from 'express'
import type { DataSource } from 'typeorm'
import type { AppAbility } from '@universo/types'
import { ForbiddenError } from '@universo/types'
import type { AuthenticatedRequest } from '../services/supabaseSession'
import { createPermissionService, type IPermissionService } from '../services/permissionService'

/**
 * Request with CASL ability attached
 */
export interface RequestWithAbility extends AuthenticatedRequest {
    ability?: AppAbility
}

/**
 * Configuration for ability middleware
 */
export interface AbilityMiddlewareOptions {
    /** Function to get DataSource */
    getDataSource: () => DataSource
}

/**
 * Creates middleware that attaches CASL ability to request
 *
 * Usage:
 * ```ts
 * const withAbility = createAbilityMiddleware({ getDataSource })
 * router.use('/protected', ensureAuth, withAbility, protectedRouter)
 * ```
 *
 * Then in route handlers:
 * ```ts
 * const { ability } = req as RequestWithAbility
 * if (ability?.cannot('delete', 'Metaverse')) {
 *   throw new ForbiddenError('Cannot delete metaverse')
 * }
 * ```
 */
export function createAbilityMiddleware(options: AbilityMiddlewareOptions) {
    const permissionService = createPermissionService(options)

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user?.id

        if (!userId) {
            console.warn('[Ability] No user ID found - skipping ability loading')
            return next()
        }

        try {
            console.log('[Ability] Loading permissions for user', { userId, path: req.path })

            const ability = await permissionService.getAbilityForUser(userId)
            ;(req as RequestWithAbility).ability = ability

            console.log('[Ability] Permissions loaded', {
                userId,
                path: req.path,
                rulesCount: ability.rules.length
            })

            next()
        } catch (error) {
            console.error('[Ability] Error loading permissions:', error)
            res.status(500).json({ error: 'Failed to load permissions' })
        }
    }
}

/**
 * Helper to get ability from request (with type guard)
 */
export function getAbilityFromRequest(req: Request): AppAbility | undefined {
    return (req as RequestWithAbility).ability
}

/**
 * Helper to require ability (throws if not present)
 */
export function requireAbility(req: Request): AppAbility {
    const ability = getAbilityFromRequest(req)
    if (!ability) {
        throw new Error('Ability not loaded. Ensure abilityMiddleware is applied.')
    }
    return ability
}

/**
 * Creates middleware that checks specific permission
 *
 * Usage:
 * ```ts
 * const canManageMetaverses = createPermissionCheck('manage', 'Metaverse')
 * router.delete('/metaverses/:id', ensureAuth, withAbility, canManageMetaverses, deleteHandler)
 * ```
 */
export function createPermissionCheck(action: string, subject: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ability = getAbilityFromRequest(req)

        if (!ability) {
            res.status(500).json({ error: 'Permissions not loaded' })
            return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (ability.cannot(action as any, subject as any)) {
            res.status(403).json({
                error: 'Forbidden',
                message: `You don't have permission to ${action} ${subject}`
            })
            return
        }

        next()
    }
}

// Re-export for convenience
export { ForbiddenError }
export type { IPermissionService }
