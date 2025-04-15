import { INode, INodeParams, INodeData, ICommonObject } from '../../../src/Interface'

class Light implements INode {
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
        this.label = 'AR Light'
        this.name = 'arLight'
        this.version = 1.0
        this.type = 'ARLight'
        this.icon = 'light.svg'
        this.category = 'AR.js'
        this.tags = ['AR.js', 'Light']
        this.description = 'Light source for AR.js scene'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Light Type',
                name: 'lightType',
                type: 'string',
                default: 'ambient',
                description: 'Type of light source',
                options: [
                    {
                        label: 'Ambient',
                        name: 'ambient'
                    },
                    {
                        label: 'Directional',
                        name: 'directional'
                    },
                    {
                        label: 'Point',
                        name: 'point'
                    },
                    {
                        label: 'Spot',
                        name: 'spot'
                    }
                ]
            },
            {
                label: 'Color',
                name: 'color',
                type: 'string',
                default: '#ffffff',
                description: 'Color of the light (CSS color)'
            },
            {
                label: 'Intensity',
                name: 'intensity',
                type: 'number',
                default: 1.0,
                description: 'Intensity of the light'
            },
            {
                label: 'Position X',
                name: 'posX',
                type: 'number',
                default: 0,
                description: 'X position (for Point and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Position Y',
                name: 'posY',
                type: 'number',
                default: 0,
                description: 'Y position (for Point and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Position Z',
                name: 'posZ',
                type: 'number',
                default: 0,
                description: 'Z position (for Point and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Direction X',
                name: 'dirX',
                type: 'number',
                default: 0,
                description: 'X direction (for Directional and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Direction Y',
                name: 'dirY',
                type: 'number',
                default: -1,
                description: 'Y direction (for Directional and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Direction Z',
                name: 'dirZ',
                type: 'number',
                default: 0,
                description: 'Z direction (for Directional and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Angle (degrees)',
                name: 'angle',
                type: 'number',
                default: 45,
                description: 'Spotlight cone angle in degrees (for Spot lights)',
                additionalParams: true
            },
            {
                label: 'Penumbra',
                name: 'penumbra',
                type: 'number',
                default: 0.1,
                description: 'Percent of the spotlight cone that is attenuated due to penumbra (for Spot lights)',
                additionalParams: true
            },
            {
                label: 'Distance',
                name: 'distance',
                type: 'number',
                default: 0,
                description: 'Maximum range of light (0 = unlimited, for Point and Spot lights)',
                additionalParams: true
            },
            {
                label: 'Cast Shadow',
                name: 'castShadow',
                type: 'boolean',
                default: false,
                description: 'Light casts shadows (for Directional, Point and Spot lights)'
            }
        ]
    }

    async init(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Call the run method to get the actual result
        return this.run(nodeData, input, options)
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<string | ICommonObject> {
        const lightType = nodeData.inputs?.lightType as string
        const color = nodeData.inputs?.color as string
        const intensity = nodeData.inputs?.intensity as number
        const posX = nodeData.inputs?.posX as number
        const posY = nodeData.inputs?.posY as number
        const posZ = nodeData.inputs?.posZ as number
        const dirX = nodeData.inputs?.dirX as number
        const dirY = nodeData.inputs?.dirY as number
        const dirZ = nodeData.inputs?.dirZ as number
        const angle = nodeData.inputs?.angle as number
        const penumbra = nodeData.inputs?.penumbra as number
        const distance = nodeData.inputs?.distance as number
        const castShadow = nodeData.inputs?.castShadow as boolean

        // This will be used by the AR.js renderer to generate appropriate HTML/JS
        const lightConfig: any = {
            type: lightType,
            color,
            intensity,
            castShadow
        }

        // Add properties based on light type
        if (lightType === 'point' || lightType === 'spot') {
            lightConfig.position = {
                x: posX,
                y: posY,
                z: posZ
            }
            lightConfig.distance = distance
        }

        if (lightType === 'directional' || lightType === 'spot') {
            lightConfig.direction = {
                x: dirX,
                y: dirY,
                z: dirZ
            }
        }

        if (lightType === 'spot') {
            lightConfig.angle = angle
            lightConfig.penumbra = penumbra
        }

        return JSON.stringify(lightConfig)
    }
}

module.exports = { nodeClass: Light }
