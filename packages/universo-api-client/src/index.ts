/**
 * @universo/api-client
 * TypeScript API client for Universo Platformo
 * 
 * This package provides a centralized, type-safe client for all backend API calls.
 * Built on top of @universo/auth-frt for authentication and axios for HTTP requests.
 * 
 * @example
 * ```typescript
 * import { createUniversoApiClient, canvasQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 * 
 * // Create client instance
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * 
 * // Use in React component with TanStack Query
 * function MyComponent({ unikId, spaceId }) {
 *   const { data, isLoading } = useQuery({
 *     queryKey: canvasQueryKeys.list(unikId, spaceId),
 *     queryFn: () => api.canvases.getCanvases(unikId, spaceId)
 *   })
 *   
 *   if (isLoading) return <div>Loading...</div>
 *   return <div>{data.canvases.length} canvases</div>
 * }
 * ```
 */

// Main client factory
export { createUniversoApiClient } from './client'
export type { UniversoApiClient, UniversoApiClientOptions, AuthClient } from './client'

// Default API client instance (uses environment defaults)
import { createUniversoApiClient } from './client'
import { getApiBaseURL } from '@universo/utils'
export const api = createUniversoApiClient({ baseURL: `${getApiBaseURL()}/api/v1` })

// API classes (for advanced use cases) - alphabetical order
export {
    ApiKeyApi,
    apikeyQueryKeys,
    type ApiKey,
    type CreateApiKeyPayload,
    type UpdateApiKeyPayload,
    type ImportApiKeysPayload
} from './api/apikey'
export { AssistantsApi, assistantQueryKeys } from './api/assistants'
export { AttachmentsApi, attachmentsQueryKeys } from './api/attachments'
export { CanvasMessagesApi, canvasMessagesQueryKeys } from './api/canvasMessages'
export { CanvasesApi, canvasQueryKeys } from './api/canvases'
export { ChatMessageFeedbackApi, chatmessagefeedbackQueryKeys } from './api/chatmessagefeedback'
export { ConfigApi, configQueryKeys } from './api/config'
export { CredentialsApi, credentialQueryKeys } from './api/credentials'
export {
    DocumentStoreApi,
    documentstoreQueryKeys,
    type DocumentStore,
    type DocumentLoader,
    type CreateDocumentStoreBody,
    type PreviewChunksBody,
    type PreviewChunksResponse
} from './api/documentstore'
export { ExportImportApi, exportimportQueryKeys } from './api/exportimport'
export { FeedbackApi, feedbackQueryKeys } from './api/feedback'
export { LeadApi, leadQueryKeys } from './api/lead'
export { MarketplacesApi, marketplacesQueryKeys } from './api/marketplaces'
export { NodesApi, nodeQueryKeys } from './api/nodes'
export { PredictionApi, predictionQueryKeys } from './api/prediction'
export { PromptApi, promptQueryKeys } from './api/prompt'
export { ScraperApi, scraperQueryKeys } from './api/scraper'
export { SpacesApi, spaceQueryKeys } from './api/spaces'
export { ToolsApi, toolQueryKeys, type CustomTool, type CreateToolBody, type UpdateToolBody } from './api/tools'
export { VariablesApi, variablesQueryKeys } from './api/variables'
export {
    VectorStoreApi,
    vectorstoreQueryKeys,
    type UpsertHistoryEntry,
    type UpsertVectorStoreBody,
    type GetUpsertHistoryParams
} from './api/vectorstore'

// TypeScript types
export * from './types'

// Query keys for TanStack Query
export * from './queryKeys'
