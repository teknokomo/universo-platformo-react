import express from 'express'
import type { Router as ExpressRouter } from 'express'
import apikeyRouter from './apikey'
import assistantsRouter from './assistants'
import attachmentsRouter from './attachments'
import chatMessageRouter from './chat-messages'
import chatflowsRouter from './chatflows'
import chatflowsStreamingRouter from './chatflows-streaming'
import chatflowsUploadsRouter from './chatflows-uploads'
import componentsCredentialsRouter from './components-credentials'
import componentsCredentialsIconRouter from './components-credentials-icon'
import credentialsRouter from './credentials'
import documentStoreRouter from './documentstore'
import exportImportRouter from './export-import'
import feedbackRouter from './feedback'
import fetchLinksRouter from './fetch-links'
import flowConfigRouter from './flow-config'
import getUploadFileRouter from './get-upload-file'
import getUploadPathRouter from './get-upload-path'
import internalChatmessagesRouter from './internal-chat-messages'
import internalPredictionRouter from './internal-predictions'
import leadsRouter from './leads'
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
import publicChatflowsRouter from './public-chatflows'
import statsRouter from './stats'
import toolsRouter from './tools'
import upsertHistoryRouter from './upsert-history'
import variablesRouter from './variables'
import vectorRouter from './vectors'
import verifyRouter from './verify'
import versionRouter from './versions'
import nvidiaNimRouter from './nvidia-nim'
import { createUniksRouter, createUniksCollectionRouter, createUnikIndividualRouter } from '@universo/uniks-srv'
import { createFinanceRouter } from '@universo/finance-srv'
import { createResourcesRouter, createClustersRoutes, createDomainsRoutes } from '@universo/resources-srv'
import { createMetaversesRoutes, createSectionsRoutes, createEntitiesRouter } from '@universo/metaverses-srv'
// Universo Platformo | Bots
import botsRouter from './bots'
// Universo Platformo | Logger
import logger from '../utils/logger'
// Universo Platformo | Import auth middleware
import { ensureAuth } from '@universo/auth-srv'
// Universo Platformo | AR.js publishing integration
import { createPublishRoutes } from '@universo/publish-srv'
// Universo Platformo | Profile service integration
import { createProfileRoutes } from '@universo/profile-srv'
import { getDataSource } from '../DataSource'
import { createSpaceBuilderRouter } from '@universo/space-builder-srv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import credentialsService from '../services/credentials'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { Credential } from '../database/entities/Credential'
import { decryptCredentialData } from '../utils'
import nodesService from '../services/nodes'
import componentsCredentialsService from '../services/components-credentials'
import { createSpacesRoutes } from '@universo/spaces-srv'

const router: ExpressRouter = express.Router()

// Security headers (safe defaults for APIs; CSP disabled for now)
router.use(helmet({ contentSecurityPolicy: false }))

router.use('/ping', pingRouter)
// Global route for apikey has been removed
// router.use('/apikey', apikeyRouter)
// Global route for assistants has been removed
// router.use('/assistants', assistantsRouter)
router.use('/attachments', attachmentsRouter)
// Global route for chatflows has been removed
// router.use('/chatflows', chatflowsRouter)
// Global route for chatflows-streaming has been removed
// router.use('/chatflows-streaming', chatflowsStreamingRouter)
router.use('/chatmessage', chatMessageRouter)
router.use('/components-credentials', componentsCredentialsRouter)
router.use('/components-credentials-icon', componentsCredentialsIconRouter)
// Global route for chatflows-uploads has been removed
// router.use('/chatflows-uploads', chatflowsUploadsRouter)
// Global route for credentials has been removed
// router.use('/credentials', credentialsRouter)
// Global route for document-store has been removed
// router.use('/document-store', documentStoreRouter)
router.use('/export-import', exportImportRouter)
router.use('/feedback', feedbackRouter)
router.use('/fetch-links', fetchLinksRouter)
// Global route for flow-config has been removed
// router.use('/flow-config', flowConfigRouter)
router.use('/internal-chatmessage', internalChatmessagesRouter)
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
router.use('/public-chatflows', publicChatflowsRouter)
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
// Apply ensureAuth middleware to /uniks route (collection operations: list, create)
router.use(
    '/uniks',
    createUniksCollectionRouter(
        ensureAuth,
        () => getDataSource()
    )
)

// Mount nested routes for Unik-specific resources at /unik/:id
router.use(
    '/unik',
    createUniksRouter(
        ensureAuth,
        () => getDataSource(),
        chatflowsRouter,
        chatflowsStreamingRouter,
        chatflowsUploadsRouter,
        flowConfigRouter,
        toolsRouter,
        variablesRouter,
        exportImportRouter,
        credentialsRouter,
        assistantsRouter,
        apikeyRouter,
        documentStoreRouter,
        marketplacesRouter,
        createFinanceRouter()
    )
)

// Apply ensureAuth middleware to /unik route (individual operations: get, update, delete)
router.use(
    '/unik',
    createUnikIndividualRouter(
        ensureAuth,
        () => getDataSource()
    )
)
console.log('[DEBUG] Registering resources router at /api/v1/resources')
const resourcesLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
router.use(
    '/resources',
    resourcesLimiter,
    createResourcesRouter(ensureAuth, () => getDataSource())
)
console.log('[DEBUG] Resources router registered')

// Universo Platformo | Clusters & Domains (Resources Service)
const clustersLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
router.use(
    '/clusters',
    clustersLimiter,
    createClustersRoutes(ensureAuth, () => getDataSource())
)
const domainsLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
router.use(
    '/domains',
    domainsLimiter,
    createDomainsRoutes(ensureAuth, () => getDataSource())
)

const metaversesLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
router.use(
    '/metaverses',
    metaversesLimiter,
    createMetaversesRoutes(ensureAuth, () => getDataSource())
)
const sectionsLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
router.use(
    '/sections',
    sectionsLimiter,
    createSectionsRoutes(ensureAuth, () => getDataSource())
)
router.use(
    '/entities',
    createEntitiesRouter(ensureAuth, () => getDataSource())
)
// Universo Platformo | Chatflows Streaming
router.use('/api/v1/chatflows-streaming', ensureAuth, chatflowsStreamingRouter)
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
            try { return await nodesService.getAllNodesForCategory('Chat Models') } catch (e) { logger.error('[SpaceBuilder] Failed to list chat model nodes:', e); return [] }
        },
        listComponentCredentials: async () => {
            try { return await componentsCredentialsService.getAllComponentsCredentials() } catch (e) { logger.error('[SpaceBuilder] Failed to list component credentials:', e); return [] }
        },
        listUserCredentials: async (unikId?: string, names?: string | string[]) => {
            try { return await credentialsService.getAllCredentials(names, unikId) } catch (e) { logger.error('[SpaceBuilder] Failed to list user credentials:', e); return [] }
        }
    })
)

// Universo Platformo | Spaces routes
const spacesLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
// Mount under /unik/:id so UI paths match both /spaces/* and /canvases/*
router.use(
    '/unik/:id',
    ensureAuth,
    spacesLimiter,
    // Parameter compatibility for Spaces routes (expects :unikId)
    (req, _res, next) => { if (req.params.id && !req.params.unikId) req.params.unikId = req.params.id; next(); },
    createSpacesRoutes(() => getDataSource())
)

// Universo Platformo | Publishing Routes
router.use('/publish', createPublishRoutes(getDataSource()))

// Universo Platformo | Profile Routes (mounted at /profile, full path becomes /api/v1/profile)
// Do not wrap with ensureAuth here, the router itself applies auth to protected endpoints
const createProfileRoutesWithAuth = createProfileRoutes as unknown as (dataSource: any, authMiddleware?: any) => ExpressRouter
router.use('/profile', createProfileRoutesWithAuth(getDataSource(), ensureAuth))

export default router
