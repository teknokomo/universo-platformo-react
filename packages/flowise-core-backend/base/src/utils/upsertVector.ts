import { Request } from 'express'
import * as path from 'path'
import { cloneDeep, omit } from 'lodash'
import {
    IMessage,
    addArrayFilesToStorage,
    mapMimeTypeToInputField,
    mapExtToInputField,
    getFileFromUpload,
    removeSpecificFileFromUpload
} from 'flowise-components'
import logger from './logger'
import {
    buildFlow,
    constructGraphs,
    getAllConnectedNodes,
    findMemoryNode,
    getMemorySessionId,
    getTelemetryFlowObj,
    getStartingNodes,
    getAPIOverrideConfig
} from '.'
import { validateCanvasApiKey } from './validateKey'
import { IncomingInput, INodeDirectedGraph, IReactFlowObject, ChatType, IExecuteFlowParams, MODE } from '../Interface'
import { getRunningExpressApp } from './getRunningExpressApp'
import { UpsertHistory } from '@flowise/docstore-backend'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { getErrorMessage } from '../errors/utils'
import { uuid } from '@universo/utils'
import { FLOWISE_COUNTER_STATUS, FLOWISE_METRIC_COUNTERS } from '../Interface.Metrics'
import { Variable } from '@flowise/variables-backend'
import { OMIT_QUEUE_JOB_DATA } from './constants'
import canvasService from '../services/spacesCanvas'

export const executeUpsert = async ({
    componentNodes,
    incomingInput,
    canvas,
    chatId,
    appDataSource,
    telemetry,
    cachePool,
    isInternal,
    files
}: IExecuteFlowParams) => {
    if (!canvas) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Canvas record not provided')
    }
    const canvasRecord = canvas
    const question = incomingInput.question
    let overrideConfig = incomingInput.overrideConfig ?? {}
    let stopNodeId = incomingInput?.stopNodeId ?? ''
    const chatHistory: IMessage[] = []
    const isUpsert = true
    const canvasId = canvasRecord.id
    const apiMessageId = uuid.generateUuidV7()

    if (files?.length) {
        overrideConfig = { ...incomingInput }
        for (const file of files) {
            const fileNames: string[] = []
            const fileBuffer = await getFileFromUpload(file.path ?? file.key)
            // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
            const storagePath = await addArrayFilesToStorage(file.mimetype, fileBuffer, file.originalname, fileNames, canvasId)

            const fileInputFieldFromMimeType = mapMimeTypeToInputField(file.mimetype)

            const fileExtension = path.extname(file.originalname)

            const fileInputFieldFromExt = mapExtToInputField(fileExtension)

            let fileInputField = 'txtFile'

            if (fileInputFieldFromExt !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            } else if (fileInputFieldFromMimeType !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            }

            if (overrideConfig[fileInputField]) {
                const existingFileInputField = overrideConfig[fileInputField].replace('FILE-STORAGE::', '')
                const existingFileInputFieldArray = JSON.parse(existingFileInputField)

                const newFileInputField = storagePath.replace('FILE-STORAGE::', '')
                const newFileInputFieldArray = JSON.parse(newFileInputField)

                const updatedFieldArray = existingFileInputFieldArray.concat(newFileInputFieldArray)

                overrideConfig[fileInputField] = `FILE-STORAGE::${JSON.stringify(updatedFieldArray)}`
            } else {
                overrideConfig[fileInputField] = storagePath
            }

            await removeSpecificFileFromUpload(file.path ?? file.key)
        }
        if (overrideConfig.vars && typeof overrideConfig.vars === 'string') {
            overrideConfig.vars = JSON.parse(overrideConfig.vars)
        }
        incomingInput = {
            ...incomingInput,
            question: '',
            overrideConfig,
            stopNodeId,
            chatId
        }
    }

    /*** Prepare canvas flow data  ***/
    const flowData = canvasRecord.flowData
    const parsedFlowData: IReactFlowObject = JSON.parse(flowData)
    const nodes = parsedFlowData.nodes
    const edges = parsedFlowData.edges

    /*** Get session ID ***/
    const memoryNode = findMemoryNode(nodes, edges)
    let sessionId = getMemorySessionId(memoryNode, incomingInput, chatId, isInternal)

    /*** Find the 1 final vector store will be upserted  ***/
    const vsNodes = nodes.filter((node) => node.data.category === 'Vector Stores')
    const vsNodesWithFileUpload = vsNodes.filter((node) => node.data.inputs?.fileUpload)
    if (vsNodesWithFileUpload.length > 1) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Multiple vector store nodes with fileUpload enabled')
    } else if (vsNodesWithFileUpload.length === 1 && !stopNodeId) {
        stopNodeId = vsNodesWithFileUpload[0].data.id
    }

    /*** Check if multiple vector store nodes exist, and if stopNodeId is specified ***/
    if (vsNodes.length > 1 && !stopNodeId) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            'There are multiple vector nodes, please provide stopNodeId in body request'
        )
    } else if (vsNodes.length === 1 && !stopNodeId) {
        stopNodeId = vsNodes[0].data.id
    } else if (!vsNodes.length && !stopNodeId) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'No vector node found')
    }

    /*** Get Starting Nodes with Reversed Graph ***/
    const { graph } = constructGraphs(nodes, edges, { isReversed: true })
    const nodeIds = getAllConnectedNodes(graph, stopNodeId)
    const filteredGraph: INodeDirectedGraph = {}
    for (const key of nodeIds) {
        if (Object.prototype.hasOwnProperty.call(graph, key)) {
            filteredGraph[key] = graph[key]
        }
    }
    const { startingNodeIds, depthQueue } = getStartingNodes(filteredGraph, stopNodeId)

    /*** Get API Config ***/
    const availableVariables = await appDataSource.getRepository(Variable).find()
    const { nodeOverrides, variableOverrides, apiOverrideStatus } = getAPIOverrideConfig(canvasRecord)

    const upsertedResult = await buildFlow({
        startingNodeIds,
        reactFlowNodes: nodes,
        reactFlowEdges: edges,
        apiMessageId,
        graph: filteredGraph,
        depthQueue,
        componentNodes,
        question,
        chatHistory,
        chatId,
        sessionId,
        canvasId,
        appDataSource,
        overrideConfig,
        apiOverrideStatus,
        nodeOverrides,
        availableVariables,
        variableOverrides,
        cachePool,
        isUpsert,
        stopNodeId
    })

    // Save to DB
    if (upsertedResult['flowData'] && upsertedResult['result']) {
        const result = cloneDeep(upsertedResult)
        result['flowData'] = JSON.stringify(result['flowData'])
        result['result'] = JSON.stringify(omit(result['result'], ['totalKeys', 'addedDocs']))
        result.canvasId = canvasId
        const newUpsertHistory = new UpsertHistory()
        Object.assign(newUpsertHistory, result)
        const upsertHistory = appDataSource.getRepository(UpsertHistory).create(newUpsertHistory)
        await appDataSource.getRepository(UpsertHistory).save(upsertHistory)
    }

    await telemetry.sendTelemetry('vector_upserted', {
        canvasId,
        type: isInternal ? ChatType.INTERNAL : ChatType.EXTERNAL,
        flowGraph: getTelemetryFlowObj(nodes, edges),
        stopNodeId
    })

    return upsertedResult['result'] ?? { result: 'Successfully Upserted' }
}

/**
 * Upsert documents
 * @param {Request} req
 * @param {boolean} isInternal
 */
export const upsertVector = async (req: Request, isInternal: boolean = false) => {
    const appServer = getRunningExpressApp()
    try {
        const canvasId = req.params?.canvasId ?? req.params?.id

        if (!canvasId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Canvas identifier is required`)
        }

        if (!req.params.id) {
            ;(req.params as any).id = canvasId
        }

        // Check if canvas exists
        let canvasRecord
        try {
            canvasRecord = await canvasService.getCanvasById(canvasId)
        } catch (error: any) {
            if (typeof error?.status === 'number' && error.status === StatusCodes.NOT_FOUND) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found`)
            }
            throw error
        }

        const httpProtocol = req.get('x-forwarded-proto') || req.protocol
        const baseURL = `${httpProtocol}://${req.get('host')}`
        const incomingInput: IncomingInput = req.body
        const chatId = incomingInput.chatId ?? incomingInput.overrideConfig?.sessionId ?? uuid.generateUuidV7()
        const files = (req.files as Express.Multer.File[]) || []

        if (!isInternal) {
            const isKeyValidated = await validateCanvasApiKey(req, canvasRecord)
            if (!isKeyValidated) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
            }
        }

        const executeData: IExecuteFlowParams = {
            componentNodes: appServer.nodesPool.componentNodes,
            incomingInput,
            canvas: canvasRecord,
            chatId,
            appDataSource: appServer.AppDataSource,
            telemetry: appServer.telemetry,
            cachePool: appServer.cachePool,
            sseStreamer: appServer.sseStreamer,
            baseURL,
            isInternal,
            files,
            isUpsert: true
        }

        if (process.env.MODE === MODE.QUEUE) {
            const upsertQueue = appServer.queueManager.getQueue('upsert')

            const job = await upsertQueue.addJob(omit(executeData, OMIT_QUEUE_JOB_DATA))
            logger.debug(`[server]: Job added to queue: ${job.id}`)

            const queueEvents = upsertQueue.getQueueEvents()
            const result = await job.waitUntilFinished(queueEvents)

            if (!result) {
                throw new Error('Job execution failed')
            }

            appServer.metricsProvider?.incrementCounter(FLOWISE_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
                status: FLOWISE_COUNTER_STATUS.SUCCESS
            })
            return result
        } else {
            const result = await executeUpsert(executeData)

            appServer.metricsProvider?.incrementCounter(FLOWISE_METRIC_COUNTERS.VECTORSTORE_UPSERT, {
                status: FLOWISE_COUNTER_STATUS.SUCCESS
            })
            return result
        }
    } catch (e) {
        logger.error('[server]: Error:', e)
        appServer.metricsProvider?.incrementCounter(FLOWISE_METRIC_COUNTERS.VECTORSTORE_UPSERT, { status: FLOWISE_COUNTER_STATUS.FAILURE })

        if (e instanceof InternalFlowiseError && e.statusCode === StatusCodes.UNAUTHORIZED) {
            throw e
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, getErrorMessage(e))
        }
    }
}
