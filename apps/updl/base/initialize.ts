// Universo Platformo | UPDL Initialization
// Initializes exporters and other UPDL components

import { ExporterRegistry } from './exporters/ExporterRegistry'
import { ExporterManager } from './exporters/ExporterManager'
import { ExportAPI } from './api/exportAPI'

// Import exporters
import { ARJSExporter } from './miniapps/arjs/ARJSExporter'

/**
 * Initializes the exporter system
 */
export function initializeExporters(): ExporterManager {
    const registry = new ExporterRegistry()

    // Register exporters
    registry.register(new ARJSExporter())
    // Will be uncommented as soon as implementation is complete
    // registry.register(new PlayCanvasReactExporter())

    return new ExporterManager(registry)
}

/**
 * Initializes and returns the export API
 */
export function getExportAPI(): ExportAPI {
    const exporterManager = initializeExporters()
    return new ExportAPI(exporterManager)
}

/**
 * Initializes the UPDL system
 * @returns The initialization result
 */
export function initializeUPDL() {
    console.log('Initializing UPDL system...')

    // Initialize exporters
    const exporterManager = initializeExporters()

    console.log('UPDL system initialized successfully')

    return {
        exporterManager
    }
}

// Default export for convenience
export default getExportAPI()
