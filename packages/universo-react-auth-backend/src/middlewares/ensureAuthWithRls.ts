import type { Request, Response, NextFunction } from 'express'
import type { Knex } from 'knex'
import {
    convertPgBindings,
    createRlsExecutor,
    releaseKnexConnection,
    runInRlsOperationScope,
    type RlsOperationScope
} from '@universo-react/database'
import { buildSetLocalStatementTimeoutSql } from '@universo-react/utils/database'
import {
    createDbSession,
    createRequestDbContext,
    getRequestDbContext,
    isDatabaseConnectTimeoutError,
    isWhitelistedApiPath,
    type DbExecutor,
    type DbSession,
    type RequestWithDbContext as BaseRequestWithDbContext
} from '@universo-react/utils'
import { ensureAuth } from './ensureAuth'
import { applyRlsContext } from '../utils/rlsContext'
import type { AuthenticatedRequest } from '../services/supabaseSession'
import { createRlsConnectionLease } from './rlsConnectionLease'
import { installRlsResponseCommitGate } from './rlsResponseCommitGate'

const RLS_DEBUG = process.env.AUTH_RLS_DEBUG === 'true'
const REQUEST_STATEMENT_TIMEOUT_MS = 30_000

const isRetryableRlsSetupError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('current transaction is aborted') || message.includes('savepoint')
}

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
 * 6. Drains admitted work, finalizes the transaction before sending the response, then releases the pinned connection
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
            logRlsDebug('[RLS] Whitelisted request - skipping auth/RLS', { method: req.method })
            next()
            return
        }

        // First, ensure authentication
        return ensureAuth(req, res, async () => {
            logRlsDebug('[RLS] Middleware invoked', {
                method: req.method,
                timestamp: new Date().toISOString()
            })

            // Prevent creating multiple request-scoped DB sessions when the middleware
            // is applied at multiple router levels.
            const existingContext = getRequestDbContext(req)
            if (existingContext && !existingContext.isReleased()) {
                logRlsDebug('[RLS] Context already exists, reusing existing request DB session', {
                    method: req.method
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
                hasUserId: typeof authReq.user?.id === 'string' && authReq.user.id.length > 0,
                method: req.method
            })

            if (!access) {
                console.warn('[RLS] No access token found - blocking request', { method: req.method })
                res.status(401).json({ error: 'Unauthorized: Missing access token' })
                return
            }

            const knex = getKnex()
            logRlsDebug('[RLS] Acquiring pinned connection', { method: req.method })

            let connection: unknown = null
            const connectionLease = createRlsConnectionLease()
            let transactionFinalized = false
            let setupInProgress = true
            let requestContextReady = false
            let requestOperationScope: RlsOperationScope | undefined
            let pendingCleanupMode: 'commit' | 'rollback' | null = null
            let responseFinished = false
            let cleanupPromise: Promise<void> | null = null
            let requestTransactionAborted = false
            let requestTransactionFailure: unknown
            let drainRequestScope: (() => Promise<Array<{ reason: unknown }>>) | undefined

            const markRequestTransactionAborted = (error: unknown) => {
                if (requestTransactionAborted) return
                requestTransactionAborted = true
                requestTransactionFailure = error
            }

            const runWithConnectionLease = <T>(operation: () => Promise<T>): Promise<T> => connectionLease.run(operation)

            const releasePinnedConnection = async (pinnedConnection: unknown, discard = false): Promise<void> => {
                await releaseKnexConnection(knex, pinnedConnection, { discard })
            }

            const cleanup = async (mode: 'commit' | 'rollback') => {
                if (cleanupPromise) {
                    if (mode === 'rollback' && !transactionFinalized) pendingCleanupMode = 'rollback'
                    return cleanupPromise
                }
                if (connectionLease.isClosed()) return
                if (setupInProgress) {
                    if (pendingCleanupMode !== 'rollback') pendingCleanupMode = mode
                    return
                }

                cleanupPromise = (async () => {
                    logRlsDebug('[RLS] Starting request transaction cleanup', { method: req.method, mode })
                    // Stop scope admission before closing the connection lease, so no transaction
                    // can be registered in the gap and later fail only because its lease was closed.
                    requestOperationScope?.closeAdmission()
                    logRlsDebug('[RLS] Draining request connection lease', { method: req.method })
                    await connectionLease.close()
                    logRlsDebug('[RLS] Request connection lease drained', { method: req.method })
                    connectionLease.release()
                    const scopeFailures = requestOperationScope
                        ? await requestOperationScope.closeAndDrain()
                        : (await drainRequestScope?.()) ?? []
                    logRlsDebug('[RLS] Request operation scope drained', {
                        method: req.method,
                        failureCount: scopeFailures.length
                    })
                    if (scopeFailures.length > 0) markRequestTransactionAborted(scopeFailures[0].reason)
                    const responseRollbackRequested = mode === 'rollback' || pendingCleanupMode === 'rollback'
                    const finalizationMode: 'commit' | 'rollback' =
                        requestTransactionAborted || responseRollbackRequested ? 'rollback' : mode
                    let finalizationFailed = false
                    let finalizationError: unknown
                    let discardConnection = false

                    if (connection) {
                        try {
                            if (!transactionFinalized) {
                                logRlsDebug('[RLS] Finalizing outer request transaction', {
                                    method: req.method,
                                    mode: finalizationMode
                                })
                                if (finalizationMode === 'commit') {
                                    logRlsDebug('[RLS] Committing request transaction', { method: req.method })
                                    await knex.raw('COMMIT').connection(connection)
                                } else {
                                    logRlsDebug('[RLS] Rolling back request transaction', { method: req.method })
                                    await knex.raw('ROLLBACK').connection(connection)
                                }
                                transactionFinalized = true
                            }
                        } catch (transactionError) {
                            finalizationFailed = true
                            finalizationError = transactionError
                            if (finalizationMode === 'commit') {
                                console.warn('[RLS] COMMIT failed, attempting ROLLBACK', {
                                    method: req.method,
                                    errorType: transactionError instanceof Error ? transactionError.name : typeof transactionError
                                })
                                try {
                                    await knex.raw('ROLLBACK').connection(connection)
                                    transactionFinalized = true
                                } catch (rollbackError) {
                                    // The failed COMMIT and failed fallback ROLLBACK leave transaction
                                    // state unknown, so this connection must never re-enter the pool.
                                    discardConnection = true
                                    console.error('[RLS] Fallback ROLLBACK failed; discarding connection', {
                                        method: req.method,
                                        errorType: rollbackError instanceof Error ? rollbackError.name : typeof rollbackError
                                    })
                                }
                            } else {
                                console.error('[RLS] ROLLBACK failed', {
                                    method: req.method,
                                    errorType: transactionError instanceof Error ? transactionError.name : typeof transactionError
                                })
                                discardConnection = true
                            }
                        }
                        try {
                            logRlsDebug('[RLS] Releasing pinned connection', { method: req.method })
                            await releasePinnedConnection(connection, discardConnection)
                        } catch (err) {
                            console.error('[RLS] Error releasing connection', {
                                method: req.method,
                                errorType: err instanceof Error ? err.name : typeof err
                            })
                        }
                        connection = null
                    }
                    delete (req as RequestWithDbContext).dbContext
                    if (finalizationFailed) throw finalizationError ?? new Error('RLS request transaction finalization failed')
                    if (requestTransactionAborted && !responseRollbackRequested) {
                        throw requestTransactionFailure ?? new Error('RLS request transaction was aborted')
                    }
                })()
                return cleanupPromise
            }

            const scheduleCleanup = (mode: 'commit' | 'rollback') => {
                void cleanup(mode).catch((cleanupError) => {
                    console.error('[RLS] Error during cleanup', {
                        errorType: cleanupError instanceof Error ? cleanupError.name : typeof cleanupError
                    })
                })
            }

            installRlsResponseCommitGate(res, cleanup, (error) => {
                console.error('[RLS] Could not finalize transaction before sending response', {
                    errorType: error instanceof Error ? error.name : typeof error,
                    method: req.method
                })
            })

            // The response gate commits or rolls back before res.end sends bytes. A close without
            // finish means the client aborted the request before the response was complete.
            res.once('finish', () => {
                responseFinished = true
                scheduleCleanup('commit')
            })
            res.once('close', () => {
                scheduleCleanup(responseFinished ? 'commit' : 'rollback')
            })

            try {
                let session: DbSession | null = null
                let executor: DbExecutor | null = null

                for (let attempt = 1; attempt <= 2; attempt += 1) {
                    // Acquire a dedicated connection from the pool
                    connection = await knex.client.acquireConnection()

                    try {
                        // Defensive reset: pooled connections must start from a clean transaction state.
                        // If a previous request returned the connection after an aborted transaction,
                        // PostgreSQL will keep rejecting commands until a rollback clears the session.
                        try {
                            await knex.raw('ROLLBACK').connection(connection)
                        } catch (resetError) {
                            // A failed reset leaves transaction-local state unknown. Discard this
                            // connection and retry on a fresh one; never issue BEGIN on it.
                            try {
                                await releasePinnedConnection(connection, true)
                            } catch {
                                /* best-effort release of a discarded connection */
                            }
                            connection = null
                            if (attempt === 2) throw resetError
                            continue
                        }

                        // Begin a request-level transaction — JWT claims will be transaction-local.
                        // This guarantees claims auto-disappear on COMMIT/ROLLBACK, preventing leaks.
                        await knex.raw('BEGIN').connection(connection)
                        await knex.raw(buildSetLocalStatementTimeoutSql(REQUEST_STATEMENT_TIMEOUT_MS)).connection(connection)

                        session = createDbSession({
                            query: <T = unknown>(sql: string, parameters?: unknown[]) =>
                                runWithConnectionLease(() => {
                                    const runQuery = async () => {
                                        const { sql: knexSql, bindings } = convertPgBindings(sql, parameters)
                                        try {
                                            const result = await knex.raw(knexSql, bindings as Knex.RawBinding[]).connection(connection)
                                            return (result.rows ?? result) as T[]
                                        } catch (error) {
                                            if (requestContextReady && !requestOperationScope) markRequestTransactionAborted(error)
                                            throw error
                                        }
                                    }
                                    return requestOperationScope ? runInRlsOperationScope(requestOperationScope, runQuery) : runQuery()
                                }),
                            isReleased: () => connectionLease.isClosed()
                        })

                        logRlsDebug('[RLS] Applying RLS context (JWT verification + SQL)', { method: req.method, attempt })
                        await applyRlsContext(session, access)

                        // Create an RLS executor — all queries AND transactions stay on
                        // the same pinned connection where set_config was called.
                        // inTransaction: true means top-level transaction() reuses the
                        // middleware-owned request transaction directly.
                        executor = createRlsExecutor(knex, connection, {
                            inTransaction: true,
                            isConnectionUnavailable: () => connectionLease.isClosed(),
                            runWithConnectionLease,
                            onOuterTransactionFailure: markRequestTransactionAborted,
                            onRequestScopeCreated: (scope) => {
                                requestOperationScope = scope
                                drainRequestScope = scope.closeAndDrain
                            }
                        })
                        break
                    } catch (error) {
                        const shouldRetry = attempt < 2 && isRetryableRlsSetupError(error)
                        console.warn('[RLS] Setup attempt failed', {
                            method: req.method,
                            attempt,
                            retrying: shouldRetry,
                            errorType: error instanceof Error ? error.name : typeof error
                        })

                        if (connection) {
                            let discardConnection = false
                            try {
                                await knex.raw('ROLLBACK').connection(connection)
                            } catch {
                                discardConnection = true
                            }
                            try {
                                await releasePinnedConnection(connection, discardConnection)
                            } catch {
                                /* best-effort release */
                            }
                            connection = null
                        }

                        if (!shouldRetry) {
                            throw error
                        }
                    }
                }

                if (!session || !executor) {
                    throw new Error('Failed to initialize request RLS context')
                }

                // Attach the neutral request-scoped context
                ;(req as RequestWithDbContext).dbContext = createRequestDbContext(session, executor)
                setupInProgress = false
                requestContextReady = true

                logRlsDebug('[RLS] ✅ Successfully applied RLS context', {
                    method: req.method
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
                    errorType: error instanceof Error ? error.name : typeof error,
                    method: req.method
                })
                // ROLLBACK before releasing — setup failed, no data to commit
                if (connection) {
                    let rollbackSucceeded = false
                    try {
                        await knex.raw('ROLLBACK').connection(connection)
                        rollbackSucceeded = true
                    } catch {
                        /* best-effort */
                    }
                    transactionFinalized = rollbackSucceeded
                    try {
                        await releasePinnedConnection(connection, !rollbackSucceeded)
                    } catch {
                        /* best-effort release after setup failure */
                    }
                    connection = null
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
