// Universo Platformo | AR Marker node implementation
import { INodeData, INodeParams, ICommonObject } from '../../../src/Interface'
import { BaseARNode } from '../BaseARNode'

class Marker extends BaseARNode {
    constructor() {
        super()
        this.label = 'AR Marker'
        this.name = 'arMarker'
        this.type = 'ARMarker'
        this.icon = 'marker.svg'
        this.tags = ['AR.js', 'Marker']
        this.description = 'AR.js marker for tracking objects - place 3D content on markers in the real world'
        this.baseClasses = [this.type]

        // Define outputs for this node
        this.outputs = [
            {
                label: 'Marker',
                name: 'marker',
                baseClasses: [this.type],
                description: 'AR Marker output'
            }
        ]

        // Define UI inputs for this node
        this.inputs = [
            {
                label: 'Cube',
                name: 'cube',
                type: 'ARCube',
                description: 'AR Cube to place on this marker',
                list: true,
                optional: true
            },
            {
                label: 'Model',
                name: 'model',
                type: 'ARModel',
                description: 'AR Model to place on this marker',
                list: true,
                optional: true
            },
            {
                label: 'Text',
                name: 'text',
                type: 'ARText',
                description: 'AR Text to place on this marker',
                list: true,
                optional: true
            },
            {
                label: 'Marker Type',
                name: 'markerType',
                type: 'string',
                default: 'hiro',
                description: 'Type of AR marker to use',
                options: [
                    {
                        label: 'Hiro (Preset)',
                        name: 'hiro'
                    },
                    {
                        label: 'Kanji (Preset)',
                        name: 'kanji'
                    },
                    {
                        label: 'Pattern (Custom)',
                        name: 'pattern'
                    },
                    {
                        label: 'Barcode',
                        name: 'barcode'
                    }
                ]
            },
            {
                label: 'Pattern URL',
                name: 'patternUrl',
                type: 'string',
                placeholder: 'https://example.com/pattern.patt',
                description: 'URL to the pattern file (required for Pattern marker type)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Barcode Value',
                name: 'barcodeValue',
                type: 'number',
                default: 1,
                description: 'Value for the barcode (required for Barcode marker type)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Smooth Tracking',
                name: 'smoothTracking',
                type: 'boolean',
                default: true,
                description: 'Enable smooth tracking to reduce jitter',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Smooth Count',
                name: 'smoothCount',
                type: 'number',
                default: 5,
                description: 'Number of frames for smoothing (higher = smoother but more latency)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Smooth Tolerance',
                name: 'smoothTolerance',
                type: 'number',
                default: 0.01,
                description: 'Tolerance value for smoothing filter',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Smooth Threshold',
                name: 'smoothThreshold',
                type: 'number',
                default: 2,
                description: 'Threshold for smoothing to activate (in pixels)',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async processInputs(nodeData: INodeData, inputs: ICommonObject): Promise<ICommonObject> {
        const markerType = nodeData.inputs?.markerType as string
        const patternUrl = nodeData.inputs?.patternUrl as string
        const barcodeValue = nodeData.inputs?.barcodeValue as number

        // Advanced tracking parameters
        const smoothTracking = nodeData.inputs?.smoothTracking as boolean
        const smoothCount = nodeData.inputs?.smoothCount as number
        const smoothTolerance = nodeData.inputs?.smoothTolerance as number
        const smoothThreshold = nodeData.inputs?.smoothThreshold as number

        // Validate inputs based on marker type
        if (markerType === 'pattern' && !patternUrl) {
            throw new Error('Pattern URL is required for Pattern marker type')
        }

        if (markerType === 'barcode' && barcodeValue === undefined) {
            throw new Error('Barcode Value is required for Barcode marker type')
        }

        // This will be used by the AR.js renderer to generate appropriate HTML/JS
        const markerConfig: ICommonObject = {
            component: 'marker',
            children: []
        }

        // Set marker configuration based on type
        if (markerType === 'hiro' || markerType === 'kanji') {
            markerConfig.preset = markerType
        } else if (markerType === 'pattern') {
            markerConfig.type = 'pattern'
            markerConfig.patternUrl = patternUrl
        } else if (markerType === 'barcode') {
            markerConfig.type = 'barcode'
            markerConfig.barcodeValue = barcodeValue
        }

        // Add smooth tracking parameters if enabled
        if (smoothTracking) {
            markerConfig.smooth = true
            if (smoothCount !== undefined) markerConfig.smoothCount = smoothCount
            if (smoothTolerance !== undefined) markerConfig.smoothTolerance = smoothTolerance
            if (smoothThreshold !== undefined) markerConfig.smoothThreshold = smoothThreshold
        }

        // Universo Platformo | !! Fixed: Process connected children (Cube, Model, Text)
        const processChildInput = (childInput: any) => {
            if (!childInput) return
            if (Array.isArray(childInput)) {
                childInput.forEach((child) => {
                    if (child && typeof child === 'object') {
                        // Ensure child is a valid object
                        markerConfig.children.push(child)
                    }
                })
            } else if (typeof childInput === 'object') {
                // Ensure childInput is a valid object
                markerConfig.children.push(childInput)
            }
        }

        processChildInput(nodeData.inputs?.cube)
        processChildInput(nodeData.inputs?.model)
        processChildInput(nodeData.inputs?.text)

        return markerConfig
    }
}

module.exports = { nodeClass: Marker }
