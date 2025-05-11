// Universo Platformo | Build UPDL Flow
// Functions for building and executing UPDL flows

import { UPDLSceneBuilder } from '../UPDLSceneBuilder'
import { UPDLFlow } from '../interfaces/UPDLInterfaces'

/**
 * Check if a node is a UPDL node
 * @param nodeType Node type string
 * @returns Boolean indicating if it's a UPDL node
 */
export function isUPDLNode(nodeType: string): boolean {
    return nodeType.startsWith('UPDL') || nodeType.includes('UPDLNode')
}

/**
 * Check if a flow contains UPDL nodes
 * @param flowData Flow data from Flowise
 * @returns Boolean indicating if it contains UPDL nodes
 */
export function hasUPDLNodes(flowData: any): boolean {
    return flowData && flowData.nodes && Array.isArray(flowData.nodes) && flowData.nodes.some((node: any) => isUPDLNode(node.type))
}

/**
 * Get UPDL scene node from a flow
 * @param flowData Flow data from Flowise
 * @returns Scene node or null if not found
 */
export function getUPDLSceneNode(flowData: any): any | null {
    if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
        return null
    }

    return flowData.nodes.find((node: any) => node.type === 'UPDLSceneNode')
}

/**
 * Check if a flow contains a UPDL scene
 * @param flowData Flow data from Flowise
 * @returns Boolean indicating if it contains a UPDL scene
 */
export function hasUPDLScene(flowData: any): boolean {
    return !!getUPDLSceneNode(flowData)
}

/**
 * Get all UPDL nodes from a flow
 * @param flowData Flow data from Flowise
 * @returns Array of UPDL nodes
 */
export function getUPDLNodes(flowData: any): any[] {
    if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
        return []
    }

    return flowData.nodes.filter((node: any) => isUPDLNode(node.type))
}

/**
 * Build UPDL flow into a scene
 * @param flowData Flow data from Flowise
 * @returns UPDLSceneBuilder instance with the built scene
 */
export function buildUPDLFlow(flowData: any): UPDLSceneBuilder {
    // Check if the flow has UPDL nodes
    if (!hasUPDLNodes(flowData)) {
        throw new Error('No UPDL nodes found in the flow')
    }

    // Check if the flow has a UPDL scene
    if (!hasUPDLScene(flowData)) {
        throw new Error('No UPDL scene node found in the flow')
    }

    // Create a scene builder
    const sceneBuilder = new UPDLSceneBuilder(flowData.nodes, flowData.edges)

    // Build the scene
    sceneBuilder.buildScene()

    // Add default elements if needed
    sceneBuilder.addDefaults()

    return sceneBuilder
}

/**
 * Check if a flow contains a valid UPDL chain
 * A valid chain must have a scene node and at least one object node
 * @param flowData Flow data from Flowise
 * @returns Boolean indicating if it contains a valid UPDL chain
 */
export function hasValidUPDLChain(flowData: any): boolean {
    if (!hasUPDLScene(flowData)) {
        return false
    }

    // Check if there's at least one object node
    const objectNodes = flowData.nodes.filter((node: any) => node.type === 'UPDLObjectNode')
    return objectNodes.length > 0
}

/**
 * Execute a UPDL flow
 * @param flowData Flow data from Flowise
 * @returns Resulting UPDL flow data
 */
export async function executeUPDLFlow(flowData: any): Promise<UPDLFlow> {
    // Build the flow
    const sceneBuilder = buildUPDLFlow(flowData)

    // Get the scene
    const scene = sceneBuilder.buildScene()

    // Create a UPDL flow
    const updlFlow: UPDLFlow = {
        id: flowData.id || 'flow-' + Date.now(),
        name: flowData.name || 'UPDL Flow',
        description: flowData.description || 'Generated UPDL Flow',
        version: '1.0.0',
        graph: sceneBuilder.getGraph(),
        nodes: sceneBuilder.getGraph().nodes,
        connections: [], // Deprecated, kept for backward compatibility
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sceneId: scene.id,
            objects: sceneBuilder.getObjects().length,
            cameras: sceneBuilder.getCameras().length,
            lights: sceneBuilder.getLights().length
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }

    return updlFlow
}

/**
 * Get the latest flow with UPDL nodes
 * @param chatflows Array of chatflows from the database
 * @returns Latest chatflow with UPDL nodes or null if none found
 */
export function getLatestUPDLFlow(chatflows: any[]): any | null {
    if (!chatflows || !Array.isArray(chatflows) || chatflows.length === 0) {
        return null
    }

    // Filter flows with UPDL nodes
    const updlFlows = chatflows.filter((flow) => {
        try {
            const flowData = JSON.parse(flow.flowData)
            return hasUPDLNodes(flowData)
        } catch (err) {
            return false
        }
    })

    if (updlFlows.length === 0) {
        return null
    }

    // Sort by updatedOn or id and return the latest
    return updlFlows.sort((a, b) => {
        const dateA = a.updatedOn ? new Date(a.updatedOn) : new Date(0)
        const dateB = b.updatedOn ? new Date(b.updatedOn) : new Date(0)
        return dateB.getTime() - dateA.getTime()
    })[0]
}
