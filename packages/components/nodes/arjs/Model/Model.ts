import { INode, INodeParams, INodeData, ICommonObject } from '../../../src/Interface'

class Model implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    tags: string[]

    constructor() {
        this.label = 'AR Model'
        this.name = 'arModel'
        this.version = 1.0
        this.type = 'ARModel'
        this.icon = 'model.svg'
        this.category = 'AR.js'
        this.tags = ['AR.js', 'Model', '3D']
        this.description = '3D model for AR.js scene'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Model Type',
                name: 'modelType',
                type: 'string',
                default: 'gltf',
                description: 'Type of 3D model',
                options: [
                    {
                        label: 'GLTF/GLB',
                        name: 'gltf'
                    },
                    {
                        label: 'OBJ',
                        name: 'obj'
                    }
                ]
            },
            {
                label: 'Model URL',
                name: 'modelUrl',
                type: 'string',
                placeholder: 'https://example.com/model.gltf',
                description: 'URL to the 3D model file'
            },
            {
                label: 'Material URL',
                name: 'materialUrl',
                type: 'string',
                placeholder: 'https://example.com/material.mtl',
                description: 'URL to the material file (for OBJ models)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Scale',
                name: 'scale',
                type: 'number',
                default: 1.0,
                description: 'Scale of the 3D model'
            },
            {
                label: 'Position X',
                name: 'posX',
                type: 'number',
                default: 0,
                description: 'X position'
            },
            {
                label: 'Position Y',
                name: 'posY',
                type: 'number',
                default: 0,
                description: 'Y position'
            },
            {
                label: 'Position Z',
                name: 'posZ',
                type: 'number',
                default: 0,
                description: 'Z position'
            },
            {
                label: 'Rotation X (degrees)',
                name: 'rotX',
                type: 'number',
                default: 0,
                description: 'X rotation in degrees'
            },
            {
                label: 'Rotation Y (degrees)',
                name: 'rotY',
                type: 'number',
                default: 0,
                description: 'Y rotation in degrees'
            },
            {
                label: 'Rotation Z (degrees)',
                name: 'rotZ',
                type: 'number',
                default: 0,
                description: 'Z rotation in degrees'
            },
            {
                label: 'Animation',
                name: 'animation',
                type: 'boolean',
                default: false,
                description: 'Enable model animation (if available)'
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Call the run method to get the actual result
        return this.run(nodeData, input, options)
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<string | ICommonObject> {
        const modelType = nodeData.inputs?.modelType as string
        const modelUrl = nodeData.inputs?.modelUrl as string
        const materialUrl = nodeData.inputs?.materialUrl as string
        const scale = nodeData.inputs?.scale as number
        const posX = nodeData.inputs?.posX as number
        const posY = nodeData.inputs?.posY as number
        const posZ = nodeData.inputs?.posZ as number
        const rotX = nodeData.inputs?.rotX as number
        const rotY = nodeData.inputs?.rotY as number
        const rotZ = nodeData.inputs?.rotZ as number
        const animation = nodeData.inputs?.animation as boolean

        if (!modelUrl) {
            throw new Error('Model URL is required')
        }

        if (modelType === 'obj' && !materialUrl) {
            throw new Error('Material URL is required for OBJ models')
        }

        // This will be used by the AR.js renderer to generate appropriate HTML/JS
        const modelConfig: any = {
            type: modelType,
            url: modelUrl,
            scale: scale,
            position: {
                x: posX,
                y: posY,
                z: posZ
            },
            rotation: {
                x: rotX,
                y: rotY,
                z: rotZ
            },
            animation: animation
        }

        if (modelType === 'obj' && materialUrl) {
            modelConfig.materialUrl = materialUrl
        }

        return JSON.stringify(modelConfig)
    }
}

module.exports = { nodeClass: Model }
