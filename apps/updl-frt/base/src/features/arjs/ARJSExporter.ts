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
        const objectNodes = []
        const lightNodes = []
        const cameraNodes = []
        const sceneNodes = []

        // First, collect and classify all nodes
        for (const node of flow.graph.nodes) {
            if (node.type === 'UPDLObjectNode' || node.type === 'Object') {
                objectNodes.push(node)
            } else if (node.type === 'UPDLLightNode' || node.type === 'Light') {
                lightNodes.push(node)
            } else if (node.type === 'UPDLCameraNode' || node.type === 'Camera') {
                cameraNodes.push(node)
            } else if (node.type === 'UPDLSceneNode' || node.type === 'Scene') {
                sceneNodes.push(node)
            }
        }

        // Process objects first
        for (const node of objectNodes) {
            entities += this.createObjectEntity(node)
        }

        // Process lights
        for (const node of lightNodes) {
            entities += this.createLightEntity(node)
        }

        // If no objects were created, check if we have a scene to extract default object
        if (entities === '' && sceneNodes.length > 0) {
            // Try to extract a default object from scene data if available
            const sceneNode = sceneNodes[0]
            if (sceneNode.data && sceneNode.data.defaultObject) {
                entities += this.createObjectEntity(sceneNode.data.defaultObject)
            } else {
                // Use absolute fallback only if needed
                entities = `        <a-box position="0 0.5 0" material="color: #FF0000" scale="1 1 1"></a-box>\n`
            }
        }

        return entities
    }

    /**
     * Create an A-Frame entity for an object node
     */
    private createObjectEntity(node: any): string {
        // Extract basic properties with safe fallbacks
        const objectType = this.getNodeProperty(node, 'objectType', 'box')
        const position = {
            x: this.getNodeProperty(node, 'position.x', 0),
            y: this.getNodeProperty(node, 'position.y', 0.5),
            z: this.getNodeProperty(node, 'position.z', 0)
        }

        // Scale can come from either scale property or individual dimensions
        const scale = {
            x: this.getNodeProperty(node, 'scale.x', 1),
            y: this.getNodeProperty(node, 'scale.y', 1),
            z: this.getNodeProperty(node, 'scale.z', 1)
        }

        // Get color - try multiple locations where it might be stored
        let color = this.getNodeProperty(node, 'color', '')
        if (!color) {
            // Try other possible locations for color
            const colorObj = this.getNodeProperty(node, 'data.color', null) || node.color || (node.data ? node.data.color : null)

            if (colorObj) {
                // If color is an object with r,g,b properties
                if (typeof colorObj === 'object' && colorObj.r !== undefined) {
                    color = this.rgbToHex(colorObj.r, colorObj.g, colorObj.b)
                } else if (typeof colorObj === 'string') {
                    color = colorObj
                }
            }
        }

        // Use default red if no color found
        if (!color) {
            color = '#FF0000'
        }

        // Extract rotation if available
        const rotation = {
            x: this.getNodeProperty(node, 'rotation.x', 0),
            y: this.getNodeProperty(node, 'rotation.y', 0),
            z: this.getNodeProperty(node, 'rotation.z', 0)
        }

        // Extract dimensions based on object type
        const dimensions = this.getNodeProperty(node, 'dimensions', {}) || {}

        // Map UPDL object type to A-Frame primitive
        let primitive = 'box'
        let dimensionAttrs = ''

        switch (objectType.toLowerCase()) {
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
          rotation="${rotation.x} ${rotation.y} ${rotation.z}"
          scale="${scale.x} ${scale.y} ${scale.z}" 
          color="${color}"
          ${dimensionAttrs}>
        </a-${primitive}>\n`
    }

    /**
     * Create an A-Frame entity for a light node
     */
    private createLightEntity(node: any): string {
        // Extract properties with safe fallbacks
        const lightType = this.getNodeProperty(node, 'lightType', 'ambient')
        const position = {
            x: this.getNodeProperty(node, 'position.x', 0),
            y: this.getNodeProperty(node, 'position.y', 0),
            z: this.getNodeProperty(node, 'position.z', 0)
        }

        // Get color from node
        let color = '#FFFFFF'
        const colorObj = this.getNodeProperty(node, 'color', null) || (node.data ? node.data.color : null)

        if (colorObj) {
            // If color is an object with r,g,b properties
            if (typeof colorObj === 'object' && colorObj.r !== undefined) {
                color = this.rgbToHex(colorObj.r, colorObj.g, colorObj.b)
            } else if (typeof colorObj === 'string') {
                color = colorObj
            }
        }

        const intensity = this.getNodeProperty(node, 'intensity', 1.0)

        // Create the entity
        return `        <a-light 
          type="${lightType}" 
          position="${position.x} ${position.y} ${position.z}" 
          color="${color}" 
          intensity="${intensity}">
        </a-light>\n`
    }

    /**
     * Safely get a property from a node, with a default value if not found
     */
    private getNodeProperty(node: any, path: string, defaultValue: any): any {
        // First, check if property exists directly on node
        if (!node) return defaultValue

        // Handle direct properties
        if (!path.includes('.')) {
            return node[path] !== undefined ? node[path] : node.data && node.data[path] !== undefined ? node.data[path] : defaultValue
        }

        // Handle nested properties
        const parts = path.split('.')
        let current: any = node

        for (let i = 0; i < parts.length; i++) {
            if (current === undefined || current === null) return defaultValue

            current = current[parts[i]]
        }

        if (current === undefined) {
            // Try looking in node.data if available
            if (node.data) {
                current = node.data
                for (let i = 0; i < parts.length; i++) {
                    if (current === undefined || current === null) return defaultValue
                    current = current[parts[i]]
                }
            }
        }

        return current !== undefined ? current : defaultValue
    }

    /**
     * Convert RGB values to hex color string
     */
    private rgbToHex(r: number, g: number, b: number): string {
        // Ensure values are between 0-255
        r = Math.min(255, Math.max(0, Math.round(r)))
        g = Math.min(255, Math.max(0, Math.round(g)))
        b = Math.min(255, Math.max(0, Math.round(b)))

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
    }
}
