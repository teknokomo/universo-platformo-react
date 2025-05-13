// Universo Platformo | UPDL Interfaces
// Type definitions for UPDL components

/**
 * UPDL Flow structure
 */
export interface UPDLFlow {
    /** Unique identifier */
    id: string

    /** Name of the flow */
    name: string

    /** Optional description */
    description?: string

    /** Version number */
    version: string

    /** Graph data */
    graph: {
        nodes: any[]
        edges: any[]
    }

    /** Legacy nodes array (for backward compatibility) */
    nodes: any[]

    /** Legacy connections array (for backward compatibility) */
    connections: any[]

    /** Additional metadata */
    metadata: Record<string, any>

    /** Creation timestamp */
    createdAt: string

    /** Last updated timestamp */
    updatedAt: string
}

/**
 * UPDL Node representation
 */
export interface UPDLNode {
    /** Unique identifier */
    id: string

    /** Node type */
    type: string

    /** Node name */
    name: string

    /** Node metadata */
    metadata: {
        /** Node properties */
        properties: Record<string, any>

        /** Node position */
        position: {
            x: number
            y: number
        }
    }
}

/**
 * UPDL Connection representation
 */
export interface UPDLConnection {
    /** Unique identifier */
    id: string

    /** Source node ID */
    sourceNodeId: string

    /** Source port ID */
    sourcePortId: string

    /** Target node ID */
    targetNodeId: string

    /** Target port ID */
    targetPortId: string
}

/**
 * Exporter options
 */
export interface ExporterOptions {
    /** Target platform */
    platform?: string

    /** Output format */
    format?: string

    /** Additional options */
    [key: string]: any
}
