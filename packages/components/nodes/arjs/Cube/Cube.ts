// Universo Platformo | AR Cube node implementation
import { INodeData, INodeParams, ICommonObject } from '../../../src/Interface'
import { BaseARNode } from '../BaseARNode'

class Cube extends BaseARNode {
    constructor() {
        super()
        this.label = 'AR Cube'
        this.name = 'arCube'
        this.type = 'ARCube'
        this.icon = 'cube.svg'
        this.tags = ['AR.js', 'Cube', 'Primitive']
        this.description = 'A 3D cube to display in AR with material properties and animation options'
        this.baseClasses = [this.type]
        
        // Define outputs for this node
        this.outputs = [
            {
                label: 'Cube',
                name: 'cube',
                baseClasses: [this.type],
                description: 'AR Cube output to connect to marker'
            }
        ]
        
        // Define UI inputs for this node
        this.inputs = [
            {
                label: 'Width',
                name: 'width',
                type: 'number',
                default: 1,
                description: 'Width of the cube'
            },
            {
                label: 'Height',
                name: 'height',
                type: 'number',
                default: 1,
                description: 'Height of the cube'
            },
            {
                label: 'Depth',
                name: 'depth',
                type: 'number',
                default: 1,
                description: 'Depth of the cube'
            },
            {
                label: 'Color',
                name: 'color',
                type: 'string',
                default: '#000000',
                description: 'Color of the cube (hex format)'
            },
            {
                label: 'Opacity',
                name: 'opacity',
                type: 'number',
                default: 1.0,
                description: 'Opacity of the cube (0.0 - 1.0)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Material Type',
                name: 'materialType',
                type: 'string',
                default: 'standard',
                description: 'Type of material to use for the cube',
                options: [
                    {
                        label: 'Standard',
                        name: 'standard'
                    },
                    {
                        label: 'Phong',
                        name: 'phong'
                    },
                    {
                        label: 'Flat',
                        name: 'flat'
                    }
                ],
                optional: true,
                additionalParams: true
            },
            {
                label: 'Metallic',
                name: 'metallic',
                type: 'number',
                default: 0,
                description: 'Metallic property (0.0 - 1.0)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Roughness',
                name: 'roughness',
                type: 'number',
                default: 0.5,
                description: 'Roughness property (0.0 - 1.0)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Position X',
                name: 'posX',
                type: 'number',
                default: 0,
                description: 'X position offset relative to marker'
            },
            {
                label: 'Position Y',
                name: 'posY',
                type: 'number',
                default: 0.5,
                description: 'Y position offset relative to marker (default: 0.5 to place on top of marker)'
            },
            {
                label: 'Position Z',
                name: 'posZ',
                type: 'number',
                default: 0,
                description: 'Z position offset relative to marker'
            },
            {
                label: 'Rotation X (degrees)',
                name: 'rotX',
                type: 'number',
                default: 0,
                description: 'X axis rotation in degrees'
            },
            {
                label: 'Rotation Y (degrees)',
                name: 'rotY',
                type: 'number',
                default: 0,
                description: 'Y axis rotation in degrees'
            },
            {
                label: 'Rotation Z (degrees)',
                name: 'rotZ',
                type: 'number',
                default: 0,
                description: 'Z axis rotation in degrees'
            },
            {
                label: 'Animation',
                name: 'animation',
                type: 'string',
                default: 'none',
                description: 'Animation type for the cube',
                options: [
                    {
                        label: 'None',
                        name: 'none'
                    },
                    {
                        label: 'Rotate',
                        name: 'rotate'
                    },
                    {
                        label: 'Pulse',
                        name: 'pulse'
                    },
                    {
                        label: 'Hover',
                        name: 'hover'
                    }
                ],
                optional: true,
                additionalParams: true
            }
        ]
    }

    async processInputs(nodeData: INodeData, inputs: ICommonObject): Promise<ICommonObject> {
        // Get cube properties from node inputs
        const width = nodeData.inputs?.width as number
        const height = nodeData.inputs?.height as number
        const depth = nodeData.inputs?.depth as number
        const color = nodeData.inputs?.color as string
        const opacity = nodeData.inputs?.opacity as number
        const materialType = nodeData.inputs?.materialType as string
        const metallic = nodeData.inputs?.metallic as number
        const roughness = nodeData.inputs?.roughness as number
        const posX = nodeData.inputs?.posX as number
        const posY = nodeData.inputs?.posY as number
        const posZ = nodeData.inputs?.posZ as number
        const rotX = nodeData.inputs?.rotX as number
        const rotY = nodeData.inputs?.rotY as number
        const rotZ = nodeData.inputs?.rotZ as number
        const animation = nodeData.inputs?.animation as string

        // Create the cube configuration
        const cubeConfig: ICommonObject = {
            component: 'cube',
            width,
            height,
            depth,
            color,
            position: {
                x: posX,
                y: posY,
                z: posZ
            },
            rotation: {
                x: rotX,
                y: rotY,
                z: rotZ
            }
        }

        // Add optional properties only if they are defined
        if (opacity !== undefined) {
            cubeConfig.opacity = opacity
        }

        if (materialType) {
            cubeConfig.materialType = materialType
        }

        if (metallic !== undefined) {
            cubeConfig.metallic = metallic
        }

        if (roughness !== undefined) {
            cubeConfig.roughness = roughness
        }

        if (animation && animation !== 'none') {
            cubeConfig.animation = animation
        }

        return cubeConfig
    }
}

module.exports = { nodeClass: Cube } 