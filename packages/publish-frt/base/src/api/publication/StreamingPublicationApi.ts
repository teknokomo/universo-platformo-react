// Universo Platformo | Streaming Publication API - for real-time content generation
// API client for streaming publication of content across different technologies

import axios from 'axios'
import { getApiBaseUrl } from '../common'
import { getPublishApiClient } from '../client'
import { IARJSPublishRequest, IARJSPublishResponse, IPublicationDataResult } from '@universo/publish-srv'

// Get base URL when initializing module
const API_BASE_URL = getApiBaseUrl()

/**
 * API client for streaming publication across different technologies
 * Currently optimized for AR.js but designed to support other technologies
 */
export class StreamingPublicationApi {
    /**
     * Gets authorization headers and adds them to the passed headers
     * @param headers Existing headers (optional)
     * @returns Combined headers with authorization
     */
    private static getClient() {
        return getPublishApiClient()
    }

    /**
     * Creates a new AR.js publication in streaming generation mode
     * @param request Publication creation request
     * @returns Information about the created publication
     */
    static async publishARJS(request: IARJSPublishRequest): Promise<IARJSPublishResponse> {
        try {
            const apiUrl = '/publish/arjs'
            console.log('🚀 [StreamingPublicationApi] Publishing AR.js project:', request.canvasId ?? 'unknown')

            const response = await this.getClient().post<IARJSPublishResponse>(apiUrl, request)

            console.log('✅ [StreamingPublicationApi] Publication successful:', response.data.publicationId)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('❌ [StreamingPublicationApi] Publication failed:', error.response?.data || error.message)

                if (error.response) {
                    const errorMessage = error.response.data?.error || error.response.statusText || error.message
                    throw new Error(`Publication failed: ${errorMessage}`)
                }
            } else {
                console.error('❌ [StreamingPublicationApi] Unexpected error:', error instanceof Error ? error.message : 'Unknown error')
            }

            throw error
        }
    }

    /**
     * Gets publication data by publication id
     * Used for public access to AR.js space
     * @param publicationId Publication ID
     * @returns Publication data with UPDL space
     */
    static async getPublicationData(publicationId: string): Promise<IPublicationDataResult> {
        try {
            const publicationUrl = `${API_BASE_URL}/api/v1/publish/arjs/public/${publicationId}`
            console.log('🚀 [StreamingPublicationApi] Loading publication:', publicationId)

            const response = await axios.get<IPublicationDataResult>(publicationUrl, {
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                    Expires: '0'
                }
            })

            console.log('✅ [StreamingPublicationApi] Publication data loaded successfully')
            return response.data
        } catch (error: unknown) {
            console.error(
                '❌ [StreamingPublicationApi] Failed to load publication:',
                error instanceof Error ? error.message : 'Unknown error'
            )

            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new Error('Publication not found')
                } else if (error.response) {
                    const errorData = error.response.data
                    throw new Error(errorData?.error || `Failed to load publication data: ${error.response.statusText}`)
                }
            }

            throw error
        }
    }

    // Future methods for other technologies can be added here
    // static async publishChatbot(request: IChatbotPublishRequest): Promise<IChatbotPublishResponse> { ... }
    // static async publishWeb(request: IWebPublishRequest): Promise<IWebPublishResponse> { ... }
}
