// Universo Platformo | Base class for AR.js nodes
import { INode, INodeData, INodeParams, INodeOutputsValue, ICommonObject } from '../../src/Interface'

/**
 * Base class for all AR.js nodes
 * Implements common functionality and defines required interfaces
 */
export abstract class BaseARNode implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    tags: string[]

    // Standard inputs and outputs
    inputs: INodeParams[] = []
    outputs: INodeOutputsValue[] = []

    constructor() {
        this.category = 'AR.js'
        this.version = 1.0
    }

    /**
     * Process the input from previous nodes and the node's own configuration
     * @param nodeData Current node data including inputs
     * @param inputs Input data from previous nodes (each key corresponds to an inputAnchor)
     */
    async processInputs(nodeData: INodeData, inputs: ICommonObject): Promise<ICommonObject> {
        // Child classes should override this to process inputs from connected nodes
        return {}
    }

    /**
     * Main execution method for the node, called by Flowise
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<string | ICommonObject> {
        // Get processed inputs from the node's configuration and previous nodes
        const inputs = options || {}
        const processedInputs = await this.processInputs(nodeData, inputs)
        return processedInputs
    }

    /**
     * Initialize the node
     */
    async init(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Call the run method to get the actual result
        return this.run(nodeData, input, options)
    }
}
