import crypto from 'crypto'
import express from 'express'
import { Request, Response, NextFunction, type RequestHandler } from 'express'
import path from 'path'
import cors from 'cors'
import http from 'http'
import session from 'express-session'
import { createCsrfProtection } from './middlewares/csrf'
import rateLimit from 'express-rate-limit'
const cookieParser = require('cookie-parser')
import { getNodeModulesPackagePath } from './utils'
import logger, { expressRequestLogger } from './utils/logger'
import { sanitizeMiddleware, getCorsOptions, getAllowedIframeOrigins } from './utils/XSS'
import apiV1Router from './routes'
import {
    passport,
    createAuthRouter,
    assertSupabaseJwtVerificationConfig,
    verifySupabaseJwt,
    type VerifiedSupabaseJwtClaims
} from '@universo/auth-backend'
import { createGlobalAccessService } from '@universo/admin-backend'
import { initializeRateLimiters as initializeMetahubsRateLimiters, seedTemplates } from '@universo/metahubs-backend'
import { getKnex, destroyKnex, checkDatabaseHealth, registerGracefulShutdown, getPoolExecutor } from '@universo/database'
import { initializeRateLimiters as initializeApplicationsRateLimiters } from '@universo/applications-backend'
import { assertIsolatedVmRuntimeAvailable } from '@universo/scripting-engine'
import {
    ensureRegisteredSystemAppSchemaGenerationPlans,
    bootstrapRegisteredSystemAppStructureMetadata,
    inspectLegacyFixedSchemaTables,
    inspectRegisteredSystemAppStructureMetadata,
    runRegisteredPlatformPostSchemaMigrations,
    runRegisteredPlatformPreludeMigrations,
    syncRegisteredPlatformDefinitionsToCatalog,
    validateRegisteredPlatformMigrations,
    validateRegisteredSystemAppDefinitions,
    validateRegisteredSystemAppSchemaGenerationPlans,
    validateRegisteredSystemAppCompiledDefinitions
} from '@universo/migrations-platform'
import { initializeRateLimiters as initializeStartRateLimiters } from '@universo/start-backend'
import errorHandlerMiddleware from './middlewares/errors'
import { API_WHITELIST_URLS, isGlobalMigrationCatalogEnabled, parsePositiveInt, resolveRateLimitKey } from '@universo/utils'
import 'global-agent/bootstrap'
import { bootstrapStartupSuperuser } from './bootstrap/bootstrapSuperuser'
import { executeStartupFullReset } from './bootstrap/startupReset'
import { createSupabaseAdminClient } from './utils/supabaseAdmin'

const parseSameSite = (value?: string): boolean | 'lax' | 'strict' | 'none' => {
    if (!value) return 'lax'
    const normalized = value.toLowerCase()
    if (['lax', 'strict', 'none'].includes(normalized)) return normalized as 'lax' | 'strict' | 'none'
    if (['true', 'false'].includes(normalized)) return normalized === 'true'
    return 'lax'
}

interface SessionTokens {
    access?: string
}

type SessionWithTokens = session.Session &
    Partial<session.SessionData> & {
        tokens?: SessionTokens
    }

type VerifiedJwtClaims = VerifiedSupabaseJwtClaims & {
    user_id?: string
    uid?: string
}

type AuthenticatedRequest = Request & {
    user?: VerifiedJwtClaims & { id?: string }
}

export class App {
    app: express.Application

    constructor() {
        this.app = express()
    }

    async initDatabase() {
        try {
            const forceReset = process.env._FORCE_DATABASE_RESET === 'true'
            await executeStartupFullReset(forceReset ? { force: true } : undefined)

            logger.info('📦 [server]: Knex is initializing...')
            await assertIsolatedVmRuntimeAvailable()
            logger.info('[server]: Scripting runtime compatibility verified')
            const globalMigrationCatalogEnabled = isGlobalMigrationCatalogEnabled()

            const validation = validateRegisteredPlatformMigrations()
            if (!validation.ok) {
                throw new Error(validation.issues.map((issue: { message: string }) => issue.message).join('; '))
            }

            const systemAppDefinitionsValidation = validateRegisteredSystemAppDefinitions()
            if (!systemAppDefinitionsValidation.ok) {
                throw new Error(systemAppDefinitionsValidation.issues.map((issue: { message: string }) => issue.message).join('; '))
            }

            const systemAppSchemaGenerationPlansValidation = validateRegisteredSystemAppSchemaGenerationPlans()
            if (!systemAppSchemaGenerationPlansValidation.ok) {
                throw new Error(systemAppSchemaGenerationPlansValidation.issues.join('; '))
            }

            const systemAppCompiledDefinitionsValidation = validateRegisteredSystemAppCompiledDefinitions()
            if (!systemAppCompiledDefinitionsValidation.ok) {
                throw new Error(systemAppCompiledDefinitionsValidation.issues.join('; '))
            }

            const preludeMigrationResult = await runRegisteredPlatformPreludeMigrations(getKnex(), {
                info(message: string, meta?: Record<string, unknown>) {
                    logger.info(message, meta)
                },
                warn(message: string, meta?: Record<string, unknown>) {
                    logger.warn(message, meta)
                },
                error(message: string, meta?: Record<string, unknown>) {
                    logger.error(message, meta)
                }
            })
            logger.info('[server]: Platform prelude migrations completed', preludeMigrationResult)

            const ensuredSystemAppSchemasResult = await ensureRegisteredSystemAppSchemaGenerationPlans(getKnex(), {
                stage: 'target'
            })
            logger.info('[server]: Fixed system app schema generation ensured', ensuredSystemAppSchemasResult)

            const postSchemaMigrationResult = await runRegisteredPlatformPostSchemaMigrations(getKnex(), {
                info(message: string, meta?: Record<string, unknown>) {
                    logger.info(message, meta)
                },
                warn(message: string, meta?: Record<string, unknown>) {
                    logger.warn(message, meta)
                },
                error(message: string, meta?: Record<string, unknown>) {
                    logger.error(message, meta)
                }
            })
            logger.info('[server]: Platform post-schema migrations completed', postSchemaMigrationResult)

            const systemAppStructureBootstrapResult = await bootstrapRegisteredSystemAppStructureMetadata(getKnex(), {
                stage: 'target'
            })
            logger.info('[server]: Fixed system app structure metadata synchronized', systemAppStructureBootstrapResult)

            const legacyFixedSchemaTables = await inspectLegacyFixedSchemaTables(getKnex())
            if (!legacyFixedSchemaTables.ok) {
                throw new Error(`Legacy fixed schema tables remain after bootstrap: ${legacyFixedSchemaTables.issues.join('; ')}`)
            }

            const systemAppStructureMetadataInspection = await inspectRegisteredSystemAppStructureMetadata(getKnex())
            if (!systemAppStructureMetadataInspection.ok) {
                throw new Error(
                    `Fixed system app structure metadata inspection failed: ${systemAppStructureMetadataInspection.issues.join('; ')}`
                )
            }

            if (globalMigrationCatalogEnabled) {
                const definitionSyncResult = await syncRegisteredPlatformDefinitionsToCatalog(getKnex(), {
                    source: 'core-backend-initDatabase'
                })
                logger.info('[server]: Registered platform definitions synchronized to catalog', definitionSyncResult)
            } else {
                logger.info('[server]: Global migration catalog is disabled; skipping catalog definition sync')
            }

            await seedTemplates(getPoolExecutor(), {
                logger: {
                    info(message: string, ...meta: unknown[]) {
                        logger.info(message, meta.length > 0 ? { meta } : undefined)
                    },
                    error(message: string, ...meta: unknown[]) {
                        logger.error(message, meta.length > 0 ? { meta } : undefined)
                    }
                }
            })

            await bootstrapStartupSuperuser()

            logger.info('📦 [server]: Database has been initialized!')
        } catch (error) {
            logger.error('❌ [server]: Error during database initialization:', error)
            try {
                await destroyKnex()
            } catch (cleanupError) {
                logger.warn('[server]: Failed to destroy Knex after initialization error', {
                    error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                })
            }
            throw error
        }
    }

    async config() {
        try {
            assertSupabaseJwtVerificationConfig()
        } catch (error) {
            logger.error('❌ [auth] Supabase JWT verification is not configured correctly', {
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
        }

        // Limit is needed to allow sending/receiving base64 encoded string
        const fileSizeLimit = process.env.FILE_SIZE_LIMIT || '50mb'
        this.app.use(express.json({ limit: fileSizeLimit }))
        this.app.use(express.urlencoded({ limit: fileSizeLimit, extended: true }))
        if (process.env.NUMBER_OF_PROXIES && parseInt(process.env.NUMBER_OF_PROXIES) > 0)
            this.app.set('trust proxy', parseInt(process.env.NUMBER_OF_PROXIES))

        // Cookie-parser middleware (needed for refresh tokens)
        this.app.use(cookieParser() as RequestHandler)

        let resolvedSessionSecret = process.env.SESSION_SECRET

        if (!resolvedSessionSecret) {
            if (process.env.NODE_ENV === 'development') {
                logger.warn('⚠️ [auth] SESSION_SECRET is not set. Using auto-generated ephemeral secret for development.')
                resolvedSessionSecret = crypto.randomBytes(32).toString('hex')
            } else {
                logger.error('❌ [auth] SESSION_SECRET is not configured. It is required for all environments except development.')
                throw new Error('Auth configuration error: SESSION_SECRET is required.')
            }
        }

        const sessionMaxAge = Number(process.env.SESSION_COOKIE_MAXAGE ?? 1000 * 60 * 60 * 24 * 7)
        const cookieConfig: session.CookieOptions = {
            httpOnly: true,
            sameSite: parseSameSite(process.env.SESSION_COOKIE_SAMESITE),
            secure: process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
            maxAge: Number.isFinite(sessionMaxAge) ? sessionMaxAge : 1000 * 60 * 60 * 24 * 7
        }

        if (cookieConfig.sameSite === 'none') {
            cookieConfig.secure = true
        }

        if (process.env.SESSION_COOKIE_PARTITIONED === 'true') {
            ;(cookieConfig as session.CookieOptions & { partitioned?: boolean }).partitioned = true
        }

        this.app.use(
            session({
                name: process.env.SESSION_COOKIE_NAME ?? 'up.session',
                secret: resolvedSessionSecret,
                resave: false,
                saveUninitialized: false,
                cookie: cookieConfig
            })
        )

        this.app.use(passport.initialize())
        this.app.use(passport.session())

        const csrfProtection = createCsrfProtection()
        const loginRateLimitWindowMs = parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 60_000)
        const loginRateLimitMax = parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10)

        const loginLimiter = rateLimit({
            windowMs: loginRateLimitWindowMs,
            max: loginRateLimitMax,
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: resolveRateLimitKey
        })
        const globalAccessService = createGlobalAccessService({ getDbExecutor: getPoolExecutor })
        const supabaseAdmin =
            process.env.SUPABASE_URL && process.env.SERVICE_ROLE_KEY
                ? createSupabaseAdminClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY)
                : undefined

        // Allow access from specified domains
        this.app.use(cors(getCorsOptions()))

        // Allow embedding from specified domains
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const allowedOrigins = getAllowedIframeOrigins()
            if (allowedOrigins === '*') {
                next()
            } else {
                const csp = `frame-ancestors ${allowedOrigins}`
                res.setHeader('Content-Security-Policy', csp)
                next()
            }
        })

        // Switch off the default 'X-Powered-By: Express' header
        this.app.disable('x-powered-by')

        // Add the expressRequestLogger middleware to log all requests
        this.app.use(expressRequestLogger)

        // Add the sanitizeMiddleware to guard against XSS
        this.app.use(sanitizeMiddleware)

        // Auth routes (login, logout, CSRF, refresh, etc.)
        this.app.use(
            '/api/v1/auth',
            createAuthRouter(csrfProtection, loginLimiter, {
                getDbExecutor: getPoolExecutor,
                assignSystemRole: globalAccessService.assignSystemRole,
                deleteAuthUser: supabaseAdmin
                    ? async (userId: string) => {
                          const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
                          if (error) {
                              throw error
                          }
                      }
                    : undefined
            })
        )

        // Health check endpoint (no auth required)
        this.app.get('/api/v1/health/db', async (_req: Request, res: Response) => {
            const health = await checkDatabaseHealth()
            res.status(health.connected ? 200 : 503).json(health)
        })

        const whitelistURLs = API_WHITELIST_URLS
        const urlCaseInsensitiveRegex = /\/api\/v1\//i
        const urlCaseSensitiveRegex = /\/api\/v1\//

        // ═══════════════════════════════════════════════════════════════
        // JWT Authentication Middleware (Supabase)
        // ═══════════════════════════════════════════════════════════════
        this.app.use('/api/v1', async (req: Request, res: Response, next: NextFunction) => {
            // If the path does not contain /api/v1, skip
            if (!urlCaseInsensitiveRegex.test(req.path)) {
                return next()
            }
            // If the path case doesn't match, reject
            if (!urlCaseSensitiveRegex.test(req.path)) {
                return res.status(401).json({ error: 'Unauthorized Access' })
            }
            // If URL in whitelist, skip
            const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url))
            if (isWhitelisted) {
                return next()
            }

            // Try session-based auth first
            const sessionTokens = (req.session as SessionWithTokens | undefined)?.tokens
            const sessionAccessToken = sessionTokens?.access ?? null
            const hasSession = Boolean(req.isAuthenticated?.() && sessionAccessToken)
            if (hasSession) {
                req.headers.authorization = `Bearer ${sessionAccessToken}`
            }

            const headerValue = req.headers['authorization'] || req.headers['Authorization']
            const hasBearerToken = typeof headerValue === 'string' && headerValue.startsWith('Bearer ')
            const bearerToken = hasBearerToken ? headerValue.substring(7) : null
            const tokenToVerify = bearerToken ?? (hasSession ? sessionAccessToken : null)

            if (!tokenToVerify) {
                return res.status(401).json({ error: 'Unauthorized Access: Missing token' })
            }

            try {
                const { payload } = await verifySupabaseJwt(tokenToVerify)
                const decoded: VerifiedJwtClaims = payload
                const supabaseUserId = decoded.sub || decoded.user_id || decoded.uid || null
                const authenticatedRequest = req as AuthenticatedRequest
                if (supabaseUserId) {
                    authenticatedRequest.user = { id: supabaseUserId, ...decoded }
                } else {
                    authenticatedRequest.user = decoded
                }
                return next()
            } catch (error) {
                logger.warn('[auth] JWT verification error', error as Error)
                if (error instanceof Error && error.message.startsWith('Auth configuration error:')) {
                    return res.status(500).json({ error: 'Server auth configuration error' })
                }
                return res.status(401).json({ error: 'Unauthorized Access: Invalid or expired token' })
            }
        })

        // Initialize rate limiters for services
        await initializeMetahubsRateLimiters()
        await initializeApplicationsRateLimiters()
        await initializeStartRateLimiters()

        // Mount API v1 routes (CSRF protection applied globally — skips GET/HEAD/OPTIONS)
        this.app.use('/api/v1', csrfProtection, apiV1Router)

        // ═══════════════════════════════════════════════════════════════
        // Serve UI static files
        // ═══════════════════════════════════════════════════════════════
        const packagePath = getNodeModulesPackagePath('@universo/core-frontend')
        const uiBuildPath = path.join(packagePath, 'build')
        const uiHtmlPath = path.join(packagePath, 'build', 'index.html')

        this.app.use('/', express.static(uiBuildPath))

        // All other requests not handled will return React app (SPA fallback)
        this.app.use((req: Request, res: Response) => {
            res.sendFile(uiHtmlPath)
        })

        // Error handling
        this.app.use(errorHandlerMiddleware)
    }

    async stopApp() {
        // Reserved for future cleanup tasks
    }
}

let serverApp: App | undefined

export async function start(): Promise<void> {
    serverApp = new App()

    registerGracefulShutdown()

    const host = process.env.HOST
    const port = parseInt(process.env.PORT || '', 10) || 3000
    const server = http.createServer(serverApp.app)

    await serverApp.initDatabase()
    await serverApp.config()

    server.listen(port, host, () => {
        logger.info(`⚡️ [server]: Universo Platformo is listening at ${host ? 'http://' + host : ''}:${port}`)
    })
}

export function getInstance(): App | undefined {
    return serverApp
}
