import { DataSource, In } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { Execution, ExecutionState } from '../database/entities/Execution'

/**
 * Zod schemas for validation
 */
const executionFiltersSchema = z.object({
    id: z.string().uuid().optional(),
    executionIds: z.array(z.string().uuid()).optional(),
    unikId: z.string().uuid().optional(),
    spaceId: z.string().uuid().optional(),
    canvasId: z.string().uuid().optional(),
    canvasName: z.string().optional(),
    sessionId: z.string().optional(),
    state: z.nativeEnum(ExecutionState).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(12)
})

const updateExecutionSchema = z.object({
    isPublic: z.boolean().optional(),
    action: z.string().optional(),
    state: z.nativeEnum(ExecutionState).optional(),
    stoppedDate: z.coerce.date().optional()
})

export type ExecutionFilters = z.infer<typeof executionFiltersSchema>
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>

/**
 * Custom error class for executions service
 */
export class ExecutionsServiceError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message)
        this.name = 'ExecutionsServiceError'
    }
}

/**
 * Interface for executions service
 */
export interface IExecutionsService {
    getExecutionById(executionId: string, canvasId?: string): Promise<Execution>
    getPublicExecutionById(executionId: string): Promise<Execution>
    getAllExecutions(filters: ExecutionFilters): Promise<{ data: Execution[]; total: number }>
    updateExecution(executionId: string, data: UpdateExecutionInput, canvasId?: string): Promise<Execution>
    deleteExecutions(executionIds: string[], canvasId?: string): Promise<{ success: boolean; deletedCount: number }>
}

/**
 * Configuration for executions service
 */
export interface ExecutionsServiceConfig {
    getDataSource: () => DataSource
}

/**
 * Factory function to create executions service
 * Adapted from Flowise 3.0.12 with improvements:
 * - Zod validation for all inputs
 * - Soft delete support
 * - Canvas-based filtering
 * - Type-safe error handling
 */
export function createExecutionsService(config: ExecutionsServiceConfig): IExecutionsService {
    const { getDataSource } = config

    const getExecutionById = async (executionId: string, canvasId?: string): Promise<Execution> => {
        try {
            const repo = getDataSource().getRepository(Execution)

            const where: Record<string, unknown> = { id: executionId, isDeleted: false }
            if (canvasId) {
                where.canvasId = canvasId
            }

            const execution = await repo.findOne({ where })
            if (!execution) {
                throw new ExecutionsServiceError(StatusCodes.NOT_FOUND, `Execution ${executionId} not found`)
            }
            return execution
        } catch (error) {
            if (error instanceof ExecutionsServiceError) {
                throw error
            }
            throw new ExecutionsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error fetching execution: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    const getPublicExecutionById = async (executionId: string): Promise<Execution> => {
        try {
            const repo = getDataSource().getRepository(Execution)
            const execution = await repo.findOne({
                where: { id: executionId, isPublic: true, isDeleted: false }
            })
            if (!execution) {
                throw new ExecutionsServiceError(StatusCodes.NOT_FOUND, `Public execution ${executionId} not found`)
            }
            return execution
        } catch (error) {
            if (error instanceof ExecutionsServiceError) {
                throw error
            }
            throw new ExecutionsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error fetching public execution: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    const getAllExecutions = async (filters: ExecutionFilters): Promise<{ data: Execution[]; total: number }> => {
        try {
            // Validate filters with Zod
            const validatedFilters = executionFiltersSchema.parse(filters)
            const { id, executionIds, unikId, spaceId, canvasId, canvasName, sessionId, state, startDate, endDate, page, limit } =
                validatedFilters

            const repo = getDataSource().getRepository(Execution)
            const queryBuilder = repo
                .createQueryBuilder('execution')
                .leftJoinAndSelect('execution.canvas', 'canvas')
                .where('execution.isDeleted = :isDeleted', { isDeleted: false })
                .orderBy('execution.updatedDate', 'DESC')
                .skip((page - 1) * limit)
                .take(limit)

            // Scope filters (Unik / Space) require additional joins
            if (unikId || spaceId) {
                queryBuilder.leftJoin('canvas.spaceCanvases', 'spaceCanvas')
                queryBuilder.leftJoin('spaceCanvas.space', 'space')
                queryBuilder.distinct(true)

                if (unikId) {
                    queryBuilder.andWhere('space.unikId = :unikId', { unikId })
                }
                if (spaceId) {
                    queryBuilder.andWhere('space.id = :spaceId', { spaceId })
                }
            }

            if (id) {
                queryBuilder.andWhere('execution.id = :id', { id })
            }
            if (executionIds && executionIds.length > 0) {
                queryBuilder.andWhere('execution.id IN (:...executionIds)', { executionIds })
            }
            if (canvasId) {
                queryBuilder.andWhere('execution.canvasId = :canvasId', { canvasId })
            }
            if (canvasName) {
                queryBuilder.andWhere('LOWER(canvas.name) LIKE LOWER(:canvasName)', { canvasName: `%${canvasName}%` })
            }
            if (sessionId) {
                queryBuilder.andWhere('execution.sessionId = :sessionId', { sessionId })
            }
            if (state) {
                queryBuilder.andWhere('execution.state = :state', { state })
            }

            // Date range filters
            if (startDate && endDate) {
                queryBuilder.andWhere('execution.createdDate BETWEEN :startDate AND :endDate', { startDate, endDate })
            } else if (startDate) {
                queryBuilder.andWhere('execution.createdDate >= :startDate', { startDate })
            } else if (endDate) {
                queryBuilder.andWhere('execution.createdDate <= :endDate', { endDate })
            }

            const [data, total] = await queryBuilder.getManyAndCount()
            return { data, total }
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ExecutionsServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid filters: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            throw new ExecutionsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error fetching executions: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    const updateExecution = async (executionId: string, data: UpdateExecutionInput, canvasId?: string): Promise<Execution> => {
        try {
            // Validate input with Zod
            const validatedData = updateExecutionSchema.parse(data)

            const repo = getDataSource().getRepository(Execution)

            const where: Record<string, unknown> = { id: executionId, isDeleted: false }
            if (canvasId) {
                where.canvasId = canvasId
            }

            const execution = await repo.findOneBy(where)
            if (!execution) {
                throw new ExecutionsServiceError(StatusCodes.NOT_FOUND, `Execution ${executionId} not found`)
            }

            repo.merge(execution, validatedData)
            return await repo.save(execution)
        } catch (error) {
            if (error instanceof ExecutionsServiceError) {
                throw error
            }
            if (error instanceof z.ZodError) {
                throw new ExecutionsServiceError(
                    StatusCodes.BAD_REQUEST,
                    `Invalid update data: ${error.errors.map((e) => e.message).join(', ')}`
                )
            }
            throw new ExecutionsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error updating execution: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    const deleteExecutions = async (executionIds: string[], canvasId?: string): Promise<{ success: boolean; deletedCount: number }> => {
        try {
            const repo = getDataSource().getRepository(Execution)

            const where: Record<string, unknown> = { id: In(executionIds), isDeleted: false }
            if (canvasId) {
                where.canvasId = canvasId
            }

            // Soft delete
            const result = await repo.update(where, {
                isDeleted: true,
                deletedDate: new Date()
            })

            return {
                success: true,
                deletedCount: result.affected || 0
            }
        } catch (error) {
            throw new ExecutionsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error deleting executions: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    return {
        getExecutionById,
        getPublicExecutionById,
        getAllExecutions,
        updateExecution,
        deleteExecutions
    }
}
