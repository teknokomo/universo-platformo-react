import { StatusCodes } from 'http-status-codes'
import { findAvailableConfigs } from '../../utils'
import { IReactFlowObject } from '../../Interface'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import canvasService from '../spacesCanvas'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const getSingleFlowConfig = async (canvasId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const canvas = await canvasService.getCanvasById(canvasId)
        if (!canvas) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found in the database!`)
        }
        const flowData = canvas.flowData
        const parsedFlowData: IReactFlowObject = JSON.parse(flowData)
        const nodes = parsedFlowData.nodes
        const dbResponse = findAvailableConfigs(nodes, appServer.nodesPool.componentCredentials)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: flowConfigService.getSingleFlowConfig - ${getErrorMessage(error)}`
        )
    }
}

export default {
    getSingleFlowConfig
}
