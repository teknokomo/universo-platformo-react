// Universo Platformo | UPDL Camera Node
// Defines a camera for a 3D scene

import { INodeData, ICommonObject, INodeOutputsValue } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * CameraNode represents a camera in the scene
 * It can be perspective or orthographic
 */
export class CameraNode extends BaseUPDLNode {
    constructor() {
        // Configure node metadata
        super({
            name: 'Camera',
            type: 'UPDLCamera',
            icon: 'camera.svg',
            description: 'Camera for viewing a 3D scene',
            version: 1.0, // Adding version
            // Define inputs (properties that can be set in the editor)
            inputs: [
                {
                    name: 'cameraName',
                    type: 'string',
                    label: 'Camera Name',
                    description: 'Name of the camera',
                    default: 'Main Camera'
                },
                {
                    name: 'cameraType',
                    type: 'options',
                    label: 'Camera Type',
                    description: 'Type of camera projection',
                    options: [
                        { name: 'perspective', label: 'Perspective' }
                        // Orthographic option may be added later
                    ],
                    default: 'perspective'
                },
                // Position
                {
                    name: 'positionX',
                    type: 'number',
                    label: 'Position X',
                    description: 'X position of the camera',
                    default: 0,
                    step: 0.1
                },
                {
                    name: 'positionY',
                    type: 'number',
                    label: 'Position Y',
                    description: 'Y position of the camera',
                    default: 1.6, // Typical human eye height
                    step: 0.1
                },
                {
                    name: 'positionZ',
                    type: 'number',
                    label: 'Position Z',
                    description: 'Z position of the camera',
                    default: 5, // Backed away from the origin
                    step: 0.1
                },
                // Rotation
                {
                    name: 'rotationX',
                    type: 'number',
                    label: 'Rotation X',
                    description: 'X rotation of the camera in degrees',
                    default: 0,
                    step: 1
                },
                {
                    name: 'rotationY',
                    type: 'number',
                    label: 'Rotation Y',
                    description: 'Y rotation of the camera in degrees',
                    default: 0,
                    step: 1
                },
                {
                    name: 'rotationZ',
                    type: 'number',
                    label: 'Rotation Z',
                    description: 'Z rotation of the camera in degrees',
                    default: 0,
                    step: 1
                },
                // Field of View (for perspective camera)
                {
                    name: 'fieldOfView',
                    type: 'number',
                    label: 'Field of View',
                    description: 'Field of view in degrees',
                    default: 75,
                    min: 1,
                    max: 179,
                    step: 1,
                    show: {
                        'data.cameraType': ['perspective']
                    }
                },
                // Clipping planes
                {
                    name: 'nearClippingPlane',
                    type: 'number',
                    label: 'Near Clipping Plane',
                    description: 'Distance to the near clipping plane',
                    default: 0.1,
                    min: 0.01,
                    step: 0.01
                },
                {
                    name: 'farClippingPlane',
                    type: 'number',
                    label: 'Far Clipping Plane',
                    description: 'Distance to the far clipping plane',
                    default: 1000,
                    min: 1,
                    step: 1
                },
                // Zoom (mainly for orthographic, but also good for perspective fine-tuning)
                {
                    name: 'zoom',
                    type: 'number',
                    label: 'Zoom',
                    description: 'Camera zoom level',
                    default: 1,
                    min: 0.1,
                    step: 0.1
                }
            ]
        })
    }

    /**
     * Initialize the node with data from Flowise
     * @param nodeData Node data from Flowise
     */
    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        // Initialize camera properties
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data (from the scene)
     * @param options Additional options
     * @returns Camera configuration
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Extract basic properties
        const name = (nodeData.inputs?.cameraName as string) || 'Main Camera'
        const cameraType = (nodeData.inputs?.cameraType as string) || 'perspective'

        // Position
        const positionX = Number(nodeData.inputs?.positionX) || 0
        const positionY = Number(nodeData.inputs?.positionY) || 1.6
        const positionZ = Number(nodeData.inputs?.positionZ) || 5

        // Rotation
        const rotationX = Number(nodeData.inputs?.rotationX) || 0
        const rotationY = Number(nodeData.inputs?.rotationY) || 0
        const rotationZ = Number(nodeData.inputs?.rotationZ) || 0

        // Field of View (perspective only)
        const fieldOfView = Number(nodeData.inputs?.fieldOfView) || 75

        // Clipping planes
        const nearClippingPlane = Number(nodeData.inputs?.nearClippingPlane) || 0.1
        const farClippingPlane = Number(nodeData.inputs?.farClippingPlane) || 1000

        // Zoom
        const zoom = Number(nodeData.inputs?.zoom) || 1

        // Generate a unique ID for the camera
        const id = `camera-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Create camera configuration
        const cameraConfig = {
            id,
            type: 'UPDLCamera',
            name,
            cameraType,
            position: {
                x: positionX,
                y: positionY,
                z: positionZ
            },
            rotation: {
                x: rotationX,
                y: rotationY,
                z: rotationZ
            },
            // Include projection-specific properties
            ...(cameraType === 'perspective' && {
                fieldOfView
            }),
            // Include common camera properties
            nearClippingPlane,
            farClippingPlane,
            zoom,
            // Output connection to scene
            outputConnections: {
                camera: {
                    type: 'UPDLCamera',
                    connections: []
                }
            }
        }

        return cameraConfig
    }
}

// Для совместимости с Flowise экспортируем класс как nodeClass
module.exports = { nodeClass: CameraNode }
