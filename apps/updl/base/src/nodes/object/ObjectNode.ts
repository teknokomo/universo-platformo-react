// Universo Platformo | UPDL Object Node
// Defines a 3D object in the scene

import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * ObjectNode represents a 3D object in the scene
 * It can be a primitive (cube, sphere, etc.) or a 3D model
 */
export class ObjectNode extends BaseUPDLNode {
    constructor() {
        // Configure node metadata
        super({
            name: 'Object',
            type: 'UPDLObject',
            icon: 'object.svg',
            description: '3D object that can be added to a scene',
            version: 1.0, // Adding version
            // Inputs are for connection points, properties are for UI fields
            // Moved properties to inputs for UI rendering
            inputs: [
                {
                    name: 'name',
                    type: 'string',
                    label: 'Object Name',
                    description: 'Name of the object',
                    default: 'My Object'
                },
                {
                    name: 'objectType',
                    type: 'options',
                    label: 'Object Type',
                    description: 'Type of 3D object',
                    options: [
                        { name: 'box', label: 'Box' },
                        { name: 'sphere', label: 'Sphere' },
                        { name: 'cylinder', label: 'Cylinder' },
                        { name: 'plane', label: 'Plane' }
                        // Model option removed for initial testing
                    ],
                    default: 'box'
                },
                // Position
                {
                    name: 'positionX',
                    type: 'number',
                    label: 'Position X',
                    description: 'X position of the object',
                    default: 0,
                    step: 0.1,
                    additionalParams: true
                },
                {
                    name: 'positionY',
                    type: 'number',
                    label: 'Position Y',
                    description: 'Y position of the object',
                    default: 0.5, // Slightly raised for visibility on marker
                    step: 0.1,
                    additionalParams: true
                },
                {
                    name: 'positionZ',
                    type: 'number',
                    label: 'Position Z',
                    description: 'Z position of the object',
                    default: 0,
                    step: 0.1,
                    additionalParams: true
                },
                // Scale - simplified to uniform scaling
                {
                    name: 'scale',
                    type: 'number',
                    label: 'Scale',
                    description: 'Uniform scale of the object',
                    default: 1,
                    step: 0.1,
                    additionalParams: true
                },
                // Color as a field for input, not a connection
                {
                    name: 'color',
                    type: 'string',
                    label: 'Color',
                    description: 'Color of the object (hex code)',
                    default: '#ff0000', // Red color as default
                    additionalParams: true
                },
                // Box specific
                {
                    name: 'width',
                    type: 'number',
                    label: 'Width',
                    description: 'Width of the box or plane',
                    default: 1,
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.objectType': ['box', 'plane']
                    }
                },
                {
                    name: 'height',
                    type: 'number',
                    label: 'Height',
                    description: 'Height of the box, plane or cylinder',
                    default: 1,
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.objectType': ['box', 'plane', 'cylinder']
                    }
                },
                {
                    name: 'depth',
                    type: 'number',
                    label: 'Depth',
                    description: 'Depth of the box',
                    default: 1,
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.objectType': ['box']
                    }
                },
                // Sphere specific
                {
                    name: 'radius',
                    type: 'number',
                    label: 'Radius',
                    description: 'Radius of the sphere or cylinder',
                    default: 1,
                    step: 0.1,
                    additionalParams: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.objectType': ['sphere', 'cylinder']
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
        // Initialize object properties if needed
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data (not used directly for properties)
     * @param options Additional options
     * @returns Object configuration
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Access properties via nodeData.inputs
        const name = (nodeData.inputs?.name as string) || 'My Object'
        const objectType = (nodeData.inputs?.objectType as string) || 'box'

        // Position
        const positionX = Number(nodeData.inputs?.positionX) || 0
        const positionY = Number(nodeData.inputs?.positionY) || 0.5
        const positionZ = Number(nodeData.inputs?.positionZ) || 0

        // Scale - now uniform
        const scale = Number(nodeData.inputs?.scale) || 1

        // Color
        const color = (nodeData.inputs?.color as string) || '#ff0000'

        // Shape specific properties
        const width = Number(nodeData.inputs?.width) || 1
        const height = Number(nodeData.inputs?.height) || 1
        const depth = Number(nodeData.inputs?.depth) || 1
        const radius = Number(nodeData.inputs?.radius) || 1

        // Generate a unique ID for the object
        const id = `object-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Create the object configuration
        const objectConfig = {
            id,
            type: 'UPDLObject',
            name,
            objectType,
            position: {
                x: positionX,
                y: positionY,
                z: positionZ
            },
            scale: { x: scale, y: scale, z: scale },
            color,
            // Include shape-specific properties based on the object type
            ...(objectType === 'box' && {
                width,
                height,
                depth
            }),
            ...(objectType === 'sphere' && {
                radius
            }),
            ...(objectType === 'cylinder' && {
                radius,
                height
            }),
            ...(objectType === 'plane' && {
                width,
                height
            })
        }

        return objectConfig
    }
}

// Для совместимости с Flowise экспортируем класс как nodeClass
module.exports = { nodeClass: ObjectNode }
