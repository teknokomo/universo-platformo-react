// Universo Platformo | UPDL Module
// Main entry point for UPDL functionality

import { initializeUPDL, getExportAPI } from './initialize'
import { ExportAPI } from './api/exportAPI'
import { UPDLFlow, ExporterOptions } from './interfaces/UPDLInterfaces'
import { ExportResult } from './interfaces/ExporterInterface'

// Export classes for external use
export { SceneNode } from './nodes/scene/SceneNode'
export { ObjectNode } from './nodes/object/ObjectNode'
export { CameraNode } from './nodes/camera/CameraNode'
export { LightNode } from './nodes/light/LightNode'

// Re-export interfaces
export * from './interfaces/UPDLInterfaces'
export * from './interfaces/ExporterInterface'

// Global UPDL instance
let globalUPDL: {
    exporterManager: any
    exportAPI: ExportAPI
} | null = null

/**
 * Initializes the UPDL system if not already initialized
 * @param options Initialization options
 * @returns UPDL API objects
 */
export function getUPDL(options?: { forceInit?: boolean }): { exportAPI: ExportAPI } {
    // Initialize if not already done or force reinitialization
    if (globalUPDL === null || options?.forceInit) {
        const { exporterManager } = initializeUPDL()
        const exportAPI = new ExportAPI(exporterManager)

        globalUPDL = {
            exporterManager,
            exportAPI
        }
    }

    return {
        exportAPI: globalUPDL.exportAPI
    }
}

/**
 * Exports a UPDL flow using the specified exporter
 * This convenience function initializes UPDL if necessary
 * @param flow UPDL flow to export
 * @param exporterId ID of the exporter to use
 * @param options Export options
 * @returns Export result
 */
export async function exportUPDLFlow(flow: any, exporterId: string, options: any = {}): Promise<any> {
    const { exportAPI } = getUPDL()
    return exportAPI.exportFlow(flow, exporterId, options)
}

/**
 * Gets information about all available exporters
 * This convenience function initializes UPDL if necessary
 * @returns Array of exporter information objects
 */
export function getAvailableExporters(): any[] {
    const { exportAPI } = getUPDL()
    return exportAPI.getAvailableExporters()
}

/**
 * Converts a flow from the Flowise format to the UPDL format
 * This convenience function initializes UPDL if necessary
 * @param flowiseFlow Flowise flow data
 * @returns UPDL flow
 */
export function convertFlowiseToUPDL(flowiseFlow: any): any {
    const { exportAPI } = getUPDL()
    return exportAPI.convertFlowiseToUPDL(flowiseFlow)
}
