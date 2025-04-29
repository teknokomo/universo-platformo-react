// Universo Platformo | AR.js Exporter
// Exports UPDL flows to AR.js/A-Frame for web-based augmented reality

import { ExporterInterface, ValidationResult, ExportResult } from '../../interfaces/ExporterInterface'
import { UPDLFlow, ExporterOptions } from '../../interfaces/UPDLInterfaces'

/**
 * AR.js exporter implementation
 */
export class ARJSExporter implements ExporterInterface {
    /**
     * Unique identifier for the exporter
     */
    id = 'arjs'

    /**
     * Display name of the exporter
     */
    name = 'AR.js / A-Frame'

    /**
     * Description of the exporter
     */
    description = 'Export to AR.js with A-Frame for web-based augmented reality'

    /**
     * Features supported by this exporter
     */
    supportedFeatures = ['marker-based-ar', 'web-ar', 'a-frame']

    /**
     * Validate if a flow can be exported with AR.js
     */
    validate(flow: UPDLFlow): ValidationResult {
        // Check for required nodes (Scene)
        const hasScene = flow.graph.nodes.some((node) => node.type === 'UPDLSceneNode' || node.type === 'Scene')

        if (!hasScene) {
            return {
                valid: false,
                errors: ['Scene node is required for AR.js export']
            }
        }

        // Additional validations for AR.js
        // For example, check for 3D objects that can be rendered

        return { valid: true }
    }

    /**
     * Export a flow to AR.js/A-Frame
     */
    async export(flow: UPDLFlow, options: ExporterOptions): Promise<ExportResult> {
        // Generate A-Frame HTML content
        const htmlContent = this.generateAFrameHTML(flow, options)

        // Return the result
        return {
            format: 'html',
            mainFile: {
                filename: 'index.html',
                content: htmlContent
            }
            // Assets would be included here
        }
    }

    /**
     * Generate A-Frame HTML content for the flow
     */
    private generateAFrameHTML(flow: UPDLFlow, options: ExporterOptions): string {
        const markerType = options.markerType || 'hiro'

        // Start with basic HTML template
        let html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>AR.js Experience - ${flow.name || 'UPDL Scene'}</title>
    <meta name="description" content="AR experience created with Universo Platformo">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
  </head>
  <body style="margin: 0; overflow: hidden;">
    <a-scene embedded arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;">
      <a-assets>
        <!-- Models and textures would be loaded here -->
      </a-assets>
      
      <!-- AR.js marker -->
      <a-marker preset="${markerType}">
`

        // Process nodes to create A-Frame entities
        html += this.processNodesToAFrame(flow)

        // Close the template
        html += `
      </a-marker>
      
      <!-- Camera -->
      <a-entity camera></a-entity>
    </a-scene>
  </body>
</html>
`

        return html
    }

    /**
     * Process UPDL nodes to A-Frame entities
     */
    private processNodesToAFrame(flow: UPDLFlow): string {
        let entities = ''

        // Process nodes
        for (const node of flow.graph.nodes) {
            switch (node.type) {
                case 'UPDLSceneNode':
                case 'Scene':
                    // Scene node is represented by the a-marker in A-Frame
                    break

                case 'UPDLObjectNode':
                case 'Object':
                    // Create an object entity
                    entities += this.createObjectEntity(node)
                    break

                case 'UPDLLightNode':
                case 'Light':
                    // Create a light entity
                    entities += this.createLightEntity(node)
                    break

                case 'UPDLCameraNode':
                case 'Camera':
                    // Camera is handled separately in A-Frame/AR.js
                    break

                // Add cases for other node types as they are implemented
            }
        }

        // If no entities were created, add a default red box as fallback
        if (entities === '') {
            entities = `        <a-box position="0 0.5 0" color="#FF0000" scale="1 1 1"></a-box>\n`
        }

        return entities
    }

    /**
     * Create an A-Frame entity for an object node
     */
    private createObjectEntity(node: any): string {
        // Extract basic properties
        const objectType = node.objectType || 'box'
        const position = node.position || { x: 0, y: 0.5, z: 0 }
        const scale = node.scale || { x: 1, y: 1, z: 1 }
        const color = node.color || '#FF0000'

        // Extract dimensions based on object type
        const dimensions = node.dimensions || {}

        // Map UPDL object type to A-Frame primitive
        let primitive = 'box'
        let dimensionAttrs = ''

        switch (objectType) {
            case 'box':
                primitive = 'box'
                dimensionAttrs =
                    dimensions.width && dimensions.height && dimensions.depth
                        ? `width="${dimensions.width}" height="${dimensions.height}" depth="${dimensions.depth}"`
                        : ''
                break

            case 'sphere':
                primitive = 'sphere'
                dimensionAttrs = dimensions.radius ? `radius="${dimensions.radius}"` : ''
                break

            case 'cylinder':
                primitive = 'cylinder'
                dimensionAttrs = dimensions.radius && dimensions.height ? `radius="${dimensions.radius}" height="${dimensions.height}"` : ''
                break

            case 'plane':
                primitive = 'plane'
                dimensionAttrs = dimensions.width && dimensions.height ? `width="${dimensions.width}" height="${dimensions.height}"` : ''
                break

            default:
                primitive = 'box'
        }

        // Create the entity with extracted properties
        return `        <a-${primitive} 
          position="${position.x} ${position.y} ${position.z}" 
          scale="${scale.x} ${scale.y} ${scale.z}" 
          color="${color}"
          ${dimensionAttrs}>
        </a-${primitive}>\n`
    }

    /**
     * Create an A-Frame entity for a light node
     */
    private createLightEntity(node: any): string {
        // Extract properties
        const lightType = node.lightType || 'ambient'
        const position = node.worldPosition || { x: 0, y: 0, z: 0 }
        const color = node.color || '#FFFFFF'
        const intensity = node.intensity || 1.0

        // Create the entity
        return `        <a-light 
          type="${lightType}" 
          position="${position.x} ${position.y} ${position.z}" 
          color="${color}" 
          intensity="${intensity}">
        </a-light>\n`
    }
}
