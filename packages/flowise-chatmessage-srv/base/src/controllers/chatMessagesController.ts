/**
 * Chat Messages Controller with Dependency Injection
 */
import { Request, Response, NextFunction } from 'express'
import { DeleteResult, FindOptionsWhere, Between, In } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { IChatMessagesService } from '../services/chatMessagesService'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ChatMessageRatingType, ChatType, IReactFlowObject } from '../Interface'

/**
 * Error class for controller operations
 */
export class ChatMessagesControllerError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'ChatMessagesControllerError'
    }
}

/**
 * Canvas service interface (for getting canvas data)
 */
export interface ICanvasService {
    getCanvasById: (id: string) => Promise<{ id: string; flowData: string } | null>
}

/**
 * Nodes pool interface
 */
export interface INodesPool {
    componentNodes: Record<string, unknown>
}

/**
 * App server interface for accessing app-level resources
 */
export interface IAppServer {
    nodesPool: INodesPool
}

/**
 * Function to get chat messages with filters
 */
export interface IUtilGetChatMessage {
    (params: {
        canvasId: string
        chatTypes?: ChatType[]
        sessionId?: string
        startDate?: string
        endDate?: string
        feedback?: boolean
        feedbackTypes?: ChatMessageRatingType[]
    }): Promise<ChatMessage[]>
}

/**
 * Configuration for Chat Messages controller
 */
export interface ChatMessagesControllerConfig {
    chatMessagesService: IChatMessagesService
    canvasService: ICanvasService
    getAppServer: () => IAppServer
    utilGetChatMessage: IUtilGetChatMessage
    aMonthAgo: () => Date
}

/**
 * Chat Messages controller interface
 */
export interface IChatMessagesController {
    createChatMessage: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    getAllChatMessages: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    getAllInternalChatMessages: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    removeAllChatMessages: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
    abortChatMessage: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
}

/**
 * Parse chat message response to convert JSON strings to objects
 */
const parseAPIResponse = (apiResponse: ChatMessage | ChatMessage[]): ChatMessage | ChatMessage[] => {
    const parseResponse = (response: ChatMessage): ChatMessage => {
        const parsedResponse = { ...response }

        if (parsedResponse.sourceDocuments) {
            parsedResponse.sourceDocuments = JSON.parse(parsedResponse.sourceDocuments)
        }
        if (parsedResponse.usedTools) {
            parsedResponse.usedTools = JSON.parse(parsedResponse.usedTools)
        }
        if (parsedResponse.fileAnnotations) {
            parsedResponse.fileAnnotations = JSON.parse(parsedResponse.fileAnnotations)
        }
        if (parsedResponse.agentReasoning) {
            parsedResponse.agentReasoning = JSON.parse(parsedResponse.agentReasoning)
        }
        if (parsedResponse.fileUploads) {
            parsedResponse.fileUploads = JSON.parse(parsedResponse.fileUploads)
        }
        if (parsedResponse.action) {
            parsedResponse.action = JSON.parse(parsedResponse.action)
        }
        if (parsedResponse.artifacts) {
            parsedResponse.artifacts = JSON.parse(parsedResponse.artifacts)
        }

        return parsedResponse
    }

    if (Array.isArray(apiResponse)) {
        return apiResponse.map(parseResponse)
    } else {
        return parseResponse(apiResponse)
    }
}

/**
 * Get feedback type filters from query parameter
 */
const getFeedbackTypeFilters = (_feedbackTypeFilters: ChatMessageRatingType[]): ChatMessageRatingType[] | undefined => {
    try {
        let feedbackTypeFilters
        const feedbackTypeFilterArray = JSON.parse(JSON.stringify(_feedbackTypeFilters))
        if (
            feedbackTypeFilterArray.includes(ChatMessageRatingType.THUMBS_UP) &&
            feedbackTypeFilterArray.includes(ChatMessageRatingType.THUMBS_DOWN)
        ) {
            feedbackTypeFilters = [ChatMessageRatingType.THUMBS_UP, ChatMessageRatingType.THUMBS_DOWN]
        } else if (feedbackTypeFilterArray.includes(ChatMessageRatingType.THUMBS_UP)) {
            feedbackTypeFilters = [ChatMessageRatingType.THUMBS_UP]
        } else if (feedbackTypeFilterArray.includes(ChatMessageRatingType.THUMBS_DOWN)) {
            feedbackTypeFilters = [ChatMessageRatingType.THUMBS_DOWN]
        } else {
            feedbackTypeFilters = undefined
        }
        return feedbackTypeFilters
    } catch (e) {
        return _feedbackTypeFilters
    }
}

/**
 * Factory function to create Chat Messages controller with DI
 */
export function createChatMessagesController(config: ChatMessagesControllerConfig): IChatMessagesController {
    const { chatMessagesService, canvasService, getAppServer, utilGetChatMessage, aMonthAgo } = config

    const createChatMessage = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            if (!req.body) {
                throw new ChatMessagesControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: createChatMessage - request body not provided!'
                )
            }
            const apiResponse = await chatMessagesService.createChatMessage(req.body)
            return res.json(parseAPIResponse(apiResponse))
        } catch (error) {
            next(error)
        }
    }

    const getAllChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            const _chatTypes = req.query?.chatType as string | undefined
            let chatTypes: ChatType[] | undefined
            if (_chatTypes) {
                try {
                    if (Array.isArray(_chatTypes)) {
                        chatTypes = _chatTypes
                    } else {
                        chatTypes = JSON.parse(_chatTypes)
                    }
                } catch (e) {
                    chatTypes = [_chatTypes as ChatType]
                }
            }
            const sortOrder = req.query?.order as string | undefined
            const chatId = req.query?.chatId as string | undefined
            const memoryType = req.query?.memoryType as string | undefined
            const sessionId = req.query?.sessionId as string | undefined
            const messageId = req.query?.messageId as string | undefined
            const startDate = req.query?.startDate as string | undefined
            const endDate = req.query?.endDate as string | undefined
            const feedback = req.query?.feedback as boolean | undefined
            let feedbackTypeFilters = req.query?.feedbackType as ChatMessageRatingType[] | undefined
            if (feedbackTypeFilters) {
                feedbackTypeFilters = getFeedbackTypeFilters(feedbackTypeFilters)
            }
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new ChatMessagesControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: getAllChatMessages - id not provided!')
            }
            const apiResponse = await chatMessagesService.getChatMessages({
                canvasId: req.params.id,
                chatTypes,
                sortOrder,
                chatId,
                memoryType,
                sessionId,
                startDate,
                endDate,
                messageId,
                feedback,
                feedbackTypes: feedbackTypeFilters
            })

            return res.json(parseAPIResponse(apiResponse))
        } catch (error) {
            next(error)
        }
    }

    const getAllInternalChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            const sortOrder = req.query?.order as string | undefined
            const chatId = req.query?.chatId as string | undefined
            const memoryType = req.query?.memoryType as string | undefined
            const sessionId = req.query?.sessionId as string | undefined
            const messageId = req.query?.messageId as string | undefined
            const startDate = req.query?.startDate as string | undefined
            const endDate = req.query?.endDate as string | undefined
            const feedback = req.query?.feedback as boolean | undefined
            let feedbackTypeFilters = req.query?.feedbackType as ChatMessageRatingType[] | undefined
            if (feedbackTypeFilters) {
                feedbackTypeFilters = getFeedbackTypeFilters(feedbackTypeFilters)
            }
            const apiResponse = await chatMessagesService.getChatMessages({
                canvasId: req.params.id,
                chatTypes: [ChatType.INTERNAL],
                sortOrder,
                chatId,
                memoryType,
                sessionId,
                startDate,
                endDate,
                messageId,
                feedback,
                feedbackTypes: feedbackTypeFilters
            })
            return res.json(parseAPIResponse(apiResponse))
        } catch (error) {
            next(error)
        }
    }

    const removeAllChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            const _appServer = getAppServer()
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new ChatMessagesControllerError(StatusCodes.PRECONDITION_FAILED, 'Error: removeAllChatMessages - id not provided!')
            }
            const canvasId = req.params.id
            const canvas = await canvasService.getCanvasById(req.params.id)
            if (!canvas) {
                return res.status(404).send(`Canvas ${req.params.id} not found`)
            }
            const flowData = canvas.flowData
            const parsedFlowData: IReactFlowObject = JSON.parse(flowData)
            const _nodes = parsedFlowData.nodes
            const chatId = req.query?.chatId as string
            const memoryType = req.query?.memoryType as string | undefined
            const sessionId = req.query?.sessionId as string | undefined
            const _chatTypes = req.query?.chatType as string | undefined
            let chatTypes: ChatType[] | undefined
            if (_chatTypes) {
                try {
                    if (Array.isArray(_chatTypes)) {
                        chatTypes = _chatTypes
                    } else {
                        chatTypes = JSON.parse(_chatTypes)
                    }
                } catch (e) {
                    chatTypes = [_chatTypes as ChatType]
                }
            }
            const startDate = req.query?.startDate as string | undefined
            const endDate = req.query?.endDate as string | undefined
            const _isClearFromViewMessageDialog = req.query?.isClearFromViewMessageDialog as string | undefined
            let feedbackTypeFilters = req.query?.feedbackType as ChatMessageRatingType[] | undefined
            if (feedbackTypeFilters) {
                feedbackTypeFilters = getFeedbackTypeFilters(feedbackTypeFilters)
            }

            if (!chatId) {
                const isFeedback = feedbackTypeFilters?.length ? true : false
                const _hardDelete = req.query?.hardDelete as boolean | undefined
                const messages = await utilGetChatMessage({
                    canvasId,
                    chatTypes,
                    sessionId,
                    startDate,
                    endDate,
                    feedback: isFeedback,
                    feedbackTypes: feedbackTypeFilters
                })
                const messageIds = messages.map((message) => message.id)

                if (messages.length === 0) {
                    const result: DeleteResult = { raw: [], affected: 0 }
                    return res.json(result)
                }

                // Categorize by chatId_memoryType_sessionId
                const chatIdMap = new Map<string, ChatMessage[]>()
                messages.forEach((message) => {
                    const msgChatId = message.chatId
                    const msgMemoryType = message.memoryType
                    const msgSessionId = message.sessionId
                    const composite_key = `${msgChatId}_${msgMemoryType}_${msgSessionId}`
                    if (!chatIdMap.has(composite_key)) {
                        chatIdMap.set(composite_key, [])
                    }
                    chatIdMap.get(composite_key)?.push(message)
                })

                const apiResponse = await chatMessagesService.removeChatMessagesByIds(canvasId, chatIdMap, messageIds)
                return res.json(apiResponse)
            } else {
                const deleteOptions: FindOptionsWhere<ChatMessage> = { canvasId }
                if (chatId) deleteOptions.chatId = chatId
                if (memoryType) deleteOptions.memoryType = memoryType
                if (sessionId) deleteOptions.sessionId = sessionId
                if (chatTypes && chatTypes.length > 0) {
                    deleteOptions.chatType = In(chatTypes)
                }
                if (startDate && endDate) {
                    const fromDate = new Date(startDate)
                    const toDate = new Date(endDate)
                    deleteOptions.createdDate = Between(fromDate ?? aMonthAgo(), toDate ?? new Date())
                }
                const apiResponse = await chatMessagesService.removeChatMessages(chatId, canvasId, deleteOptions)
                return res.json(apiResponse)
            }
        } catch (error) {
            next(error)
        }
    }

    const abortChatMessage = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            if (typeof req.params === 'undefined' || !req.params.canvasId || !req.params.chatId) {
                throw new ChatMessagesControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: abortChatMessage - canvasId or chatId not provided!'
                )
            }
            await chatMessagesService.abortChatMessage(req.params.chatId, req.params.canvasId)
            return res.json({ status: 200, message: 'Chat message aborted' })
        } catch (error) {
            next(error)
        }
    }

    return {
        createChatMessage,
        getAllChatMessages,
        getAllInternalChatMessages,
        removeAllChatMessages,
        abortChatMessage
    }
}
