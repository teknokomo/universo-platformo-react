import type { Request, Response, NextFunction } from 'express'
import type { DataSource, QueryRunner } from 'typeorm'
import { ensureAuth } from './ensureAuth'
import { applyRlsContext } from '../utils/rlsContext'
import type { AuthenticatedRequest } from '../services/supabaseSession'

/**
 * Extended request type with database context for RLS-enabled queries
 */
export interface RequestWithDbContext extends AuthenticatedRequest {
    dbContext?: {
        queryRunner: QueryRunner
        manager: import('typeorm').EntityManager
    }
}

/**
 * Configuration options for RLS middleware
 */
export interface EnsureAuthWithRlsOptions {
    /**
     * Function that returns the TypeORM DataSource instance
     */
    getDataSource: () => DataSource
}

/**
 * Creates middleware that ensures authentication AND propagates JWT context to PostgreSQL.
 * This enables Row Level Security (RLS) policies to work correctly with TypeORM queries.
 *
 * The middleware:
 * 1. Validates user session (via ensureAuth)
 * 2. Creates a dedicated QueryRunner for the request
 * 3. Sets PostgreSQL session variables (role, JWT claims)
 * 4. Attaches the QueryRunner's manager to req.dbContext
 * 5. Ensures cleanup on request completion
 *
 * Usage in routes:
 * ```ts
 * const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })
 * router.use('/uniks', ensureAuthWithRls, uniksRouter)
 * ```
 *
 * Accessing the RLS-enabled manager:
 * ```ts
 * const manager = (req as RequestWithDbContext).dbContext?.manager ?? dataSource.manager
 * const repo = manager.getRepository(Unik)
 * ```
 *
 * @param options - Configuration with DataSource getter
 * @returns Express middleware function
 */
export function createEnsureAuthWithRls(options: EnsureAuthWithRlsOptions) {
    const { getDataSource } = options

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // First, ensure authentication
        return ensureAuth(req, res, async () => {
            console.log('[RLS] Middleware invoked', {
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            })

            const authReq = req as AuthenticatedRequest
            const access = authReq.session?.tokens?.access

            console.log('[RLS] Session token check', {
                hasSession: !!authReq.session,
                hasTokens: !!authReq.session?.tokens,
                hasAccess: !!access,
                userId: authReq.user?.id,
                path: req.path
            })

            if (!access) {
                console.warn('[RLS] No access token found - blocking request', {
                    path: req.path,
                    userId: authReq.user?.id
                })
                res.status(401).json({ error: 'Unauthorized: Missing access token' })
                return
            }

            console.log('[RLS] Creating QueryRunner', { path: req.path })
            const ds = getDataSource()
            const runner = ds.createQueryRunner()

            // Cleanup function to release resources
            const cleanup = async () => {
                if (!runner.isReleased) {
                    try {
                        // Reset request.jwt.claims before releasing the pooled connection.
                        try {
                            console.log('[RLS] Resetting session context', { path: req.path })
                            await runner.query(`SELECT set_config('request.jwt.claims', '', false)`)
                        } catch (resetErr) {
                            console.warn('[RLS] Failed to reset session context (continuing to release)', {
                                path: req.path,
                                error: resetErr instanceof Error ? resetErr.message : String(resetErr)
                            })
                        }

                        console.log('[RLS] Releasing QueryRunner', { path: req.path })
                        await runner.release()
                    } catch (err) {
                        console.error('[RLS] Error releasing QueryRunner:', err)
                    }
                }
                delete (req as RequestWithDbContext).dbContext
            }

            // Ensure cleanup on response completion
            res.once('finish', cleanup)
            res.once('close', cleanup)

            try {
                // Connect and apply RLS context
                console.log('[RLS] Connecting QueryRunner', { path: req.path })
                await runner.connect()

                console.log('[RLS] Applying RLS context (JWT verification + SQL)', { path: req.path })
                await applyRlsContext(runner, access)

                // Attach to request
                ;(req as RequestWithDbContext).dbContext = {
                    queryRunner: runner,
                    manager: runner.manager
                }

                console.log('[RLS] ✅ Successfully applied RLS context', {
                    path: req.path,
                    userId: authReq.user?.id
                })

                next()
            } catch (error) {
                // Clean up on error
                console.error('[RLS] ❌ Failed to apply RLS context', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    path: req.path,
                    method: req.method,
                    userId: authReq.user?.id
                })
                await cleanup()
                next(error)
            }
        })
    }
}
