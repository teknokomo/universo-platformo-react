/**
 * ChatMessages Service with Dependency Injection
 */
import { StatusCodes } from 'http-status-codes'
import { DataSource, DeleteResult, FindOptionsWhere, In, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { IChatMessage, GetChatMessageParams } from '../Interface'

/**
 * Error class for ChatMessages service
 */
export class ChatMessagesServiceError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'ChatMessagesServiceError'
    }
}

/**
 * Logger interface
 */
export interface ILogger {
    error: (message: string, ...args: unknown[]) => void
    info: (message: string, ...args: unknown[]) => void
}

/**
 * Abort controller interface
 */
export interface IAbortController {
    abort: (id: string) => void
}

/**
 * Queue manager interface for abort events
 */
export interface IQueueManager {
    getPredictionQueueEventsProducer: () => {
        publishEvent: (event: { eventName: string; id: string }) => Promise<void>
    }
}

/**
 * Configuration for ChatMessages service
 */
export interface ChatMessagesServiceConfig {
    getDataSource: () => DataSource
    logger?: ILogger
    removeFilesFromStorage?: (...paths: string[]) => Promise<{ totalSize: number }>
    getAbortController?: () => IAbortController
    getQueueManager?: () => IQueueManager
    isQueueMode?: () => boolean
}

/**
 * ChatMessages service interface
 */
export interface IChatMessagesService {
    createChatMessage: (chatMessage: Partial<IChatMessage>) => Promise<ChatMessage>
    getChatMessages: (params: GetChatMessageParams) => Promise<ChatMessage[]>
    removeChatMessages: (chatId: string, canvasId: string, deleteOptions: FindOptionsWhere<ChatMessage>) => Promise<DeleteResult>
    removeChatMessagesByIds: (canvasId: string, chatIdMap: Map<string, ChatMessage[]>, messageIds: string[]) => Promise<DeleteResult>
    abortChatMessage: (chatId: string, canvasId: string) => Promise<void>
}

/**
 * Factory function to create ChatMessages service with DI
 */
export function createChatMessagesService(config: ChatMessagesServiceConfig): IChatMessagesService {
    const { getDataSource, logger, removeFilesFromStorage, getAbortController, getQueueManager, isQueueMode } = config

    const createChatMessage = async (chatMessage: Partial<IChatMessage>): Promise<ChatMessage> => {
        try {
            const dataSource = getDataSource()
            const newChatMessage = new ChatMessage()
            Object.assign(newChatMessage, chatMessage)

            if (!newChatMessage.createdDate) {
                newChatMessage.createdDate = new Date()
            }

            const entity = dataSource.getRepository(ChatMessage).create(newChatMessage)
            return await dataSource.getRepository(ChatMessage).save(entity)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ChatMessagesServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error creating chat message: ${message}`)
        }
    }

    const getChatMessages = async (params: GetChatMessageParams): Promise<ChatMessage[]> => {
        try {
            const dataSource = getDataSource()
            const {
                canvasId,
                chatTypes,
                sortOrder = 'ASC',
                chatId,
                memoryType,
                sessionId,
                startDate,
                endDate,
                messageId,
                feedback,
                feedbackTypes
            } = params

            if (feedback) {
                // Complex query with feedback join
                const query = dataSource
                    .getRepository(ChatMessage)
                    .createQueryBuilder('chat_message')
                    .leftJoinAndMapOne('chat_message.feedback', ChatMessageFeedback, 'feedback', 'feedback.messageId = chat_message.id')
                    .where('chat_message.canvas_id = :canvasId', { canvasId })

                if (chatTypes?.length) {
                    query.andWhere('chat_message.chatType IN (:...chatTypes)', { chatTypes })
                }
                if (chatId) {
                    query.andWhere('chat_message.chatId = :chatId', { chatId })
                }
                if (memoryType) {
                    query.andWhere('chat_message.memoryType = :memoryType', { memoryType })
                }
                if (sessionId) {
                    query.andWhere('chat_message.sessionId = :sessionId', { sessionId })
                }
                if (startDate) {
                    query.andWhere('chat_message.createdDate >= :startDate', { startDate: new Date(startDate) })
                }
                if (endDate) {
                    query.andWhere('chat_message.createdDate <= :endDate', { endDate: new Date(endDate) })
                }

                query.orderBy('chat_message.createdDate', sortOrder === 'DESC' ? 'DESC' : 'ASC')

                const messages = (await query.getMany()) as Array<ChatMessage & { feedback?: ChatMessageFeedback }>

                // Filter by feedback types if specified
                if (feedbackTypes?.length) {
                    const indicesToKeep = new Set<number>()
                    messages.forEach((message, index) => {
                        if (message.role === 'apiMessage' && message.feedback && feedbackTypes.includes(message.feedback.rating)) {
                            if (index > 0) indicesToKeep.add(index - 1)
                            indicesToKeep.add(index)
                        }
                    })
                    return messages.filter((_, index) => indicesToKeep.has(index))
                }

                return messages
            }

            // Simple query without feedback
            let createdDateQuery
            if (startDate || endDate) {
                if (startDate && endDate) {
                    createdDateQuery = Between(new Date(startDate), new Date(endDate))
                } else if (startDate) {
                    createdDateQuery = MoreThanOrEqual(new Date(startDate))
                } else if (endDate) {
                    createdDateQuery = LessThanOrEqual(new Date(endDate))
                }
            }

            return await dataSource.getRepository(ChatMessage).find({
                where: {
                    canvasId,
                    chatType: chatTypes?.length ? In(chatTypes) : undefined,
                    chatId: chatId ?? undefined,
                    memoryType: memoryType ?? undefined,
                    sessionId: sessionId ?? undefined,
                    createdDate: createdDateQuery,
                    id: messageId ?? undefined
                },
                order: {
                    createdDate: sortOrder === 'DESC' ? 'DESC' : 'ASC'
                }
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ChatMessagesServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting chat messages: ${message}`)
        }
    }

    const removeChatMessages = async (
        chatId: string,
        canvasId: string,
        deleteOptions: FindOptionsWhere<ChatMessage>
    ): Promise<DeleteResult> => {
        try {
            const dataSource = getDataSource()

            // Remove related feedback records
            await dataSource.getRepository(ChatMessageFeedback).delete({ chatId })

            // Remove files from storage if handler provided
            if (chatId && removeFilesFromStorage) {
                try {
                    await removeFilesFromStorage(canvasId, chatId)
                } catch (e) {
                    logger?.error(`Error deleting file storage for canvas ${canvasId}, chatId ${chatId}: ${e}`)
                }
            }

            return await dataSource.getRepository(ChatMessage).delete(deleteOptions)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ChatMessagesServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error removing chat messages: ${message}`)
        }
    }

    const removeChatMessagesByIds = async (
        canvasId: string,
        chatIdMap: Map<string, ChatMessage[]>,
        messageIds: string[]
    ): Promise<DeleteResult> => {
        try {
            const dataSource = getDataSource()

            for (const [compositeKey] of chatIdMap) {
                const [chatId] = compositeKey.split('_')

                // Remove related feedback records
                await dataSource.getRepository(ChatMessageFeedback).delete({ chatId })

                // Remove files from storage
                if (removeFilesFromStorage) {
                    try {
                        await removeFilesFromStorage(canvasId, chatId)
                    } catch (e) {
                        logger?.error(`Error deleting file storage for canvas ${canvasId}, chatId ${chatId}: ${e}`)
                    }
                }
            }

            return await dataSource.getRepository(ChatMessage).delete(messageIds)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ChatMessagesServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error removing chat messages by IDs: ${message}`)
        }
    }

    const abortChatMessage = async (chatId: string, canvasId: string): Promise<void> => {
        try {
            const id = `${canvasId}_${chatId}`

            if (isQueueMode?.()) {
                const queueManager = getQueueManager?.()
                await queueManager?.getPredictionQueueEventsProducer().publishEvent({
                    eventName: 'abort',
                    id
                })
            } else {
                getAbortController?.().abort(id)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ChatMessagesServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error aborting chat message: ${message}`)
        }
    }

    return {
        createChatMessage,
        getChatMessages,
        removeChatMessages,
        removeChatMessagesByIds,
        abortChatMessage
    }
}
