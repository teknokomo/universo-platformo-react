import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { getErrorMessage } from '../errors/utils'
import canvasService from '../services/spacesCanvas'
import type { CanvasFlowResult } from '@universo/spaces-srv'

export const addChatflowsCount = async (keys: any) => {
    try {
        let tmpResult = keys
        if (typeof keys !== 'undefined' && keys.length > 0) {
            const updatedKeys: any[] = []
            //iterate through keys and get chatflows
            for (const key of keys) {
                let chatflows: CanvasFlowResult[] = []
                try {
                    chatflows = await canvasService.getCanvasByApiKey(key.id)
                } catch (error: any) {
                    if (typeof error?.status === 'number' && error.status === StatusCodes.NOT_FOUND) {
                        chatflows = []
                    } else {
                        throw error
                    }
                }
                const linkedChatFlows: any[] = []
                chatflows.map((cf) => {
                    linkedChatFlows.push({
                        flowName: cf.name,
                        category: cf.category,
                        updatedDate: cf.updatedDate
                    })
                })
                key.chatFlows = linkedChatFlows
                updatedKeys.push(key)
            }
            tmpResult = updatedKeys
        }
        return tmpResult
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: addChatflowsCount - ${getErrorMessage(error)}`)
    }
}
