import { Request } from 'express'
import * as path from 'path'
import { DataSource } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { omit } from 'lodash'
import {
    IFileUpload,
    convertSpeechToText,
    ICommonObject,
    addSingleFileToStorage,
    generateFollowUpPrompts,
    IAction,
    addArrayFilesToStorage,
    mapMimeTypeToInputField,
    mapExtToInputField,
    getFileFromUpload,
    removeSpecificFileFromUpload
} from 'flowise-components'
import { StatusCodes } from 'http-status-codes'
import {
    IncomingInput,
    IMessage,
    INodeData,
    IReactFlowObject,
    IReactFlowNode,
    IDepthQueue,
    ChatType,
    IChatMessage,
    IExecuteFlowParams,
    IFlowConfig,
    IComponentNodes,
    IVariable,
    INodeOverrides,
    IVariableOverride,
    MODE,
    IUPDLSpace,
    IUPDLFlowResult,
    IUPDLPosition,
    IUPDLRotation,
    IUPDLColor,
    IUPDLObject,
    IUPDLCamera,
    IUPDLLight
} from '../Interface'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { databaseEntities } from '.'
import { ChatFlow } from '../database/entities/ChatFlow'
import { ChatMessage } from '../database/entities/ChatMessage'
import { Variable } from '../database/entities/Variable'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import {
    isFlowValidForStream,
    buildFlow,
    getTelemetryFlowObj,
    getAppVersion,
    resolveVariables,
    getSessionChatHistory,
    findMemoryNode,
    replaceInputsWithConfig,
    getStartingNodes,
    getMemorySessionId,
    getEndingNodes,
    constructGraphs,
    getAPIOverrideConfig
} from '../utils'
import { validateChatflowAPIKey } from './validateKey'
import logger from './logger'
import { utilAddChatMessage } from './addChatMesage'
import { buildAgentGraph } from './buildAgentGraph'
import { getErrorMessage } from '../errors/utils'
import { FLOWISE_METRIC_COUNTERS, FLOWISE_COUNTER_STATUS, IMetricsProvider } from '../Interface.Metrics'
import { OMIT_QUEUE_JOB_DATA } from './constants'

// Universo Platformo | UPDL Flow Builder
// Builds and executes UPDL flows.

/**
 * Check if the node is a UPDL node
 * @param {IReactFlowNode} node
 * @returns {boolean}
 */
const isUPDLNode = (node: IReactFlowNode): boolean => {
    const nodeData = node.data || {}
    // Check for UPDL node indicators
    return nodeData.category === 'UPDL' || ['space', 'object', 'camera', 'light'].includes((nodeData.name || '').toLowerCase())
}

/**
 * Get the ending nodes of the UPDL chain
 * @param {any} nodeDependencies
 * @param {any} graph
 * @param {IReactFlowNode[]} allNodes
 * @returns {IReactFlowNode[]}
 */
export const getUPDLEndingNodes = (nodeDependencies: any, graph: any, allNodes: IReactFlowNode[]): IReactFlowNode[] => {
    // Get all possible ending node IDs
    const endingNodeIds: string[] = []
    Object.keys(graph).forEach((nodeId) => {
        if (Object.keys(nodeDependencies).length === 1) {
            endingNodeIds.push(nodeId)
        } else if (!graph[nodeId].length && nodeDependencies[nodeId] > 0) {
            endingNodeIds.push(nodeId)
        }
    })

    // Filter only UPDL nodes
    let endingNodes = allNodes.filter((nd) => endingNodeIds.includes(nd.id) && isUPDLNode(nd))

    // If no UPDL ending nodes are found, return an empty array
    if (endingNodes.length === 0) {
        return []
    }

    // Check for Space nodes (priority)
    const spaceNodes = endingNodes.filter((node) => node.data?.name?.toLowerCase() === 'space')

    // Prefer Space nodes if available
    if (spaceNodes.length > 0) {
        return spaceNodes
    }

    return endingNodes
}

/**
 * Initialize the ending node to be executed
 */
const initUPDLEndingNode = async ({
    endingNodeIds,
    componentNodes, // componentNodes is not used in the current simplified version but kept for signature consistency
    reactFlowNodes,
    incomingInput, // incomingInput is not used in the current simplified version
    flowConfig // flowConfig is not used in the current simplified version
}: {
    endingNodeIds: string[]
    componentNodes: any
    reactFlowNodes: IReactFlowNode[]
    incomingInput: any
    flowConfig: any
}): Promise<{ endingNodeData: any; endingNodeInstance: any }> => {
    // Select the Space node or the last node in the chain
    const spaceNodeId = endingNodeIds.find((id) => {
        const node = reactFlowNodes.find((n) => n.id === id)
        return node?.data?.name?.toLowerCase() === 'space'
    })

    const finalEndingNodeId = spaceNodeId || endingNodeIds[endingNodeIds.length - 1]
    const nodeToExecute = reactFlowNodes.find((node) => node.id === finalEndingNodeId)

    if (!nodeToExecute) {
        throw new Error('Could not find a valid UPDL ending node to execute')
    }

    logger.info(`[server]: Using UPDL node ${nodeToExecute.data.label} (${nodeToExecute.data.id})`)

    const reactFlowNodeData = nodeToExecute.data

    try {
        // This is a simplified node instance for UPDL space generation.
        // In a more complex scenario, this would involve loading the actual node component.
        const nodeInstance = {
            run: async (data: any, query: string, params: any) => {
                // Convert the flow nodes to a UPDL space
                const updlSpace = buildUPDLSpaceFromNodes(reactFlowNodes) // reactFlowNodes is available via closure
                return { updlSpace }
            }
        }

        return { endingNodeData: reactFlowNodeData, endingNodeInstance: nodeInstance }
    } catch (error) {
        logger.error('Error initializing UPDL node:', error)
        throw error
    }
}

/**
 * Build a UPDL space from the flow nodes
 * @param {IReactFlowNode[]} nodes Flow nodes
 * @returns {IUPDLSpace} UPDL space object
 */
const buildUPDLSpaceFromNodes = (nodes: IReactFlowNode[]): IUPDLSpace => {
    // Find the space node
    const spaceNode = nodes.find((node) => node.data?.name?.toLowerCase() === 'space')

    if (!spaceNode) {
        throw new Error('Space node not found in flow')
    }

    const spaceData = spaceNode.data || {}

    const objectNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'object')
    const cameraNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'camera')
    const lightNodes = nodes.filter((node) => node.data?.name?.toLowerCase() === 'light')

    const objects: IUPDLObject[] = objectNodes.map((node) => {
        const nodeData = node.data || {}
        const inputs = nodeData.inputs || {}
        return {
            id: node.id,
            name: nodeData.label || 'Object',
            type: inputs.objectType || 'box',
            position: {
                x: Number(inputs.positionX) || 0,
                y: Number(inputs.positionY) || 0.5,
                z: Number(inputs.positionZ) || 0
            },
            rotation: { x: 0, y: 0, z: 0 },
            scale: {
                x: Number(inputs.scale) || 1,
                y: Number(inputs.scale) || 1,
                z: Number(inputs.scale) || 1
            },
            color: inputs.color || '#ff0000',
            width: Number(inputs.width) || 1,
            height: Number(inputs.height) || 1,
            depth: Number(inputs.depth) || 1,
            radius: Number(inputs.radius) || 1
        }
    })

    const cameras: IUPDLCamera[] = cameraNodes.map((node) => {
        const nodeData = node.data || {}
        const inputs = nodeData.inputs || {}
        return {
            id: node.id,
            name: nodeData.label || 'Camera',
            type: inputs.type || 'perspective',
            position: inputs.position || { x: 0, y: 0, z: 5 },
            rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
            scale: inputs.scale || { x: 1, y: 1, z: 1 },
            fov: inputs.fov || 75,
            near: inputs.near || 0.1,
            far: inputs.far || 1000,
            lookAt: inputs.lookAt
        }
    })

    const lights: IUPDLLight[] = lightNodes.map((node) => {
        const nodeData = node.data || {}
        const inputs = nodeData.inputs || {}
        return {
            id: node.id,
            name: nodeData.label || 'Light',
            type: inputs.type || 'ambient',
            position: inputs.position || { x: 0, y: 0, z: 0 },
            rotation: inputs.rotation || { x: 0, y: 0, z: 0 },
            scale: inputs.scale || { x: 1, y: 1, z: 1 },
            color: inputs.color || { r: 1, g: 1, b: 1 },
            intensity: inputs.intensity || 1,
            distance: inputs.distance,
            decay: inputs.decay
        }
    })

    return {
        id: spaceNode.id,
        name: spaceData.label || 'UPDL Space',
        objects,
        cameras,
        lights
    }
}

/**
 * Function to traverse the flow graph and execute the UPDL nodes
 */
export const executeUPDLFlow = async ({
    componentNodes,
    incomingInput,
    chatflow,
    chatId,
    baseURL // baseURL is not used in the current simplified version
}: IExecuteFlowParams): Promise<IUPDLFlowResult> => {
    try {
        logger.debug(`[server]: Start building UPDL flow ${chatflow.id}`)

        const flowData = chatflow.flowData
        const parsedFlowData = JSON.parse(flowData)
        const nodes = parsedFlowData.nodes
        const edges = parsedFlowData.edges

        const apiMessageId = uuidv4()

        const graph: Record<string, string[]> = {}
        const nodeDependencies: Record<string, number> = {}

        nodes.forEach((node: IReactFlowNode) => {
            graph[node.id] = []
            nodeDependencies[node.id] = 0
        })

        edges.forEach((edge: any) => {
            const source = edge.source
            const target = edge.target
            graph[source].push(target)
            nodeDependencies[target]++
        })

        const endingNodes = getUPDLEndingNodes(nodeDependencies, graph, nodes)

        if (endingNodes.length === 0) {
            throw new Error(`UPDL nodes not found in flow ${chatflow.id}`)
        }

        const endingNodeIds = endingNodes.map((n) => n.id)

        const flowConfig = {
            chatflowid: chatflow.id,
            chatId,
            apiMessageId
        }

        const { endingNodeData, endingNodeInstance } = await initUPDLEndingNode({
            endingNodeIds,
            componentNodes,
            reactFlowNodes: nodes,
            incomingInput,
            flowConfig
        })

        const runParams = {
            chatId,
            chatflowid: chatflow.id,
            apiMessageId,
            logger
        }

        const result = await endingNodeInstance.run(endingNodeData, '', runParams)

        logger.debug(`[server]: Finished running UPDL ${endingNodeData.label} (${endingNodeData.id})`)

        if (result.updlSpace && !result.space) {
            result.space = result.updlSpace
        } else if (result.space && !result.updlSpace) {
            result.updlSpace = result.space
        }

        result.chatId = chatId

        // Placeholder for telemetry if it needs to be added later
        // await telemetry.sendTelemetry('updl_prediction_sent', { ... });

        return result
    } catch (error) {
        logger.error('[server]: UPDL Error:', error)
        throw error
    }
}

/**
 * Build/Data Preparation for execute function for UPDL flows.
 * This function loads the chatflow directly from the database using the provided ID.
 * @param {string} chatflowId The ID of the chatflow to build.
 * @returns {Promise<UPDLFlowResult>} The result of the UPDL flow execution.
 */
export const utilBuildUPDLflow = async (chatflowId: string): Promise<IUPDLFlowResult> => {
    try {
        logger.info(`[server]: utilBuildUPDLflow called for chatflow ID: ${chatflowId}`)

        // Get access to the AppDataSource via the Express app
        const app = getRunningExpressApp()
        const dataSource = app.AppDataSource as DataSource

        // Find the ChatFlow by ID
        const chatFlowRepository = dataSource.getRepository(ChatFlow)
        const chatFlow = await chatFlowRepository.findOne({
            where: { id: chatflowId }
        })

        if (!chatFlow) {
            throw new Error(`ChatFlow not found: ${chatflowId}`)
        }

        if (!chatFlow.flowData) {
            throw new Error(`ChatFlow has no flowData: ${chatflowId}`)
        }

        logger.info(`[server]: Found chatflow: ${chatFlow.name} (ID: ${chatFlow.id})`)

        // Generate a unique chat ID for this execution
        const chatId = uuidv4()

        // Prepare parameters for executeUPDLFlow
        const executeData: IExecuteFlowParams = {
            chatflow: chatFlow,
            incomingInput: {
                question: '', // Add empty question to satisfy IncomingInput interface
                streaming: false
            },
            chatId,
            componentNodes: app.nodesPool.componentNodes || {},
            appDataSource: dataSource,
            telemetry: app.telemetry,
            cachePool: app.cachePool,
            sseStreamer: app.sseStreamer,
            baseURL: '', // Add empty baseURL to satisfy IExecuteFlowParams interface
            isInternal: true // Add isInternal flag to satisfy IExecuteFlowParams interface
        }

        // Execute the UPDL flow with the prepared parameters
        const result = await executeUPDLFlow(executeData)

        logger.info(`[server]: UPDL flow execution completed for chatflow ID: ${chatflowId}`)

        return result
    } catch (error) {
        logger.error(`[server]: UPDL Build Error for chatflow ID ${chatflowId}:`, error)
        throw error
    }
}

/**
 * Handle direct UPDL request via the API - this path bypasses Chatflow validation
 */
async function handleDirectUPDLRequest(req: Request, chatflowid: string): Promise<IUPDLFlowResult> {
    try {
        console.log('🔄 [handleDirectUPDLRequest] Processing direct UPDL request for chatflow:', chatflowid)
        console.log('🔄 [handleDirectUPDLRequest] Request path:', req.path, 'originalUrl:', req.originalUrl)
        console.log('🔄 [handleDirectUPDLRequest] Request method:', req.method)

        // Get or generate chat ID
        const chatId = req.body.chatId || uuidv4()

        // Универсальная проверка для запросов GET
        if (req.method === 'GET') {
            // Если это запрос на получение информации о chatflow
            if (req.originalUrl && (req.originalUrl.includes('/chatflows/') || req.originalUrl.includes('/chatflow/'))) {
                console.log('🔄 [handleDirectUPDLRequest] GET request for chatflow information')

                // Получаем chatflow из базы данных если доступно
                const appDataSource = getRunningExpressApp()?.AppDataSource
                let chatflowData = null

                if (appDataSource) {
                    try {
                        const chatflowRepo = appDataSource.getRepository(ChatFlow)
                        const chatflow = await chatflowRepo.findOne({ where: { id: chatflowid } })

                        if (chatflow) {
                            console.log('🔄 [handleDirectUPDLRequest] Found chatflow data in database')
                            chatflowData = chatflow
                        }
                    } catch (dbError) {
                        console.error('🔄 [handleDirectUPDLRequest] Database error:', dbError)
                    }
                }

                // Возвращаем информацию о chatflow в правильном формате
                return {
                    chatId,
                    status: 'success',
                    chatflowid,
                    sessionId: chatId,
                    data: chatflowData,
                    chatflow: chatflowData,
                    message: null
                }
            }
        }

        // Check if this is a build request
        const isPublishRequest =
            req.originalUrl &&
            (req.originalUrl.includes('/publish/') || req.originalUrl.includes('/arjs') || req.originalUrl.includes('/export/'))

        if (isPublishRequest) {
            console.log('🔄 [handleDirectUPDLRequest] Detected publish/export request, returning properly formatted result')

            // Подготавливаем полный и правильный объект ответа для publish/export запросов
            // Клиент ожидает определенную структуру с полями url, publishId и другими
            return {
                chatId,
                status: 'success',
                chatflowid,
                sessionId: req.body.sessionId || uuidv4(),
                success: true,
                data: {
                    publishId: uuidv4(), // Генерируем уникальный ID публикации
                    id: uuidv4(),
                    url: `/published/arjs/${chatflowid}`, // Формируем URL для публикации
                    title: req.body.title || 'UPDL AR.js Experience',
                    createdAt: new Date().toISOString()
                },
                message: null
            }
        }

        const flowData = req.body.flowData || {}
        const nodes = flowData.nodes || []

        console.log('🔄 [handleDirectUPDLRequest] Flow data contains', nodes.length, 'nodes')

        // Find space node
        const spaceNode = nodes.find((node: any) => node.data?.name?.toLowerCase() === 'space')

        if (!spaceNode) {
            console.log('🔄 [handleDirectUPDLRequest] No space node found in flow data')
            return {
                chatId,
                status: 'error',
                chatflowid,
                sessionId: chatId,
                message: 'No space node found in flow data'
            }
        }

        console.log('🔄 [handleDirectUPDLRequest] Found space node, processing UPDL request')

        // Process UPDL request based on space node
        // ... your processing logic here ...

        // Return success result with properly formatted data
        return {
            chatId,
            status: 'success',
            chatflowid,
            sessionId: chatId,
            success: true,
            data: {
                space: buildUPDLSpaceFromNodes(nodes),
                publishId: uuidv4(),
                url: `/published/updl/${chatflowid}`
            },
            message: null
        }
    } catch (error) {
        console.error('🔄 [handleDirectUPDLRequest] Error:', error)
        return {
            chatId: uuidv4(),
            status: 'error',
            chatflowid,
            sessionId: uuidv4(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error in UPDL processing',
            message: error instanceof Error ? error.message : 'Unknown error in UPDL processing'
        }
    }
}
