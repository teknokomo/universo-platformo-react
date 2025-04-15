import { INode, INodeParams, INodeData, ICommonObject } from '../../../src/Interface'

class Image implements INode {
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
        this.label = 'AR Image'
        this.name = 'arImage'
        this.version = 1.0
        this.type = 'ARImage'
        this.icon = 'image.svg'
        this.category = 'AR.js'
        this.tags = ['AR.js', 'Image']
        this.description = 'Image element for AR.js scene'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Image URL',
                name: 'imageUrl',
                type: 'string',
                placeholder: 'https://example.com/image.jpg',
                description: 'URL to the image file'
            },
            {
                label: 'Width',
                name: 'width',
                type: 'number',
                default: 1.0,
                description: 'Width of the image in scene units'
            },
            {
                label: 'Height',
                name: 'height',
                type: 'number',
                default: 1.0,
                description: 'Height of the image in scene units'
            },
            {
                label: 'Opacity',
                name: 'opacity',
                type: 'number',
                default: 1.0,
                description: 'Opacity of the image (0.0 - 1.0)'
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
                label: 'Look At Camera',
                name: 'lookAt',
                type: 'boolean',
                default: false,
                description: 'Always face the image towards the camera'
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Call the run method to get the actual result
        return this.run(nodeData, input, options)
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<string | ICommonObject> {
        const imageUrl = nodeData.inputs?.imageUrl as string
        const width = nodeData.inputs?.width as number
        const height = nodeData.inputs?.height as number
        const opacity = nodeData.inputs?.opacity as number
        const posX = nodeData.inputs?.posX as number
        const posY = nodeData.inputs?.posY as number
        const posZ = nodeData.inputs?.posZ as number
        const rotX = nodeData.inputs?.rotX as number
        const rotY = nodeData.inputs?.rotY as number
        const rotZ = nodeData.inputs?.rotZ as number
        const lookAt = nodeData.inputs?.lookAt as boolean

        if (!imageUrl) {
            throw new Error('Image URL is required')
        }

        // This will be used by the AR.js renderer to generate appropriate HTML/JS
        const imageConfig = {
            imageUrl,
            width,
            height,
            opacity,
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
            lookAt
        }

        return JSON.stringify(imageConfig)
    }
}

module.exports = { nodeClass: Image }
