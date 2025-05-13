// Universo Platformo | Exporter API client
import httpClient from './httpClient'
import { UPDL_API_URL } from '../configs/constants'

interface ExporterInfo {
    id: string
    name: string
    description: string
    icon?: string
}

interface ExportOptions {
    title?: string
    description?: string
    [key: string]: any
}

interface ExportResponse {
    success: boolean
    exporterId: string
    result: any
}

/**
 * Get all available exporters
 */
export const getExporters = async (): Promise<ExporterInfo[]> => {
    try {
        const response = await httpClient.get(`${UPDL_API_URL}/exporters`)
        return response.data
    } catch (error) {
        console.error('Failed to fetch exporters:', error)
        throw error
    }
}

/**
 * Export UPDL scene to specified format
 */
export const exportScene = async (flowData: any, exporterId: string, options?: ExportOptions): Promise<ExportResponse> => {
    try {
        const response = await httpClient.post(`${UPDL_API_URL}/export`, {
            flowData,
            exporterId,
            options
        })
        return response.data
    } catch (error) {
        console.error(`Failed to export scene with ${exporterId}:`, error)
        throw error
    }
}

export default {
    getExporters,
    exportScene
}
