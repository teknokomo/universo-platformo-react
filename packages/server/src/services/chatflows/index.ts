import { removeFolderFromStorage } from 'flowise-components'
import { ChatflowType, ICanvasFlow, withCanvasAlias, withCanvasAliases } from '../../Interface'
import { FLOWISE_COUNTER_STATUS, FLOWISE_METRIC_COUNTERS } from '../../Interface.Metrics'
import { LegacyChatflowsService } from '@universo/spaces-srv'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
import { ChatFlow } from '../../database/entities/ChatFlow'
import type { Canvas } from '@universo/spaces-srv'
import documentStoreService from '../../services/documentstore'
import { constructGraphs, getAppVersion, getEndingNodes, getTelemetryFlowObj, isFlowValidForStream } from '../../utils'
import { containsBase64File, updateFlowDataWithFilePaths } from '../../utils/fileRepository'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { utilGetUploadsConfig } from '../../utils/getUploadsConfig'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import logger from '../../utils/logger'

const legacyService = new LegacyChatflowsService(
    () => getRunningExpressApp().AppDataSource,
    {
        chatMessage: ChatMessage,
        chatMessageFeedback: ChatMessageFeedback,
        upsertHistory: UpsertHistory
    },
    {
        errorFactory: (status, message) => new InternalFlowiseError(status, message),
        removeFolderFromStorage,
        updateDocumentStoreUsage: (chatflowId, usage) => documentStoreService.updateDocumentStoreUsage(chatflowId, usage),
        containsBase64File: ({ flowData }) => containsBase64File({ flowData } as ChatFlow),
        updateFlowDataWithFilePaths,
        constructGraphs,
        getEndingNodes,
        isFlowValidForStream,
        getAppVersion,
        getTelemetryFlowObj,
        telemetry: {
            sendTelemetry: async (eventName, payload) => {
                const telemetry = getRunningExpressApp().telemetry
                if (telemetry) {
                    await telemetry.sendTelemetry(eventName, payload)
                }
            }
        },
        metricsProvider: {
            incrementCounter: (metric, labels) => {
                const metrics = getRunningExpressApp().metricsProvider
                metrics?.incrementCounter(metric as FLOWISE_METRIC_COUNTERS, labels)
            }
        },
        metricsConfig: {
            chatflowCreatedCounter: FLOWISE_METRIC_COUNTERS.CHATFLOW_CREATED,
            agentflowCreatedCounter: FLOWISE_METRIC_COUNTERS.AGENTFLOW_CREATED,
            successStatusLabel: FLOWISE_COUNTER_STATUS.SUCCESS
        },
        logger,
        getUploadsConfig: utilGetUploadsConfig
    }
)

const checkIfChatflowIsValidForStreaming = async (chatflowId: string) => {
    return legacyService.checkIfChatflowIsValidForStreaming(chatflowId)
}

const checkIfChatflowIsValidForUploads = async (chatflowId: string) => {
    return legacyService.checkIfChatflowIsValidForUploads(chatflowId)
}

const deleteChatflow = async (chatflowId: string, unikId?: string) => {
    return legacyService.deleteChatflow(chatflowId, unikId)
}

const getAllChatflows = async (type?: ChatflowType, unikId?: string): Promise<ICanvasFlow[]> => {
    const results = await legacyService.getAllChatflows(type, unikId)
    return withCanvasAliases(results as unknown as ChatFlow[])
}

const getChatflowByApiKey = async (apiKeyId: string, keyonly?: string): Promise<ICanvasFlow[]> => {
    const results = await legacyService.getChatflowByApiKey(apiKeyId, keyonly)
    return withCanvasAliases(results as unknown as ChatFlow[])
}

const getChatflowById = async (chatflowId: string, unikId?: string): Promise<ICanvasFlow> => {
    const chatflow = await legacyService.getChatflowById(chatflowId, unikId)
    return withCanvasAlias(chatflow as unknown as ChatFlow)
}

const saveChatflow = async (newChatFlow: ChatFlow): Promise<ICanvasFlow> => {
    const saved = await legacyService.saveChatflow(newChatFlow as unknown as Partial<Canvas>)
    return withCanvasAlias(saved as unknown as ChatFlow)
}

const importChatflows = async (newChatflows: Partial<ChatFlow>[], queryRunner?: any) => {
    return legacyService.importChatflows(newChatflows as Partial<Canvas>[], queryRunner)
}

const updateChatflow = async (chatflow: ChatFlow, updateChatFlow: ChatFlow, unikId?: string): Promise<ICanvasFlow> => {
    const updated = await legacyService.updateChatflow(
        chatflow as unknown as Canvas,
        updateChatFlow as unknown as Canvas,
        unikId
    )
    return withCanvasAlias(updated as unknown as ChatFlow)
}

const getSinglePublicChatflow = async (chatflowId: string): Promise<ICanvasFlow & { unikId?: string }> => {
    const chatflow = await legacyService.getSinglePublicChatflow(chatflowId)
    return withCanvasAlias({
        ...chatflow,
        id: chatflow.id
    } as unknown as ChatFlow) as ICanvasFlow & { unikId?: string }
}

const getSinglePublicBotConfig = async (chatflowId: string): Promise<any> => {
    try {
        logger.info(`Getting unified Bot config for chatflow: ${chatflowId}`)

        const botServiceFactory = require('../../services/bots').default
        const botService = await botServiceFactory.getServiceByChatflowId(chatflowId)
        return await botService.getBotConfig(chatflowId)
    } catch (error) {
        logger.error(`Error getting unified bot config: ${getErrorMessage(error)}`)
        return { error: getErrorMessage(error) }
    }
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    importChatflows,
    updateChatflow,
    getSinglePublicChatflow,
    getSinglePublicBotConfig
}
