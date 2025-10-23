import { IChatMessageFeedback } from '../Interface'
import { getRunningExpressApp } from './getRunningExpressApp'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import lunary from 'lunary'
import canvasService from '../services/spacesCanvas'

/**
 * Method that updates chat message feedback.
 * @param {string} id
 * @param {Partial<IChatMessageFeedback>} chatMessageFeedback
 */
export const utilUpdateChatMessageFeedback = async (id: string, chatMessageFeedback: Partial<IChatMessageFeedback>) => {
    const appServer = getRunningExpressApp()
    const newChatMessageFeedback = new ChatMessageFeedback()
    Object.assign(newChatMessageFeedback, chatMessageFeedback)

    await appServer.AppDataSource.getRepository(ChatMessageFeedback).update({ id }, chatMessageFeedback)

    // Fetch the updated entity
    const updatedFeedback = await appServer.AppDataSource.getRepository(ChatMessageFeedback).findOne({ where: { id } })

    let canvasAnalytic = '{}'
    if (updatedFeedback?.canvasId) {
        try {
            const canvas = await canvasService.getCanvasById(updatedFeedback.canvasId)
            canvasAnalytic = canvas?.analytic ?? '{}'
        } catch (error) {
            canvasAnalytic = '{}'
        }
    }
    const analytic = JSON.parse(canvasAnalytic)

    if (analytic?.lunary?.status === true && updatedFeedback?.rating) {
        lunary.trackFeedback(updatedFeedback.messageId, {
            comment: updatedFeedback?.content,
            thumb: updatedFeedback?.rating === 'THUMBS_UP' ? 'up' : 'down'
        })
    }

    return { status: 'OK' }
}
