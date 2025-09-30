import { DataSource, EntityTarget, QueryRunner, Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { validate as validateUuid } from 'uuid'
import { randomUUID } from 'crypto'
import { Canvas, ChatflowType } from '../database/entities/Canvas'
import { Space } from '../database/entities/Space'
import { SpaceCanvas } from '../database/entities/SpaceCanvas'

export interface LegacyChatflowEntities {
    chatMessage: EntityTarget<any>
    chatMessageFeedback: EntityTarget<any>
    upsertHistory: EntityTarget<any>
}

export interface LegacyChatflowMetricsConfig {
    chatflowCreatedCounter: string
    agentflowCreatedCounter: string
    successStatusLabel: string
}

export interface LegacyChatflowDependencies {
    errorFactory: (status: number, message: string) => Error
    removeFolderFromStorage: (chatflowId: string) => Promise<void>
    updateDocumentStoreUsage: (chatflowId: string, usage?: string) => Promise<void>
    containsBase64File: (payload: { flowData: string }) => boolean
    updateFlowDataWithFilePaths: (chatflowId: string, flowData: string) => Promise<string>
    constructGraphs: (nodes: any[], edges: any[]) => { graph: any; nodeDependencies: Record<string, number> }
    getEndingNodes: (nodeDependencies: Record<string, number>, graph: any, nodes: any[]) => any[]
    isFlowValidForStream: (nodes: any[], nodeData: any) => boolean
    getAppVersion: () => Promise<string>
    getTelemetryFlowObj: (nodes: any[], edges: any[]) => unknown
    telemetry?: { sendTelemetry: (eventName: string, payload: Record<string, unknown>) => Promise<void> }
    metricsProvider?: { incrementCounter: (metric: string, labels?: Record<string, unknown>) => void }
    metricsConfig: LegacyChatflowMetricsConfig
    logger: { warn: (...args: any[]) => void; error: (...args: any[]) => void }
    getUploadsConfig: (chatflowId: string) => Promise<any>
}

export interface LegacyChatflowPublicCanvas {
    id: string
    name: string
    flowData: string
    isPublic?: boolean
    type?: ChatflowType
    unikId?: string
    versionGroupId: string
    versionUuid: string
    versionLabel: string
    versionDescription?: string
    versionIndex: number
    isActive: boolean
}

export class LegacyChatflowsService {
    constructor(
        private readonly getDataSource: () => DataSource,
        private readonly entities: LegacyChatflowEntities,
        private readonly deps: LegacyChatflowDependencies
    ) {}

    private get dataSource(): DataSource {
        return this.getDataSource()
    }

    private get canvasRepository(): Repository<Canvas> {
        return this.dataSource.getRepository(Canvas)
    }

    private get spaceRepository(): Repository<Space> {
        return this.dataSource.getRepository(Space)
    }

    private get spaceCanvasRepository(): Repository<SpaceCanvas> {
        return this.dataSource.getRepository(SpaceCanvas)
    }

    private get chatMessageRepository(): Repository<any> {
        return this.dataSource.getRepository(this.entities.chatMessage)
    }

    private get chatMessageFeedbackRepository(): Repository<any> {
        return this.dataSource.getRepository(this.entities.chatMessageFeedback)
    }

    private get upsertHistoryRepository(): Repository<any> {
        return this.dataSource.getRepository(this.entities.upsertHistory)
    }

    private ensureVersioningFields(chatflow: Partial<Canvas>): void {
        if (!chatflow.versionGroupId) {
            chatflow.versionGroupId = randomUUID()
        }
        if (!chatflow.versionUuid) {
            chatflow.versionUuid = randomUUID()
        }
        if (!chatflow.versionLabel) {
            chatflow.versionLabel = 'v1'
        }
        if (typeof chatflow.versionIndex !== 'number' || Number.isNaN(chatflow.versionIndex)) {
            chatflow.versionIndex = 1
        }
        if (typeof chatflow.isActive !== 'boolean') {
            chatflow.isActive = true
        }
    }

    private createError(status: number, message: string): Error {
        return this.deps.errorFactory(status, message)
    }

    async checkIfChatflowIsValidForStreaming(chatflowId: string): Promise<{ isStreaming: boolean }> {
        try {
            const chatflow = await this.canvasRepository.findOne({ where: { id: chatflowId } })
            if (!chatflow) {
                throw this.createError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
            }

            let chatflowConfig: Record<string, any> = {}
            if (chatflow.chatbotConfig) {
                chatflowConfig = JSON.parse(chatflow.chatbotConfig)
                if (chatflowConfig?.postProcessing?.enabled === true) {
                    return { isStreaming: false }
                }
            }

            const parsedFlowData = JSON.parse(chatflow.flowData)
            const nodes = parsedFlowData.nodes ?? []
            const edges = parsedFlowData.edges ?? []
            const { graph, nodeDependencies } = this.deps.constructGraphs(nodes, edges)
            const endingNodes = this.deps.getEndingNodes(nodeDependencies, graph, nodes)

            let isStreaming = false
            for (const endingNode of endingNodes) {
                const endingNodeData = endingNode.data
                const isEndingNode = endingNodeData?.outputs?.output === 'EndingNode'
                if (isEndingNode) {
                    return { isStreaming: false }
                }
                isStreaming = this.deps.isFlowValidForStream(nodes, endingNodeData)
            }

            if (endingNodes.filter((node: any) => node.data.category === 'Multi Agents' || node.data.category === 'Sequential Agents').length > 0) {
                return { isStreaming: true }
            }

            return { isStreaming }
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.checkIfChatflowIsValidForStreaming - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async checkIfChatflowIsValidForUploads(chatflowId: string): Promise<any> {
        try {
            return await this.deps.getUploadsConfig(chatflowId)
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.checkIfChatflowIsValidForUploads - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async deleteChatflow(chatflowId: string, unikId?: string): Promise<any> {
        try {
            let chatflow: Canvas | null
            if (unikId) {
                chatflow = await this.canvasRepository
                    .createQueryBuilder('canvas')
                    .innerJoin('spaces_canvases', 'sc', 'sc.canvas_id = canvas.id')
                    .innerJoin('spaces', 'space', 'space.id = sc.space_id')
                    .where('canvas.id = :id', { id: chatflowId })
                    .andWhere('space.unik_id = :unikId', { unikId })
                    .getOne()
            } else {
                chatflow = await this.canvasRepository.findOne({ where: { id: chatflowId } })
            }

            if (!chatflow) {
                throw this.createError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
            }

            const deleteResult = await this.canvasRepository.delete({ id: chatflowId })

            try {
                await this.deps.removeFolderFromStorage(chatflowId)
                await this.deps.updateDocumentStoreUsage(chatflowId, undefined)
                await this.chatMessageRepository.delete({ chatflowid: chatflowId })
                await this.chatMessageFeedbackRepository.delete({ chatflowid: chatflowId })
                await this.upsertHistoryRepository.delete({ chatflowid: chatflowId })
            } catch (cleanupError) {
                this.deps.logger.error(`[spaces-srv]: Error deleting file storage for chatflow ${chatflowId}: ${cleanupError}`)
            }

            return deleteResult
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.deleteChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getAllChatflows(type?: ChatflowType, unikId?: string): Promise<Canvas[]> {
        try {
            let queryBuilder = this.canvasRepository.createQueryBuilder('canvas')

            if (unikId) {
                queryBuilder = queryBuilder
                    .innerJoin('spaces_canvases', 'sc', 'sc.canvas_id = canvas.id')
                    .innerJoin('spaces', 'space', 'space.id = sc.space_id')
                    .where('space.unik_id = :unikId', { unikId })
            }

            if (type === 'MULTIAGENT') {
                queryBuilder = queryBuilder.andWhere('canvas.type = :type', { type: 'MULTIAGENT' })
            } else if (type === 'ASSISTANT') {
                queryBuilder = queryBuilder.andWhere('canvas.type = :type', { type: 'ASSISTANT' })
            } else if (type === 'CHATFLOW') {
                queryBuilder = queryBuilder.andWhere('(canvas.type = :type OR canvas.type IS NULL)', { type: 'CHATFLOW' })
            }

            return await queryBuilder.getMany()
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.getAllChatflows - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getChatflowByApiKey(apiKeyId: string, keyonly?: string): Promise<Canvas[]> {
        try {
            let query = this.canvasRepository
                .createQueryBuilder('canvas')
                .where('canvas.apikeyid = :apikeyid', { apikeyid: apiKeyId })

            if (keyonly === undefined) {
                query = query.orWhere('canvas.apikeyid IS NULL').orWhere("canvas.apikeyid = ''")
            }

            const results = await query.orderBy('canvas.name', 'ASC').getMany()
            if (results.length < 1) {
                throw this.createError(StatusCodes.NOT_FOUND, 'Chatflow not found in the database!')
            }
            return results
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.getChatflowByApiKey - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getChatflowById(chatflowId: string, unikId?: string): Promise<Canvas> {
        try {
            let chatflow: Canvas | null
            if (unikId) {
                chatflow = await this.canvasRepository
                    .createQueryBuilder('canvas')
                    .innerJoin('spaces_canvases', 'sc', 'sc.canvas_id = canvas.id')
                    .innerJoin('spaces', 'space', 'space.id = sc.space_id')
                    .where('canvas.id = :id', { id: chatflowId })
                    .andWhere('space.unik_id = :unikId', { unikId })
                    .getOne()
            } else {
                chatflow = await this.canvasRepository.findOne({ where: { id: chatflowId } })
            }

            if (!chatflow) {
                throw this.createError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found in the database!`)
            }

            return chatflow
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.getChatflowById - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async checkAndUpdateDocumentStoreUsage(chatflow: Canvas): Promise<void> {
        const parsedFlowData = JSON.parse(chatflow.flowData ?? '{}') as { nodes?: any[] }
        const nodes = Array.isArray(parsedFlowData?.nodes) ? parsedFlowData.nodes : []
        const documentStoreNode =
            nodes.length > 0 && nodes.find((node: any) => node?.data?.name === 'documentStore')
        const selectedStore = documentStoreNode?.data?.inputs?.selectedStore

        if (typeof selectedStore !== 'string' || selectedStore.length === 0) {
            await this.deps.updateDocumentStoreUsage(chatflow.id, undefined)
            return
        }

        await this.deps.updateDocumentStoreUsage(chatflow.id, selectedStore)
    }

    async saveChatflow(newChatFlow: Partial<Canvas>): Promise<Canvas> {
        try {
            this.ensureVersioningFields(newChatFlow)

            let saved: Canvas

            if (newChatFlow.flowData && this.deps.containsBase64File({ flowData: newChatFlow.flowData })) {
                const incomingFlowData = newChatFlow.flowData
                newChatFlow.flowData = JSON.stringify({})
                const entity = this.canvasRepository.create(newChatFlow)
                const step1Results = await this.canvasRepository.save(entity)

                step1Results.flowData = await this.deps.updateFlowDataWithFilePaths(step1Results.id, incomingFlowData)
                await this.checkAndUpdateDocumentStoreUsage(step1Results)
                saved = await this.canvasRepository.save(step1Results)
            } else {
                const entity = this.canvasRepository.create(newChatFlow)
                saved = await this.canvasRepository.save(entity)
            }

            try {
                const spaceRepo = this.spaceRepository
                const scRepo = this.spaceCanvasRepository

                const existingSpace = await spaceRepo.findOne({ where: { id: saved.id } })
                if (!existingSpace) {
                    const baseSpacePayload: Record<string, unknown> = {
                        id: saved.id,
                        name: newChatFlow.name || 'Space',
                        visibility: 'private'
                    }
                    const unikRelation = (newChatFlow as any)?.unik
                    if (unikRelation) {
                        baseSpacePayload.unik = unikRelation
                    }
                    const space = spaceRepo.create(baseSpacePayload as any)
                    await spaceRepo.save(space)
                }

                const existsJunction =
                    (await scRepo
                        .createQueryBuilder('sc')
                        .where('sc.space_id = :sid AND sc.version_group_id = :vgid', {
                            sid: saved.id,
                            vgid: saved.versionGroupId
                        })
                        .getCount()) > 0

                if (!existsJunction) {
                    const spaceCanvas = scRepo.create({
                        sortOrder: 1,
                        space: ({ id: saved.id } as Space),
                        canvas: ({ id: saved.id } as Canvas),
                        versionGroupId: saved.versionGroupId
                    })
                    await scRepo.save(spaceCanvas)
                } else {
                    await scRepo
                        .createQueryBuilder()
                        .update(SpaceCanvas)
                        .set({
                            canvas: ({ id: saved.id } as Canvas),
                            versionGroupId: saved.versionGroupId
                        })
                        .where('space_id = :sid AND version_group_id = :vgid', {
                            sid: saved.id,
                            vgid: saved.versionGroupId
                        })
                        .execute()
                }
            } catch (linkErr) {
                this.deps.logger.warn(
                    `[spaces-srv]: Unable to ensure Space/Canvas relation for ${saved.id}: ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`
                )
            }

            if (this.deps.telemetry) {
                await this.deps.telemetry.sendTelemetry('chatflow_created', {
                    version: await this.deps.getAppVersion(),
                    chatflowId: saved.id,
                    flowGraph: this.deps.getTelemetryFlowObj(
                        JSON.parse(saved.flowData)?.nodes,
                        JSON.parse(saved.flowData)?.edges
                    )
                })
            }

            this.deps.metricsProvider?.incrementCounter(
                saved?.type === 'MULTIAGENT'
                    ? this.deps.metricsConfig.agentflowCreatedCounter
                    : this.deps.metricsConfig.chatflowCreatedCounter,
                { status: this.deps.metricsConfig.successStatusLabel }
            )

            return saved
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.saveChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async importChatflows(newChatflows: Partial<Canvas>[], queryRunner?: QueryRunner): Promise<any> {
        try {
            for (const data of newChatflows) {
                if (data.id && !validateUuid(data.id)) {
                    throw this.createError(StatusCodes.PRECONDITION_FAILED, 'Error: importChatflows - invalid id!')
                }
            }

            const repository = queryRunner
                ? queryRunner.manager.getRepository(Canvas)
                : this.canvasRepository

            if (newChatflows.length === 0) return

            const chatflowIds = newChatflows
                .map((newChatflow) => newChatflow.id)
                .filter((id): id is string => Boolean(id))

            let foundIds: string[] = []
            if (chatflowIds.length > 0) {
                const selectResponse = await repository
                    .createQueryBuilder('cf')
                    .select('cf.id')
                    .where('cf.id IN (:...ids)', { ids: chatflowIds })
                    .getMany()
                foundIds = selectResponse.map((response) => response.id)
            }

            const prepChatflows: Partial<Canvas>[] = newChatflows.map((newChatflow) => {
                let id = ''
                if (newChatflow.id) id = newChatflow.id
                let flowData = ''
                if (newChatflow.flowData) flowData = newChatflow.flowData
                if (foundIds.includes(id)) {
                    newChatflow.id = undefined
                    newChatflow.name = `${newChatflow.name ?? 'Canvas'} (1)`
                }
                newChatflow.flowData = JSON.stringify(JSON.parse(flowData))
                this.ensureVersioningFields(newChatflow)
                return newChatflow
            })

            return await repository.insert(prepChatflows)
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.saveChatflows - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async updateChatflow(chatflow: Canvas, updateChatFlow: Canvas, unikId?: string): Promise<Canvas> {
        try {
            if (updateChatFlow.flowData && this.deps.containsBase64File({ flowData: updateChatFlow.flowData })) {
                updateChatFlow.flowData = await this.deps.updateFlowDataWithFilePaths(chatflow.id, updateChatFlow.flowData)
            }

            const merged = this.canvasRepository.merge(chatflow, updateChatFlow)
            await this.checkAndUpdateDocumentStoreUsage(merged)
            const saved = await this.canvasRepository.save(merged)

            if (unikId) {
                await this.spaceCanvasRepository
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({ canvas: ({ id: saved.id } as Canvas) })
                    .where('canvas_id = :id', { id: saved.id })
                    .execute()
            }

            return saved
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.updateChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getSinglePublicChatflow(chatflowId: string): Promise<LegacyChatflowPublicCanvas> {
        try {
            const chatflow = await this.canvasRepository
                .createQueryBuilder('canvas')
                .leftJoin('spaces_canvases', 'sc', 'sc.canvas_id = canvas.id')
                .leftJoin('spaces', 'space', 'space.id = sc.space_id')
                .select([
                    'canvas.id',
                    'canvas.name',
                    'canvas.flowData',
                    'canvas.isPublic',
                    'canvas.chatbotConfig',
                    'canvas.type',
                    'canvas.versionGroupId',
                    'canvas.versionUuid',
                    'canvas.versionLabel',
                    'canvas.versionDescription',
                    'canvas.versionIndex',
                    'canvas.isActive',
                    'space.unik_id'
                ])
                .where('canvas.id = :id', { id: chatflowId })
                .getRawOne()

            if (!chatflow) {
                throw this.createError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
            }

            const isPublic = chatflow.canvas_isPublic === true
            let hasPublicConfig = false

            if (!isPublic && chatflow.canvas_chatbotConfig) {
                try {
                    const chatbotConfig = JSON.parse(chatflow.canvas_chatbotConfig)
                    if (chatbotConfig && typeof chatbotConfig === 'object') {
                        hasPublicConfig = Object.values(chatbotConfig as Record<string, any>).some(
                            (config: any) => config?.isPublic === true
                        )
                    }
                } catch {
                    // ignore JSON parse errors and fall back to legacy authorization checks
                }
            }

            if (!isPublic && !hasPublicConfig) {
                throw this.createError(StatusCodes.UNAUTHORIZED, 'Unauthorized')
            }

            return {
                id: chatflow.canvas_id,
                name: chatflow.canvas_name,
                flowData: chatflow.canvas_flowData,
                isPublic: chatflow.canvas_isPublic,
                type: chatflow.canvas_type,
                unikId: chatflow.space_unik_id ?? undefined,
                versionGroupId: chatflow.canvas_version_group_id,
                versionUuid: chatflow.canvas_version_uuid,
                versionLabel: chatflow.canvas_version_label,
                versionDescription: chatflow.canvas_version_description ?? undefined,
                versionIndex: chatflow.canvas_version_index,
                isActive: chatflow.canvas_is_active
            }
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.getSinglePublicChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
