// Universo Platformo | Node interfaces
// These interfaces are compatible with Flowise node system

/**
 * Interface for node parameters compatible with Flowise
 * Used for both properties (UI fields) and inputs (connection points)
 */
export interface INodeParams {
    name: string
    type: string
    label?: string
    description?: string
    optional?: boolean
    default?: any
    options?: Array<{ label: string; name: string; description?: string }>
    list?: boolean
    acceptVariable?: boolean
    placeholder?: string
    step?: number
    rows?: number
    min?: number
    max?: number
    multiline?: boolean
    additionalParams?: boolean
    displayName?: string
    credentialNames?: Array<{ label: string; name: string }>
    show?: { [key: string]: any[] }
    hidden?: boolean
}

/**
 * Interface for node outputs values compatible with Flowise
 */
export interface INodeOutputsValue {
    name: string
    label?: string
    baseClasses?: string[]
    description?: string
}

/**
 * Interface for node data, compatible with Flowise
 */
export interface INodeData {
    id?: string
    name?: string
    type?: string
    positionX?: number
    positionY?: number
    inputs?: Record<string, unknown>
    outputs?: Record<string, unknown>
    properties?: Record<string, unknown>
    credentials?: Record<string, unknown>
    instance?: any
}

/**
 * Interface that all UPDL nodes must implement
 * for compatibility with Flowise
 */
export interface INode {
    name: string
    type: string
    icon: string
    category: string
    description: string
    baseClasses: string[]
    inputs?: INodeParams[]
    properties?: INodeParams[]
    outputs?: INodeOutputsValue[]
    version?: number
    init?(nodeData: INodeData, input: string): Promise<any>
    run?(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any>
}

/**
 * Common object interface used throughout the API
 */
export interface ICommonObject {
    [key: string]: any
}

// -----------------------------------------------------------------
// Helper functions for creating objects (migrated from interfaces.js)
// -----------------------------------------------------------------

/**
 * Creates a common object for various purposes
 * @returns Empty object to be populated at runtime
 */
export function createCommonObject(): ICommonObject {
    return {}
}

/**
 * Creates a node parameter definition
 * @param params Parameter properties
 * @returns Node parameter object
 */
export function createNodeParams(params: Partial<INodeParams>): INodeParams {
    const { name, type, label, description, optional, default: defaultValue, options, list, ...rest } = params as any

    return {
        name,
        type,
        label,
        description,
        optional,
        default: defaultValue,
        options,
        list,
        ...rest
    } as INodeParams
}

/**
 * Creates a node data structure
 * @param data Node data properties
 * @returns Node data object
 */
export function createNodeData(data: Partial<INodeData>): INodeData {
    const { id, name, type, positionX, positionY, inputs, outputs, properties, credentials, instance } = data

    return {
        id,
        name,
        type,
        positionX,
        positionY,
        inputs,
        outputs,
        properties,
        credentials,
        instance
    }
}

/**
 * Creates a node interface
 * @param node Node properties
 * @returns Node interface object
 */
export function createNode(node: Partial<INode>): INode {
    const { name, type, icon, category, description, baseClasses, inputs, outputs } = node as any

    return {
        name,
        type,
        icon,
        category,
        description,
        baseClasses,
        inputs,
        outputs
    } as INode
}
