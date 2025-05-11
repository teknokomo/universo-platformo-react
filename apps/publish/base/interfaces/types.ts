// Universo Platformo | UPDL Common Types (Local Copy)
// TypeScript type definitions for UPDL flows

/**
 * Base interface for UPDL Flow
 */
export interface UPDLFlow {
    /** Unique identifier for the flow */
    id: string

    /** Name of the flow */
    name: string

    /** Optional description */
    description?: string

    /** Version number */
    version: string

    /** Graph data structure containing nodes and edges */
    graph: UPDLGraph

    /** Backward compatibility: direct access to nodes */
    nodes?: UPDLNode[]

    /** Backward compatibility: direct access to connections */
    connections?: UPDLConnection[]

    /** Metadata for the flow */
    metadata: Record<string, any>

    /** Creation timestamp */
    createdAt: string

    /** Last modified timestamp */
    updatedAt: string

    /** Author information */
    author?: string
}

/**
 * UPDL Graph structure
 */
export interface UPDLGraph {
    /** Nodes in the graph */
    nodes: UPDLNode[]

    /** Edges connecting nodes */
    edges: UPDLEdge[]
}

/**
 * UPDL Node representing an atomic operation
 */
export interface UPDLNode {
    /** Unique identifier for the node */
    id: string

    /** Type of the node */
    type: string

    /** Name of the node */
    name?: string

    /** Optional label */
    label?: string

    /** Node position */
    position?: {
        x: number
        y: number
    }

    /** Node data */
    data: Record<string, any>

    /** Input ports (backwards compatibility) */
    inputs?: UPDLNodePort[]

    /** Output ports (backwards compatibility) */
    outputs?: UPDLNodePort[]
}

/**
 * UPDL Edge representing a connection between nodes
 */
export interface UPDLEdge {
    /** Unique identifier for the edge */
    id: string

    /** Source node ID */
    source: string

    /** Target node ID */
    target: string

    /** Optional edge label */
    label?: string

    /** Edge type */
    type?: string

    /** Edge data */
    data?: Record<string, any>
}

/**
 * Port definition for node connections (backwards compatibility)
 */
export interface UPDLNodePort {
    id: string
    name: string
    type: string
    label?: string
}

/**
 * Connection between nodes (backwards compatibility)
 */
export interface UPDLConnection {
    id: string
    sourceNodeId: string
    sourcePortId: string
    targetNodeId: string
    targetPortId: string
}
