// Universo Platformo | Agents Backend Types
// Type definitions for agent-specific backend services

/**
 * Validation result for a single node
 */
export interface IValidationResult {
    /** Node ID */
    id: string
    /** Node label (display name) */
    label: string
    /** Node type name */
    name: string
    /** List of validation issues found */
    issues: string[]
}

/**
 * ReactFlow node interface (minimal subset for validation)
 */
export interface IReactFlowNode {
    id: string
    type?: string
    data: {
        id?: string
        name: string
        label?: string
        type?: string
        version?: number
        inputParams?: INodeParam[]
        inputs?: Record<string, unknown>
    }
}

/**
 * ReactFlow edge interface
 */
export interface IReactFlowEdge {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
}

/**
 * Node parameter definition
 */
export interface INodeParam {
    name: string
    label: string
    type: string
    optional?: boolean
    show?: Record<string, unknown>
    hide?: Record<string, unknown>
    array?: INodeParam[]
}

/**
 * Component node metadata from nodesPool
 */
export interface IComponentNode {
    name: string
    label: string
    version: number
    inputs?: INodeParam[]
    credential?: {
        name: string
        optional?: boolean
    }
}

/**
 * Component nodes map
 */
export type IComponentNodes = Record<string, IComponentNode>

/**
 * Flow data structure from canvas
 */
export interface IFlowData {
    nodes: IReactFlowNode[]
    edges: IReactFlowEdge[]
}
