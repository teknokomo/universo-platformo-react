import { StatusCodes } from 'http-status-codes'
import { IChatMessageFeedback } from '../../Interface'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'

/**
 * Validates that the message ID exists
 * @param {string} messageId
 */
export const validateMessageExists = async (messageId: string): Promise<ChatMessage> => {
    const appServer = getRunningExpressApp()
    const message = await appServer.AppDataSource.getRepository(ChatMessage).findOne({
        where: { id: messageId }
    })

    if (!message) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Message with ID ${messageId} not found`)
    }

    return message
}

/**
 * Validates that the feedback ID exists
 * @param {string} feedbackId
 */
export const validateFeedbackExists = async (feedbackId: string): Promise<ChatMessageFeedback> => {
    const appServer = getRunningExpressApp()
    const feedbackExists = await appServer.AppDataSource.getRepository(ChatMessageFeedback).findOne({
        where: { id: feedbackId }
    })

    if (!feedbackExists) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Feedback with ID ${feedbackId} not found`)
    }

    return feedbackExists
}

/**
 * Validates a feedback object for creation
 * @param {Partial<IChatMessageFeedback>} feedback
 */
export const validateFeedbackForCreation = async (feedback: Partial<IChatMessageFeedback>): Promise<Partial<IChatMessageFeedback>> => {
    // If messageId is provided, validate it exists and get the message
    let message: ChatMessage | null = null
    if (feedback.messageId) {
        message = await validateMessageExists(feedback.messageId)
    } else {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Message ID is required')
    }

    // If chatId is provided, validate it matches the message's chatId
    if (feedback.chatId) {
        if (message.chatId !== feedback.chatId) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chat ID: message with ID ${message.id} does not belong to chat with ID ${feedback.chatId}`
            )
        }
    } else {
        // If not provided, use the message's chatId
        feedback.chatId = message.chatId
    }

    // If canvasId is provided, validate it matches the message's canvasId
    if (feedback.canvasId) {
        if (message.canvasId !== feedback.canvasId) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent canvas ID: message with ID ${message.id} does not belong to canvas with ID ${feedback.canvasId}`
            )
        }
    } else {
        // If not provided, use the message's canvasId
        feedback.canvasId = message.canvasId
    }

    return feedback
}

/**
 * Validates a feedback object for update
 * @param {string} feedbackId
 * @param {Partial<IChatMessageFeedback>} feedback
 */
export const validateFeedbackForUpdate = async (
    feedbackId: string,
    feedback: Partial<IChatMessageFeedback>
): Promise<Partial<IChatMessageFeedback>> => {
    // First validate the feedback exists
    const existingFeedback = await validateFeedbackExists(feedbackId)

    feedback.messageId = feedback.messageId ?? existingFeedback.messageId
    feedback.chatId = feedback.chatId ?? existingFeedback.chatId
    feedback.canvasId = feedback.canvasId ?? existingFeedback.canvasId

    // If messageId is provided, validate it exists and get the message
    let message: ChatMessage | null = null
    if (feedback.messageId) {
        message = await validateMessageExists(feedback.messageId)
    }

    // If chatId is provided and we have a message, validate it matches the message's chatId
    if (feedback.chatId) {
        if (message?.chatId !== feedback.chatId) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent chat ID: message with ID ${message?.id} does not belong to chat with ID ${feedback.chatId}`
            )
        }
    }

    // If canvasId is provided and we have a message, validate it matches the message's canvasId
    if (feedback.canvasId && message) {
        if (message?.canvasId !== feedback.canvasId) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                `Inconsistent canvas ID: message with ID ${message?.id} does not belong to canvas with ID ${feedback.canvasId}`
            )
        }
    }

    return feedback
}
