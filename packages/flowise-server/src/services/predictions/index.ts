import { Request } from 'express'
import { StatusCodes } from 'http-status-codes'
import { utilBuildCanvasFlow } from '../../utils/buildCanvasFlow'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const buildCanvasFlow = async (fullRequest: Request) => {
    try {
        const dbResponse = await utilBuildCanvasFlow(fullRequest)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: predictionsServices.buildCanvasFlow - ${getErrorMessage(error)}`
        )
    }
}

export default {
    buildCanvasFlow
}
