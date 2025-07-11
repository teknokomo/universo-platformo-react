// Universo Platformo | Base UPDL Node
// Base class for all UPDL nodes compatible with Flowise architecture

import { INode, INodeData, INodeOutputsValue, INodeParams, ICommonObject } from '../interfaces'
import { UPDLNode, UPDLNodePort, UPDLPortType } from '../../interfaces/UPDLInterfaces'

/**
 * A list of types that represent connectable inputs, used to distinguish them from regular UI parameter fields.
 */
const CONNECTABLE_TYPES = [
    // Legacy types (for backward compatibility)
    'space',
    'object',
    'camera',
    'light',
    // Modern UPDL types
    'UPDLSpace',
    'UPDLEntity',
    'UPDLComponent',
    'UPDLEvent',
    'UPDLAction',
    'UPDLData',
    'UPDLUniverso'
]

/**
 * Base class for all UPDL nodes that integrates with Flowise
 */
export abstract class BaseUPDLNode implements INode {
    /**
     * Node properties used by Flowise
     */
    name: string
    type: string
    icon: string
    category: string = 'UPDL'
    description: string
    baseClasses: string[] = ['UPDLNode']
    inputs: INodeParams[] = []
    properties?: INodeParams[]
    outputs: INodeOutputsValue[] = []
    version: number = 1.0 // Adding version property
    tags: string[] = ['UPDL'] // Tag for display in the UPDL tab

    // Universo Platformo | Add properties compatible with Flowise
    label: string
    filePath?: string

    /**
     * Constructor for BaseUPDLNode
     * @param config Node configuration
     */
    constructor(config: {
        name: string
        type: string
        icon: string
        description: string
        inputs?: INodeParams[]
        outputs?: INodeOutputsValue[]
        version?: number
        properties?: INodeParams[]
    }) {
        this.name = config.name
        this.type = config.type
        this.icon = config.icon
        this.description = config.description
        this.label = config.name // Universo Platformo | Use name as display label
        this.version = config.version || 1.0 // Set default version if not provided
        this.properties = config.properties || []

        if (config.inputs) this.inputs = config.inputs

        // Only set outputs if explicitly provided in config
        if (config.outputs) {
            this.outputs = config.outputs
        }
        // Otherwise, let Flowise handle the default output behavior

        // Make sure the base classes include the type
        this.baseClasses = [this.type, ...this.baseClasses.filter((c) => c !== this.type)]
    }

    /**
     * Initialize the node with data from Flowise
     * @param nodeData Node data from Flowise
     */
    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        // Default implementation, can be overridden by subclasses
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data from previous nodes
     * @param options Optional parameters
     */
    async run(nodeData: INodeData, input?: string, options?: ICommonObject): Promise<any> {
        // Default implementation, should be overridden by subclasses
        throw new Error('Run method must be implemented by subclass')
    }

    /**
     * Convert from Flowise node data to UPDL node format
     * @param nodeData Node data from Flowise
     * @returns UPDLNode representation
     */
    toUPDLNode(nodeData: INodeData): UPDLNode {
        return {
            id: nodeData.id as string,
            type: this.type,
            name: this.name,
            metadata: {
                properties: nodeData.inputs || {},
                position: {
                    x: nodeData.positionX || 0,
                    y: nodeData.positionY || 0
                },
                inputs: this.mapPortsToUPDL(this.inputs),
                outputs: this.mapOutputsToUPDL(this.outputs)
            }
        }
    }

    /**
     * Map Flowise inputs to UPDL ports
     * @param params Flowise node parameters
     * @returns UPDL node ports
     */
    private mapPortsToUPDL(params: INodeParams[]): UPDLNodePort[] {
        // Map only parameters that are connection points, not UI fields
        return params
            .filter((param) => CONNECTABLE_TYPES.includes(param.type))
            .map((param) => ({
                id: param.name,
                name: param.label || param.name,
                type: this.mapParamTypeToPortType(param.type),
                label: param.description
            }))
    }

    /**
     * Map Flowise outputs to UPDL ports
     */
    private mapOutputsToUPDL(outputs: INodeOutputsValue[]): UPDLNodePort[] {
        return outputs.map((output) => ({
            id: output.name,
            name: output.label || output.name,
            type: this.mapParamTypeToPortType(output.baseClasses[0] || 'object'),
            label: output.description
        }))
    }

    /**
     * Map Flowise parameter type to UPDL port type
     * @param paramType Flowise parameter type
     * @returns UPDL port type
     */
    private mapParamTypeToPortType(paramType: string): UPDLPortType {
        // Map Flowise parameter types to UPDL port types
        switch (paramType) {
            // Legacy types (for backward compatibility)
            case 'space':
                return UPDLPortType.SCENE // Using SCENE port type for backward compatibility
            case 'object':
                return UPDLPortType.OBJECT
            case 'camera':
                return UPDLPortType.CAMERA
            case 'light':
                return UPDLPortType.LIGHT
            case 'material':
                return UPDLPortType.MATERIAL
            case 'trigger':
                return UPDLPortType.TRIGGER

            // Modern UPDL types
            case 'UPDLSpace':
                return UPDLPortType.SCENE
            case 'UPDLEntity':
                return UPDLPortType.OBJECT // Entities are positioned objects
            case 'UPDLComponent':
                return UPDLPortType.CONTROLLER // Components control entity behavior
            case 'UPDLEvent':
                return UPDLPortType.TRIGGER // Events are triggers
            case 'UPDLAction':
                return UPDLPortType.ACTION
            case 'UPDLData':
                return UPDLPortType.CONTROLLER // Data controls application state
            case 'UPDLUniverso':
                return UPDLPortType.CONTROLLER // Universo controls global connectivity

            // Default fallback
            default:
                return UPDLPortType.OBJECT
        }
    }
}
