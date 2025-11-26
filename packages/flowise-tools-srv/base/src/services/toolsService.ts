import { StatusCodes } from 'http-status-codes'
import { DataSource, QueryRunner, In } from 'typeorm'
import { validate as validateUuid } from 'uuid'
import { z } from 'zod'
import { Tool } from '../database/entities/Tool'

/**
 * Zod schemas for input validation
 */
export const createToolSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    description: z.string().min(1, 'Description is required'),
    color: z.string().min(1, 'Color is required').max(50, 'Color too long'),
    iconSrc: z.string().max(500, 'Icon URL too long').optional(),
    schema: z.string().optional(),
    func: z.string().optional(),
    unikId: z.string().uuid('Invalid unikId format')
})

export const updateToolSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    color: z.string().min(1).max(50).optional(),
    iconSrc: z.string().max(500).optional(),
    schema: z.string().optional(),
    func: z.string().optional(),
    unikId: z.string().uuid().optional()
})

/**
 * Error class for Tools service
 */
export class ToolsServiceError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'ToolsServiceError'
    }
}

/**
 * Telemetry interface for tools events
 */
export interface ToolsTelemetry {
    sendTelemetry: (event: string, data: Record<string, unknown>) => Promise<void>
}

/**
 * Metrics interface for tools counters
 */
export interface ToolsMetrics {
    incrementCounter: (counter: string, labels: Record<string, string>) => void
}

/**
 * Configuration for tools service factory
 */
export interface ToolsServiceConfig {
    getDataSource: () => DataSource
    telemetry?: ToolsTelemetry
    metrics?: ToolsMetrics
    counterName?: string
    counterStatus?: { SUCCESS: string; FAILURE: string }
}

/**
 * Tools service interface
 */
export interface IToolsService {
    createTool: (requestBody: CreateToolBody) => Promise<Tool>
    deleteTool: (toolId: string, unikId?: string) => Promise<{ affected?: number }>
    getAllTools: (unikId?: string) => Promise<Tool[]>
    getToolById: (toolId: string, unikId?: string) => Promise<Tool>
    updateTool: (toolId: string, toolBody: UpdateToolBody) => Promise<Tool>
    importTools: (newTools: Partial<Tool>[], queryRunner?: QueryRunner) => Promise<unknown>
}

export interface CreateToolBody {
    name: string
    description: string
    color: string
    iconSrc?: string
    schema?: string
    func?: string
    unikId: string
}

export interface UpdateToolBody {
    name?: string
    description?: string
    color?: string
    iconSrc?: string
    schema?: string
    func?: string
    unikId?: string
}

/**
 * Factory function to create tools service with dependency injection
 */
export function createToolsService(config: ToolsServiceConfig): IToolsService {
    const { getDataSource, telemetry, metrics, counterName, counterStatus } = config

    const createTool = async (requestBody: CreateToolBody): Promise<Tool> => {
        try {
            // Validate input with zod
            const validatedData = createToolSchema.parse(requestBody)
            
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Tool)

            const newTool = repo.create({
                name: validatedData.name,
                description: validatedData.description,
                color: validatedData.color,
                iconSrc: validatedData.iconSrc,
                schema: validatedData.schema,
                func: validatedData.func,
                unik: { id: validatedData.unikId } as any
            })

            const dbResponse = await repo.save(newTool)

            if (telemetry) {
                await telemetry.sendTelemetry('tool_created', {
                    toolId: dbResponse.id,
                    toolName: dbResponse.name
                })
            }

            if (metrics && counterName && counterStatus) {
                metrics.incrementCounter(counterName, { status: counterStatus.SUCCESS })
            }

            return dbResponse
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ToolsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map(e => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.createTool - ${message}`)
        }
    }

    const deleteTool = async (toolId: string, unikId?: string): Promise<{ affected?: number }> => {
        try {
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Tool)

            const whereClause: Record<string, unknown> = { id: toolId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }

            const dbResponse = await repo.delete(whereClause)
            return { affected: dbResponse.affected ?? undefined }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.deleteTool - ${message}`)
        }
    }

    const getAllTools = async (unikId?: string): Promise<Tool[]> => {
        try {
            const dataSource = getDataSource()
            let queryBuilder = dataSource.getRepository(Tool).createQueryBuilder('tool')

            if (unikId) {
                queryBuilder = queryBuilder.where('tool.unik_id = :unikId', { unikId })
            }

            return await queryBuilder.getMany()
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getAllTools - ${message}`)
        }
    }

    const getToolById = async (toolId: string, unikId?: string): Promise<Tool> => {
        try {
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Tool)

            const whereClause: Record<string, unknown> = { id: toolId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }

            const dbResponse = await repo.findOneBy(whereClause)
            if (!dbResponse) {
                throw new ToolsServiceError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
            }

            return dbResponse
        } catch (error) {
            if (error instanceof ToolsServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.getToolById - ${message}`)
        }
    }

    const updateTool = async (toolId: string, toolBody: UpdateToolBody): Promise<Tool> => {
        try {
            // Validate input with zod
            const validatedData = updateToolSchema.parse(toolBody)
            
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Tool)

            const whereClause: Record<string, unknown> = { id: toolId }
            if (validatedData.unikId) {
                whereClause.unik = { id: validatedData.unikId }
            }

            const tool = await repo.findOneBy(whereClause)
            if (!tool) {
                throw new ToolsServiceError(StatusCodes.NOT_FOUND, `Tool ${toolId} not found`)
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { unikId, ...updateData } = validatedData
            const updateTool = repo.create(updateData)
            repo.merge(tool, updateTool)

            return await repo.save(tool)
        } catch (error) {
            if (error instanceof ToolsServiceError) {
                throw error
            }
            if (error instanceof z.ZodError) {
                throw new ToolsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map(e => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.updateTool - ${message}`)
        }
    }

    const importTools = async (newTools: Partial<Tool>[], queryRunner?: QueryRunner): Promise<unknown> => {
        try {
            // Validate all UUIDs
            for (const data of newTools) {
                if (data.id && !validateUuid(data.id)) {
                    throw new ToolsServiceError(StatusCodes.PRECONDITION_FAILED, 'Error: importTools - invalid id!')
                }
            }

            const dataSource = getDataSource()
            const repository = queryRunner ? queryRunner.manager.getRepository(Tool) : dataSource.getRepository(Tool)

            if (newTools.length === 0) return

            // Extract valid IDs for parameterized query (prevents SQL injection)
            const toolIds = newTools
                .map((tool) => tool.id)
                .filter((id): id is string => id !== undefined && id !== null)

            // Use TypeORM's In() operator for safe parameterized query
            const selectResponse = toolIds.length > 0
                ? await repository.find({
                    where: { id: In(toolIds) },
                    select: ['id']
                })
                : []
            const foundIds = selectResponse.map((response) => response.id)

            // Remove duplicate IDs and rename tools
            const prepTools: Partial<Tool>[] = newTools.map((newTool) => {
                const id = newTool.id ?? ''
                if (foundIds.includes(id)) {
                    newTool.id = undefined
                    newTool.name = (newTool.name ?? '') + ' (1)'
                }
                return newTool
            })

            return await repository.insert(prepTools)
        } catch (error) {
            if (error instanceof ToolsServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new ToolsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: toolsService.importTools - ${message}`)
        }
    }

    return {
        createTool,
        deleteTool,
        getAllTools,
        getToolById,
        updateTool,
        importTools
    }
}
