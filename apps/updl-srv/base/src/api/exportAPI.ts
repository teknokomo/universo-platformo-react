// Universo Platformo | Export API
// API for exporting UPDL flows

import express from 'express'
import { ExporterManager, ExporterInfo } from '../exporters/ExporterManager'
import { UPDLFlow, ExporterOptions } from '../interfaces/UPDLInterfaces'
import { ExportResult } from '../interfaces/ExporterInterface'

// Create router
const router = express.Router()

// Create exporter manager
const exporterManager = new ExporterManager()

/**
 * Get available exporters
 * GET /api/updl/export/exporters
 */
router.get('/exporters', (req, res) => {
    try {
        const exporters = exporterManager.getAvailableExporters()
        res.status(200).json({ exporters })
    } catch (error) {
        console.error('Error getting exporters:', error)
        res.status(500).json({
            error: 'Failed to retrieve exporters',
            details: error instanceof Error ? error.message : String(error)
        })
    }
})

/**
 * Get exporters by feature
 * GET /api/updl/export/exporters/byFeature/:feature
 */
router.get('/exporters/byFeature/:feature', (req, res) => {
    try {
        const { feature } = req.params
        if (!feature) {
            res.status(400).json({ error: 'Feature parameter is required' })
            return
        }

        const exporters = exporterManager.getExportersByFeature(feature)
        res.status(200).json({ exporters })
    } catch (error) {
        console.error(`Error getting exporters by feature "${req.params.feature}":`, error)
        res.status(500).json({
            error: 'Failed to retrieve exporters by feature',
            details: error instanceof Error ? error.message : String(error)
        })
    }
})

/**
 * Export a flow
 * POST /api/updl/export
 * Body: { flow: UPDLFlow, exporterId: string, options?: ExporterOptions }
 */
router.post('/', async (req, res) => {
    try {
        const { flow, exporterId, options = {} } = req.body

        // Validate input
        if (!flow || !exporterId) {
            res.status(400).json({ error: 'Missing required parameters: flow or exporterId' })
            return
        }

        // Export flow
        const result = await exporterManager.exportFlow(flow, exporterId, options)
        res.status(200).json(result)
    } catch (error) {
        console.error('Error exporting flow:', error)
        res.status(500).json({
            error: 'Failed to export flow',
            details: error instanceof Error ? error.message : String(error)
        })
    }
})

/**
 * Convert a Flowise flow to UPDL format
 * POST /api/updl/export/convert
 * Body: { flow: any }
 */
router.post('/convert', (req, res) => {
    try {
        const { flow } = req.body

        // Validate input
        if (!flow) {
            res.status(400).json({ error: 'Missing required parameter: flow' })
            return
        }

        // Convert flow
        const updlFlow = convertFlowiseToUPDL(flow)
        res.status(200).json({ updlFlow })
    } catch (error) {
        console.error('Error converting flow:', error)
        res.status(500).json({
            error: 'Failed to convert flow',
            details: error instanceof Error ? error.message : String(error)
        })
    }
})

/**
 * Convert a flow from Flowise format to UPDL format
 * @param flowiseFlow Flow data from Flowise
 * @returns UPDL flow
 */
function convertFlowiseToUPDL(flowiseFlow: any): UPDLFlow {
    // This is a simplified implementation that would need to be expanded
    // based on the actual Flowise flow format

    const nodes = []
    const connections = []

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

// Export router
export const exportAPI = router
