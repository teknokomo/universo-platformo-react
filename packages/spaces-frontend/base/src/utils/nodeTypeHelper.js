/**
 * Universo Platformo | Node Type Helper
 *
 * Utility functions for determining ReactFlow node render types
 * based on node data (category, name, type).
 *
 * This enables a universal canvas that renders different node styles:
 * - 'agentFlow' - Compact AgentFlow nodes with colored borders
 * - 'iteration' - Container node for iterations
 * - 'stickyNote' - Sticky note nodes
 * - 'customNode' - Standard node rendering (default)
 */

import { AGENTFLOW_ICONS } from '@flowise/template-mui'

/**
 * Determines the ReactFlow node render type based on node data
 * @param {Object} nodeData - Node data from component definition or flowData
 * @returns {string} - ReactFlow node type: 'iteration' | 'stickyNote' | 'agentFlow' | 'customNode'
 */
export const getNodeRenderType = (nodeData) => {
    if (!nodeData) return 'customNode'

    // Iteration container node - special resizable container
    if (nodeData.type === 'Iteration') {
        return 'iteration'
    }

    // Sticky note - simple note node
    if (nodeData.type === 'StickyNote') {
        return 'stickyNote'
    }

    // AgentFlow nodes - check by category or name convention
    const isAgentFlowNode =
        nodeData.category === 'Agent Flows' ||
        nodeData.name?.endsWith('Agentflow') ||
        // Also check if it has a matching AGENTFLOW_ICONS entry (built-in icon)
        (Array.isArray(AGENTFLOW_ICONS) && AGENTFLOW_ICONS.some((icon) => icon.name === nodeData.name))

    if (isAgentFlowNode) {
        return 'agentFlow'
    }

    // Standard node
    return 'customNode'
}

/**
 * Normalizes nodes array to ensure each node has correct 'type' for rendering
 * Used when loading flowData from database
 * @param {Array} nodes - Array of ReactFlow nodes
 * @param {Array} componentNodes - Array of component node definitions (optional)
 * @returns {Array} - Normalized nodes with correct types
 */
export const normalizeNodeTypes = (nodes, componentNodes = []) => {
    if (!Array.isArray(nodes)) return []

    const validTypes = ['iteration', 'stickyNote', 'agentFlow', 'customNode']

    return nodes.map((node) => {
        // If type is already set and valid, keep it
        if (node.type && validTypes.includes(node.type)) {
            return node
        }

        // Get node definition from componentNodes or use node.data
        const nodeData = node.data || {}
        const componentNode = componentNodes.find((cn) => cn.name === nodeData.name)

        // Merge data with component definition for better type detection
        const mergedData = {
            ...nodeData,
            // Component definition takes priority for category/type
            category: componentNode?.category || nodeData.category,
            type: componentNode?.type || nodeData.type
        }

        return {
            ...node,
            type: getNodeRenderType(mergedData)
        }
    })
}

/**
 * Checks if a node is an AgentFlow node
 * @param {Object} node - ReactFlow node object
 * @returns {boolean}
 */
export const isAgentFlowNode = (node) => {
    if (!node) return false
    return (
        node.type === 'agentFlow' ||
        node.type === 'iteration' ||
        node.data?.category === 'Agent Flows' ||
        node.data?.name?.endsWith('Agentflow')
    )
}

/**
 * Determines edge type based on connected nodes
 * AgentFlow connections get special styling
 * @param {Object} sourceNode - Source ReactFlow node
 * @param {Object} targetNode - Target ReactFlow node
 * @returns {string} - Edge type: 'agentFlow' | 'buttonedge'
 */
export const getEdgeRenderType = (sourceNode, targetNode) => {
    const isAgentFlowConnection = isAgentFlowNode(sourceNode) || isAgentFlowNode(targetNode)
    return isAgentFlowConnection ? 'agentFlow' : 'buttonedge'
}
