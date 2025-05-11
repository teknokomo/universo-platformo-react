// Universo Platformo | Export API
// API for exporting UPDL flows

import { ExporterManager, ExporterInfo } from '../exporters/ExporterManager'
import { UPDLFlow, ExporterOptions, UPDLNode, UPDLConnection } from '../interfaces/UPDLInterfaces'
import { ExportResult } from '../interfaces/ExporterInterface'

/**
 * API for exporting UPDL flows
 */
export class ExportAPI {
    /**
     * Constructor for ExportAPI
     * @param exporterManager Instance of ExporterManager
     */
    constructor(private exporterManager: ExporterManager) {}

    /**
     * Export a flow using the specified exporter
     * @param flow UPDL flow to export
     * @param exporterId ID of the exporter to use
     * @param options Export options
     * @returns Export result
     */
    async exportFlow(flow: UPDLFlow, exporterId: string, options: ExporterOptions = {}): Promise<ExportResult> {
        return this.exporterManager.exportFlow(flow, exporterId, options)
    }

    /**
     * Get all available exporters
     * @returns Array of exporter info objects
     */
    getAvailableExporters() {
        return this.exporterManager.getAvailableExporters()
    }

    /**
     * Get exporters that support a specific feature
     * @param feature Feature to filter by
     * @returns Array of exporter info objects
     */
    getExportersByFeature(feature: string): ExporterInfo[] {
        return this.exporterManager.getExportersByFeature(feature)
    }

    /**
     * Convert a flow from Flowise format to UPDL format
     * @param flowiseFlow Flow data from Flowise
     * @returns UPDL flow
     */
    convertFlowiseToUPDL(flowiseFlow: any): UPDLFlow {
        // This is a simplified implementation that would need to be expanded
        // based on the actual Flowise flow format

        const nodes: UPDLNode[] = []
        const connections: UPDLConnection[] = []

        // Map Flowise nodes to UPDL nodes
        if (flowiseFlow.nodes && Array.isArray(flowiseFlow.nodes)) {
            for (const flowiseNode of flowiseFlow.nodes) {
                // Skip non-UPDL nodes
                if (!flowiseNode.type.startsWith('UPDL')) {
                    continue
                }

                // Create a UPDL node from Flowise node
                nodes.push({
                    id: flowiseNode.id,
                    type: flowiseNode.type,
                    name: flowiseNode.data?.name || flowiseNode.type,
                    metadata: {
                        properties: flowiseNode.data || {},
                        position: {
                            x: flowiseNode.position?.x || 0,
                            y: flowiseNode.position?.y || 0
                        }
                    }
                })
            }
        }

        // Map Flowise edges to UPDL connections
        if (flowiseFlow.edges && Array.isArray(flowiseFlow.edges)) {
            for (const flowiseEdge of flowiseFlow.edges) {
                connections.push({
                    id: flowiseEdge.id,
                    sourceNodeId: flowiseEdge.source,
                    sourcePortId: flowiseEdge.sourceHandle,
                    targetNodeId: flowiseEdge.target,
                    targetPortId: flowiseEdge.targetHandle
                })
            }
        }

        return {
            id: flowiseFlow.id || 'unknown',
            name: flowiseFlow.name || 'Untitled UPDL Flow',
            description: flowiseFlow.description,
            version: '1.0',
            graph: {
                nodes: [...nodes],
                edges: []
            },
            nodes, // For backward compatibility
            connections, // For backward compatibility
            metadata: {
                originalFlow: flowiseFlow.id,
                createdAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    }
}
