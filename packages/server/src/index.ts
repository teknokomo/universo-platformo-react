import express from 'express'
import { Request, Response, NextFunction } from 'express'
import path from 'path'
import cors from 'cors'
import http from 'http'
// Universo Platformo | Removed express-basic-auth import - Basic Auth is no longer used
// import basicAuth from 'express-basic-auth'
const cookieParser = require('cookie-parser') // Universo Platformo | Add cookie-parser for refresh tokens
import jwt from 'jsonwebtoken' // Universo Platformo | New import for JWT verification
import { DataSource } from 'typeorm'
import { MODE } from './Interface'
import { getNodeModulesPackagePath, getEncryptionKey } from './utils'
import logger, { expressRequestLogger } from './utils/logger'
import { getDataSource } from './DataSource'
import { NodesPool } from './NodesPool'
import { ChatFlow } from './database/entities/ChatFlow'
import { CachePool } from './CachePool'
import { AbortControllerPool } from './AbortControllerPool'
import { RateLimiterManager } from './utils/rateLimit'
import { getAPIKeys } from './utils/apiKey'
import { sanitizeMiddleware, getCorsOptions, getAllowedIframeOrigins } from './utils/XSS'
import { Telemetry } from './utils/telemetry'
import flowiseApiV1Router from './routes'
import errorHandlerMiddleware from './middlewares/errors'
import { SSEStreamer } from './utils/SSEStreamer'
import { validateAPIKey } from './utils/validateKey'
import { IMetricsProvider } from './Interface.Metrics'
import { Prometheus } from './metrics/Prometheus'
import { OpenTelemetry } from './metrics/OpenTelemetry'
import { QueueManager } from './queue/QueueManager'
import { RedisEventSubscriber } from './queue/RedisEventSubscriber'
import { WHITELIST_URLS } from './utils/constants'
import 'global-agent/bootstrap'

declare global {
    namespace Express {
        namespace Multer {
            interface File {
                bucket: string
                key: string
                acl: string
                contentType: string
                contentDisposition: null
                storageClass: string
                serverSideEncryption: null
                metadata: any
                location: string
                etag: string
            }
        }
    }
}

export class App {
    app: express.Application
    nodesPool: NodesPool
    abortControllerPool: AbortControllerPool
    cachePool: CachePool
    telemetry: Telemetry
    rateLimiterManager: RateLimiterManager
    AppDataSource: DataSource = getDataSource()
    sseStreamer: SSEStreamer
    metricsProvider: IMetricsProvider
    queueManager: QueueManager
    redisSubscriber: RedisEventSubscriber

    constructor() {
        this.app = express()
    }

    async initDatabase() {
        // Initialize database
        try {
            await this.AppDataSource.initialize()
            logger.info('📦 [server]: Data Source is initializing...')

            // Run Migrations Scripts
            await this.AppDataSource.runMigrations({ transaction: 'each' })

            // Initialize nodes pool
            this.nodesPool = new NodesPool()
            await this.nodesPool.initialize()

            // Initialize abort controllers pool
            this.abortControllerPool = new AbortControllerPool()

            // Initialize API keys
            await getAPIKeys()

            // Initialize encryption key
            await getEncryptionKey()

            // Initialize Rate Limit
            this.rateLimiterManager = RateLimiterManager.getInstance()
            await this.rateLimiterManager.initializeRateLimiters(await getDataSource().getRepository(ChatFlow).find())

            // Initialize cache pool
            this.cachePool = new CachePool()

            // Initialize telemetry
            this.telemetry = new Telemetry()

            // Initialize SSE Streamer
            this.sseStreamer = new SSEStreamer()

            // Init Queues
            if (process.env.MODE === MODE.QUEUE) {
                this.queueManager = QueueManager.getInstance()
                this.queueManager.setupAllQueues({
                    componentNodes: this.nodesPool.componentNodes,
                    telemetry: this.telemetry,
                    cachePool: this.cachePool,
                    appDataSource: this.AppDataSource,
                    abortControllerPool: this.abortControllerPool
                })
                this.redisSubscriber = new RedisEventSubscriber(this.sseStreamer)
                await this.redisSubscriber.connect()
            }

            logger.info('📦 [server]: Data Source has been initialized!')
        } catch (error) {
            logger.error('❌ [server]: Error during Data Source initialization:', error)
        }
    }

    async config() {
        // Limit is needed to allow sending/receiving base64 encoded string
        const flowise_file_size_limit = process.env.FLOWISE_FILE_SIZE_LIMIT || '50mb'
        this.app.use(express.json({ limit: flowise_file_size_limit }))
        this.app.use(express.urlencoded({ limit: flowise_file_size_limit, extended: true }))
        if (process.env.NUMBER_OF_PROXIES && parseInt(process.env.NUMBER_OF_PROXIES) > 0)
            this.app.set('trust proxy', parseInt(process.env.NUMBER_OF_PROXIES))

        // Universo Platformo | Add cookie-parser middleware
        this.app.use(cookieParser() as any)

        // Allow access from specified domains
        this.app.use(cors(getCorsOptions()))

        // Allow embedding from specified domains.
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const allowedOrigins = getAllowedIframeOrigins()
            if (allowedOrigins == '*') {
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

        const whitelistURLs = WHITELIST_URLS
        const URL_CASE_INSENSITIVE_REGEX: RegExp = /\/api\/v1\//i
        const URL_CASE_SENSITIVE_REGEX: RegExp = /\/api\/v1\//

        // ======= NEW AUTHENTICATION MIDDLEWARE (Supabase JWT) =======
        // Universo Platformo | This middleware replaces the old Basic Auth logic and checks all requests to the API.
        this.app.use('/api/v1', async (req: Request, res: Response, next: NextFunction) => {
            // Universo Platformo | If the path does not contain /api/v1, skip
            if (!URL_CASE_INSENSITIVE_REGEX.test(req.path)) {
                return next()
            }
            // Universo Platformo | If the path case doesn't match, reject
            if (!URL_CASE_SENSITIVE_REGEX.test(req.path)) {
                return res.status(401).json({ error: 'Unauthorized Access' })
            }
            // Universo Platformo | If URL in whitelist, skip
            const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url))
            if (isWhitelisted) {
                return next()
            }
            // Universo Platformo | Extract Authorization header
            const authHeader = req.headers['authorization'] || req.headers['Authorization']
            let supabaseUserId: string | null = null
            if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    // Universo Platformo | Verify JWT using Supabase secret key
                    const decoded: any = jwt.verify(token, process.env.SUPABASE_JWT_SECRET as string)
                    supabaseUserId = decoded.sub || decoded.user_id || decoded.uid || null
                    if (supabaseUserId) {
                        // Universo Platformo | Save user data in req.user for further use
                        ;(req as any).user = { id: supabaseUserId, ...decoded }
                    }
                } catch (err) {
                    supabaseUserId = null
                }
            }
            // Universo Platformo | If JWT is missing or invalid, check API key
            if (!supabaseUserId) {
                const apiKeyValid = await validateAPIKey(req)
                if (!apiKeyValid) {
                    return res.status(401).json({ error: 'Unauthorized Access' })
                }
                return next()
            }
            return next()
        })
        // ======= END NEW AUTHENTICATION MIDDLEWARE =======

        // --- Old Basic Auth blocks are removed ---
        // Universo Platformo | (Branch based on FLOWISE_USERNAME / FLOWISE_PASSWORD completely removed)

        if (process.env.ENABLE_METRICS === 'true') {
            switch (process.env.METRICS_PROVIDER) {
                // default to prometheus
                case 'prometheus':
                case undefined:
                    this.metricsProvider = new Prometheus(this.app)
                    break
                case 'open_telemetry':
                    this.metricsProvider = new OpenTelemetry(this.app)
                    break
                // add more cases for other metrics providers here
            }
            if (this.metricsProvider) {
                await this.metricsProvider.initializeCounters()
                logger.info(`📊 [server]: Metrics Provider [${this.metricsProvider.getName()}] has been initialized!`)
            } else {
                logger.error(
                    "❌ [server]: Metrics collection is enabled, but failed to initialize provider (valid values are 'prometheus' or 'open_telemetry'."
                )
            }
        }

        this.app.use('/api/v1', flowiseApiV1Router)

        // ----------------------------------------
        // Configure number of proxies in Host Environment
        // ----------------------------------------
        this.app.get('/api/v1/ip', (request, response) => {
            response.send({
                ip: request.ip,
                msg: 'Check returned IP address in the response. If it matches your current IP address ( which you can get by going to http://ip.nfriedly.com/ or https://api.ipify.org/ ), then the number of proxies is correct and the rate limiter should now work correctly. If not, increase the number of proxies by 1 and restart Cloud-Hosted Flowise until the IP address matches your own. Visit https://docs.flowiseai.com/configuration/rate-limit#cloud-hosted-rate-limit-setup-guide for more information.'
            })
        })

        if (process.env.MODE === MODE.QUEUE) {
            this.app.use('/admin/queues', this.queueManager.getBullBoardRouter())
        }

        // ----------------------------------------
        // Serve UI static
        // ----------------------------------------

        const packagePath = getNodeModulesPackagePath('flowise-ui')
        const uiBuildPath = path.join(packagePath, 'build')
        const uiHtmlPath = path.join(packagePath, 'build', 'index.html')

        // Universo Platformo | Serve static assets from publish-frt for AR.js libraries
        const publishFrtAssetsPath = path.join(__dirname, '../../../apps/publish-frt/base/dist/assets')
        this.app.use('/assets', express.static(publishFrtAssetsPath))

        this.app.use('/', express.static(uiBuildPath))

        // All other requests not handled will return React app
        this.app.use((req: Request, res: Response) => {
            res.sendFile(uiHtmlPath)
        })

        // Error handling
        this.app.use(errorHandlerMiddleware)
    }

    async stopApp() {
        try {
            const removePromises: any[] = []
            removePromises.push(this.telemetry.flush())
            if (this.queueManager) {
                removePromises.push(this.redisSubscriber.disconnect())
            }
            await Promise.all(removePromises)
        } catch (e) {
            logger.error(`❌[server]: Flowise Server shut down error: ${e}`)
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
        logger.info(`⚡️ [server]: Flowise Server is listening at ${host ? 'http://' + host : ''}:${port}`)
    })
}

export function getInstance(): App | undefined {
    return serverApp
}
