import { DataSource, EntityTarget, QueryRunner, Repository, SelectQueryBuilder } from 'typeorm'
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
    canvasCreatedCounter: string
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

export interface CanvasScope {
    spaceId?: string
    unikId?: string
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

    private getSpaceRepositoryForScope(queryRunner?: QueryRunner): Repository<Space> {
        return queryRunner ? queryRunner.manager.getRepository(Space) : this.spaceRepository
    }

    private getSpaceCanvasRepositoryForScope(queryRunner?: QueryRunner): Repository<SpaceCanvas> {
        return queryRunner ? queryRunner.manager.getRepository(SpaceCanvas) : this.spaceCanvasRepository
    }

    private getCanvasRepositoryForScope(queryRunner?: QueryRunner): Repository<Canvas> {
        return queryRunner ? queryRunner.manager.getRepository(Canvas) : this.canvasRepository
    }

    private applyScopeToQuery(
        query: SelectQueryBuilder<Canvas>,
        scope?: CanvasScope
    ): SelectQueryBuilder<Canvas> {
        if (!scope?.spaceId && !scope?.unikId) {
            return query
        }

        query.innerJoin('spaces_canvases', 'sc', 'sc.canvas_id = canvas.id')

        if (query.expressionMap.wheres.length === 0) {
            query.where('1 = 1')
        }

        if (scope.spaceId) {
            query.andWhere('sc.space_id = :spaceId', { spaceId: scope.spaceId })
        }

        if (scope.unikId) {
            query.innerJoin('spaces', 'space', 'space.id = sc.space_id')
            query.andWhere('space.unik_id = :unikId', { unikId: scope.unikId })
        }

        return query
    }

    private async resolveSpace(scope?: CanvasScope, queryRunner?: QueryRunner): Promise<Space | undefined> {
        if (!scope?.spaceId) {
            return undefined
        }

        const spaceRepo = this.getSpaceRepositoryForScope(queryRunner)
        const space = await spaceRepo.findOne({ where: { id: scope.spaceId } })

        if (!space || (scope.unikId && space.unikId !== scope.unikId)) {
            throw this.createError(StatusCodes.NOT_FOUND, `Space ${scope.spaceId} not found`)
        }

        return space
    }

    private async attachCanvasToSpace(
        canvas: Canvas,
        space: Space,
        queryRunner?: QueryRunner
    ): Promise<void> {
        const repo = this.getSpaceCanvasRepositoryForScope(queryRunner)

        const existing = await repo
            .createQueryBuilder('sc')
            .where('sc.space_id = :spaceId', { spaceId: space.id })
            .andWhere('sc.canvas_id = :canvasId', { canvasId: canvas.id })
            .getOne()

        if (existing) {
            return
        }

        const maxOrderResult = await repo
            .createQueryBuilder('sc')
            .where('sc.space_id = :spaceId', { spaceId: space.id })
            .select('MAX(sc.sort_order)', 'maxOrder')
            .getRawOne()

        const nextSortOrder = Number(maxOrderResult?.maxOrder ?? 0) + 1

        const relation = repo.create({
            space: ({ id: space.id } as Space),
            canvas: ({ id: canvas.id } as Canvas),
            versionGroupId: canvas.versionGroupId,
            sortOrder: nextSortOrder
        })

        await repo.save(relation)
    }

    private async ensureCanvasLinkedToDefaultSpace(
        canvas: Canvas,
        options: { unikId?: string; fallbackName?: string },
        queryRunner?: QueryRunner
    ): Promise<void> {
        const { unikId, fallbackName } = options

        if (!unikId) {
            this.deps.logger.warn(
                `[spaces-srv]: Unable to ensure default Space relation for ${canvas.id}: unikId not provided`
            )
            return
        }

        try {
            const spaceRepo = this.getSpaceRepositoryForScope(queryRunner)
            const scRepo = this.getSpaceCanvasRepositoryForScope(queryRunner)

            let existingSpace = await spaceRepo.findOne({ where: { id: canvas.id } })
            let spaceIdConflict = false

            if (existingSpace && existingSpace.unikId !== unikId) {
                spaceIdConflict = true
                this.deps.logger.warn(
                    `[spaces-srv]: Space ${existingSpace.id} belongs to unik ${existingSpace.unikId}, expected ${unikId}. Creating a dedicated default space.`
                )
                existingSpace = null
            }

            if (!existingSpace) {
                const baseName = fallbackName || canvas.name || 'Space'
                const createdSpace = spaceRepo.create({
                    ...(spaceIdConflict ? {} : { id: canvas.id }),
                    name: baseName,
                    visibility: 'private'
                } as Partial<Space>)
                ;(createdSpace as any).unik = { id: unikId }
                ;(createdSpace as any).unikId = unikId

                try {
                    existingSpace = await spaceRepo.save(createdSpace)
                } catch (creationError) {
                    if (!spaceIdConflict) {
                        this.deps.logger.warn(
                            `[spaces-srv]: Failed to reuse space id ${canvas.id} for unik ${unikId}: ${
                                creationError instanceof Error ? creationError.message : String(creationError)
                            }. Retrying with generated id.`
                        )
                        const retrySpace = spaceRepo.create({
                            name: baseName,
                            visibility: 'private'
                        } as Partial<Space>)
                        ;(retrySpace as any).unik = { id: unikId }
                        ;(retrySpace as any).unikId = unikId
                        existingSpace = await spaceRepo.save(retrySpace)
                    } else {
                        throw creationError
                    }
                }
            }

            if (!existingSpace) {
                return
            }

            const existsJunction =
                (await scRepo
                    .createQueryBuilder('sc')
                    .where('sc.space_id = :sid AND sc.version_group_id = :vgid', {
                        sid: existingSpace.id,
                        vgid: canvas.versionGroupId
                    })
                    .getCount()) > 0

            if (!existsJunction) {
                const spaceCanvas = scRepo.create({
                    sortOrder: 1,
                    space: ({ id: existingSpace.id } as Space),
                    canvas: ({ id: canvas.id } as Canvas),
                    versionGroupId: canvas.versionGroupId
                })
                await scRepo.save(spaceCanvas)
            } else {
                await scRepo
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({
                        canvas: ({ id: canvas.id } as Canvas),
                        versionGroupId: canvas.versionGroupId
                    })
                    .where('space_id = :sid AND version_group_id = :vgid', {
                        sid: existingSpace.id,
                        vgid: canvas.versionGroupId
                    })
                    .execute()
            }
        } catch (linkErr) {
            this.deps.logger.warn(
                `[spaces-srv]: Unable to ensure Space/Canvas relation for ${canvas.id}: ${
                    linkErr instanceof Error ? linkErr.message : String(linkErr)
                }`
            )
        }
    }

    private async loadCanvasOrThrow(
        chatflowId: string,
        scope?: CanvasScope,
        queryRunner?: QueryRunner
    ): Promise<Canvas> {
        let query = this.getCanvasRepositoryForScope(queryRunner).createQueryBuilder('canvas')
        query = query.where('canvas.id = :id', { id: chatflowId })
        query = this.applyScopeToQuery(query, scope)

        const chatflow = await query.getOne()

        if (!chatflow) {
            throw this.createError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found in the database!`)
        }

        return chatflow
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

    async checkIfChatflowIsValidForStreaming(
        chatflowId: string,
        scope?: CanvasScope
    ): Promise<{ isStreaming: boolean }> {
        try {
            const chatflow = await this.loadCanvasOrThrow(chatflowId, scope)

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
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.checkIfChatflowIsValidForStreaming - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async checkIfChatflowIsValidForUploads(chatflowId: string, scope?: CanvasScope): Promise<any> {
        try {
            await this.loadCanvasOrThrow(chatflowId, scope)
            return await this.deps.getUploadsConfig(chatflowId)
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.checkIfChatflowIsValidForUploads - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async deleteChatflow(chatflowId: string, scope?: CanvasScope): Promise<any> {
        try {
            const chatflow = await this.loadCanvasOrThrow(chatflowId, scope)

            const deleteResult = await this.canvasRepository.delete({ id: chatflowId })

            try {
                await this.deps.removeFolderFromStorage(chatflowId)
                await this.deps.updateDocumentStoreUsage(chatflowId, undefined)
                await this.chatMessageRepository.delete({ canvasId: chatflowId })
                await this.chatMessageFeedbackRepository.delete({ canvasId: chatflowId })
                await this.upsertHistoryRepository.delete({ canvasId: chatflowId })
            } catch (cleanupError) {
                this.deps.logger.error(`[spaces-srv]: Error deleting file storage for chatflow ${chatflowId}: ${cleanupError}`)
            }

            return deleteResult
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.deleteChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getAllChatflows(type?: ChatflowType, scope?: CanvasScope): Promise<Canvas[]> {
        try {
            let queryBuilder = this.canvasRepository.createQueryBuilder('canvas')
            queryBuilder = this.applyScopeToQuery(queryBuilder, scope)

            if (queryBuilder.expressionMap.wheres.length === 0) {
                queryBuilder = queryBuilder.where('1 = 1')
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
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
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

    async getChatflowById(chatflowId: string, scope?: CanvasScope): Promise<Canvas> {
        try {
            return await this.loadCanvasOrThrow(chatflowId, scope)
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
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

    async saveChatflow(newChatFlow: Partial<Canvas>, scope?: CanvasScope): Promise<Canvas> {
        try {
            const space = await this.resolveSpace(scope)
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

            if (space) {
                await this.attachCanvasToSpace(saved, space)
            } else {
                await this.ensureCanvasLinkedToDefaultSpace(saved, {
                    unikId: scope?.unikId,
                    fallbackName: newChatFlow.name
                })
            }

            if (this.deps.telemetry) {
                await this.deps.telemetry.sendTelemetry('canvas_created', {
                    version: await this.deps.getAppVersion(),
                    canvasId: saved.id,
                    flowGraph: this.deps.getTelemetryFlowObj(
                        JSON.parse(saved.flowData)?.nodes,
                        JSON.parse(saved.flowData)?.edges
                    )
                })
            }

            this.deps.metricsProvider?.incrementCounter(
                saved?.type === 'MULTIAGENT'
                    ? this.deps.metricsConfig.agentflowCreatedCounter
                    : this.deps.metricsConfig.canvasCreatedCounter,
                { status: this.deps.metricsConfig.successStatusLabel }
            )

            return saved
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.saveChatflow - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async importChatflows(
        newChatflows: Partial<Canvas>[],
        scope?: CanvasScope,
        queryRunner?: QueryRunner
    ): Promise<any> {
        try {
            const space = await this.resolveSpace(scope, queryRunner)
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

            const insertResult = await repository.insert(prepChatflows)

            const canvasRepo = this.getCanvasRepositoryForScope(queryRunner)
            const identifiers = insertResult.identifiers || []

            if (space) {
                await Promise.all(
                    identifiers.map(async (identifier: any, index: number) => {
                        const insertedId = identifier?.id ?? prepChatflows[index]?.id
                        if (!insertedId) {
                            return
                        }

                        const canvas = await canvasRepo.findOne({ where: { id: insertedId } })
                        if (canvas) {
                            await this.attachCanvasToSpace(canvas, space, queryRunner)
                        }
                    })
                )
            } else {
                await Promise.all(
                    identifiers.map(async (identifier: any, index: number) => {
                        const insertedId = identifier?.id ?? prepChatflows[index]?.id
                        if (!insertedId) {
                            return
                        }

                        const canvas = await canvasRepo.findOne({ where: { id: insertedId } })
                        if (canvas) {
                            await this.ensureCanvasLinkedToDefaultSpace(
                                canvas,
                                {
                                    unikId: scope?.unikId,
                                    fallbackName: prepChatflows[index]?.name
                                },
                                queryRunner
                            )
                        }
                    })
                )
            }

            return insertResult
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.saveChatflows - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async updateChatflow(chatflow: Canvas, updateChatFlow: Canvas, scope?: CanvasScope): Promise<Canvas> {
        try {
            if (updateChatFlow.flowData && this.deps.containsBase64File({ flowData: updateChatFlow.flowData })) {
                updateChatFlow.flowData = await this.deps.updateFlowDataWithFilePaths(chatflow.id, updateChatFlow.flowData)
            }

            const merged = this.canvasRepository.merge(chatflow, updateChatFlow)
            await this.checkAndUpdateDocumentStoreUsage(merged)
            const saved = await this.canvasRepository.save(merged)

            if (scope?.spaceId) {
                const space = await this.resolveSpace(scope)
                if (space) {
                    await this.attachCanvasToSpace(saved, space)
                }
            }

            return saved
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
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
