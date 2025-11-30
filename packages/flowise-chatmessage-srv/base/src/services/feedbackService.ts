/**
 * Feedback Service with Dependency Injection
 */
import { StatusCodes } from 'http-status-codes'
import { DataSource, Between } from 'typeorm'
import { z } from 'zod'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { IChatMessageFeedback, ChatMessageRatingType } from '../Interface'

/**
 * Error class for Feedback service
 */
export class FeedbackServiceError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'FeedbackServiceError'
    }
}

/**
 * Zod schema for feedback creation
 */
export const createFeedbackSchema = z.object({
    messageId: z.string().min(1, 'messageId is required'),
    rating: z.enum(['THUMBS_UP', 'THUMBS_DOWN']),
    content: z.string().optional(),
    chatId: z.string().optional(),
    canvasId: z.string().optional()
})

/**
 * Zod schema for feedback update
 */
export const updateFeedbackSchema = z.object({
    rating: z.enum(['THUMBS_UP', 'THUMBS_DOWN']).optional(),
    content: z.string().optional()
})

/**
 * Canvas service interface for analytics
 */
export interface ICanvasService {
    getCanvasById: (id: string) => Promise<{ analytic?: string } | null>
}

/**
 * Lunary integration interface
 */
export interface ILunaryClient {
    trackFeedback: (messageId: string, data: { comment?: string; thumb: 'up' | 'down' }) => void
}

/**
 * Configuration for Feedback service
 */
export interface FeedbackServiceConfig {
    getDataSource: () => DataSource
    canvasService?: ICanvasService
    lunaryClient?: ILunaryClient
}

/**
 * Feedback service interface
 */
export interface IFeedbackService {
    getAllFeedback: (
        canvasId: string,
        chatId?: string,
        sortOrder?: string,
        startDate?: string,
        endDate?: string
    ) => Promise<ChatMessageFeedback[]>
    createFeedback: (body: Partial<IChatMessageFeedback>) => Promise<ChatMessageFeedback>
    updateFeedback: (id: string, body: Partial<IChatMessageFeedback>) => Promise<{ status: string }>
}

/**
 * Factory function to create Feedback service with DI
 */
export function createFeedbackService(config: FeedbackServiceConfig): IFeedbackService {
    const { getDataSource, canvasService, lunaryClient } = config

    const validateMessageExists = async (messageId: string): Promise<ChatMessage> => {
        const dataSource = getDataSource()
        const message = await dataSource.getRepository(ChatMessage).findOne({
            where: { id: messageId }
        })

        if (!message) {
            throw new FeedbackServiceError(StatusCodes.NOT_FOUND, `Message with ID ${messageId} not found`)
        }

        return message
    }

    const getAllFeedback = async (
        canvasId: string,
        chatId?: string,
        sortOrder: string = 'ASC',
        startDate?: string,
        endDate?: string
    ): Promise<ChatMessageFeedback[]> => {
        try {
            const dataSource = getDataSource()
            const fromDate = startDate ? new Date(startDate) : undefined
            const toDate = endDate ? new Date(endDate) : undefined

            return await dataSource.getRepository(ChatMessageFeedback).find({
                where: {
                    canvasId,
                    chatId: chatId ?? undefined,
                    createdDate: toDate && fromDate ? Between(fromDate, toDate) : undefined
                },
                order: {
                    createdDate: sortOrder === 'DESC' ? 'DESC' : 'ASC'
                }
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new FeedbackServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error getting feedback: ${message}`)
        }
    }

    const createFeedback = async (body: Partial<IChatMessageFeedback>): Promise<ChatMessageFeedback> => {
        try {
            const validated = createFeedbackSchema.parse(body)
            const dataSource = getDataSource()

            // Validate message exists and get its data
            const message = await validateMessageExists(validated.messageId)

            // Create feedback with validated data
            const feedback = new ChatMessageFeedback()
            feedback.messageId = validated.messageId
            feedback.rating = validated.rating as ChatMessageRatingType
            feedback.content = validated.content
            feedback.chatId = validated.chatId ?? message.chatId
            feedback.canvasId = validated.canvasId ?? message.canvasId

            const entity = dataSource.getRepository(ChatMessageFeedback).create(feedback)
            return await dataSource.getRepository(ChatMessageFeedback).save(entity)
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new FeedbackServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            if (error instanceof FeedbackServiceError) throw error

            const message = error instanceof Error ? error.message : String(error)
            throw new FeedbackServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error creating feedback: ${message}`)
        }
    }

    const updateFeedback = async (id: string, body: Partial<IChatMessageFeedback>): Promise<{ status: string }> => {
        try {
            const validated = updateFeedbackSchema.parse(body)
            const dataSource = getDataSource()

            // Verify feedback exists
            const existing = await dataSource.getRepository(ChatMessageFeedback).findOne({
                where: { id }
            })
            if (!existing) {
                throw new FeedbackServiceError(StatusCodes.NOT_FOUND, `Feedback with ID ${id} not found`)
            }

            // Build update object with proper types
            const updateData: Partial<ChatMessageFeedback> = {}
            if (validated.rating) {
                updateData.rating = validated.rating as ChatMessageRatingType
            }
            if (validated.content !== undefined) {
                updateData.content = validated.content
            }

            // Update feedback
            await dataSource.getRepository(ChatMessageFeedback).update({ id }, updateData)

            // Get updated feedback for Lunary tracking
            const updated = await dataSource.getRepository(ChatMessageFeedback).findOne({ where: { id } })

            // Track in Lunary if configured
            if (updated?.canvasId && canvasService && lunaryClient) {
                try {
                    const canvas = await canvasService.getCanvasById(updated.canvasId)
                    const analytic = JSON.parse(canvas?.analytic ?? '{}')

                    if (analytic?.lunary?.status === true && updated.rating) {
                        lunaryClient.trackFeedback(updated.messageId, {
                            comment: updated.content,
                            thumb: updated.rating === 'THUMBS_UP' ? 'up' : 'down'
                        })
                    }
                } catch {
                    // Ignore Lunary errors
                }
            }

            return { status: 'OK' }
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new FeedbackServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            if (error instanceof FeedbackServiceError) throw error

            const message = error instanceof Error ? error.message : String(error)
            throw new FeedbackServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error updating feedback: ${message}`)
        }
    }

    return { getAllFeedback, createFeedback, updateFeedback }
}
