/**
 * @flowise/chatmessage-backend
 *
 * Chat Message service package with Dependency Injection pattern.
 * Provides entities, migrations, services, controllers, and routes for chat messages and feedback.
 */

// Interfaces and types
export {
    MessageType,
    ChatType,
    ChatMessageRatingType,
    type IChatMessage,
    type IChatMessageFeedback,
    type GetChatMessageParams,
    type IReactFlowNode,
    type IReactFlowObject
} from './Interface'

// Database entities
export { ChatMessage } from './database/entities/ChatMessage'
export { ChatMessageFeedback } from './database/entities/ChatMessageFeedback'
export { chatMessageEntities } from './database/entities'

// Database migrations
export { chatMessageMigrations } from './database/migrations/postgres'

// Services
export {
    createChatMessagesService,
    ChatMessagesServiceError,
    type IChatMessagesService,
    type ChatMessagesServiceConfig,
    type ILogger,
    type IAbortController,
    type IQueueManager
} from './services/chatMessagesService'

export {
    createFeedbackService,
    FeedbackServiceError,
    createFeedbackSchema,
    updateFeedbackSchema,
    type IFeedbackService,
    type FeedbackServiceConfig,
    type ICanvasService as IFeedbackCanvasService,
    type ILunaryClient
} from './services/feedbackService'

// Controllers
export {
    createChatMessagesController,
    ChatMessagesControllerError,
    type IChatMessagesController,
    type ChatMessagesControllerConfig,
    type ICanvasService,
    type INodesPool,
    type IAppServer,
    type IUtilGetChatMessage
} from './controllers/chatMessagesController'

export {
    createFeedbackController,
    FeedbackControllerError,
    type IFeedbackController,
    type FeedbackControllerConfig
} from './controllers/feedbackController'

// Routes
export { createChatMessagesRouter, chatMessagesErrorHandler, type ChatMessagesRouterConfig } from './routes/chatMessagesRouter'
export { createFeedbackRouter, feedbackErrorHandler, type FeedbackRouterConfig } from './routes/feedbackRouter'
export { createInternalCanvasMessagesRouter, type InternalCanvasMessagesRouterConfig } from './routes/internalCanvasMessagesRouter'

// Utility functions (backward-compatible wrappers)
export {
    utilAddChatMessage,
    utilGetChatMessage,
    utilAddChatMessageFeedback,
    utilGetChatMessageFeedback,
    utilUpdateChatMessageFeedback,
    type GetChatMessageParams as UtilGetChatMessageParams
} from './utils'
