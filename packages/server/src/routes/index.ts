import express from 'express'
// Remove global mounting of apikeyRouter as apikeys are now accessible via /uniks/:unikId/apikey
// import apikeyRouter from './apikey'
// Remove global mounting of assistantsRouter as assistants are now accessible via /uniks/:unikId/assistants
// import assistantsRouter from './assistants'
import attachmentsRouter from './attachments'
import chatMessageRouter from './chat-messages'
// Remove global mounting of chatflowsRouter as chatflows are now accessible via /uniks/:unikId/chatflows
// import chatflowsRouter from './chatflows'
// Remove global mounting of chatflowsStreamingRouter as it's now accessible via /uniks/:unikId/chatflows-streaming
// import chatflowsStreamingRouter from './chatflows-streaming'
// Remove global mounting of chatflowsUploadsRouter as it's now accessible via /uniks/:unikId/chatflows-uploads
// import chatflowsUploadsRouter from './chatflows-uploads'
import componentsCredentialsRouter from './components-credentials'
import componentsCredentialsIconRouter from './components-credentials-icon'
// Remove global mounting of credentialsRouter as credentials are now accessible via /uniks/:unikId/credentials
// import credentialsRouter from './credentials'
// Remove global mounting of documentStoreRouter as document store is now accessible via /uniks/:unikId/document-stores
// import documentStoreRouter from './documentstore'
import exportImportRouter from './export-import'
import feedbackRouter from './feedback'
import fetchLinksRouter from './fetch-links'
// Remove global mounting of flowConfigRouter as it's now accessible via /uniks/:unikId/flow-config
// import flowConfigRouter from './flow-config'
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
// Remove global mounting of toolsRouter as tools are now accessible via /uniks/:unikId/tools
// import toolsRouter from './tools'
import upsertHistoryRouter from './upsert-history'
// Remove global mounting of variablesRouter as variables are now accessible via /uniks/:unikId/variables
// import variablesRouter from './variables'
import vectorRouter from './vectors'
import verifyRouter from './verify'
import versionRouter from './versions'
import nvidiaNimRouter from './nvidia-nim'
import upAuthRouter from './up-auth'
import upUniksRouter from './up-uniks/uniks'
// Universo Platformo | Bots
import botsRouter from './bots'
// Universo Platformo | Chatflows Streaming
import chatflowsStreamingRouter from './chatflows-streaming'
// Universo Platformo | Logger
import logger from '../utils/logger'
// Universo Platformo | Import auth middleware
import upAuth from '../middlewares/up-auth'
// Universo Platformo | AR.js publishing integration
import { publishRoutes } from '../../../../apps/publish-srv/base/dist'

const router = express.Router()

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
router.use('/uniks', upAuth.ensureAuth, upUniksRouter)
// Universo Platformo | Chatflows Streaming
router.use('/api/v1/chatflows-streaming', upAuth.ensureAuth, chatflowsStreamingRouter)
// Universo Platformo | Bots
router.use('/api/v1/bots', upAuth.ensureAuth, botsRouter)

// Universo Platformo | AR.js Publishing Routes
router.use('/publish', publishRoutes)

export default router
