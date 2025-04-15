import { INode, INodeParams, INodeData, ICommonObject } from '../../../src/Interface'

class Text implements INode {
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
        this.label = 'AR Text'
        this.name = 'arText'
        this.version = 1.0
        this.type = 'ARText'
        this.icon = 'text.svg'
        this.category = 'AR.js'
        this.tags = ['AR.js', 'Text']
        this.description = 'Text element for AR.js scene'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Text Content',
                name: 'text',
                type: 'string',
                placeholder: 'Enter text to display',
                description: 'Text content to display in AR'
            },
            {
                label: 'Font Size',
                name: 'fontSize',
                type: 'number',
                default: 1.0,
                description: 'Size of the text'
            },
            {
                label: 'Color',
                name: 'color',
                type: 'string',
                default: '#ffffff',
                description: 'Color of the text (CSS color)'
            },
            {
                label: 'Background Color',
                name: 'backgroundColor',
                type: 'string',
                default: '',
                description: 'Background color of the text (CSS color, empty for transparent)',
                optional: true
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
                label: 'Align',
                name: 'align',
                type: 'string',
                default: 'center',
                description: 'Text alignment',
                options: [
                    {
                        label: 'Left',
                        name: 'left'
                    },
                    {
                        label: 'Center',
                        name: 'center'
                    },
                    {
                        label: 'Right',
                        name: 'right'
                    }
                ]
            },
            {
                label: 'Width',
                name: 'width',
                type: 'number',
                default: 0,
                description: 'Text width (0 for auto)',
                optional: true
            },
            {
                label: 'Look At Camera',
                name: 'lookAt',
                type: 'boolean',
                default: false,
                description: 'Always face the text towards the camera'
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Call the run method to get the actual result
        return this.run(nodeData, input, options)
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<string | ICommonObject> {
        const text = nodeData.inputs?.text as string
        const fontSize = nodeData.inputs?.fontSize as number
        const color = nodeData.inputs?.color as string
        const backgroundColor = nodeData.inputs?.backgroundColor as string
        const posX = nodeData.inputs?.posX as number
        const posY = nodeData.inputs?.posY as number
        const posZ = nodeData.inputs?.posZ as number
        const rotX = nodeData.inputs?.rotX as number
        const rotY = nodeData.inputs?.rotY as number
        const rotZ = nodeData.inputs?.rotZ as number
        const align = nodeData.inputs?.align as string
        const width = nodeData.inputs?.width as number
        const lookAt = nodeData.inputs?.lookAt as boolean

        if (!text) {
            throw new Error('Text content is required')
        }

        // This will be used by the AR.js renderer to generate appropriate HTML/JS
        const textConfig = {
            text,
            fontSize,
            color,
            backgroundColor,
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
            align,
            width,
            lookAt
        }

        return JSON.stringify(textConfig)
    }
}

module.exports = { nodeClass: Text }
