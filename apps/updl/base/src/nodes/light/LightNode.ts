// Universo Platformo | UPDL Light Node
// Defines a light source for a 3D scene

import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * LightNode represents a light source in the scene
 * It can be ambient, directional, point, or spot
 */
export class LightNode extends BaseUPDLNode {
    constructor() {
        // Configure node metadata
        super({
            name: 'Light',
            type: 'UPDLLight',
            icon: 'light.svg',
            description: 'Light source for illuminating a 3D scene',
            version: 1.0, // Adding version
            // Moved properties to inputs for UI rendering
            inputs: [
                {
                    name: 'lightName',
                    type: 'string',
                    label: 'Light Name',
                    description: 'Name of the light',
                    default: 'Main Light'
                },
                {
                    name: 'lightType',
                    type: 'options',
                    label: 'Light Type',
                    description: 'Type of light source',
                    options: [
                        { name: 'directional', label: 'Directional' },
                        { name: 'ambient', label: 'Ambient' },
                        { name: 'point', label: 'Point' }
                        // Spot light may be added later
                    ],
                    default: 'directional'
                },
                // Light color
                {
                    name: 'lightColor',
                    type: 'string',
                    label: 'Light Color',
                    description: 'Color of the light',
                    default: '',
                    optional: true,
                    additionalParams: true
                },
                // Intensity
                {
                    name: 'intensity',
                    type: 'number',
                    label: 'Intensity',
                    description: 'Brightness of the light',
                    default: 1,
                    min: 0,
                    max: 10,
                    step: 0.1,
                    additionalParams: true
                },
                // Position (for point and directional lights)
                {
                    name: 'positionX',
                    type: 'number',
                    label: 'Position X',
                    description: 'X position of the light',
                    default: 0,
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.lightType': ['point', 'directional']
                    }
                },
                {
                    name: 'positionY',
                    type: 'number',
                    label: 'Position Y',
                    description: 'Y position of the light',
                    default: 10, // Higher up for better illumination
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.lightType': ['point', 'directional']
                    }
                },
                {
                    name: 'positionZ',
                    type: 'number',
                    label: 'Position Z',
                    description: 'Z position of the light',
                    default: 10, // Further back for directional light
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.lightType': ['point', 'directional']
                    }
                },
                // Cast shadows
                {
                    name: 'castShadow',
                    type: 'boolean',
                    label: 'Cast Shadows',
                    description: 'Whether the light casts shadows',
                    default: true,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.lightType': ['directional', 'point']
                    }
                },
                // Ground color (for hemisphere lights - type not currently in options)
                {
                    name: 'groundColor',
                    type: 'string',
                    label: 'Ground Color',
                    description: 'Color of the light from below (for hemisphere light)',
                    default: '',
                    optional: true,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.lightType': ['hemisphere'] // hemisphere type not shown
                    }
                }
            ]
            // properties: [], // Removed properties array
        })
    }

    /**
     * Initialize the node with data from Flowise
     * @param nodeData Node data from Flowise
     */
    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        // Initialize light properties if needed
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data (not used for light properties)
     * @param options Additional options
     * @returns Light configuration
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Extract basic properties via nodeData.inputs
        const name = (nodeData.inputs?.lightName as string) || 'Main Light'
        const lightType = (nodeData.inputs?.lightType as string) || 'directional'

        // Light properties
        const lightColor = (nodeData.inputs?.lightColor as string) || '' // Use default from input definition
        const intensity = Number(nodeData.inputs?.intensity) || 1
        const castShadow = nodeData.inputs?.castShadow !== false // Default to true if undefined
        const groundColor = (nodeData.inputs?.groundColor as string) || '' // Use default from input definition

        // Position
        const positionX = Number(nodeData.inputs?.positionX) || 0
        const positionY = Number(nodeData.inputs?.positionY) || 10
        const positionZ = Number(nodeData.inputs?.positionZ) || 10

        // Generate a unique ID for the light
        const id = `light-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Create light configuration
        const lightConfig = {
            id,
            type: 'UPDLLight',
            name,
            lightType,
            color: lightColor,
            intensity,
            // Only include position for appropriate light types
            ...(lightType !== 'ambient' && {
                position: {
                    x: positionX,
                    y: positionY,
                    z: positionZ
                }
            }),
            // Only include shadow properties for appropriate light types
            ...(lightType !== 'ambient' && {
                castShadow
            }),
            // Only include ground color for hemisphere lights (if type is added)
            ...(lightType === 'hemisphere' && {
                groundColor
            })
        }

        return lightConfig
    }
}

// Для совместимости с Flowise экспортируем класс как nodeClass
module.exports = { nodeClass: LightNode }
