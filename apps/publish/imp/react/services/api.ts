// Universo Platformo | Publication API Service
// Service for interacting with the publication backend API

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
 * Publish a flow as an AR.js experience
 * @param flowId ID of the flow to publish
 * @param options AR.js publication options
 * @returns Publication result
 */
export async function publishARJSFlow(
    flowId: string,
    options: {
        marker: string
    }
): Promise<PublishResult> {
    return publishFlow(flowId, 'arjs', options)
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
    success: boolean
    publishedUrl?: string
    error?: string
    metadata?: Record<string, any>
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
