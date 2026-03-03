import express from 'express'
import { Request, Response, NextFunction } from 'express'
import path from 'path'
import cors from 'cors'
import http from 'http'
import session from 'express-session'
import csurf from 'csurf'
import rateLimit from 'express-rate-limit'
const cookieParser = require('cookie-parser')
import jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'
import { getNodeModulesPackagePath } from './utils'
import logger, { expressRequestLogger } from './utils/logger'
import { getDataSource } from './DataSource'
import { Telemetry } from './utils/telemetry'
import { sanitizeMiddleware, getCorsOptions, getAllowedIframeOrigins } from './utils/XSS'
import flowiseApiV1Router from './routes'
import { passport, createAuthRouter } from '@universo/auth-backend'
import {
    initializeRateLimiters as initializeMetahubsRateLimiters,
    seedTemplates as seedMetahubTemplates
} from '@universo/metahubs-backend'
import { initializeRateLimiters as initializeApplicationsRateLimiters } from '@universo/applications-backend'
import { initializeRateLimiters as initializeStartRateLimiters } from '@universo/start-backend'
import errorHandlerMiddleware from './middlewares/errors'
import { API_WHITELIST_URLS } from '@universo/utils'
import 'global-agent/bootstrap'

const parseSameSite = (value?: string): boolean | 'lax' | 'strict' | 'none' => {
    if (!value) return 'lax'
    const normalized = value.toLowerCase()
    if (['lax', 'strict', 'none'].includes(normalized)) return normalized as 'lax' | 'strict' | 'none'
    if (['true', 'false'].includes(normalized)) return normalized === 'true'
    return 'lax'
}

export class App {
    app: express.Application
    telemetry: Telemetry
    AppDataSource: DataSource = getDataSource()

    constructor() {
        this.app = express()
    }

    async initDatabase() {
        try {
            await this.AppDataSource.initialize()
            logger.info('📦 [server]: Data Source is initializing...')

            // Run Migrations Scripts
            await this.AppDataSource.runMigrations({ transaction: 'each' })

            // Initialize telemetry
            this.telemetry = new Telemetry()

            // Diagnostics: list registered entities
            const entityNames = getDataSource()
                .entityMetadatas.map((m) => m.name)
                .sort()
            logger.info('📦 [server]: Data Source has been initialized!')
            logger.info(`[diag] Entities loaded: ${entityNames.join(', ')}`)
        } catch (error) {
            logger.error('❌ [server]: Error during Data Source initialization:', error)
        }
    }

    async config() {
        // Validate required authentication secrets at startup
        const jwtSecret = process.env.SUPABASE_JWT_SECRET as string | undefined
        if (!jwtSecret) {
            logger.error('❌ [auth] SUPABASE_JWT_SECRET is not configured')
            throw new Error('Auth configuration error: SUPABASE_JWT_SECRET is required')
        }

        // Limit is needed to allow sending/receiving base64 encoded string
        const fileSizeLimit = process.env.FLOWISE_FILE_SIZE_LIMIT || '50mb'
        this.app.use(express.json({ limit: fileSizeLimit }))
        this.app.use(express.urlencoded({ limit: fileSizeLimit, extended: true }))
        if (process.env.NUMBER_OF_PROXIES && parseInt(process.env.NUMBER_OF_PROXIES) > 0)
            this.app.set('trust proxy', parseInt(process.env.NUMBER_OF_PROXIES))

        // Cookie-parser middleware (needed for refresh tokens)
        this.app.use(cookieParser() as any)

        const sessionSecret = process.env.SESSION_SECRET
        if (!sessionSecret) {
            logger.warn('⚠️ [auth] SESSION_SECRET is not set. Falling back to insecure development secret.')
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
                secret: sessionSecret ?? 'change-me',
                resave: false,
                saveUninitialized: false,
                cookie: cookieConfig
            })
        )

        this.app.use(passport.initialize())
        this.app.use(passport.session())

        const csrfProtection = csurf({ cookie: false })
        const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false })

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
        this.app.use('/api/v1/auth', createAuthRouter(csrfProtection, loginLimiter, getDataSource))

        const whitelistURLs = API_WHITELIST_URLS
        const URL_CASE_INSENSITIVE_REGEX: RegExp = /\/api\/v1\//i
        const URL_CASE_SENSITIVE_REGEX: RegExp = /\/api\/v1\//

        // ═══════════════════════════════════════════════════════════════
        // JWT Authentication Middleware (Supabase)
        // ═══════════════════════════════════════════════════════════════
        this.app.use('/api/v1', async (req: Request, res: Response, next: NextFunction) => {
            // If the path does not contain /api/v1, skip
            if (!URL_CASE_INSENSITIVE_REGEX.test(req.path)) {
                return next()
            }
            // If the path case doesn't match, reject
            if (!URL_CASE_SENSITIVE_REGEX.test(req.path)) {
                return res.status(401).json({ error: 'Unauthorized Access' })
            }
            // If URL in whitelist, skip
            const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url))
            if (isWhitelisted) {
                return next()
            }

            // Try session-based auth first
            const sessionTokens = (req.session as any)?.tokens
            const hasSession = Boolean(req.isAuthenticated?.() && sessionTokens?.access)
            if (hasSession) {
                req.headers.authorization = `Bearer ${sessionTokens.access}`
            }

            const headerValue = req.headers['authorization'] || req.headers['Authorization']
            const bearerToken =
                typeof headerValue === 'string' && headerValue.startsWith('Bearer ') ? headerValue.substring(7) : null
            const tokenToVerify = bearerToken ?? (hasSession ? sessionTokens?.access : null)

            if (!tokenToVerify) {
                return res.status(401).json({ error: 'Unauthorized Access: Missing token' })
            }

            try {
                const decoded: any = jwt.verify(tokenToVerify, jwtSecret)
                const supabaseUserId = decoded.sub || decoded.user_id || decoded.uid || null
                if (supabaseUserId) {
                    ;(req as any).user = { id: supabaseUserId, ...decoded }
                } else {
                    ;(req as any).user = decoded
                }
                return next()
            } catch (error) {
                logger.warn('[auth] JWT verification error', error as Error)
                return res.status(401).json({ error: 'Unauthorized Access: Invalid or expired token' })
            }
        })

        // Initialize rate limiters for services
        await initializeMetahubsRateLimiters()
        await initializeApplicationsRateLimiters()
        await initializeStartRateLimiters()

        // Seed metahub templates into DB (idempotent, non-fatal)
        try {
            await seedMetahubTemplates(this.AppDataSource)
        } catch (error) {
            logger.error('[server]: Failed to seed metahub templates:', error)
        }

        // Mount API v1 routes
        this.app.use('/api/v1', flowiseApiV1Router)

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
        try {
            await this.telemetry.flush()
        } catch (e) {
            logger.error(`❌[server]: Server shut down error: ${e}`)
        }
    }
}

let serverApp: App | undefined

export async function start(): Promise<void> {
    serverApp = new App()

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
