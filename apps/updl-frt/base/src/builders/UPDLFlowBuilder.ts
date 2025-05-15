import { UPDLSceneBuilder } from './UPDLSceneBuilder'
import { UPDLSceneGraph } from '../interfaces/UPDLInterfaces'

/**
 * Universo Platformo | Client-side UPDL flow builder
 * This module contains functionality for building UPDL scenes from chatflow data
 * on the client side. It is used for processing UPDL node data and converting it
 * to a scene graph structure that can be used by the AR.js exporter.
 *

/**
 * Check if a Flowise component node is a UPDL node
 * @param node Node to check
 * @returns True if the node is a UPDL node
 */
export function isUPDLNode(node: any): boolean {
    // Check node type
    if (!node || !node.data) return false

    // Check if nodeClass contains valid UPDL base class
    const baseClasses = node.data.baseClasses || []
    const updlBaseClasses = ['UPDLScene', 'UPDLObject', 'UPDLCamera', 'UPDLLight', 'UPDLInteraction']

    // Check if any of the node's base classes are UPDL base classes
    return baseClasses.some((baseClass: string) => updlBaseClasses.includes(baseClass))
}

/**
 * Check if a Flowise chatflow contains UPDL nodes
 * @param chatflow Flowise chatflow object
 * @returns True if the chatflow contains UPDL nodes
 */
export function hasUPDLNodes(chatflow: any): boolean {
    if (!chatflow || !chatflow.nodes || !Array.isArray(chatflow.nodes)) {
        return false
    }

    return chatflow.nodes.some((node: any) => isUPDLNode(node))
}

/**
 * Extract nodes with UPDL base classes from a chatflow
 * @param chatflow Flowise chatflow object
 * @returns Array of UPDL nodes
 */
export function extractUPDLNodes(chatflow: any): any[] {
    if (!chatflow || !chatflow.nodes || !Array.isArray(chatflow.nodes)) {
        return []
    }

    return chatflow.nodes.filter((node: any) => isUPDLNode(node))
}

/**
 * Build a UPDL scene from a Flowise chatflow
 * @param chatflow Flowise chatflow object
 * @param ensureDefaults Whether to add default elements if missing
 * @returns Built UPDL scene or null if invalid
 */
export function buildUPDLScene(chatflow: any, ensureDefaults: boolean = true): UPDLSceneGraph | null {
    // Extract UPDL nodes from chatflow
    const updlNodes = extractUPDLNodes(chatflow)

    if (updlNodes.length === 0) {
        console.warn('No UPDL nodes found in chatflow')
        return null
    }

    // Create scene builder
    const builder = new UPDLSceneBuilder()

    // Add each node to the builder
    let addedNodes = 0

    for (const node of updlNodes) {
        // Skip nodes without data output from run
        if (!node.data?.outputData?.data) continue

        // Add node data to builder
        const nodeData = node.data.outputData.data
        const added = builder.addNode(nodeData)

        if (added) {
            addedNodes++
        }
    }

    if (addedNodes === 0) {
        console.warn('No valid UPDL nodes could be added to the scene')
        return null
    }

    // Build the scene
    const scene = builder.build(ensureDefaults)

    // Log any warnings
    const warnings = builder.getWarnings()
    if (warnings.length > 0) {
        console.warn('UPDL scene build warnings:', warnings)
    }

    return scene
}

/**
 * Build and execute a UPDL flow from chatflow
 * @param chatflow Chatflow to execute
 * @param chatId Chat ID for tracking
 * @param inputs Input data
 * @param componentNodes Component nodes
 * @param ensureDefaults Whether to add default elements if missing
 * @returns UPDL scene or null if invalid
 */
export async function buildUPDLflow(
    chatflow: any,
    chatId: string,
    inputs: any = {},
    componentNodes: any = {},
    ensureDefaults: boolean = true
): Promise<UPDLSceneGraph | null> {
    if (!hasUPDLNodes(chatflow)) {
        console.warn('No UPDL nodes in chatflow')
        return null
    }

    // First execute the entire chatflow to get node outputs
    // This is based on buildFlow functionality in flowiseAI
    try {
        // Get all nodes from chatflow
        const nodes = chatflow.nodes || []

        // Execute each UPDL node
        for (const node of nodes) {
            // Skip non-UPDL nodes
            if (!isUPDLNode(node)) continue

            // Get component node class
            const nodeClassInstance = componentNodes[node.data.name]
            if (!nodeClassInstance) {
                console.error(`Node class instance not found for node: ${node.data.name}`)
                continue
            }

            // Get node input data
            const nodeInputData = { ...node.data }
            nodeInputData.inputs = { ...inputs, ...nodeInputData.inputs }

            // Execute node
            const outputData = await nodeClassInstance.run(nodeInputData, {}, {})

            // Store output data in node for later use
            node.data.outputData = { data: outputData }
        }

        // Now build the UPDL scene using the executed nodes
        return buildUPDLScene(chatflow, ensureDefaults)
    } catch (error) {
        console.error('Error building UPDL flow:', error)
        return null
    }
}

/**
 * Validate a UPDL flow to check for errors
 * @param chatflow Chatflow to validate
 * @returns Object with validation results
 */
export function validateUPDLflow(chatflow: any): {
    isValid: boolean
    hasUPDLNodes: boolean
    hasScene: boolean
    hasObjects: boolean
    errors: string[]
    warnings: string[]
} {
    // Default validation results
    const result = {
        isValid: false,
        hasUPDLNodes: false,
        hasScene: false,
        hasObjects: false,
        errors: [] as string[],
        warnings: [] as string[]
    }

    // Check if chatflow exists
    if (!chatflow) {
        result.errors.push('No chatflow provided')
        return result
    }

    // Extract UPDL nodes
    const updlNodes = extractUPDLNodes(chatflow)
    result.hasUPDLNodes = updlNodes.length > 0

    if (!result.hasUPDLNodes) {
        result.errors.push('No UPDL nodes found in chatflow')
        return result
    }

    // Check for scene node
    const sceneNodes = updlNodes.filter((node) => node.data?.baseClasses?.includes('UPDLScene'))
    result.hasScene = sceneNodes.length > 0

    if (!result.hasScene) {
        result.errors.push('No Scene node found in chatflow')
    } else if (sceneNodes.length > 1) {
        result.warnings.push('Multiple Scene nodes found, only the first one will be used')
    }

    // Check for object nodes
    const objectNodes = updlNodes.filter((node) => node.data?.baseClasses?.includes('UPDLObject'))
    result.hasObjects = objectNodes.length > 0

    if (!result.hasObjects) {
        result.warnings.push('No Object nodes found in chatflow')
    }

    // Check for camera nodes
    const cameraNodes = updlNodes.filter((node) => node.data?.baseClasses?.includes('UPDLCamera'))

    if (cameraNodes.length === 0) {
        result.warnings.push('No Camera nodes found, a default camera will be added')
    } else if (cameraNodes.length > 1) {
        result.warnings.push("Multiple Camera nodes found, make sure they don't conflict")
    }

    // Check for light nodes
    const lightNodes = updlNodes.filter((node) => node.data?.baseClasses?.includes('UPDLLight'))

    if (lightNodes.length === 0) {
        result.warnings.push('No Light nodes found, default lighting will be added')
    }

    // Set overall validity
    result.isValid = result.hasUPDLNodes && result.hasScene && result.errors.length === 0

    return result
}
