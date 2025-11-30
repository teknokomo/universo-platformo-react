/**
 * Utility functions for ChatMessage operations.
 * These provide backward-compatible wrappers for use in buildCanvasFlow.ts
 * and other legacy code that uses functional approach instead of DI services.
 */
import { DataSource } from 'typeorm'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { IChatMessage, IChatMessageFeedback, ChatType, ChatMessageRatingType } from '../Interface'

/**
 * Parameters for getChatMessage utility
 */
export interface GetChatMessageParams {
    canvasId: string
    chatTypes?: ChatType[]
    sortOrder?: string
    chatId?: string
    memoryType?: string
    sessionId?: string
    startDate?: string
    endDate?: string
    messageId?: string
    feedback?: boolean
    feedbackTypes?: ChatMessageRatingType[]
}

/**
 * Add a chat message to the database.
 * Backward-compatible utility function for use in buildCanvasFlow.ts
 *
 * @param chatMessage - Partial chat message data
 * @param appDataSource - TypeORM DataSource instance
 * @returns Created ChatMessage entity
 */
export const utilAddChatMessage = async (chatMessage: Partial<IChatMessage>, appDataSource: DataSource): Promise<ChatMessage> => {
    const newChatMessage = new ChatMessage()
    Object.assign(newChatMessage, chatMessage)

    if (!newChatMessage.createdDate) {
        newChatMessage.createdDate = new Date()
    }

    const entity = appDataSource.getRepository(ChatMessage).create(newChatMessage)
    return await appDataSource.getRepository(ChatMessage).save(entity)
}

/**
 * Get chat messages from the database with optional filters.
 * Backward-compatible utility function.
 *
 * @param params - Query parameters
 * @param appDataSource - TypeORM DataSource instance
 * @param aMonthAgo - Function that returns date one month ago (for default startDate)
 * @returns Array of ChatMessage entities
 */
export const utilGetChatMessage = async (
    params: GetChatMessageParams,
    appDataSource: DataSource,
    aMonthAgo?: () => Date
): Promise<ChatMessage[]> => {
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
        const query = appDataSource
            .getRepository(ChatMessage)
            .createQueryBuilder('chat_message')
            .leftJoinAndMapOne('chat_message.feedback', ChatMessageFeedback, 'feedback', 'feedback.messageId = chat_message.id')
            .where('chat_message.canvas_id = :canvasId', { canvasId })

        if (chatTypes && chatTypes.length > 0) {
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
            const startDateTime = new Date(startDate)
            query.andWhere('chat_message.createdDate >= :startDateTime', { startDateTime })
        } else if (aMonthAgo) {
            query.andWhere('chat_message.createdDate >= :startDateTime', { startDateTime: aMonthAgo() })
        }
        if (endDate) {
            const endDateTime = new Date(endDate)
            query.andWhere('chat_message.createdDate <= :endDateTime', { endDateTime })
        }

        query.orderBy('chat_message.createdDate', sortOrder === 'DESC' ? 'DESC' : 'ASC')

        const messages = (await query.getMany()) as Array<ChatMessage & { feedback?: ChatMessageFeedback }>

        if (feedbackTypes && feedbackTypes.length > 0) {
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

    // Simple query without feedback - use find with conditions
    const where: Record<string, string | undefined> = { canvasId }

    if (chatTypes && chatTypes.length > 0) {
        // Use raw query for IN clause
        const query = appDataSource
            .getRepository(ChatMessage)
            .createQueryBuilder('chat_message')
            .where('chat_message.canvas_id = :canvasId', { canvasId })
            .andWhere('chat_message.chatType IN (:...chatTypes)', { chatTypes })

        if (chatId) query.andWhere('chat_message.chatId = :chatId', { chatId })
        if (memoryType) query.andWhere('chat_message.memoryType = :memoryType', { memoryType })
        if (sessionId) query.andWhere('chat_message.sessionId = :sessionId', { sessionId })
        if (messageId) query.andWhere('chat_message.id = :messageId', { messageId })
        if (startDate) query.andWhere('chat_message.createdDate >= :startDate', { startDate: new Date(startDate) })
        if (endDate) query.andWhere('chat_message.createdDate <= :endDate', { endDate: new Date(endDate) })

        query.orderBy('chat_message.createdDate', sortOrder === 'DESC' ? 'DESC' : 'ASC')

        return await query.getMany()
    }

    // Simple find for basic queries
    if (chatId) where.chatId = chatId
    if (memoryType) where.memoryType = memoryType
    if (sessionId) where.sessionId = sessionId
    if (messageId) where.id = messageId

    return await appDataSource.getRepository(ChatMessage).find({
        where,
        order: { createdDate: sortOrder === 'DESC' ? 'DESC' : 'ASC' }
    })
}

/**
 * Add chat message feedback to the database.
 *
 * @param feedback - Partial feedback data
 * @param appDataSource - TypeORM DataSource instance
 * @returns Created ChatMessageFeedback entity
 */
export const utilAddChatMessageFeedback = async (
    feedback: Partial<IChatMessageFeedback>,
    appDataSource: DataSource
): Promise<ChatMessageFeedback> => {
    const newFeedback = new ChatMessageFeedback()
    Object.assign(newFeedback, feedback)

    if (!newFeedback.createdDate) {
        newFeedback.createdDate = new Date()
    }

    const entity = appDataSource.getRepository(ChatMessageFeedback).create(newFeedback)
    return await appDataSource.getRepository(ChatMessageFeedback).save(entity)
}

/**
 * Get chat message feedback from the database.
 *
 * @param messageId - Message ID to get feedback for
 * @param appDataSource - TypeORM DataSource instance
 * @returns ChatMessageFeedback entity or null
 */
export const utilGetChatMessageFeedback = async (messageId: string, appDataSource: DataSource): Promise<ChatMessageFeedback | null> => {
    return await appDataSource.getRepository(ChatMessageFeedback).findOne({
        where: { messageId }
    })
}

/**
 * Update chat message feedback in the database.
 *
 * @param id - Feedback ID
 * @param feedback - Partial feedback data to update
 * @param appDataSource - TypeORM DataSource instance
 * @returns Updated ChatMessageFeedback entity
 */
export const utilUpdateChatMessageFeedback = async (
    id: string,
    feedback: Partial<IChatMessageFeedback>,
    appDataSource: DataSource
): Promise<ChatMessageFeedback | null> => {
    const existingFeedback = await appDataSource.getRepository(ChatMessageFeedback).findOne({
        where: { id }
    })

    if (!existingFeedback) {
        return null
    }

    const merged = appDataSource.getRepository(ChatMessageFeedback).merge(existingFeedback, feedback)
    return await appDataSource.getRepository(ChatMessageFeedback).save(merged)
}
