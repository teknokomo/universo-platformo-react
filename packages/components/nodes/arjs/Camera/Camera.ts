// Universo Platformo | AR Camera node implementation
import { INodeData, INodeParams, ICommonObject } from '../../../src/Interface'
import { BaseARNode } from '../BaseARNode'

class Camera extends BaseARNode {
    constructor() {
        super()
        this.label = 'AR Camera'
        this.name = 'arCamera'
        this.type = 'ARCamera'
        this.icon = 'camera.svg'
        this.tags = ['AR.js', 'Camera']
        this.description = 'Basic camera for AR.js scene - required for any AR experience'
        this.baseClasses = [this.type]
        
        // Define outputs for this node
        this.outputs = [
            {
                label: 'Camera',
                name: 'camera',
                baseClasses: [this.type],
                description: 'Camera configuration for AR Scene'
            }
        ]
        
        this.inputs = [
            {
                label: 'Position X',
                name: 'posX',
                type: 'number',
                default: 0,
                description: 'Camera X position',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Position Y',
                name: 'posY',
                type: 'number',
                default: 0,
                description: 'Camera Y position',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Position Z',
                name: 'posZ',
                type: 'number',
                default: 0,
                description: 'Camera Z position',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Look At Enabled',
                name: 'lookAtEnabled',
                type: 'boolean',
                default: false,
                description: 'Camera looks at a specific point',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Look At X',
                name: 'lookAtX',
                type: 'number',
                default: 0,
                description: 'Look at X position',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Look At Y',
                name: 'lookAtY',
                type: 'number',
                default: 0,
                description: 'Look at Y position',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Look At Z',
                name: 'lookAtZ',
                type: 'number',
                default: 0,
                description: 'Look at Z position',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async processInputs(nodeData: INodeData, inputs: ICommonObject): Promise<ICommonObject> {
        const posX = nodeData.inputs?.posX as number || 0
        const posY = nodeData.inputs?.posY as number || 0
        const posZ = nodeData.inputs?.posZ as number || 0
        const lookAtEnabled = nodeData.inputs?.lookAtEnabled as boolean
        const lookAtX = nodeData.inputs?.lookAtX as number
        const lookAtY = nodeData.inputs?.lookAtY as number
        const lookAtZ = nodeData.inputs?.lookAtZ as number

        // Create a basic camera configuration that will be used by ARScene
        const cameraConfig: ICommonObject = {
            component: 'camera',
            position: {
                x: posX,
                y: posY,
                z: posZ
            }
        }

        // Add look-at configuration if enabled
        if (lookAtEnabled) {
            cameraConfig.lookAt = {
                x: lookAtX || 0,
                y: lookAtY || 0,
                z: lookAtZ || 0
            }
        }

        return cameraConfig
    }
}

module.exports = { nodeClass: Camera } 
