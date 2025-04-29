// Universo Platformo | UPDL Scene Node
// Root node for 3D scene definition

import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * SceneNode is the root node for any UPDL scene
 * It defines global scene settings and serves as a container
 * for other nodes like camera, lights, and objects
 */
export class SceneNode extends BaseUPDLNode {
    constructor() {
        // Configure node metadata
        super({
            name: 'Scene',
            type: 'UPDLScene',
            icon: 'scene.svg',
            description: 'Root node for a 3D scene that contains global scene settings',
            version: 1.0,
            // Moved properties to inputs for UI rendering
            inputs: [
                {
                    name: 'sceneName',
                    type: 'string',
                    label: 'Scene Name',
                    description: 'Name of the scene',
                    default: 'My Scene'
                },
                {
                    name: 'backgroundColor',
                    type: 'string',
                    label: 'Background Color',
                    description: 'Background color of the scene (hex code)',
                    default: '',
                    optional: true
                },
                {
                    name: 'skybox',
                    type: 'boolean',
                    label: 'Enable Skybox',
                    description: 'Whether to use a skybox',
                    default: false
                },
                {
                    name: 'skyboxTexture',
                    type: 'string',
                    label: 'Skybox Texture',
                    description: 'URL to the skybox texture (optional)',
                    optional: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.skybox': [true]
                    }
                },
                {
                    name: 'fog',
                    type: 'boolean',
                    label: 'Enable Fog',
                    description: 'Whether to use fog effect',
                    default: false
                },
                {
                    name: 'fogColor',
                    type: 'string',
                    label: 'Fog Color',
                    description: 'Color of the fog (hex code)',
                    default: '',
                    optional: true,
                    show: {
                        // Using inputs prefix now
                        'inputs.fog': [true]
                    }
                },
                {
                    name: 'fogDensity',
                    type: 'number',
                    label: 'Fog Density',
                    description: 'Density of the fog (0-1)',
                    default: 0.1,
                    min: 0,
                    max: 1,
                    step: 0.01,
                    show: {
                        // Using inputs prefix now
                        'inputs.fog': [true]
                    }
                },
                {
                    name: 'isRootNode',
                    type: 'boolean',
                    label: 'Is Root Node',
                    description: 'Scene must be the root node of a UPDL flow',
                    default: true,
                    hidden: true
                },
                {
                    label: 'Objects',
                    name: 'objects',
                    type: 'UPDLObject',
                    description: 'Connect Object nodes to add them to the scene',
                    list: true,
                    optional: true
                },
                {
                    label: 'Lights',
                    name: 'lights',
                    type: 'UPDLLight',
                    description: 'Connect Light nodes to add them to the scene',
                    list: true,
                    optional: true
                },
                {
                    label: 'Cameras',
                    name: 'cameras',
                    type: 'UPDLCamera',
                    description: 'Connect Camera nodes to add them to the scene',
                    list: true,
                    optional: true
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
        // Initialize scene properties if necessary
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data (not used for Scene properties)
     * @param options Additional options
     * @returns Scene object
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Extract properties via nodeData.inputs
        const sceneName = (nodeData.inputs?.sceneName as string) || 'My Scene'
        const backgroundColor = (nodeData.inputs?.backgroundColor as string) || '' // Use default from input definition
        const enableSkybox = nodeData.inputs?.skybox ? true : false
        const skyboxTexture = nodeData.inputs?.skyboxTexture as string
        const enableFog = nodeData.inputs?.fog ? true : false
        const fogColor = (nodeData.inputs?.fogColor as string) || '' // Use default from input definition
        const fogDensity = Number(nodeData.inputs?.fogDensity) || 0.1

        // Use empty arrays for connected elements; connections are handled by Flowise graph execution
        const objects = []
        const cameras = []
        const lights = []

        // Generate a unique ID for the scene
        const id = `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Return scene configuration
        return {
            id,
            type: 'UPDLSceneNode',
            name: sceneName,
            isRootNode: true,
            backgroundColor,
            skybox: {
                enabled: enableSkybox,
                texture: skyboxTexture
            },
            fog: {
                enabled: enableFog,
                color: fogColor,
                density: fogDensity
            },
            objects,
            cameras,
            lights
        }
    }
}

// Для совместимости с Flowise экспортируем класс как nodeClass
module.exports = { nodeClass: SceneNode }
