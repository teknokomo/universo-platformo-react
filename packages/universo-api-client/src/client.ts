import { createAuthClient, type AuthClient } from '@universo/auth-frt'
import { CanvasesApi } from './api/canvases'
import { CredentialsApi } from './api/credentials'
import { AssistantsApi } from './api/assistants'
import { ToolsApi } from './api/tools'
import { NodesApi } from './api/nodes'
import { SpacesApi } from './api/spaces'
import { DocumentStoreApi } from './api/documentstore'
import { MarketplacesApi } from './api/marketplaces'
import { CanvasMessagesApi } from './api/canvasMessages'
import { VariablesApi } from './api/variables'
import { ApiKeyApi } from './api/apikey'
import { ConfigApi } from './api/config'
import { FeedbackApi } from './api/feedback'
import { LeadApi } from './api/lead'
import { VectorStoreApi } from './api/vectorstore'
import { PredictionApi } from './api/prediction'
import { PromptApi } from './api/prompt'
import { ScraperApi } from './api/scraper'
import { ExportImportApi } from './api/exportimport'
import { AttachmentsApi } from './api/attachments'
import { ChatMessageFeedbackApi } from './api/chatmessagefeedback'

export interface UniversoApiClientOptions {
    /** Base URL pointing to the API root (e.g. '/api/v1') */
    baseURL: string
    /** Path that returns { csrfToken: string }. Defaults to 'auth/csrf' */
    csrfPath?: string
    /** Storage key for CSRF token. Defaults to 'up.auth.csrf' */
    csrfStorageKey?: string
}

/**
 * Universo API Client - centralized TypeScript client for all API calls
 * 
 * @example
 * ```typescript
 * import { createUniversoApiClient } from '@universo/api-client'
 * 
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * 
 * // Usage with async/await
 * const canvases = await api.canvases.getCanvases(unikId, spaceId)
 * 
 * // Usage with TanStack Query
 * import { useQuery } from '@tanstack/react-query'
 * import { canvasQueryKeys } from '@universo/api-client'
 * 
 * const { data } = useQuery({
 *   queryKey: canvasQueryKeys.list(unikId, spaceId),
 *   queryFn: () => api.canvases.getCanvases(unikId, spaceId)
 * })
 * ```
 */
export const createUniversoApiClient = (options: UniversoApiClientOptions) => {
    // Create authenticated axios client
    const client = createAuthClient(options)

    // Add custom header for internal requests
    client.defaults.headers.common['x-request-from'] = 'internal'

    // Setup 401 redirect interceptor (moved from flowise-ui client.js)
    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error?.response?.status === 401) {
                const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')
                if (!isAuthRoute) {
                    window.location.href = '/auth'
                }
            }
            return Promise.reject(error)
        }
    )

    return {
        // API endpoint groups (alphabetical order)
        apiKeys: new ApiKeyApi(client),
        assistants: new AssistantsApi(client),
        attachments: new AttachmentsApi(client),
        canvasMessages: new CanvasMessagesApi(client),
        canvases: new CanvasesApi(client),
        chatMessageFeedback: new ChatMessageFeedbackApi(client),
        config: new ConfigApi(client),
        credentials: new CredentialsApi(client),
        documentStore: new DocumentStoreApi(client),
        exportImport: new ExportImportApi(client),
        feedback: new FeedbackApi(client),
        leads: new LeadApi(client),
        marketplaces: new MarketplacesApi(client),
        nodes: new NodesApi(client),
        predictions: new PredictionApi(client),
        prompts: new PromptApi(client),
        scrapers: new ScraperApi(client),
        spaces: new SpacesApi(client),
        tools: new ToolsApi(client),
        variables: new VariablesApi(client),
        vectorStores: new VectorStoreApi(client),

        // Raw axios instance for special cases
        $client: client,
    }
}

/**
 * Type of the Universo API client
 */
export type UniversoApiClient = ReturnType<typeof createUniversoApiClient>

/**
 * Export the AuthClient type for advanced use cases
 */
export type { AuthClient }
