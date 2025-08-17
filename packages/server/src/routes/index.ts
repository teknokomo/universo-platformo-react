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
import upAuthRouter from './up-auth'
import { createUniksRouter } from '@universo/uniks-srv'
import { supabase } from '../utils/supabase'
// Universo Platformo | Bots
import botsRouter from './bots'
// Universo Platformo | Logger
import logger from '../utils/logger'
// Universo Platformo | Import auth middleware
import upAuth from '../middlewares/up-auth'
// Universo Platformo | AR.js publishing integration
import { createPublishRoutes } from '@universo/publish-srv'
// Universo Platformo | Profile service integration
import { createProfileRoutes } from '@universo/profile-srv'
import { getDataSource } from '../DataSource'
import { createSpaceBuilderRouter } from '@universo/space-builder-srv'
import rateLimit from 'express-rate-limit'
import credentialsService from '../services/credentials'
import { createMetaverseRoutes } from '@universo/metaverse-srv'

const router: ExpressRouter = express.Router()

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
router.use('/auth', upAuthRouter)
// Apply ensureAuth middleware to /uniks route
router.use(
	'/uniks',
	createUniksRouter(
		upAuth.ensureAuth,
		supabase,
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
		marketplacesRouter
	)
)
// Universo Platformo | Chatflows Streaming
router.use('/api/v1/chatflows-streaming', upAuth.ensureAuth, chatflowsStreamingRouter)
// Universo Platformo | Bots
router.use('/api/v1/bots', upAuth.ensureAuth, botsRouter)

// Universo Platformo | Space Builder
const spaceBuilderLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true })
router.use(
	'/space-builder',
	upAuth.ensureAuth,
	spaceBuilderLimiter,
	createSpaceBuilderRouter({
		resolveCredential: async (credentialId: string) => {
			const cred = await credentialsService.getCredentialById(credentialId)
			const data: any = cred?.plainDataObj || {}
			const name: string = (cred as any)?.credentialName || ''
			// Strict provider-specific key selection to avoid cross-provider mixups
			if (name === 'groqApi') {
				return data.groqApiKey || data.GROQ_API_KEY || ''
			}
			if (name === 'openAIApi') {
				return data.openAIApiKey || data.OPENAI_API_KEY || ''
			}
			if (name === 'azureOpenAIApi') {
				return data.azureOpenAIApiKey || data.AZURE_OPENAI_API_KEY || ''
			}
			// Fallback: try common field names, but avoid leaking mismatched keys
			return data.apiKey || data.API_KEY || ''
		}
	})
)

// Universo Platformo | Metaverse routes
const metaverseLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true })
router.use('/metaverses', upAuth.ensureAuth, metaverseLimiter, createMetaverseRoutes(getDataSource()))

// Universo Platformo | Publishing Routes
router.use('/publish', createPublishRoutes(getDataSource()))

// Universo Platformo | Profile Routes (mounted at /profile, full path becomes /api/v1/profile)
// Do not wrap with ensureAuth here, the router itself applies auth to protected endpoints
const createProfileRoutesWithAuth = (createProfileRoutes as unknown as (
	dataSource: any,
	authMiddleware?: any
) => ExpressRouter)
router.use('/profile', createProfileRoutesWithAuth(getDataSource(), upAuth.ensureAuth))

export default router
