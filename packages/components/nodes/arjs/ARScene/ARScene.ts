// Universo Platformo | AR Scene node implementation
import { INodeData, INodeParams, ICommonObject } from '../../../src/Interface'
import { BaseARNode } from '../BaseARNode'

class ARScene extends BaseARNode {
    constructor() {
        super()
        this.label = 'AR Scene'
        this.name = 'arScene'
        this.type = 'ARScene'
        this.icon = 'arscene.svg'
        this.tags = ['AR.js', 'Scene']
        this.description = 'AR.js scene configuration with enhanced tracking options and performance settings'
        this.baseClasses = [this.type]

        // Define outputs for this node
        this.outputs = [
            {
                label: 'Scene',
                name: 'scene',
                baseClasses: [this.type],
                description: 'AR Scene output'
            }
        ]

        // Define UI inputs for this node
        this.inputs = [
            {
                label: 'Camera',
                name: 'camera',
                type: 'ARCamera',
                description: 'AR Camera to use in the scene (required)'
            },
            {
                label: 'Marker',
                name: 'marker',
                type: 'ARMarker',
                description: 'AR Marker to include in the scene',
                list: true
            },
            {
                label: 'Tracking Method',
                name: 'trackingMethod',
                type: 'string',
                default: 'best',
                description: 'Method used for marker tracking',
                options: [
                    {
                        label: 'Best (Auto Select)',
                        name: 'best'
                    },
                    {
                        label: 'Tango',
                        name: 'tango'
                    },
                    {
                        label: 'Area Target',
                        name: 'area-nft'
                    },
                    {
                        label: 'Area Image',
                        name: 'area-image'
                    }
                ]
            },
            {
                label: 'Detection Mode',
                name: 'detectionMode',
                type: 'string',
                default: 'mono',
                description: 'Type of detection to use',
                options: [
                    {
                        label: 'Mono (Standard)',
                        name: 'mono'
                    },
                    {
                        label: 'Color',
                        name: 'color'
                    }
                ]
            },
            {
                label: 'Matrix Code Type',
                name: 'matrixCodeType',
                type: 'string',
                default: '3x3',
                description: 'Type of matrix code to detect',
                options: [
                    {
                        label: '3x3',
                        name: '3x3'
                    },
                    {
                        label: '3x3_HAMMING63',
                        name: '3x3_hamming63'
                    },
                    {
                        label: '3x3_PARITY65',
                        name: '3x3_parity65'
                    },
                    {
                        label: '4x4',
                        name: '4x4'
                    },
                    {
                        label: '4x4_BCH_13_9_3',
                        name: '4x4_bch_13_9_3'
                    },
                    {
                        label: '4x4_BCH_13_5_5',
                        name: '4x4_bch_13_5_5'
                    }
                ]
            },
            {
                label: 'Camera Parameters URL',
                name: 'cameraParametersUrl',
                type: 'string',
                default: '',
                placeholder: 'https://example.com/camera_para.dat',
                description: 'URL to camera parameters file',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Max Detection Rate',
                name: 'maxDetectionRate',
                type: 'number',
                default: 60,
                description: 'Maximum detection rate (fps)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Canvas Width',
                name: 'canvasWidth',
                type: 'number',
                default: 640,
                description: 'Width of the processing canvas',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Canvas Height',
                name: 'canvasHeight',
                type: 'number',
                default: 480,
                description: 'Height of the processing canvas',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Debug Mode',
                name: 'debugMode',
                type: 'boolean',
                default: false,
                description: 'Enable debug mode',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Debug UI',
                name: 'debugUI',
                type: 'boolean',
                default: false,
                description: 'Enable debug UI',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Enable Stats',
                name: 'enableStats',
                type: 'boolean',
                default: false,
                description: 'Enable performance stats',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Physically Correct Lights',
                name: 'physicallyCorrectLights',
                type: 'boolean',
                default: true,
                description: 'Enable physically correct lighting',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Tone Mapping',
                name: 'toneMapping',
                type: 'string',
                default: 'ACESFilmic',
                description: 'Type of tone mapping to use',
                options: [
                    {
                        label: 'ACES Filmic',
                        name: 'ACESFilmic'
                    },
                    {
                        label: 'Cineon',
                        name: 'Cineon'
                    },
                    {
                        label: 'Linear',
                        name: 'Linear'
                    },
                    {
                        label: 'Reinhard',
                        name: 'Reinhard'
                    },
                    {
                        label: 'None',
                        name: 'None'
                    }
                ],
                optional: true,
                additionalParams: true
            },
            {
                label: 'Anti-Aliasing',
                name: 'antialias',
                type: 'boolean',
                default: true,
                description: 'Enable anti-aliasing',
                optional: true,
                additionalParams: true
            },
            {
                label: 'VR Mode',
                name: 'vrMode',
                type: 'boolean',
                default: false,
                description: 'Enable VR mode UI',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Embedded Mode',
                name: 'embedded',
                type: 'boolean',
                default: true,
                description: 'Display AR scene embedded in a web page',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async processInputs(nodeData: INodeData, inputs: ICommonObject): Promise<ICommonObject> {
        // Get scene configuration from node inputs
        const trackingMethod = nodeData.inputs?.trackingMethod as string
        const detectionMode = nodeData.inputs?.detectionMode as string
        const matrixCodeType = nodeData.inputs?.matrixCodeType as string
        const cameraParametersUrl = nodeData.inputs?.cameraParametersUrl as string
        const maxDetectionRate = nodeData.inputs?.maxDetectionRate as number
        const canvasWidth = nodeData.inputs?.canvasWidth as number
        const canvasHeight = nodeData.inputs?.canvasHeight as number
        const debugMode = nodeData.inputs?.debugMode as boolean
        const debugUI = nodeData.inputs?.debugUI as boolean
        const enableStats = nodeData.inputs?.enableStats as boolean
        const physicallyCorrectLights = nodeData.inputs?.physicallyCorrectLights as boolean
        const toneMapping = nodeData.inputs?.toneMapping as string
        const antialias = nodeData.inputs?.antialias as boolean
        const vrMode = nodeData.inputs?.vrMode as boolean
        const embedded = nodeData.inputs?.embedded as boolean

        // Validate required inputs
        if (!nodeData.inputs?.camera) {
            throw new Error('Camera is required for AR Scene')
        }

        // Define the AR.js scene configuration
        const sceneConfig: ICommonObject = {
            component: 'arscene',
            trackingMethod,
            detectionMode,
            matrixCodeType,
            debugUI: debugUI !== undefined ? debugUI : false,
            embedded: embedded !== undefined ? embedded : true,
            children: []
        }

        // Add camera to scene
        sceneConfig.children.push(nodeData.inputs.camera)

        // Add optional properties
        if (cameraParametersUrl) {
            sceneConfig.cameraParametersUrl = cameraParametersUrl
        }

        if (maxDetectionRate !== undefined) {
            sceneConfig.maxDetectionRate = maxDetectionRate
        }

        if (canvasWidth !== undefined) {
            sceneConfig.canvasWidth = canvasWidth
        }

        if (canvasHeight !== undefined) {
            sceneConfig.canvasHeight = canvasHeight
        }

        if (debugMode !== undefined) {
            sceneConfig.debugMode = debugMode
        }

        if (enableStats !== undefined) {
            sceneConfig.enableStats = enableStats
        }

        // Add renderer configuration
        sceneConfig.renderer = {
            antialias: antialias !== undefined ? antialias : true,
            physicallyCorrectLights: physicallyCorrectLights !== undefined ? physicallyCorrectLights : true
        }

        if (toneMapping && toneMapping !== 'None') {
            sceneConfig.renderer.toneMapping = toneMapping
        }

        // Add VR mode configuration
        if (vrMode !== undefined) {
            sceneConfig.vrMode = vrMode
        }

        // Process marker nodes and add them to scene children
        if (nodeData.inputs?.marker) {
            const markers = nodeData.inputs.marker
            if (Array.isArray(markers)) {
                markers.forEach((marker: ICommonObject) => {
                    sceneConfig.children.push(marker)
                })
            } else {
                sceneConfig.children.push(markers)
            }
        }

        return { scene: sceneConfig }
    }
    
}

module.exports = { nodeClass: ARScene }
