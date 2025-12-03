import { StatusCodes } from 'http-status-codes'
import { DataSource, In, QueryRunner } from 'typeorm'
import { validate as validateUuid } from 'uuid'
import { z } from 'zod'
import { Variable } from '../database/entities/Variable'
import type { Unik } from '@universo/uniks-backend'

/**
 * Zod schemas for input validation
 */
export const createVariableSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    value: z.string().optional(),
    type: z.enum(['static', 'runtime']).default('static'),
    unikId: z.string().uuid('Invalid unikId format')
})

export const updateVariableSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    value: z.string().optional(),
    type: z.enum(['static', 'runtime']).optional()
})

/**
 * Error class for Variables service
 */
export class VariablesServiceError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'VariablesServiceError'
    }
}

/**
 * Configuration for variables service factory
 */
export interface VariablesServiceConfig {
    getDataSource: () => DataSource
}

/**
 * Variables service interface
 */
export interface IVariablesService {
    createVariable: (requestBody: CreateVariableBody) => Promise<Variable>
    deleteVariable: (variableId: string, unikId: string) => Promise<{ affected?: number }>
    getAllVariables: (unikId: string) => Promise<Variable[]>
    getVariableById: (variableId: string, unikId: string) => Promise<Variable | null>
    updateVariable: (variableId: string, requestBody: UpdateVariableBody, unikId: string) => Promise<Variable>
    importVariables: (newVariables: Partial<Variable>[], queryRunner?: QueryRunner) => Promise<unknown>
}

export interface CreateVariableBody {
    name: string
    value?: string
    type?: 'static' | 'runtime'
    unikId: string
}

export interface UpdateVariableBody {
    name?: string
    value?: string
    type?: 'static' | 'runtime'
}

/**
 * Factory function to create variables service with dependency injection
 */
export function createVariablesService(config: VariablesServiceConfig): IVariablesService {
    const { getDataSource } = config

    const createVariable = async (requestBody: CreateVariableBody): Promise<Variable> => {
        try {
            const validatedData = createVariableSchema.parse(requestBody)

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Variable)

            const newVariable = repo.create({
                name: validatedData.name,
                value: validatedData.value ?? '',
                type: validatedData.type,
                unik: { id: validatedData.unikId } as Pick<Unik, 'id'>
            })

            return await repo.save(newVariable)
        } catch (error) {
            if (error instanceof VariablesServiceError) {
                throw error
            }
            if (error instanceof z.ZodError) {
                throw new VariablesServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.createVariable - ${message}`
            )
        }
    }

    const deleteVariable = async (variableId: string, unikId: string): Promise<{ affected?: number }> => {
        try {
            if (!validateUuid(variableId)) {
                throw new VariablesServiceError(StatusCodes.BAD_REQUEST, 'Invalid variable ID format')
            }

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Variable)

            const dbResponse = await repo.delete({
                id: variableId,
                unik: { id: unikId }
            })
            return { affected: dbResponse.affected ?? undefined }
        } catch (error) {
            if (error instanceof VariablesServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.deleteVariable - ${message}`
            )
        }
    }

    const getAllVariables = async (unikId: string): Promise<Variable[]> => {
        try {
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Variable)

            const variables = await repo
                .createQueryBuilder('variable')
                .where('variable.unik_id = :unikId', { unikId })
                .getMany()

            return variables
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.getAllVariables - ${message}`
            )
        }
    }

    const getVariableById = async (variableId: string, unikId: string): Promise<Variable | null> => {
        try {
            if (!validateUuid(variableId)) {
                throw new VariablesServiceError(StatusCodes.BAD_REQUEST, 'Invalid variable ID format')
            }

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Variable)

            const variable = await repo.findOneBy({
                id: variableId,
                unik: { id: unikId }
            })

            return variable
        } catch (error) {
            if (error instanceof VariablesServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.getVariableById - ${message}`
            )
        }
    }

    const updateVariable = async (
        variableId: string,
        requestBody: UpdateVariableBody,
        unikId: string
    ): Promise<Variable> => {
        try {
            if (!validateUuid(variableId)) {
                throw new VariablesServiceError(StatusCodes.BAD_REQUEST, 'Invalid variable ID format')
            }

            const validatedData = updateVariableSchema.parse(requestBody)

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Variable)

            const variable = await repo.findOneBy({
                id: variableId,
                unik: { id: unikId }
            })

            if (!variable) {
                throw new VariablesServiceError(StatusCodes.NOT_FOUND, `Variable ${variableId} not found`)
            }

            // Merge validated data
            if (validatedData.name !== undefined) {
                variable.name = validatedData.name
            }
            if (validatedData.value !== undefined) {
                variable.value = validatedData.value
            }
            if (validatedData.type !== undefined) {
                variable.type = validatedData.type
            }

            return await repo.save(variable)
        } catch (error) {
            if (error instanceof VariablesServiceError) {
                throw error
            }
            if (error instanceof z.ZodError) {
                throw new VariablesServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.updateVariable - ${message}`
            )
        }
    }

    const importVariables = async (
        newVariables: Partial<Variable>[],
        queryRunner?: QueryRunner
    ): Promise<unknown> => {
        try {
            // Validate IDs
            for (const data of newVariables) {
                if (data.id && !validateUuid(data.id)) {
                    throw new VariablesServiceError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: importVariables - invalid id!'
                    )
                }
            }

            const dataSource = getDataSource()
            const repository = queryRunner
                ? queryRunner.manager.getRepository(Variable)
                : dataSource.getRepository(Variable)

            // Check if array is empty
            if (newVariables.length === 0) return

            // Get existing IDs to check for duplicates
            const variableIds = newVariables
                .map((v) => v.id)
                .filter((id): id is string => id !== undefined && id !== null)

            const selectResponse =
                variableIds.length > 0
                    ? await repository.find({
                          where: { id: In(variableIds) },
                          select: ['id']
                      })
                    : []

            const foundIds = selectResponse.map((response) => response.id)

            // Handle duplicates by removing id and appending (1) to name
            const prepVariables: Partial<Variable>[] = newVariables.map((newVariable) => {
                const id = newVariable.id ?? ''
                if (foundIds.includes(id)) {
                    return {
                        ...newVariable,
                        id: undefined,
                        name: (newVariable.name ?? '') + ' (1)'
                    }
                }
                return newVariable
            })

            return await repository.insert(prepVariables)
        } catch (error) {
            if (error instanceof VariablesServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new VariablesServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: variablesService.importVariables - ${message}`
            )
        }
    }

    return {
        createVariable,
        deleteVariable,
        getAllVariables,
        getVariableById,
        updateVariable,
        importVariables
    }
}
