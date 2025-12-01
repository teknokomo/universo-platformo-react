import { StatusCodes } from 'http-status-codes'
import { ChatMessageRatingType, ChatType } from '../../Interface'
import { ChatMessage, ChatMessageFeedback, utilGetChatMessage } from '@flowise/chatmessage-srv'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { aMonthAgo } from '../../utils'

// get stats for showing in a canvas
const getCanvasStats = async (
    canvasId: string,
    chatTypes: ChatType[] | undefined,
    startDate?: string,
    endDate?: string,
    messageId?: string,
    feedback?: boolean,
    feedbackTypes?: ChatMessageRatingType[]
): Promise<{ totalMessages: number; totalFeedback: number; positiveFeedback: number }> => {
    try {
        const appServer = getRunningExpressApp()
        const chatmessages = (await utilGetChatMessage(
            {
                canvasId,
                chatTypes,
                startDate,
                endDate,
                messageId,
                feedback,
                feedbackTypes
            },
            appServer.AppDataSource,
            aMonthAgo
        )) as Array<ChatMessage & { feedback?: ChatMessageFeedback }>
        const totalMessages = chatmessages.length
        const totalFeedback = chatmessages.filter((message) => message?.feedback).length
        const positiveFeedback = chatmessages.filter((message) => message?.feedback?.rating === 'THUMBS_UP').length
        const dbResponse = {
            totalMessages,
            totalFeedback,
            positiveFeedback
        }

        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: statsService.getCanvasStats - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getCanvasStats
}
