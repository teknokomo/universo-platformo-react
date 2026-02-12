import type { Request, Response, NextFunction } from 'express'
import type { DataSource, QueryRunner } from 'typeorm'
import { isDatabaseConnectTimeoutError, isWhitelistedApiPath } from '@universo/utils'
import { ensureAuth } from './ensureAuth'
import { applyRlsContext } from '../utils/rlsContext'
import type { AuthenticatedRequest } from '../services/supabaseSession'

const RLS_DEBUG = process.env.AUTH_RLS_DEBUG === 'true'

const logRlsDebug = (message: string, payload?: unknown): void => {
    if (!RLS_DEBUG) return
    if (payload !== undefined) {
        console.log(message, payload)
        return
    }
    console.log(message)
}

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
        const requestPath = (req.originalUrl || req.url || req.path).split('?')[0]

        // Public endpoints must remain accessible without authentication.
        // This middleware wraps ensureAuth and would otherwise return 401 before the core whitelist is applied.
        if (isWhitelistedApiPath(requestPath)) {
            logRlsDebug('[RLS] Whitelisted request - skipping auth/RLS', {
                originalUrl: req.originalUrl,
                path: req.path,
                method: req.method
            })
            next()
            return
        }

        // First, ensure authentication
        return ensureAuth(req, res, async () => {
            logRlsDebug('[RLS] Middleware invoked', {
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            })

            // IMPORTANT: Check if RLS context already exists on this request.
            // This prevents creating multiple QueryRunners when the middleware
            // is applied at multiple router levels (e.g., parent + child routers).
            const existingContext = (req as RequestWithDbContext).dbContext
            if (existingContext?.queryRunner && !existingContext.queryRunner.isReleased) {
                logRlsDebug('[RLS] Context already exists, reusing existing QueryRunner', {
                    path: req.path
                })
                next()
                return
            }

            const authReq = req as AuthenticatedRequest
            const access = authReq.session?.tokens?.access

            logRlsDebug('[RLS] Session token check', {
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

            logRlsDebug('[RLS] Creating QueryRunner', { path: req.path })
            const ds = getDataSource()
            const runner = ds.createQueryRunner()

            let cleanupStarted = false
            let runnerConnected = false

            // Cleanup function to release resources
            const cleanup = async () => {
                if (cleanupStarted) return
                cleanupStarted = true

                if (!runner.isReleased) {
                    try {
                        // Reset request.jwt.claims before releasing the pooled connection.
                        if (runnerConnected) {
                            try {
                                logRlsDebug('[RLS] Resetting session context', { path: req.path })
                                await runner.query(`SELECT set_config('request.jwt.claims', '', false)`)
                            } catch (resetErr) {
                                console.warn('[RLS] Failed to reset session context (continuing to release)', {
                                    path: req.path,
                                    error: resetErr instanceof Error ? resetErr.message : String(resetErr)
                                })
                            }
                        }

                        logRlsDebug('[RLS] Releasing QueryRunner', { path: req.path })
                        await runner.release()
                        runnerConnected = false
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
                logRlsDebug('[RLS] Connecting QueryRunner', { path: req.path })
                await runner.connect()
                runnerConnected = true

                logRlsDebug('[RLS] Applying RLS context (JWT verification + SQL)', { path: req.path })
                await applyRlsContext(runner, access)

                // Attach to request
                ;(req as RequestWithDbContext).dbContext = {
                    queryRunner: runner,
                    manager: runner.manager
                }

                logRlsDebug('[RLS] ✅ Successfully applied RLS context', {
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
                if (isDatabaseConnectTimeoutError(error)) {
                    const wrapped = new Error('Database connection timeout while applying RLS context') as Error & {
                        statusCode?: number
                        code?: string
                    }
                    wrapped.statusCode = 503
                    wrapped.code = 'DB_CONNECTION_TIMEOUT'
                    next(wrapped)
                    return
                }
                next(error)
            }
        })
    }
}
