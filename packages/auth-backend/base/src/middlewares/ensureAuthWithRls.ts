import type { Request, Response, NextFunction } from 'express'
import type { Knex } from 'knex'
import { convertPgBindings, createRlsExecutor } from '@universo/database'
import { buildSetLocalStatementTimeoutSql } from '@universo/utils/database'
import {
    createDbSession,
    createRequestDbContext,
    getRequestDbContext,
    isDatabaseConnectTimeoutError,
    isWhitelistedApiPath,
    type RequestWithDbContext as BaseRequestWithDbContext
} from '@universo/utils'
import { ensureAuth } from './ensureAuth'
import { applyRlsContext } from '../utils/rlsContext'
import type { AuthenticatedRequest } from '../services/supabaseSession'

const RLS_DEBUG = process.env.AUTH_RLS_DEBUG === 'true'
const REQUEST_STATEMENT_TIMEOUT_MS = 30_000

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
export type RequestWithDbContext = AuthenticatedRequest & BaseRequestWithDbContext

/**
 * Configuration options for RLS middleware
 */
export interface EnsureAuthWithRlsOptions {
    getKnex: () => Knex
}

/**
 * Creates middleware that ensures authentication AND propagates JWT context to PostgreSQL.
 * This enables Row Level Security (RLS) policies to work correctly with Knex queries.
 *
 * The middleware:
 * 1. Validates user session (via ensureAuth)
 * 2. Acquires a dedicated pool connection and pins it for the request
 * 3. Sets PostgreSQL session variables (role, JWT claims) on the pinned connection
 * 4. Creates an RLS executor that routes all queries through the pinned connection
 * 5. Attaches the request-scoped DbSession/DbExecutor to req.dbContext
 * 6. Ensures cleanup (reset claims + release connection) on response completion
 *
 * @param options - Configuration with Knex getter
 * @returns Express middleware function
 */
export function createEnsureAuthWithRls(options: EnsureAuthWithRlsOptions) {
    const { getKnex } = options

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestPath = (req.originalUrl || req.url || req.path).split('?')[0]

        // Public endpoints must remain accessible without authentication.
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

            // Prevent creating multiple request-scoped DB sessions when the middleware
            // is applied at multiple router levels.
            const existingContext = getRequestDbContext(req)
            if (existingContext && !existingContext.isReleased()) {
                logRlsDebug('[RLS] Context already exists, reusing existing request DB session', {
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

            const knex = getKnex()
            logRlsDebug('[RLS] Acquiring pinned connection', { path: req.path })

            let connection: unknown = null
            let released = false
            let transactionFinalized = false
            let setupInProgress = true
            let pendingCleanupMode: 'commit' | 'rollback' | null = null
            let responseFinished = false

            const cleanup = async (mode: 'commit' | 'rollback') => {
                if (released) return
                if (setupInProgress) {
                    pendingCleanupMode = mode
                    return
                }

                released = true

                if (connection) {
                    try {
                        if (!transactionFinalized) {
                            if (mode === 'commit') {
                                logRlsDebug('[RLS] Committing request transaction', { path: req.path })
                                await knex.raw('COMMIT').connection(connection)
                            } else {
                                logRlsDebug('[RLS] Rolling back request transaction', { path: req.path })
                                await knex.raw('ROLLBACK').connection(connection)
                            }
                            transactionFinalized = true
                        }
                    } catch (transactionError) {
                        if (mode === 'commit') {
                            console.warn('[RLS] COMMIT failed, attempting ROLLBACK', {
                                path: req.path,
                                error: transactionError instanceof Error ? transactionError.message : String(transactionError)
                            })
                            try {
                                await knex.raw('ROLLBACK').connection(connection)
                                transactionFinalized = true
                            } catch {
                                /* best-effort rollback */
                            }
                        }
                    }
                    try {
                        logRlsDebug('[RLS] Releasing pinned connection', { path: req.path })
                        knex.client.releaseConnection(connection)
                    } catch (err) {
                        console.error('[RLS] Error releasing connection:', err)
                    }
                    connection = null
                }
                delete (req as RequestWithDbContext).dbContext
            }

            const scheduleCleanup = (mode: 'commit' | 'rollback') => {
                void cleanup(mode).catch((cleanupError) => {
                    console.error('[RLS] Error during cleanup', cleanupError)
                })
            }

            // Ensure cleanup on response completion. finish means the response was fully sent,
            // while close without finish means the request was aborted and must be rolled back.
            res.once('finish', () => {
                responseFinished = true
                scheduleCleanup('commit')
            })
            res.once('close', () => {
                scheduleCleanup(responseFinished ? 'commit' : 'rollback')
            })

            try {
                // Acquire a dedicated connection from the pool
                connection = await knex.client.acquireConnection()

                // Begin a request-level transaction — JWT claims will be transaction-local.
                // This guarantees claims auto-disappear on COMMIT/ROLLBACK, preventing leaks.
                await knex.raw('BEGIN').connection(connection)
                await knex.raw(buildSetLocalStatementTimeoutSql(REQUEST_STATEMENT_TIMEOUT_MS)).connection(connection)

                const session = createDbSession({
                    query: <T = unknown>(sql: string, parameters?: unknown[]) => {
                        if (released) throw new Error('RLS session already released')
                        const { sql: knexSql, bindings } = convertPgBindings(sql, parameters)
                        return knex
                            .raw(knexSql, bindings as Knex.RawBinding[])
                            .connection(connection)
                            .then((result: any) => (result.rows ?? result) as T[])
                    },
                    isReleased: () => released
                })

                logRlsDebug('[RLS] Applying RLS context (JWT verification + SQL)', { path: req.path })
                await applyRlsContext(session, access)

                // Create an RLS executor — all queries AND transactions stay on
                // the same pinned connection where set_config was called.
                // inTransaction: true means top-level transaction() calls use SAVEPOINT.
                const executor = createRlsExecutor(knex, connection, { inTransaction: true })

                // Attach the neutral request-scoped context
                ;(req as RequestWithDbContext).dbContext = createRequestDbContext(session, executor)
                setupInProgress = false

                logRlsDebug('[RLS] ✅ Successfully applied RLS context', {
                    path: req.path,
                    userId: authReq.user?.id
                })

                if (pendingCleanupMode) {
                    const mode = pendingCleanupMode
                    pendingCleanupMode = null
                    await cleanup(mode)
                    return
                }

                next()
            } catch (error) {
                setupInProgress = false
                console.error('[RLS] ❌ Failed to apply RLS context', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    path: req.path,
                    method: req.method,
                    userId: authReq.user?.id
                })
                // ROLLBACK before releasing — setup failed, no data to commit
                if (connection) {
                    try {
                        await knex.raw('ROLLBACK').connection(connection)
                    } catch {
                        /* best-effort */
                    }
                    transactionFinalized = true
                }
                await cleanup('rollback')
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
