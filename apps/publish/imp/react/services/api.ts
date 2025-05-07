// Universo Platformo | Publication API Service
// Service for interacting with the publication backend API

import axios from 'axios'
import { publishARJSProject } from '../api/updlApi'
import { ARJSExporter, MarkerType } from '../miniapps/arjs/ARJSExporter'

/**
 * Get available exporters for UPDL flows
 * @returns List of available exporters
 */
export async function getExporters(): Promise<ExporterInfo[]> {
    try {
        const response = await fetch('/api/v1/publish/exporters')

        if (!response.ok) {
            throw new Error(`Failed to get exporters: ${response.statusText}`)
        }

        const data = await response.json()
        return data.exporters
    } catch (error) {
        console.error('Error fetching exporters:', error)
        throw error
    }
}

/**
 * Publish a flow using the specified exporter
 * @param flowId ID of the flow to publish
 * @param exporterId ID of the exporter to use
 * @param options Publication options
 * @returns Publication result
 */
export async function publishFlow(flowId: string, exporterId: string, options: Record<string, any> = {}): Promise<PublishResult> {
    try {
        const response = await fetch('/api/v1/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                flowId,
                exporterId,
                options
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `Failed to publish: ${response.statusText}`)
        }

        return await response.json()
    } catch (error) {
        console.error('Error publishing flow:', error)
        throw error
    }
}

/**
 * Get available markers for AR.js
 * @returns List of available markers
 */
export async function getARJSMarkers(): Promise<MarkerInfo[]> {
    try {
        const response = await fetch('/api/v1/publish/arjs/markers')

        if (!response.ok) {
            throw new Error(`Failed to get AR.js markers: ${response.statusText}`)
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching AR.js markers:', error)
        throw error
    }
}

/**
 * Get chatflow by ID
 * @param id - ID of the chatflow
 */
export const getChatflow = async (id: string) => {
    try {
        const response = await axios.get(`/api/v1/chatflows/${id}`)
        return response.data
    } catch (error) {
        console.error('Error fetching chatflow:', error)
        throw error
    }
}

/**
 * Publish AR.js flow
 * @param flowId - ID of the flow to publish
 * @param options - Publishing options
 * @returns Publish result with URL
 */
export const publishARJSFlow = async (
    flowId: string,
    options: {
        marker: string
        isPublic: boolean
        unikId?: string
    }
): Promise<PublishResult> => {
    try {
        // Get chatflow data
        const chatflowData = await getChatflow(flowId)

        // Generate title from flow name
        const title = chatflowData.name || `AR Experience ${flowId}`

        // Create exporter instance
        const exporter = new ARJSExporter()

        // Get UPDL scene from chatflow nodes (simplified for now)
        // In a real implementation, this would traverse the nodes to build a UPDL scene
        const updlScene = {
            id: flowId,
            name: title,
            updatedAt: new Date().toISOString()
            // Nodes will be automatically processed with default values
        }

        // Generate HTML with marker
        const html = exporter.generateHTML(updlScene, {
            title: title,
            markerType: MarkerType.PATTERN,
            markerValue: options.marker
        })

        // Publish to backend
        const publishResult = await publishARJSProject({
            sceneId: flowId,
            title: title,
            html: html,
            markerType: 'pattern',
            markerValue: options.marker,
            unikId: options.unikId
        })

        return {
            success: true,
            publishedUrl: publishResult.url,
            id: publishResult.id,
            url: publishResult.url,
            title: publishResult.title,
            metadata: {
                id: publishResult.id,
                title: publishResult.title,
                timestamp: new Date().toISOString(),
                exporterId: 'arjs',
                options: {
                    marker: options.marker,
                    isPublic: options.isPublic
                }
            }
        }
    } catch (error) {
        console.error('Error publishing AR.js flow:', error)
        return {
            success: false,
            publishedUrl: '',
            id: '',
            url: '',
            error: error instanceof Error ? error.message : 'Unknown error publishing AR.js flow'
        }
    }
}

// Interface definitions

/**
 * Information about an exporter
 */
export interface ExporterInfo {
    id: string
    name: string
    description: string
    features: string[]
    iconUrl?: string
}

/**
 * Result of a publication operation
 */
export interface PublishResult {
    /**
     * Indicates if publishing was successful
     */
    success: boolean

    /**
     * URL where the published content can be accessed
     * Only present when success is true
     */
    publishedUrl: string

    /**
     * Error message if publishing failed
     * Only present when success is false
     */
    error?: string

    /**
     * Additional metadata about the publishing operation
     */
    metadata?: Record<string, any>

    /**
     * Original API response fields (for backward compatibility)
     */
    id: string
    url: string
    title?: string
}

/**
 * Information about an AR marker
 */
export interface MarkerInfo {
    id: string
    name: string
    description?: string
    imageUrl?: string
}
