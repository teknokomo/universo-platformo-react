// Universo Platformo | Exporter Manager
// Manages the export process for UPDL flows

import { ExporterRegistry } from './ExporterRegistry'
import { UPDLFlow, ExporterOptions } from '../../interfaces/UPDLInterfaces'
import { ExportResult, ExporterInfo, Exporter } from '../../interfaces/ExporterInterface'

// Re-export ExporterInfo for external use
export { ExporterInfo }

/**
 * Manager for handling export operations
 */
export class ExporterManager {
    /**
     * Registry containing all available exporters
     */
    private registry: ExporterRegistry

    /**
     * Constructor for ExporterManager
     */
    constructor() {
        this.registry = new ExporterRegistry()
        this.registerDefaultExporters()
    }

    /**
     * Register default exporters
     */
    private registerDefaultExporters() {
        // Mock exporter for HTML
        const htmlExporter: Exporter = {
            getInfo: () => ({
                id: 'html',
                name: 'HTML Exporter',
                description: 'Exports UPDL scenes to standalone HTML',
                supportedFeatures: ['web', 'standalone'],
                supportedPlatforms: ['browser'],
                supportedFormats: ['html']
            }),
            export: async (flow: UPDLFlow, options?: ExporterOptions) => {
                // Generate a simple HTML page with the flow data
                const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${flow.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
    </style>
</head>
<body>
    <h1>${flow.name}</h1>
    <p>${flow.description || 'No description provided.'}</p>
    <h2>Flow Data</h2>
    <pre>${JSON.stringify(flow, null, 2)}</pre>
    <script>
        console.log('UPDL Flow:', ${JSON.stringify(flow)});
    </script>
</body>
</html>
                `.trim()

                return {
                    format: 'html',
                    mainFile: {
                        filename: 'index.html',
                        content: html
                    },
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        exporterId: 'html'
                    }
                }
            }
        }

        // Mock exporter for AR.js
        const arjsExporter: Exporter = {
            getInfo: () => ({
                id: 'arjs',
                name: 'AR.js Exporter',
                description: 'Exports UPDL scenes to AR.js web applications',
                supportedFeatures: ['ar', 'web', 'markers'],
                supportedPlatforms: ['browser', 'mobile'],
                supportedFormats: ['html']
            }),
            export: async (flow: UPDLFlow, options?: ExporterOptions) => {
                // Generate a simple AR.js page with the flow data
                const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${flow.name} - AR.js</title>
    <script src="https://aframe.io/releases/1.3.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <style>
        body { margin: 0; overflow: hidden; }
        .arjs-loader {
            height: 100%;
            width: 100%;
            position: absolute;
            top: 0;
            left: 0;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .arjs-loader div {
            text-align: center;
            font-size: 1.25em;
            color: white;
        }
    </style>
</head>
<body style="margin: 0; overflow: hidden;">
    <div class="arjs-loader">
        <div>Loading AR experience, please wait...</div>
    </div>
    
    <a-scene embedded arjs="trackingMethod: best; sourceType: webcam; debugUIEnabled: false;">
        <a-marker preset="hiro">
            <a-box position="0 0.5 0" material="color: red;"></a-box>
        </a-marker>
        
        <a-entity camera></a-entity>
    </a-scene>
    
    <script>
        // Hide loader when the scene is ready
        document.querySelector('a-scene').addEventListener('loaded', function () {
            document.querySelector('.arjs-loader').style.display = 'none';
        });
        
        // UPDL Flow data
        const updlFlow = ${JSON.stringify(flow)};
        console.log('UPDL Flow:', updlFlow);
    </script>
</body>
</html>
                `.trim()

                return {
                    format: 'html',
                    mainFile: {
                        filename: 'index.html',
                        content: html
                    },
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        exporterId: 'arjs'
                    }
                }
            }
        }

        // Register the mock exporters
        this.registry.register(htmlExporter)
        this.registry.register(arjsExporter)
    }

    /**
     * Export a UPDL flow using a specific exporter
     * @param flow UPDL flow to export
     * @param exporterId ID of the exporter to use
     * @param options Export options
     * @returns Export result with generated content
     * @throws Error if exporter not found
     */
    async exportFlow(flow: UPDLFlow, exporterId: string, options: ExporterOptions = {}): Promise<ExportResult> {
        // Get the requested exporter
        const exporter = this.registry.get(exporterId)
        if (!exporter) {
            throw new Error(`Exporter not found: ${exporterId}`)
        }

        console.log(`Exporting flow "${flow.name}" with ${exporter.getInfo().name} exporter`)

        // Perform the export
        try {
            const result = await exporter.export(flow, options)
            console.log(`Export completed successfully with ${exporter.getInfo().name}`)
            return result
        } catch (error) {
            console.error(`Export failed with ${exporter.getInfo().name}:`, error)
            throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Get information about all available exporters
     * @returns Array of exporter info objects
     */
    getAvailableExporters(): ExporterInfo[] {
        return this.registry.getAll().map((exporter) => exporter.getInfo())
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporter info objects
     */
    getExportersByFeature(feature: string): ExporterInfo[] {
        return this.registry.getByFeature(feature).map((exporter) => exporter.getInfo())
    }
}
