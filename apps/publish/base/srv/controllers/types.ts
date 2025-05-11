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

    /** Optional label */
    label?: string

    /** Node position */
    position?: {
        x: number
        y: number
    }

    /** Node data */
    data: Record<string, any>
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
