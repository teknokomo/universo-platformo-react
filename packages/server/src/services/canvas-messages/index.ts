import { removeFilesFromStorage } from 'flowise-components'
import { StatusCodes } from 'http-status-codes'
import { DeleteResult, FindOptionsWhere } from 'typeorm'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { ChatMessageRatingType, ChatType, IChatMessage, MODE } from '../../Interface'
import { utilAddChatMessage } from '../../utils/addChatMesage'
import { utilGetChatMessage } from '../../utils/getChatMessage'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'

// Add canvas messages for a canvas
const createChatMessage = async (chatMessage: Partial<IChatMessage>) => {
    try {
        const dbResponse = await utilAddChatMessage(chatMessage)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.createChatMessage - ${getErrorMessage(error)}`
        )
    }
}

// Get all canvas messages for a canvas
const getAllChatMessages = async (
    canvasId: string,
    chatTypes: ChatType[] | undefined,
    sortOrder: string = 'ASC',
    chatId?: string,
    memoryType?: string,
    sessionId?: string,
    startDate?: string,
    endDate?: string,
    messageId?: string,
    feedback?: boolean,
    feedbackTypes?: ChatMessageRatingType[]
): Promise<ChatMessage[]> => {
    try {
        const dbResponse = await utilGetChatMessage({
            canvasId,
            chatTypes,
            sortOrder,
            chatId,
            memoryType,
            sessionId,
            startDate,
            endDate,
            messageId,
            feedback,
            feedbackTypes
        })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.getAllChatMessages - ${getErrorMessage(error)}`
        )
    }
}

// Get internal canvas messages for a canvas
const getAllInternalChatMessages = async (
    canvasId: string,
    chatTypes: ChatType[] | undefined,
    sortOrder: string = 'ASC',
    chatId?: string,
    memoryType?: string,
    sessionId?: string,
    startDate?: string,
    endDate?: string,
    messageId?: string,
    feedback?: boolean,
    feedbackTypes?: ChatMessageRatingType[]
): Promise<ChatMessage[]> => {
    try {
        const dbResponse = await utilGetChatMessage({
            canvasId,
            chatTypes,
            sortOrder,
            chatId,
            memoryType,
            sessionId,
            startDate,
            endDate,
            messageId,
            feedback,
            feedbackTypes
        })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.getAllInternalChatMessages - ${getErrorMessage(error)}`
        )
    }
}

const removeAllChatMessages = async (
    chatId: string,
    canvasId: string,
    deleteOptions: FindOptionsWhere<ChatMessage>
): Promise<DeleteResult> => {
    try {
        const appServer = getRunningExpressApp()

        // Remove all related feedback records
        const feedbackDeleteOptions: FindOptionsWhere<ChatMessageFeedback> = { chatId }
        await appServer.AppDataSource.getRepository(ChatMessageFeedback).delete(feedbackDeleteOptions)

        // Delete all uploads corresponding to this canvas/chatId
        if (chatId) {
            try {
                await removeFilesFromStorage(canvasId, chatId)
            } catch (e) {
                logger.error(`[server]: Error deleting file storage for canvas ${canvasId}, chatId ${chatId}: ${e}`)
            }
        }
        const dbResponse = await appServer.AppDataSource.getRepository(ChatMessage).delete(deleteOptions)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.removeAllChatMessages - ${getErrorMessage(error)}`
        )
    }
}

const removeChatMessagesByMessageIds = async (
    canvasId: string,
    chatIdMap: Map<string, ChatMessage[]>,
    messageIds: string[]
): Promise<DeleteResult> => {
    try {
        const appServer = getRunningExpressApp()

        for (const [composite_key] of chatIdMap) {
            const [chatId] = composite_key.split('_')

            // Remove all related feedback records
            const feedbackDeleteOptions: FindOptionsWhere<ChatMessageFeedback> = { chatId }
            await appServer.AppDataSource.getRepository(ChatMessageFeedback).delete(feedbackDeleteOptions)

            // Delete all uploads corresponding to this canvas/chatId
            await removeFilesFromStorage(canvasId, chatId)
        }

        const dbResponse = await appServer.AppDataSource.getRepository(ChatMessage).delete(messageIds)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.removeChatMessagesByMessageIds - ${getErrorMessage(error)}`
        )
    }
}

const abortChatMessage = async (chatId: string, canvasId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const id = `${canvasId}_${chatId}`

        if (process.env.MODE === MODE.QUEUE) {
            await appServer.queueManager.getPredictionQueueEventsProducer().publishEvent({
                eventName: 'abort',
                id
            })
        } else {
            appServer.abortControllerPool.abort(id)
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: canvasMessagesService.abortChatMessage - ${getErrorMessage(error)}`
        )
    }
}

async function getAllMessages(): Promise<ChatMessage[]> {
    const appServer = getRunningExpressApp()
    return await appServer.AppDataSource.getRepository(ChatMessage).find()
}

async function getAllMessagesFeedback(): Promise<ChatMessageFeedback[]> {
    const appServer = getRunningExpressApp()
    return await appServer.AppDataSource.getRepository(ChatMessageFeedback).find()
}

export default {
    createChatMessage,
    getAllChatMessages,
    getAllInternalChatMessages,
    removeAllChatMessages,
    removeChatMessagesByMessageIds,
    abortChatMessage,
    getAllMessages,
    getAllMessagesFeedback
}
