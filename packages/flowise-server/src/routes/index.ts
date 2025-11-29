import express from 'express'
import type { Router as ExpressRouter, Request, Response, NextFunction } from 'express'
// apikeyRouter removed - now created via @universo/flowise-apikey-srv
// assistantsRouter removed - now created via @universo/flowise-assistants-srv
import attachmentsRouter from './attachments'
import canvasMessageRouter from './canvas-messages'
import componentsCredentialsRouter from './components-credentials'
import componentsCredentialsIconRouter from './components-credentials-icon'
import documentStoreRouter from './documentstore'
import exportImportRouter from './export-import'
import feedbackRouter from './feedback'
import fetchLinksRouter from './fetch-links'
import flowConfigRouter from './flow-config'
import getUploadFileRouter from './get-upload-file'
import getUploadPathRouter from './get-upload-path'
import internalCanvasMessagesRouter from './internal-canvas-messages'
import internalPredictionRouter from './internal-predictions'
// leadsRouter removed - now created via @universo/flowise-leads-srv
import loadPromptRouter from './load-prompts'
import marketplacesRouter from './marketplaces'
import nodeConfigRouter from './node-configs'
import nodeCustomFunctionRouter from './node-custom-functions'
import nodeIconRouter from './node-icons'
import nodeLoadMethodRouter from './node-load-methods'
import nodesRouter from './nodes'
import openaiAssistantsRouter from './openai-assistants'
import openaiAssistantsFileRouter from './openai-assistants-files'
import openaiAssistantsVectorStoreRouter from './openai-assistants-vector-store'
import openaiRealtimeRouter from './openai-realtime'
import pingRouter from './ping'
import predictionRouter from './predictions'
import promptListsRouter from './prompts-lists'
import statsRouter from './stats'
import upsertHistoryRouter from './upsert-history'
// variablesRouter removed - now created via @universo/flowise-variables-srv
import vectorRouter from './vectors'
import verifyRouter from './verify'
import versionRouter from './versions'
import nvidiaNimRouter from './nvidia-nim'
import { createUniksRouter, createUniksCollectionRouter, createUnikIndividualRouter } from '@universo/uniks-srv'
import { initializeRateLimiters, getRateLimiters, createMetaversesServiceRoutes } from '@universo/metaverses-srv'
import { initializeRateLimiters as initializeClustersRateLimiters, createClustersServiceRoutes } from '@universo/clusters-srv'
import { initializeRateLimiters as initializeProjectsRateLimiters, createProjectsServiceRoutes } from '@universo/projects-srv'
import { createCampaignsServiceRoutes } from '@universo/campaigns-srv'
import { createOrganizationsServiceRoutes } from '@universo/organizations-srv'
import { createStoragesServiceRoutes } from '@universo/storages-srv'
import { createToolsService, createToolsRouter, toolsErrorHandler } from '@universo/flowise-tools-srv'
import { createCredentialsService, createCredentialsRouter, credentialsErrorHandler, Credential } from '@universo/flowise-credentials-srv'
import { createVariablesService, createVariablesRouter, variablesErrorHandler } from '@universo/flowise-variables-srv'
import { createApikeyService, createApikeyRouter, apikeyErrorHandler } from '@universo/flowise-apikey-srv'
import { createAssistantsService, createAssistantsController, createAssistantsRouter, assistantsErrorHandler } from '@universo/flowise-assistants-srv'
import { createLeadsService, createLeadsRouter, leadsErrorHandler } from '@universo/flowise-leads-srv'
// Universo Platformo | Bots
import botsRouter from './bots'
// Universo Platformo | Logger
import logger from '../utils/logger'
// Universo Platformo | Import auth middleware
import { ensureAuth, createEnsureAuthWithRls } from '@universo/auth-srv'
// Universo Platformo | AR.js publishing integration
import { createPublishRoutes } from '@universo/publish-srv'
// Universo Platformo | Profile service integration
import { createProfileRoutes } from '@universo/profile-srv'
import { getDataSource } from '../DataSource'
import { createSpaceBuilderRouter } from '@universo/space-builder-srv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { encryptCredentialData, decryptCredentialData } from '../utils'
import nodesService from '../services/nodes'
import componentsCredentialsService from '../services/components-credentials'
import { canvasServiceConfig } from '../services/spacesCanvas'
import { createCanvasPublicRoutes } from '@universo/spaces-srv'
import canvasStreamingRouter from './canvas-streaming'
import { RateLimiterManager } from '../utils/rateLimit'
// apiKeyService removed - now created via @universo/flowise-apikey-srv
import { ensureUnikMembershipResponse } from '../services/access-control'
import { appConfig } from '../AppConfig'
import { DocumentStore } from '../database/entities/DocumentStore'

const router: ExpressRouter = express.Router()

// Create RLS-enabled authentication middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })

// Create tools service and router using new package
const toolsService = createToolsService({
    getDataSource,
    telemetry: {
        sendTelemetry: async (event: string, data: Record<string, unknown>) => {
            const { getRunningExpressApp } = await import('../utils/getRunningExpressApp')
            await getRunningExpressApp().telemetry.sendTelemetry(event, data)
        }
    }
})
const toolsRouter = createToolsRouter(toolsService)

// Create credentials service and router using new package with DI for encryption
const credentialsService = createCredentialsService({
    getDataSource,
    encryptCredentialData: async (data: Record<string, unknown>) => {
        return await encryptCredentialData(data as any)
    },
    decryptCredentialData: async (encrypted: string, componentName?: string, components?: any) => {
        // If components not provided, get from running app
        const actualComponents = components ?? getRunningExpressApp().nodesPool.componentCredentials
        return await decryptCredentialData(encrypted, componentName, actualComponents) as Record<string, unknown>
    }
})
const credentialsRouter = createCredentialsRouter(credentialsService)

// Create variables service and router using new package with DI
const variablesService = createVariablesService({
    getDataSource
})
const variablesRouter = createVariablesRouter(variablesService)

// Create apikey service and router using new package with DI
const apikeyService = createApikeyService({
    getDataSource,
    storageConfig: {
        type: appConfig.apiKeys.storageType as 'json' | 'db'
    }
})
const apikeyRouter = createApikeyRouter(apikeyService)

// Create assistants service and router using new package with DI
const assistantsService = createAssistantsService({
    getDataSource,
    decryptCredentialData: async (encrypted: string) => {
        const components = getRunningExpressApp().nodesPool.componentCredentials
        return (await decryptCredentialData(encrypted, undefined, components)) as Record<string, unknown>
    },
    telemetry: {
        sendTelemetry: async (event: string, data: Record<string, unknown>) => {
            await getRunningExpressApp().telemetry.sendTelemetry(event, data)
        }
    },
    getNodesService: () => nodesService,
    getDocumentStoreRepository: () => getDataSource().getRepository(DocumentStore) as any,
    getNodesPool: () => getRunningExpressApp().nodesPool,
    getDatabaseEntities: () => {
        const { databaseEntities } = require('../utils')
        return databaseEntities
    },
    getLogger: () => logger,
    getPromptGenerator: () => `You are a helpful assistant that generates high-quality instructions for AI assistants.

Based on the following task description, generate clear, detailed, and actionable instructions for an AI assistant:

Task: {{task}}

Generate comprehensive instructions that:
1. Clearly define the assistant's role and purpose
2. Specify the expected behavior and tone
3. Include any constraints or guidelines
4. Provide examples if helpful

Instructions:
`,
    getInputParamsType: () => ['string', 'number', 'boolean', 'json', 'file']
})
const assistantsController = createAssistantsController({ assistantsService })
const assistantsRouter = createAssistantsRouter({ assistantsController })

// Create leads service and router using new package with DI
const leadsService = createLeadsService({
    getDataSource
})
const leadsRouter = createLeadsRouter(leadsService)

// Security headers (safe defaults for APIs; CSP disabled for now)
router.use(helmet({ contentSecurityPolicy: false }))

router.use('/ping', pingRouter)
// Global route for apikey has been removed
// router.use('/apikey', apikeyRouter)
// Global route for assistants has been removed
// router.use('/assistants', assistantsRouter)
router.use('/attachments', attachmentsRouter)
router.use('/canvas-messages', canvasMessageRouter)
router.use('/components-credentials', componentsCredentialsRouter)
router.use('/components-credentials-icon', componentsCredentialsIconRouter)
// Global route for credentials has been removed
// router.use('/credentials', credentialsRouter)
// Global route for document-store has been removed
// router.use('/document-store', documentStoreRouter)
router.use('/export-import', exportImportRouter)
router.use('/feedback', feedbackRouter)
router.use('/fetch-links', fetchLinksRouter)
// Global route for flow-config has been removed
// router.use('/flow-config', flowConfigRouter)
router.use('/internal-canvas-messages', internalCanvasMessagesRouter)
router.use('/internal-prediction', internalPredictionRouter)
router.use('/get-upload-file', getUploadFileRouter)
router.use('/get-upload-path', getUploadPathRouter)
router.use('/leads', leadsRouter)
router.use('/load-prompt', loadPromptRouter)
router.use('/marketplaces', marketplacesRouter)
router.use('/node-config', nodeConfigRouter)
router.use('/node-custom-function', nodeCustomFunctionRouter)
router.use('/node-icon', nodeIconRouter)
router.use('/node-load-method', nodeLoadMethodRouter)
router.use('/nodes', nodesRouter)
router.use('/openai-assistants', openaiAssistantsRouter)
router.use('/openai-assistants-file', openaiAssistantsFileRouter)
router.use('/openai-assistants-vector-store', openaiAssistantsVectorStoreRouter)
router.use('/openai-realtime', openaiRealtimeRouter)
router.use('/prediction', predictionRouter)
router.use('/prompts-list', promptListsRouter)
router.use(
    '/public',
    createCanvasPublicRoutes(() => getDataSource(), canvasServiceConfig)
)
router.use('/stats', statsRouter)
// Global route for tools has been removed
// router.use('/tools', toolsRouter)
// Global route for variables has been removed
// router.use('/variables', variablesRouter)
router.use('/vector', vectorRouter)
router.use('/verify', verifyRouter)
router.use('/version', versionRouter)
router.use('/upsert-history', upsertHistoryRouter)
router.use('/nvidia-nim', nvidiaNimRouter)
// Apply ensureAuthWithRls middleware to /uniks route (collection operations: list, create)
router.use(
    '/uniks',
    createUniksCollectionRouter(ensureAuthWithRls, () => getDataSource())
)

// Mount nested routes for Unik-specific resources at /unik/:id
const spacesLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })

router.use(
    '/unik',
    createUniksRouter(
        ensureAuthWithRls,
        () => getDataSource(),
        flowConfigRouter,
        toolsRouter,
        variablesRouter,
        exportImportRouter,
        credentialsRouter,
        assistantsRouter,
        apikeyRouter,
        documentStoreRouter,
        marketplacesRouter,
        {
            spacesLimiter,
            spacesRoutes: {
                canvasService: canvasServiceConfig,
                rateLimiterManager: RateLimiterManager.getInstance(),
                apiKeyService: {
                    getApiKey: async (key: string) => {
                        const record = await apikeyService.getApiKey(key)
                        if (record && typeof (record as any).id === 'string') {
                            return { id: (record as any).id as string }
                        }
                        return null
                    }
                },
                membership: {
                    ensureUnikMembershipResponse: async (req: any, res: any, unikId: any, options: any) => {
                        const userId = await ensureUnikMembershipResponse(req, res, unikId, options)
                        return userId === null ? undefined : userId
                    },
                    accessDeniedMessage: 'Access denied: You do not have permission to access this Unik'
                }
            }
        }
    )
)

// Apply ensureAuthWithRls middleware to /unik route (individual operations: get, update, delete)
router.use(
    '/unik',
    createUnikIndividualRouter(ensureAuthWithRls, () => getDataSource())
)

// Legacy resources-srv routes removed (package obsolete) - 2025-01-18:
// - /resources (createResourcesRouter)
// - /clusters (createClustersRoutes)
// - /domains (createDomainsRoutes)

// Universo Platformo | Metaverses, Sections, Entities
// Note: Rate limiters initialized via initializeRateLimiters() in server startup
// This mounts: /metaverses, /sections, /entities
// Lazy initialization: router created on first request (after initializeRateLimiters called)
let metaversesRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!metaversesRouter) {
        metaversesRouter = createMetaversesServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (metaversesRouter) {
        metaversesRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Clusters, Domains, Resources
// Note: Rate limiters initialized via initializeClustersRateLimiters() in server startup
// This mounts: /clusters, /domains, /resources
// Lazy initialization: router created on first request (after initializeClustersRateLimiters called)
let clustersRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!clustersRouter) {
        clustersRouter = createClustersServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (clustersRouter) {
        clustersRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Projects, Milestones, Tasks
// Note: Rate limiters initialized via initializeProjectsRateLimiters() in server startup
// This mounts: /projects, /milestones, /tasks
// Lazy initialization: router created on first request (after initializeProjectsRateLimiters called)
let projectsRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!projectsRouter) {
        projectsRouter = createProjectsServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (projectsRouter) {
        projectsRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Campaigns, Events, Activities
// Note: Rate limiters initialized via initializeCampaignsRateLimiters() in server startup
// This mounts: /campaigns, /events, /activities
// Lazy initialization: router created on first request (after initializeCampaignsRateLimiters called)
let campaignsRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!campaignsRouter) {
        campaignsRouter = createCampaignsServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (campaignsRouter) {
        campaignsRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Organizations, Departments, Positions
// Note: Rate limiters initialized via initializeOrganizationsRateLimiters() in server startup
// This mounts: /organizations, /departments, /positions
// Lazy initialization: router created on first request (after initializeOrganizationsRateLimiters called)
let organizationsRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!organizationsRouter) {
        organizationsRouter = createOrganizationsServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (organizationsRouter) {
        organizationsRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Storages, Containers, Slots
// Note: Rate limiters initialized via initializeStoragesRateLimiters() in server startup
// This mounts: /storages, /containers, /slots
// Lazy initialization: router created on first request (after initializeStoragesRateLimiters called)
let storagesRouter: ExpressRouter | null = null
router.use((req: Request, res: Response, next: NextFunction) => {
    if (!storagesRouter) {
        storagesRouter = createStoragesServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    if (storagesRouter) {
        storagesRouter(req, res, next)
    } else {
        next()
    }
})

// Universo Platformo | Canvas Streaming
router.use('/api/v1/canvas-streaming', ensureAuth, canvasStreamingRouter)
// Universo Platformo | Bots
router.use('/api/v1/bots', ensureAuth, botsRouter)

// Universo Platformo | Space Builder
const spaceBuilderLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true })
router.use(
    '/space-builder',
    ensureAuth,
    spaceBuilderLimiter,
    createSpaceBuilderRouter({
        resolveCredential: async (credentialId: string) => {
            try {
                if (!credentialId) {
                    throw new Error('Credential ID is required')
                }

                // Fetch raw credential from DB to avoid redaction and decrypt locally
                const appServer = getRunningExpressApp()
                const credEntity = await appServer.AppDataSource.getRepository(Credential).findOneBy({ id: credentialId })
                if (!credEntity) throw new Error(`Credential with ID ${credentialId} not found`)
                const decrypted = await decryptCredentialData(credEntity.encryptedData)
                const credentialData: any = decrypted || {}
                const credentialName: string = credEntity.credentialName || ''

                // Map credential types to their specific API key field names
                const credentialFieldMap: Record<string, string> = {
                    openAIApi: 'openAIApiKey',
                    groqApi: 'groqApiKey',
                    azureOpenAIApi: 'azureOpenAIApiKey',
                    openRouterApi: 'openRouterApiKey',
                    anthropicApi: 'anthropicApiKey',
                    cohereApi: 'cohereApiKey',
                    mistralAIApi: 'mistralAIApiKey',
                    googleGenerativeAIApi: 'googleGenerativeAIApiKey',
                    huggingFaceApi: 'huggingFaceApiKey'
                }

                const expectedField = credentialFieldMap[credentialName]
                if (!expectedField) {
                    throw new Error(
                        `Unsupported credential type: ${credentialName}. Supported types: ${Object.keys(credentialFieldMap).join(', ')}`
                    )
                }

                const apiKey = credentialData[expectedField]
                if (!apiKey) {
                    throw new Error(`API key field '${expectedField}' not found in credential data for credential type '${credentialName}'`)
                }

                return apiKey
            } catch (error: any) {
                logger.error(`[SpaceBuilder] Credential resolution error: ${error?.message || 'Unknown error'}`)
                throw new Error(`Failed to resolve credential: ${error?.message || 'Unknown error'}`)
            }
        },
        listChatModelNodes: async () => {
            // Return only Chat Models category
            try {
                return await nodesService.getAllNodesForCategory('Chat Models')
            } catch (e) {
                logger.error('[SpaceBuilder] Failed to list chat model nodes:', e)
                return []
            }
        },
        listComponentCredentials: async () => {
            try {
                return await componentsCredentialsService.getAllComponentsCredentials()
            } catch (e) {
                logger.error('[SpaceBuilder] Failed to list component credentials:', e)
                return []
            }
        },
        listUserCredentials: async (unikId?: string, names?: string | string[]) => {
            try {
                return await credentialsService.getAllCredentials(names, unikId)
            } catch (e) {
                logger.error('[SpaceBuilder] Failed to list user credentials:', e)
                return []
            }
        }
    })
)

// Universo Platformo | Publishing Routes
router.use('/publish', createPublishRoutes(getDataSource()))

// Universo Platformo | Profile Routes (mounted at /profile, full path becomes /api/v1/profile)
// Do not wrap with ensureAuth here, the router itself applies auth to protected endpoints
const createProfileRoutesWithAuth = createProfileRoutes as unknown as (dataSource: any, authMiddleware?: any) => ExpressRouter
router.use('/profile', createProfileRoutesWithAuth(getDataSource(), ensureAuthWithRls))

// Tools-specific error handler (before global handler)
router.use(toolsErrorHandler)

// Credentials-specific error handler
router.use(credentialsErrorHandler)

// Variables-specific error handler
router.use(variablesErrorHandler)

// ApiKey-specific error handler
router.use(apikeyErrorHandler)

// Assistants-specific error handler
router.use(assistantsErrorHandler)

// Leads-specific error handler
router.use(leadsErrorHandler)

// Global error handler for debugging middleware issues (should be last)
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[API Error Handler]', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    })

    // If headers already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err)
    }

    // Send error response
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
        path: req.path
    })
})

export default router
