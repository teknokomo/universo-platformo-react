import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { getErrorMessage } from '../errors/utils'
import canvasService from '../services/spacesCanvas'
import type { CanvasFlowResult } from '@universo/spaces-backend'

export const addCanvasCount = async (keys: any) => {
    try {
        let tmpResult = keys
        if (typeof keys !== 'undefined' && keys.length > 0) {
            const updatedKeys: any[] = []
            // Iterate through keys and get canvases linked to each API key
            for (const key of keys) {
                let canvases: CanvasFlowResult[] = []
                try {
                    canvases = await canvasService.getCanvasByApiKey(key.id)
                } catch (error: any) {
                    if (typeof error?.status === 'number' && error.status === StatusCodes.NOT_FOUND) {
                        canvases = []
                    } else {
                        throw error
                    }
                }
                const linkedCanvases: any[] = canvases.map((cf) => ({
                    flowName: cf.name,
                    category: cf.category,
                    updatedDate: cf.updatedDate
                }))
                key.canvases = linkedCanvases
                updatedKeys.push(key)
            }
            tmpResult = updatedKeys
        }
        return tmpResult
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: addCanvasCount - ${getErrorMessage(error)}`)
    }
}
