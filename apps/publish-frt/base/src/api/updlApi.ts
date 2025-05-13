/**
 * UPDL API Client
 * Provides functions for interacting with UPDL backend services
 */

import axios, { AxiosError } from 'axios'
// Import types for internal use
import { UPDLPublishOptions, Vector3, Color, UPDLCamera, UPDLLight, UPDLObject, UPDLScene } from '../interfaces/UPDLInterfaces'
import { ARJSExporter as ARJSExporterClass } from '../features/arjs/ARJSExporter'
import { getAuthHeaders, safeRequest } from '../services/apiUtils'

// Re-export types for external use
export type { UPDLScene, UPDLObject, UPDLCamera, UPDLLight, Vector3, Color, UPDLPublishOptions } from '../interfaces/UPDLInterfaces'

// Create placeholder values for types to preserve during bundling
export const UPDL = {
    // Use _as_ to explicitly indicate that this is a typed object
    Scene: null as unknown as UPDLScene,
    Object: null as unknown as UPDLObject,
    Camera: null as unknown as UPDLCamera,
    Light: null as unknown as UPDLLight,
    Vector3: null as unknown as Vector3,
    Color: null as unknown as Color
}

// Base API URL - adjust as needed based on your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

// Types
interface ErrorResponse {
    message: string
}

export interface PublishedScene {
    id: string
    title: string
    url: string
    markerType: string
    createdAt: string
    size: number
}

interface PublishARJSRequest {
    sceneId: string
    title: string
    html: string
    markerType: string
    markerValue: string
    isPublic?: boolean
    unikId?: string
}

interface PublishARJSResponse {
    id: string
    url: string
    title: string
    createdAt: string
    publishedUrl?: string
    publicUrl?: string
    dataUrl?: string
}

// Universo Platformo | UPDL API
// API client for UPDL functionality

// Base API setup
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

/**
 * Fetch a UPDL scene by ID
 * @param {string} sceneId - The ID of the scene to fetch
 * @returns {Promise<any>} - The scene data
 */
export const fetchUPDLScene = async (sceneId: string): Promise<any> => {
    try {
        const response = await api.get(`/updl/scene/${sceneId}`)
        return response.data.data
    } catch (error) {
        console.error('Error fetching UPDL scene:', error)
        throw new Error('Failed to fetch UPDL scene')
    }
}

/**
 * Generate AR.js HTML locally without server request
 * @param sceneData Scene data object
 * @param options AR.js options
 * @returns Generated HTML string
 */
export const generateARJSHTMLLocally = (sceneData: any, options: any): string => {
    console.log('🔍 [updlApi.generateARJSHTMLLocally] Generating AR.js HTML locally with options:', options)

    try {
        const exporter = new ARJSExporterClass()

        // Determine marker settings based on UI selections
        let markerTypeToUse: 'pattern' | 'barcode' | 'custom' = 'pattern' // Default pattern type
        let markerValueToUse = options.markerValue || 'hiro'

        if (options.markerType === 'preset') {
            markerTypeToUse = 'pattern'
            markerValueToUse = options.markerValue || 'hiro'
        } else if (options.markerType === 'pattern') {
            markerTypeToUse = 'pattern'
            markerValueToUse = options.markerValue || 'hiro'
        } else if (options.markerType === 'barcode') {
            markerTypeToUse = 'barcode'
            markerValueToUse = options.markerValue || '0'
        } else if (options.markerType === 'custom') {
            markerTypeToUse = 'custom'
            markerValueToUse = options.markerValue || ''
        }

        const html = exporter.generateHTML(sceneData, {
            title: options.title || 'AR.js Experience',
            markerType: markerTypeToUse,
            markerValue: markerValueToUse
        })

        console.log('🔍 [updlApi.generateARJSHTMLLocally] Successfully generated HTML, length:', html.length)
        return html
    } catch (error) {
        console.error('🔍 [updlApi.generateARJSHTMLLocally] Error generating HTML:', error)

        // Create a basic fallback HTML
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${options.title || 'AR.js Experience'}</title>
                <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
                <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
            </head>
            <body style="margin: 0; overflow: hidden;">
                <a-scene embedded arjs>
                    <a-marker preset="hiro">
                        <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
                    </a-marker>
                    <a-entity camera></a-entity>
                </a-scene>
                <!-- Fallback generated due to error: ${error instanceof Error ? error.message : 'Unknown error'} -->
            </body>
            </html>
        `
    }
}

/**
 * Publish an AR.js project
 * @param {PublishARJSRequest} request - The publication request
 * @returns {Promise<any>} - Publication result
 */
export const publishARJSProject = async (request: PublishARJSRequest): Promise<any> => {
    try {
        console.log('🔍 [updlApi.publishARJSProject] Publishing project with request:', {
            sceneId: request.sceneId,
            title: request.title,
            htmlLength: request.html ? request.html.length : 0,
            markerType: request.markerType,
            markerValue: request.markerValue,
            unikId: request.unikId
        })

        // Universo Platformo | Set default values
        const safeRequestData = {
            sceneId: request.sceneId || '',
            title: request.title || 'UPDL AR.js Project',
            html: request.html || '<!-- Empty HTML -->',
            markerType: request.markerType || 'pattern',
            markerValue: request.markerValue || 'hiro',
            isPublic: typeof request.isPublic === 'boolean' ? request.isPublic : true,
            unikId: request.unikId || ''
        }

        console.log('🔍 [updlApi.publishARJSProject] Created safe request with defaults:', safeRequestData)

        // Save HTML in localStorage for debugging and fallback
        try {
            const truncatedHtml =
                safeRequestData.html.length > 100000 ? safeRequestData.html.substring(0, 100000) + '...(truncated)' : safeRequestData.html

            localStorage.setItem('arjs-last-html', truncatedHtml)
            localStorage.setItem(
                'arjs-last-request',
                JSON.stringify({
                    sceneId: safeRequestData.sceneId,
                    title: safeRequestData.title,
                    markerType: safeRequestData.markerType,
                    markerValue: safeRequestData.markerValue,
                    isPublic: safeRequestData.isPublic,
                    unikId: safeRequestData.unikId
                })
            )
            console.log('🔍 [updlApi.publishARJSProject] Saved HTML and request data to localStorage')
        } catch (storageError) {
            console.warn('🔍 [updlApi.publishARJSProject] Failed to save to localStorage:', storageError)
        }

        // Get authentication headers
        const authHeaders = getAuthHeaders()
        console.log('🔍 [updlApi.publishARJSProject] Using auth headers:', Object.keys(authHeaders).length > 0 ? 'Present' : 'None')

        console.log('🔍 [updlApi.publishARJSProject] Attempting to send request to /api/updl/publish/arjs')

        // Use safeRequest directly, instead of dynamic import
        const apiResponse = await safeRequest('/api/updl/publish/arjs', {
            method: 'POST',
            headers: {
                ...authHeaders
            },
            body: JSON.stringify(safeRequestData)
        })

        console.log('🔍 [updlApi.publishARJSProject] Received response:', apiResponse)

        if (!apiResponse || !apiResponse.id) {
            console.error('🔍 [updlApi.publishARJSProject] Invalid response received:', apiResponse)
            throw new Error('Publication failed: Invalid response from server')
        }

        return apiResponse
    } catch (error) {
        console.error('🔍 [updlApi.publishARJSProject] Error publishing AR.js project:', error)
        // In case of an error, throw an informative error
        throw new Error(`Failed to publish AR.js project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Get a published AR.js project
 * @param {string} publishId - The ID of the published project
 * @returns {Promise<any>} - The publication data
 */
export const getARJSPublication = async (publishId: string): Promise<any> => {
    try {
        const response = await api.get(`/updl/publication/arjs/${publishId}`)
        return response.data.data
    } catch (error) {
        console.error('Error getting AR.js publication:', error)
        throw new Error('Failed to get AR.js publication')
    }
}

/**
 * List all published AR.js projects
 * @returns {Promise<any[]>} - List of publications
 */
export const listARJSPublications = async (): Promise<any[]> => {
    try {
        const response = await api.get('/updl/publications/arjs')
        return response.data.data
    } catch (error) {
        console.error('Error listing AR.js publications:', error)
        throw new Error('Failed to list AR.js publications')
    }
}

/**
 * Fetch all available UPDL scenes
 * @returns Promise resolving to an array of scene summaries
 */
export async function fetchUPDLScenes(): Promise<UPDLScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/scenes`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error fetching UPDL scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to fetch UPDL scenes')
    }
}

/**
 * Delete a published AR.js project
 * @param projectId - The ID of the project to delete
 * @returns Promise resolving to the delete response
 */
export async function deleteARJSProject(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/arjs/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting AR.js project:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete AR.js project')
    }
}

/**
 * List all published UPDL scenes
 * @returns Promise with the list of published scenes
 */
export async function listPublishedScenes(): Promise<PublishedScene[]> {
    try {
        const response = await axios.get(`${API_BASE_URL}/updl/published`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error listing published scenes:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to list published scenes')
    }
}

/**
 * Delete a published scene
 * @param publishId The ID of the published scene to delete
 * @returns Promise with the deletion response
 */
export async function deletePublishedScene(id: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/updl/published/${id}`)
    } catch (error) {
        const axiosError = error as AxiosError<ErrorResponse>
        console.error('Error deleting published scene:', axiosError)
        throw new Error(axiosError.response?.data?.message || 'Failed to delete published scene')
    }
}

/**
 * Fetches all available UPDL scenes
 * @returns Promise with an array of scenes
 */
export const fetchAllUPDLScenes = async () => {
    try {
        const response = await fetch('/api/updl/scenes')

        if (!response.ok) {
            throw new Error(`Failed to fetch scenes: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error fetching UPDL scenes:', error)
        throw error
    }
}

/**
 * Deletes a UPDL scene
 * @param sceneId - The ID of the scene to delete
 * @returns Promise with the deletion result
 */
export const deleteUPDLScene = async (sceneId: string) => {
    try {
        const response = await fetch(`/api/updl/scenes/${sceneId}`, {
            method: 'DELETE'
        })

        if (!response.ok) {
            throw new Error(`Failed to delete scene: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Error deleting UPDL scene:', error)
        throw error
    }
}
