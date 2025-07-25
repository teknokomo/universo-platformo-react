import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { Variable } from '../../database/entities/Variable'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { QueryRunner } from 'typeorm'
import { validate } from 'uuid'

const createVariable = async (newVariable: Variable, unikId: string) => {
    try {
        const appServer = getRunningExpressApp()
        // Set relationship with Unik
        newVariable.unik = { id: unikId } as any
        const variable = await appServer.AppDataSource.getRepository(Variable).create(newVariable)
        const dbResponse = await appServer.AppDataSource.getRepository(Variable).save(variable)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.createVariable - ${getErrorMessage(error)}`
        )
    }
}

const deleteVariable = async (variableId: string, unikId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(Variable).delete({ 
            id: variableId,
            unik: { id: unikId }
        })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.deleteVariable - ${getErrorMessage(error)}`
        )
    }
}

const getAllVariables = async (unikId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(Variable)
            .createQueryBuilder('variable')
            .where('variable.unik_id = :unikId', { unikId })
            .getMany()
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.getAllVariables - ${getErrorMessage(error)}`
        )
    }
}

const getVariableById = async (variableId: string, unikId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(Variable).findOneBy({
            id: variableId,
            unik: { id: unikId }
        })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.getVariableById - ${getErrorMessage(error)}`
        )
    }
}

const updateVariable = async (variable: Variable, updatedVariable: Variable, unikId: string) => {
    try {
        const appServer = getRunningExpressApp()
        // Ensure unikId is not set directly
        if ('unikId' in updatedVariable) {
            delete (updatedVariable as any).unikId
        }
        const tmpUpdatedVariable = await appServer.AppDataSource.getRepository(Variable).merge(variable, updatedVariable)
        const dbResponse = await appServer.AppDataSource.getRepository(Variable).save(tmpUpdatedVariable)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variablesServices.updateVariable - ${getErrorMessage(error)}`
        )
    }
}

const importVariables = async (newVariables: Partial<Variable>[], queryRunner?: QueryRunner): Promise<any> => {
    try {
        for (const data of newVariables) {
            if (data.id && !validate(data.id)) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: importVariables - invalid id!`)
            }
        }

        const appServer = getRunningExpressApp()
        const repository = queryRunner ? queryRunner.manager.getRepository(Variable) : appServer.AppDataSource.getRepository(Variable)

        // step 1 - check whether array is zero
        if (newVariables.length == 0) return

        // step 2 - check whether ids are duplicate in database
        let ids = '('
        let count: number = 0
        const lastCount = newVariables.length - 1
        newVariables.forEach((newVariable) => {
            ids += `'${newVariable.id}'`
            if (lastCount != count) ids += ','
            if (lastCount == count) ids += ')'
            count += 1
        })

        const selectResponse = await repository.createQueryBuilder('v').select('v.id').where(`v.id IN ${ids}`).getMany()
        const foundIds = selectResponse.map((response) => {
            return response.id
        })

        // step 3 - remove ids that are only duplicate
        const prepVariables: Partial<Variable>[] = newVariables.map((newVariable) => {
            let id: string = ''
            if (newVariable.id) id = newVariable.id
            if (foundIds.includes(id)) {
                newVariable.id = undefined
                newVariable.name += ' (1)'
            }
            return newVariable
        })

        // step 4 - transactional insert array of entities
        const insertResponse = await repository.insert(prepVariables)

        return insertResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: variableService.importVariables - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createVariable,
    deleteVariable,
    getAllVariables,
    getVariableById,
    updateVariable,
    importVariables
}
