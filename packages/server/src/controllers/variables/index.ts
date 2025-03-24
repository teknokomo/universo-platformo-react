import { Request, Response, NextFunction } from 'express'
import variablesService from '../../services/variables'
import { Variable } from '../../database/entities/Variable'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const createVariable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: variablesController.createVariable - body not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: variablesController.createVariable - unikId not provided!`)
        }
        const body = req.body
        const newVariable = new Variable()
        Object.assign(newVariable, body)
        const apiResponse = await variablesService.createVariable(newVariable, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteVariable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, 'Error: variablesController.deleteVariable - id not provided!')
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: variablesController.deleteVariable - unikId not provided!`)
        }
        const apiResponse = await variablesService.deleteVariable(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllVariables = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        const apiResponse = await variablesService.getAllVariables(unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getVariableById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, 'Error: variablesController.getVariableById - id not provided!')
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: variablesController.getVariableById - unikId not provided!`)
        }
        const apiResponse = await variablesService.getVariableById(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateVariable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, 'Error: variablesController.updateVariable - id not provided!')
        }
        if (typeof req.body === 'undefined') {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                'Error: variablesController.updateVariable - body not provided!'
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: variablesController.updateVariable - unikId not provided!`)
        }
        const variable = await variablesService.getVariableById(req.params.id, unikId)
        if (!variable) {
            return res.status(404).send(`Variable ${req.params.id} not found in the database`)
        }
        const body = req.body
        const updatedVariable = new Variable()
        Object.assign(updatedVariable, body)
        const apiResponse = await variablesService.updateVariable(variable, updatedVariable, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createVariable,
    deleteVariable,
    getAllVariables,
    getVariableById,
    updateVariable
}
