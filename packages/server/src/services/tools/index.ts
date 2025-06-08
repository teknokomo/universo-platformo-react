import { StatusCodes } from 'http-status-codes'
import { Tool } from '../../database/entities/Tool'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getAppVersion } from '../../utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { FLOWISE_METRIC_COUNTERS, FLOWISE_COUNTER_STATUS } from '../../Interface.Metrics'
import { QueryRunner } from 'typeorm'

const createTool = async (requestBody: any): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        
        // Ensure unikId is properly passed to the database
        if (requestBody.unikId) {
            // TypeORM expects unik_id instead of unikId
            requestBody.unik_id = requestBody.unikId
            // Remove unikId to avoid duplication
            delete requestBody.unikId
        }
        
        const newTool = new Tool()
        // Set relationship with Unik
        newTool.unik = { id: requestBody.unik_id } as any
        // Copy other fields
        Object.assign(newTool, requestBody)
        
        const tool = await appServer.AppDataSource.getRepository(Tool).create(newTool)
        const dbResponse = await appServer.AppDataSource.getRepository(Tool).save(tool)
        await appServer.telemetry.sendTelemetry('tool_created', {
            version: await getAppVersion(),
            toolId: dbResponse.id,
            toolName: dbResponse.name
        })
        appServer.metricsProvider?.incrementCounter(FLOWISE_METRIC_COUNTERS.TOOL_CREATED, { status: FLOWISE_COUNTER_STATUS.SUCCESS })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.createTool - ${getErrorMessage(error)}`)
    }
}

const deleteTool = async (toolId: string, unikId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: toolId }
        if (unikId) {
            whereClause.unik = { id: unikId }
        }
        const dbResponse = await appServer.AppDataSource.getRepository(Tool).delete(whereClause)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.deleteTool - ${getErrorMessage(error)}`)
    }
}

const getAllTools = async (unikId?: string): Promise<Tool[]> => {
    try {
        const appServer = getRunningExpressApp()
        let queryBuilder = appServer.AppDataSource.getRepository(Tool)
            .createQueryBuilder('tool')

        // Apply filter by unikId if provided
        if (unikId) {
            queryBuilder = queryBuilder.where('tool.unik_id = :unikId', { unikId })
        }

        return await queryBuilder.getMany()
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getAllTools - ${getErrorMessage(error)}`)
    }
}

const getToolById = async (toolId: string, unikId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: toolId }
        if (unikId) {
            whereClause.unik = { id: unikId }
        }
        const dbResponse = await appServer.AppDataSource.getRepository(Tool).findOneBy(whereClause)
        if (!dbResponse) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getToolById - ${getErrorMessage(error)}`)
    }
}

const updateTool = async (toolId: string, toolBody: any): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: toolId }
        if (toolBody.unikId) {
            whereClause.unik = { id: toolBody.unikId }
            // Remove unikId from toolBody to avoid setting it directly
            const { unikId, ...restBody } = toolBody
            toolBody = restBody
        }
        
        const tool = await appServer.AppDataSource.getRepository(Tool).findOneBy(whereClause)
        if (!tool) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
        }
        const updateTool = new Tool()
        Object.assign(updateTool, toolBody)
        await appServer.AppDataSource.getRepository(Tool).merge(tool, updateTool)
        const dbResponse = await appServer.AppDataSource.getRepository(Tool).save(tool)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.updateTool - ${getErrorMessage(error)}`)
    }
}

const importTools = async (newTools: Partial<Tool>[], queryRunner?: QueryRunner) => {
    try {
        const appServer = getRunningExpressApp()
        const repository = queryRunner ? queryRunner.manager.getRepository(Tool) : appServer.AppDataSource.getRepository(Tool)

        // step 1 - check whether file tools array is zero
        if (newTools.length == 0) return

        // step 2 - check whether ids are duplicate in database
        let ids = '('
        let count: number = 0
        const lastCount = newTools.length - 1
        newTools.forEach((newTools) => {
            ids += `'${newTools.id}'`
            if (lastCount != count) ids += ','
            if (lastCount == count) ids += ')'
            count += 1
        })

        const selectResponse = await repository.createQueryBuilder('t').select('t.id').where(`t.id IN ${ids}`).getMany()
        const foundIds = selectResponse.map((response) => {
            return response.id
        })

        // step 3 - remove ids that are only duplicate
        const prepTools: Partial<Tool>[] = newTools.map((newTool) => {
            let id: string = ''
            if (newTool.id) id = newTool.id
            if (foundIds.includes(id)) {
                newTool.id = undefined
                newTool.name += ' (1)'
            }
            return newTool
        })

        // step 4 - transactional insert array of entities
        const insertResponse = await repository.insert(prepTools)

        return insertResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.importTools - ${getErrorMessage(error)}`)
    }
}

export default {
    createTool,
    deleteTool,
    getAllTools,
    getToolById,
    updateTool,
    importTools
}
