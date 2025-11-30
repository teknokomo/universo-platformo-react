import OpenAI from 'openai'
import { StatusCodes } from 'http-status-codes'
import { uniqWith, isEqual, cloneDeep } from 'lodash'
import { DataSource, DeleteResult, QueryRunner, Repository } from 'typeorm'
import { validate as validateUuid } from 'uuid'
import { z } from 'zod'
import { Assistant } from '../database/entities/Assistant'
import { Credential } from '@universo/flowise-credentials-srv'
import type { AssistantType } from '../Interface'

/**
 * Zod schemas for input validation
 */
export const createAssistantSchema = z.object({
    details: z.string().min(1, 'Details are required'),
    credential: z.string().uuid('Invalid credential ID').optional(),
    iconSrc: z.string().optional(),
    type: z.enum(['CUSTOM', 'OPENAI', 'AZURE']).optional(),
    unikId: z.string().uuid('Invalid unikId format')
})

export const updateAssistantSchema = z.object({
    details: z.string().min(1).optional(),
    credential: z.string().uuid().optional(),
    iconSrc: z.string().optional(),
    type: z.enum(['CUSTOM', 'OPENAI', 'AZURE']).optional()
})

/**
 * Error class for Assistants service
 */
export class AssistantsServiceError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'AssistantsServiceError'
    }
}

/**
 * Telemetry interface for assistants events
 */
export interface AssistantsTelemetry {
    sendTelemetry: (event: string, data: Record<string, unknown>) => Promise<void>
}

/**
 * Metrics interface for assistants counters
 */
export interface AssistantsMetrics {
    incrementCounter: (counter: string, labels: Record<string, string>) => void
}

/**
 * Nodes service interface for getChatModels/getTools
 */
export interface INodesService {
    getAllNodesForCategory: (category: string) => Promise<any[]>
}

/**
 * Document store entity interface
 */
export interface IDocumentStore {
    id: string
    name: string
    description?: string
    status: string
}

/**
 * Configuration for assistants service factory
 */
export interface AssistantsServiceConfig {
    getDataSource: () => DataSource
    decryptCredentialData: (encryptedData: string) => Promise<Record<string, unknown>>
    telemetry?: AssistantsTelemetry
    metrics?: AssistantsMetrics
    counterName?: string
    counterStatus?: { SUCCESS: string; FAILURE: string }
    // Optional dependencies for auxiliary methods
    getNodesService?: () => INodesService
    getDocumentStoreRepository?: () => Repository<IDocumentStore>
    // For generateAssistantInstruction
    getNodesPool?: () => any
    getDatabaseEntities?: () => any
    getLogger?: () => any
    getPromptGenerator?: () => string
    getInputParamsType?: () => string[]
}

export interface CreateAssistantBody {
    details: string
    credential?: string
    iconSrc?: string
    type?: AssistantType
    unikId: string
}

export interface UpdateAssistantBody {
    details?: string
    credential?: string
    iconSrc?: string
    type?: AssistantType
}

/**
 * Assistants service interface
 */
export interface IAssistantsService {
    createAssistant: (requestBody: CreateAssistantBody) => Promise<Assistant>
    deleteAssistant: (assistantId: string, isDeleteBoth: any, unikId?: string) => Promise<DeleteResult>
    getAllAssistants: (type?: AssistantType, unikId?: string) => Promise<Assistant[]>
    getAssistantById: (assistantId: string, unikId?: string) => Promise<Assistant>
    updateAssistant: (assistantId: string, requestBody: UpdateAssistantBody, unikId?: string) => Promise<Assistant>
    importAssistants: (newAssistants: Partial<Assistant>[], queryRunner?: QueryRunner) => Promise<unknown>
    // Auxiliary methods (require optional dependencies)
    getChatModels: () => Promise<any>
    getDocumentStores: () => Promise<any>
    getTools: () => Promise<any>
    generateAssistantInstruction: (task: string, selectedChatModel: any) => Promise<any>
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
}

/**
 * Factory function to create assistants service with dependency injection
 */
export function createAssistantsService(config: AssistantsServiceConfig): IAssistantsService {
    const {
        getDataSource,
        decryptCredentialData,
        telemetry,
        metrics,
        counterName,
        counterStatus,
        getNodesService,
        getDocumentStoreRepository,
        getNodesPool,
        getDatabaseEntities,
        getLogger,
        getPromptGenerator,
        getInputParamsType
    } = config

    const createAssistant = async (requestBody: CreateAssistantBody): Promise<Assistant> => {
        try {
            const dataSource = getDataSource()

            if (!requestBody.details) {
                throw new AssistantsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Invalid request body')
            }
            const assistantDetails = JSON.parse(requestBody.details)

            // Convert unikId to unik_id for database
            const unikId = requestBody.unikId

            if (requestBody.type === 'CUSTOM') {
                const newAssistant = new Assistant()
                Object.assign(newAssistant, {
                    details: requestBody.details,
                    credential: requestBody.credential || '',
                    iconSrc: requestBody.iconSrc,
                    type: requestBody.type
                })
                // Set unik_id directly instead of using relation object with 'as any'
                newAssistant.unik_id = unikId

                const repo = dataSource.getRepository(Assistant)
                const assistant = repo.create(newAssistant)
                const dbResponse = await repo.save(assistant)

                if (telemetry) {
                    await telemetry.sendTelemetry('assistant_created', {
                        assistantId: dbResponse.id
                    })
                }
                if (metrics && counterName && counterStatus) {
                    metrics.incrementCounter(counterName, { status: counterStatus.SUCCESS })
                }
                return dbResponse
            }

            // OpenAI/Azure assistant creation
            try {
                const credential = await dataSource.getRepository(Credential).findOneBy({
                    id: requestBody.credential
                })

                if (!credential) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Credential ${requestBody.credential} not found`)
                }

                const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
                const openAIApiKey = decryptedCredentialData['openAIApiKey'] as string
                if (!openAIApiKey) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, 'OpenAI ApiKey not found')
                }
                const openai = new OpenAI({ apiKey: openAIApiKey })

                // Prepare tools - OpenAI SDK requires typed tools
                const tools: Array<OpenAI.Beta.Assistants.AssistantTool> = []
                if (assistantDetails.tools) {
                    for (const tool of assistantDetails.tools ?? []) {
                        if (tool === 'code_interpreter') {
                            tools.push({ type: 'code_interpreter' })
                        } else if (tool === 'file_search') {
                            tools.push({ type: 'file_search' })
                        }
                        // Skip 'function' type as it requires additional parameters
                    }
                }

                // Save tool_resources to be stored later into database
                const savedToolResources = cloneDeep(assistantDetails.tool_resources)

                // Cleanup tool_resources for creating assistant
                if (assistantDetails.tool_resources) {
                    for (const toolResource in assistantDetails.tool_resources) {
                        if (toolResource === 'file_search') {
                            assistantDetails.tool_resources['file_search'] = {
                                vector_store_ids: assistantDetails.tool_resources['file_search'].vector_store_ids
                            }
                        } else if (toolResource === 'code_interpreter') {
                            assistantDetails.tool_resources['code_interpreter'] = {
                                file_ids: assistantDetails.tool_resources['code_interpreter'].file_ids
                            }
                        }
                    }
                }

                // If the assistant doesn't exist, create a new one
                if (!assistantDetails.id) {
                    const newOpenAIAssistant = await openai.beta.assistants.create({
                        name: assistantDetails.name,
                        description: assistantDetails.description,
                        instructions: assistantDetails.instructions,
                        model: assistantDetails.model,
                        tools,
                        tool_resources: assistantDetails.tool_resources,
                        temperature: assistantDetails.temperature,
                        top_p: assistantDetails.top_p
                    })
                    assistantDetails.id = newOpenAIAssistant.id
                } else {
                    const retrievedAssistant = await openai.beta.assistants.retrieve(assistantDetails.id)
                    let filteredTools = uniqWith(
                        [...retrievedAssistant.tools.filter((tool) => tool.type === 'function'), ...tools],
                        isEqual
                    )
                    // Remove empty functions
                    filteredTools = filteredTools.filter((tool) => !(tool.type === 'function' && !(tool as any).function))

                    await openai.beta.assistants.update(assistantDetails.id, {
                        name: assistantDetails.name,
                        description: assistantDetails.description ?? '',
                        instructions: assistantDetails.instructions ?? '',
                        model: assistantDetails.model,
                        tools: filteredTools,
                        tool_resources: assistantDetails.tool_resources,
                        temperature: assistantDetails.temperature,
                        top_p: assistantDetails.top_p
                    })
                }

                const newAssistantDetails = { ...assistantDetails }
                if (savedToolResources) newAssistantDetails.tool_resources = savedToolResources

                const newAssistant = new Assistant()
                Object.assign(newAssistant, {
                    details: JSON.stringify(newAssistantDetails),
                    credential: requestBody.credential,
                    iconSrc: requestBody.iconSrc,
                    type: requestBody.type
                })
                // Set unik_id directly instead of using relation object with 'as any'
                newAssistant.unik_id = unikId

                const repo = dataSource.getRepository(Assistant)
                const assistant = repo.create(newAssistant)
                const dbResponse = await repo.save(assistant)

                if (telemetry) {
                    await telemetry.sendTelemetry('assistant_created', { assistantId: dbResponse.id })
                }
                if (metrics && counterName && counterStatus) {
                    metrics.incrementCounter(counterName, { status: counterStatus.SUCCESS })
                }
                return dbResponse
            } catch (error) {
                throw new AssistantsServiceError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error creating new assistant - ${getErrorMessage(error)}`
                )
            }
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.createAssistant - ${getErrorMessage(error)}`
            )
        }
    }

    const deleteAssistant = async (assistantId: string, isDeleteBoth: any, unikId?: string): Promise<DeleteResult> => {
        try {
            const dataSource = getDataSource()
            const whereClause: any = { id: assistantId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }
            const assistant = await dataSource.getRepository(Assistant).findOneBy(whereClause)
            if (!assistant) {
                throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
            }
            if (assistant.type === 'CUSTOM') {
                return await dataSource.getRepository(Assistant).delete({ id: assistantId })
            }
            try {
                const assistantDetails = JSON.parse(assistant.details)
                const credential = await dataSource.getRepository(Credential).findOneBy({
                    id: assistant.credential
                })

                if (!credential) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Credential ${assistant.credential} not found`)
                }

                const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
                const openAIApiKey = decryptedCredentialData['openAIApiKey'] as string
                if (!openAIApiKey) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, 'OpenAI ApiKey not found')
                }

                const openai = new OpenAI({ apiKey: openAIApiKey })
                const dbResponse = await dataSource.getRepository(Assistant).delete({ id: assistantId })
                if (isDeleteBoth) await openai.beta.assistants.del(assistantDetails.id)
                return dbResponse
            } catch (error) {
                throw new AssistantsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error deleting assistant - ${getErrorMessage(error)}`)
            }
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.deleteAssistant - ${getErrorMessage(error)}`
            )
        }
    }

    const getAllAssistants = async (type?: AssistantType, unikId?: string): Promise<Assistant[]> => {
        try {
            const dataSource = getDataSource()
            let queryBuilder = dataSource.getRepository(Assistant).createQueryBuilder('assistant')

            if (type) {
                queryBuilder = queryBuilder.where('assistant.type = :type', { type })
            }

            if (unikId) {
                if (type) {
                    queryBuilder = queryBuilder.andWhere('assistant.unik_id = :unikId', { unikId })
                } else {
                    queryBuilder = queryBuilder.where('assistant.unik_id = :unikId', { unikId })
                }
            }

            return await queryBuilder.getMany()
        } catch (error) {
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.getAllAssistants - ${getErrorMessage(error)}`
            )
        }
    }

    const getAssistantById = async (assistantId: string, unikId?: string): Promise<Assistant> => {
        try {
            const dataSource = getDataSource()
            const whereClause: any = { id: assistantId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }
            const dbResponse = await dataSource.getRepository(Assistant).findOneBy(whereClause)
            if (!dbResponse) {
                throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
            }
            return dbResponse
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.getAssistantById - ${getErrorMessage(error)}`
            )
        }
    }

    const updateAssistant = async (assistantId: string, requestBody: UpdateAssistantBody, unikId?: string): Promise<Assistant> => {
        try {
            const dataSource = getDataSource()
            const whereClause: any = { id: assistantId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }
            const assistant = await dataSource.getRepository(Assistant).findOneBy(whereClause)

            if (!assistant) {
                throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Assistant ${assistantId} not found`)
            }

            if (assistant.type === 'CUSTOM') {
                const updateData = new Assistant()
                Object.assign(updateData, requestBody)

                dataSource.getRepository(Assistant).merge(assistant, updateData)
                return await dataSource.getRepository(Assistant).save(assistant)
            }

            try {
                const openAIAssistantId = JSON.parse(assistant.details)?.id
                const body = requestBody as any
                const assistantDetails = JSON.parse(body.details)
                const credential = await dataSource.getRepository(Credential).findOneBy({
                    id: body.credential
                })

                if (!credential) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, `Credential ${body.credential} not found`)
                }

                const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
                const openAIApiKey = decryptedCredentialData['openAIApiKey'] as string
                if (!openAIApiKey) {
                    throw new AssistantsServiceError(StatusCodes.NOT_FOUND, 'OpenAI ApiKey not found')
                }

                const openai = new OpenAI({ apiKey: openAIApiKey })

                // Prepare tools - OpenAI SDK requires typed tools
                const tools: Array<OpenAI.Beta.Assistants.AssistantTool> = []
                if (assistantDetails.tools) {
                    for (const tool of assistantDetails.tools ?? []) {
                        if (tool === 'code_interpreter') {
                            tools.push({ type: 'code_interpreter' })
                        } else if (tool === 'file_search') {
                            tools.push({ type: 'file_search' })
                        }
                    }
                }

                const savedToolResources = cloneDeep(assistantDetails.tool_resources)

                if (assistantDetails.tool_resources) {
                    for (const toolResource in assistantDetails.tool_resources) {
                        if (toolResource === 'file_search') {
                            assistantDetails.tool_resources['file_search'] = {
                                vector_store_ids: assistantDetails.tool_resources['file_search'].vector_store_ids
                            }
                        } else if (toolResource === 'code_interpreter') {
                            assistantDetails.tool_resources['code_interpreter'] = {
                                file_ids: assistantDetails.tool_resources['code_interpreter'].file_ids
                            }
                        }
                    }
                }

                const retrievedAssistant = await openai.beta.assistants.retrieve(openAIAssistantId)
                let filteredTools = uniqWith([...retrievedAssistant.tools.filter((tool) => tool.type === 'function'), ...tools], isEqual)
                filteredTools = filteredTools.filter((tool) => !(tool.type === 'function' && !(tool as any).function))

                await openai.beta.assistants.update(openAIAssistantId, {
                    name: assistantDetails.name,
                    description: assistantDetails.description,
                    instructions: assistantDetails.instructions,
                    model: assistantDetails.model,
                    tools: filteredTools,
                    tool_resources: assistantDetails.tool_resources,
                    temperature: assistantDetails.temperature,
                    top_p: assistantDetails.top_p
                })

                const newAssistantDetails = { ...assistantDetails, id: openAIAssistantId }
                if (savedToolResources) newAssistantDetails.tool_resources = savedToolResources

                const updateData = new Assistant()
                body.details = JSON.stringify(newAssistantDetails)
                Object.assign(updateData, body)

                dataSource.getRepository(Assistant).merge(assistant, updateData)
                return await dataSource.getRepository(Assistant).save(assistant)
            } catch (error) {
                throw new AssistantsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error updating assistant - ${getErrorMessage(error)}`)
            }
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.updateAssistant - ${getErrorMessage(error)}`
            )
        }
    }

    const importAssistants = async (newAssistants: Partial<Assistant>[], queryRunner?: QueryRunner): Promise<unknown> => {
        try {
            for (const data of newAssistants) {
                if (data.id && !validateUuid(data.id)) {
                    throw new AssistantsServiceError(StatusCodes.PRECONDITION_FAILED, 'Error: importAssistants - invalid id!')
                }
            }

            const dataSource = getDataSource()
            const repository = queryRunner ? queryRunner.manager.getRepository(Assistant) : dataSource.getRepository(Assistant)

            if (newAssistants.length === 0) return

            // Check for duplicate IDs
            let ids = '('
            let count = 0
            const lastCount = newAssistants.length - 1
            newAssistants.forEach((newAssistant) => {
                ids += `'${newAssistant.id}'`
                if (lastCount !== count) ids += ','
                if (lastCount === count) ids += ')'
                count += 1
            })

            const selectResponse = await repository
                .createQueryBuilder('assistant')
                .select('assistant.id')
                .where(`assistant.id IN ${ids}`)
                .getMany()
            const foundIds = selectResponse.map((response) => response.id)

            // Remove duplicate IDs
            const prepVariables: Partial<Assistant>[] = newAssistants.map((newAssistant) => {
                const id = newAssistant.id || ''
                if (foundIds.includes(id)) {
                    newAssistant.id = undefined
                }
                return newAssistant
            })

            return await repository.insert(prepVariables)
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.importAssistants - ${getErrorMessage(error)}`
            )
        }
    }

    // Auxiliary methods - require optional dependencies
    const getChatModels = async (): Promise<any> => {
        try {
            if (!getNodesService) {
                throw new AssistantsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'getChatModels requires getNodesService configuration')
            }
            const nodesService = getNodesService()
            const dbResponse = await nodesService.getAllNodesForCategory('Chat Models')
            return dbResponse.filter((node: any) => !node.tags?.includes('LlamaIndex'))
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.getChatModels - ${getErrorMessage(error)}`
            )
        }
    }

    const getDocumentStores = async (): Promise<any> => {
        try {
            if (!getDocumentStoreRepository) {
                throw new AssistantsServiceError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    'getDocumentStores requires getDocumentStoreRepository configuration'
                )
            }
            const stores = await getDocumentStoreRepository().find()
            const returnData: Array<{ name: string; label: string; description?: string }> = []
            for (const store of stores) {
                if (store.status === 'UPSERTED') {
                    returnData.push({
                        name: store.id,
                        label: store.name,
                        description: store.description
                    })
                }
            }
            return returnData
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.getDocumentStores - ${getErrorMessage(error)}`
            )
        }
    }

    const getTools = async (): Promise<any> => {
        try {
            if (!getNodesService) {
                throw new AssistantsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'getTools requires getNodesService configuration')
            }
            const inputParamsType = getInputParamsType?.() || []
            const nodesService = getNodesService()
            const tools = await nodesService.getAllNodesForCategory('Tools')

            return tools.filter((tool: any) => {
                const inputs = tool.inputs || []
                return inputs.every((input: any) => inputParamsType.includes(input.type))
            })
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.getTools - ${getErrorMessage(error)}`
            )
        }
    }

    const generateAssistantInstruction = async (task: string, selectedChatModel: any): Promise<any> => {
        try {
            if (!getNodesPool || !getDatabaseEntities || !getLogger || !getPromptGenerator) {
                throw new AssistantsServiceError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    'generateAssistantInstruction requires nodesPool, databaseEntities, logger, and promptGenerator configuration'
                )
            }

            const dataSource = getDataSource()
            const nodesPool = getNodesPool()
            const databaseEntities = getDatabaseEntities()
            const logger = getLogger()
            const promptGenerator = getPromptGenerator()

            if (selectedChatModel && Object.keys(selectedChatModel).length > 0) {
                const nodeInstanceFilePath = nodesPool.componentNodes[selectedChatModel.name].filePath as string
                const nodeModule = await import(nodeInstanceFilePath)
                const newNodeInstance = new nodeModule.nodeClass()
                const nodeData = {
                    credential: selectedChatModel.credential || selectedChatModel.inputs['FLOWISE_CREDENTIAL_ID'] || undefined,
                    inputs: selectedChatModel.inputs,
                    id: `${selectedChatModel.name}_0`
                }
                const options = {
                    appDataSource: dataSource,
                    databaseEntities,
                    logger
                }
                const llmNodeInstance = await newNodeInstance.init(nodeData, '', options)
                const response = await llmNodeInstance.invoke([
                    {
                        role: 'user',
                        content: promptGenerator.replace('{{task}}', task)
                    }
                ])
                const content = response?.content || response.kwargs?.content

                return { content }
            }

            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Error: assistantsService.generateAssistantInstruction - Error generating tool description'
            )
        } catch (error) {
            if (error instanceof AssistantsServiceError) throw error
            throw new AssistantsServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: assistantsService.generateAssistantInstruction - ${getErrorMessage(error)}`
            )
        }
    }

    return {
        createAssistant,
        deleteAssistant,
        getAllAssistants,
        getAssistantById,
        updateAssistant,
        importAssistants,
        getChatModels,
        getDocumentStores,
        getTools,
        generateAssistantInstruction
    }
}

export { z }
