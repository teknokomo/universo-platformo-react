// Universo Platformo | Export API Client
// Client-side API for interacting with the UPDL export server

import axios from 'axios'
import { UPDLFlow } from '../interfaces/UPDLInterfaces'

// Default API endpoint
const DEFAULT_API_ENDPOINT = '/api/updl/export'

/**
 * Client for the UPDL Export API
 */
export class ExportAPIClient {
    /**
     * Base URL for API requests
     */
    private baseUrl: string

    /**
     * Constructor
     * @param baseUrl Optional base URL override
     */
    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || DEFAULT_API_ENDPOINT
    }

    /**
     * Export a flow using the specified exporter
     * @param flow UPDL flow to export
     * @param exporterId ID of the exporter to use
     * @param options Export options
     * @returns Export result
     */
    async exportFlow(flow: UPDLFlow, exporterId: string, options: any = {}) {
        try {
            const response = await axios.post(this.baseUrl, {
                flow,
                exporterId,
                options
            })
            return response.data
        } catch (error) {
            console.error('Error exporting flow:', error)
            throw new Error(error instanceof Error ? error.message : 'Unknown error during export')
        }
    }

    /**
     * Get all available exporters
     * @returns Array of exporter info objects
     */
    async getAvailableExporters() {
        try {
            const response = await axios.get(`${this.baseUrl}/exporters`)
            return response.data.exporters
        } catch (error) {
            console.error('Error fetching exporters:', error)
            throw new Error(error instanceof Error ? error.message : 'Unknown error fetching exporters')
        }
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporter info objects
     */
    async getExportersByFeature(feature: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/exporters/byFeature/${feature}`)
            return response.data.exporters
        } catch (error) {
            console.error(`Error fetching exporters by feature "${feature}":`, error)
            throw new Error(error instanceof Error ? error.message : `Unknown error fetching exporters for feature "${feature}"`)
        }
    }

    /**
     * Convert a flow from Flowise format to UPDL format
     * @param flowiseFlow Flow data from Flowise
     * @returns UPDL flow
     */
    async convertFlowiseToUPDL(flowiseFlow: any) {
        try {
            const response = await axios.post(`${this.baseUrl}/convert`, {
                flow: flowiseFlow
            })
            return response.data.updlFlow
        } catch (error) {
            console.error('Error converting flow:', error)
            throw new Error(error instanceof Error ? error.message : 'Unknown error converting flow')
        }
    }
}

// Create and export a default instance
export const exportAPI = new ExportAPIClient()
