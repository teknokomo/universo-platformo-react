// Universo Platformo | API client for publishing AR.js applications
import axios, { AxiosError } from 'axios'
import { getAuthHeaders } from '../services/api'
import { IARJSPublishRequest, IARJSPublishResponse, IUPDLFlowResult } from '@server/interface'

// Universo Platformo | Universal definition of API base URL
// In development mode, we use a relative path, since UI and API are on the same domain (via Vite proxy).
// For production or explicit specification, use the VITE_API_HOST environment variable.
const getApiBaseUrl = () => {
    try {
        // @ts-ignore - ignore error for import.meta.env
        if (import.meta.env && import.meta.env.DEV) {
            return window.location.origin
        }

        // @ts-ignore
        const configuredHost = import.meta.env && import.meta.env.VITE_API_HOST
        if (configuredHost) {
            return configuredHost
        }

        return window.location.origin
    } catch (error) {
        console.warn('Error determining API base URL, falling back to origin:', error)
        return window.location.origin
    }
}

// Get base URL when initializing module
const API_BASE_URL = getApiBaseUrl()

/**
 * API client for working with AR.js project publication
 * Optimized for streaming generation mode
 */
export class ARJSPublishApi {
    /**
     * Gets authorization headers and adds them to the passed headers
     * @param headers Existing headers (optional)
     * @returns Combined headers with authorization
     */
    private static getHeaders(headers: Record<string, string> = {}): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...headers
        }
    }

    /**
     * Creates a new AR.js publication in streaming generation mode
     * @param request Publication creation request
     * @returns Information about the created publication
     */
    static async publishARJS(request: IARJSPublishRequest): Promise<IARJSPublishResponse> {
        try {
            const apiUrl = `${API_BASE_URL}/api/v1/publish/arjs`
            console.log('🚀 [ARJSPublishApi] Publishing AR.js project:', request.chatflowId)

            const response = await axios.post<IARJSPublishResponse>(apiUrl, request, {
                headers: this.getHeaders()
            })

            console.log('✅ [ARJSPublishApi] Publication successful:', response.data.publicationId)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('❌ [ARJSPublishApi] Publication failed:', error.response?.data || error.message)

                if (error.response) {
                    const errorMessage = error.response.data?.error || error.response.statusText || error.message
                    throw new Error(`Publication failed: ${errorMessage}`)
                }
            } else {
                console.error('❌ [ARJSPublishApi] Unexpected error:', error instanceof Error ? error.message : 'Unknown error')
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
    static async getPublicationData(
        publicationId: string
    ): Promise<IUPDLFlowResult & { id: string; projectId: string; settings: any; createdAt: string }> {
        try {
            const publicationUrl = `${API_BASE_URL}/api/v1/publish/arjs/public/${publicationId}`
            console.log('🚀 [ARJSPublishApi] Loading publication:', publicationId)

            const response = await axios.get<IUPDLFlowResult & { id: string; projectId: string; settings: any; createdAt: string }>(
                publicationUrl,
                {
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache',
                        Expires: '0'
                    }
                }
            )

            console.log('✅ [ARJSPublishApi] Publication data loaded successfully')
            return response.data
        } catch (error: unknown) {
            console.error('❌ [ARJSPublishApi] Failed to load publication:', error instanceof Error ? error.message : 'Unknown error')

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
}
