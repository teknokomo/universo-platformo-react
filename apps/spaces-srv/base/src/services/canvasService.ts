import { DataSource, EntityTarget, QueryRunner, Repository, SelectQueryBuilder } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { validate as validateUuid } from 'uuid'
import { randomUUID } from 'crypto'
import { Canvas, ChatflowType } from '../database/entities/Canvas'
import { Space } from '../database/entities/Space'
import { SpaceCanvas } from '../database/entities/SpaceCanvas'

export interface CanvasServiceEntities {
    chatMessage: EntityTarget<any>
    chatMessageFeedback: EntityTarget<any>
    upsertHistory: EntityTarget<any>
}

export interface CanvasServiceMetricsConfig {
    canvasCreatedCounter: string
    agentflowCreatedCounter: string
    successStatusLabel: string
}

export interface CanvasServiceDependencies {
    errorFactory: (status: number, message: string) => Error
    removeFolderFromStorage: (canvasId: string) => Promise<void>
    updateDocumentStoreUsage: (canvasId: string, usage?: string) => Promise<void>
    containsBase64File: (payload: { flowData: string }) => boolean
    updateFlowDataWithFilePaths: (canvasId: string, flowData: string) => Promise<string>
    constructGraphs: (nodes: any[], edges: any[]) => { graph: any; nodeDependencies: Record<string, number> }
    getEndingNodes: (nodeDependencies: Record<string, number>, graph: any, nodes: any[]) => any[]
    isFlowValidForStream: (nodes: any[], nodeData: any) => boolean
    getTelemetryFlowObj: (nodes: any[], edges: any[]) => unknown
    telemetry?: {
        sendTelemetry: (eventName: string, payload: Record<string, unknown>, orgId?: string) => Promise<void>
    }
    metricsProvider?: { incrementCounter: (metric: string, labels?: Record<string, unknown>) => void }
    metricsConfig: CanvasServiceMetricsConfig
    logger: { warn: (...args: any[]) => void; error: (...args: any[]) => void }
    getUploadsConfig: (canvasId: string) => Promise<any>
}

export interface PublicCanvasResponse {
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

export class CanvasService {
    constructor(
        private readonly getDataSource: () => DataSource,
        private readonly entities: CanvasServiceEntities,
        private readonly deps: CanvasServiceDependencies
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

    private applyScopeToQuery(query: SelectQueryBuilder<Canvas>, scope?: CanvasScope): SelectQueryBuilder<Canvas> {
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

    private async attachCanvasToSpace(canvas: Canvas, space: Space, queryRunner?: QueryRunner): Promise<void> {
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
            space: { id: space.id } as Space,
            canvas: { id: canvas.id } as Canvas,
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
            this.deps.logger.warn(`[spaces-srv]: Unable to ensure default Space relation for ${canvas.id}: unikId not provided`)
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
                    space: { id: existingSpace.id } as Space,
                    canvas: { id: canvas.id } as Canvas,
                    versionGroupId: canvas.versionGroupId
                })
                await scRepo.save(spaceCanvas)
            } else {
                await scRepo
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({
                        canvas: { id: canvas.id } as Canvas,
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

    private async loadCanvasOrThrow(canvasId: string, scope?: CanvasScope, queryRunner?: QueryRunner): Promise<Canvas> {
        let query = this.getCanvasRepositoryForScope(queryRunner).createQueryBuilder('canvas')
        query = query.where('canvas.id = :id', { id: canvasId })
        query = this.applyScopeToQuery(query, scope)

        // Explicitly select all fields including versioning fields
        query = query.select([
            'canvas.id',
            'canvas.name',
            'canvas.flowData',
            'canvas.deployed',
            'canvas.isPublic',
            'canvas.apikeyid',
            'canvas.chatbotConfig',
            'canvas.apiConfig',
            'canvas.analytic',
            'canvas.speechToText',
            'canvas.followUpPrompts',
            'canvas.category',
            'canvas.type',
            'canvas.versionGroupId',
            'canvas.versionUuid',
            'canvas.versionLabel',
            'canvas.versionDescription',
            'canvas.versionIndex',
            'canvas.isActive',
            'canvas.createdDate',
            'canvas.updatedDate'
        ])

        const canvas = await query.getOne()

        if (!canvas) {
            throw this.createError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found in the database!`)
        }

        return canvas
    }

    private ensureVersioningFields(canvas: Partial<Canvas>): void {
        if (!canvas.versionGroupId) {
            canvas.versionGroupId = randomUUID()
        }
        if (!canvas.versionUuid) {
            canvas.versionUuid = randomUUID()
        }
        if (!canvas.versionLabel) {
            canvas.versionLabel = 'v1'
        }
        if (typeof canvas.versionIndex !== 'number' || Number.isNaN(canvas.versionIndex)) {
            canvas.versionIndex = 1
        }
        if (typeof canvas.isActive !== 'boolean') {
            canvas.isActive = true
        }
    }

    private createError(status: number, message: string): Error {
        return this.deps.errorFactory(status, message)
    }

    async checkIfCanvasIsValidForStreaming(canvasId: string, scope?: CanvasScope): Promise<{ isStreaming: boolean }> {
        try {
            const canvas = await this.loadCanvasOrThrow(canvasId, scope)

            let canvasConfig: Record<string, any> = {}
            const rawChatbotConfig = canvas.chatbotConfig
            if (rawChatbotConfig !== null && rawChatbotConfig !== undefined) {
                try {
                    if (typeof rawChatbotConfig === 'string') {
                        canvasConfig = rawChatbotConfig.trim().length ? JSON.parse(rawChatbotConfig) : {}
                    } else if (typeof rawChatbotConfig === 'object') {
                        canvasConfig = rawChatbotConfig || {}
                    } else {
                        canvasConfig = {}
                    }
                } catch (configError) {
                    this.deps.logger.warn(
                        '[spaces-srv] Failed to parse chatbotConfig for canvas %s: %s',
                        canvasId,
                        configError instanceof Error ? configError.message : String(configError)
                    )
                    canvasConfig = {}
                }
                if (canvasConfig?.postProcessing?.enabled === true) {
                    return { isStreaming: false }
                }
            }

            let parsedFlowData: any = {}
            try {
                parsedFlowData =
                    typeof canvas.flowData === 'string' ? JSON.parse(canvas.flowData) : canvas.flowData ?? {}
            } catch (flowError) {
                this.deps.logger.warn(
                    '[spaces-srv] Failed to parse flowData for canvas %s: %s',
                    canvasId,
                    flowError instanceof Error ? flowError.message : String(flowError)
                )
                return { isStreaming: false }
            }

            const nodes = Array.isArray(parsedFlowData?.nodes) ? parsedFlowData.nodes : []
            const edges = Array.isArray(parsedFlowData?.edges) ? parsedFlowData.edges : []
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

            if (
                endingNodes.filter((node: any) => node.data.category === 'Multi Agents' || node.data.category === 'Sequential Agents')
                    .length > 0
            ) {
                return { isStreaming: true }
            }

            return { isStreaming }
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.checkIfCanvasIsValidForStreaming - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async checkIfCanvasIsValidForUploads(canvasId: string, scope?: CanvasScope): Promise<any> {
        try {
            await this.loadCanvasOrThrow(canvasId, scope)
            return await this.deps.getUploadsConfig(canvasId)
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.checkIfCanvasIsValidForUploads - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async deleteCanvas(canvasId: string, scope?: CanvasScope): Promise<any> {
        try {
            const canvas = await this.loadCanvasOrThrow(canvasId, scope)

            const deleteResult = await this.canvasRepository.delete({ id: canvasId })

            try {
                await this.deps.removeFolderFromStorage(canvasId)
                await this.deps.updateDocumentStoreUsage(canvasId, undefined)
                await this.chatMessageRepository.delete({ canvasId: canvasId })
                await this.chatMessageFeedbackRepository.delete({ canvasId: canvasId })
                await this.upsertHistoryRepository.delete({ canvasId: canvasId })
            } catch (cleanupError) {
                this.deps.logger.error(`[spaces-srv]: Error deleting file storage for canvas ${canvasId}: ${cleanupError}`)
            }

            return deleteResult
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.deleteCanvas - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getAllCanvases(type?: ChatflowType, scope?: CanvasScope): Promise<Canvas[]> {
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
                `Error: canvasesService.getAllCanvases - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getCanvasesByApiKey(apiKeyId: string, keyonly?: string): Promise<Canvas[]> {
        try {
            let query = this.canvasRepository.createQueryBuilder('canvas').where('canvas.apikeyid = :apikeyid', { apikeyid: apiKeyId })

            if (keyonly === undefined) {
                query = query.orWhere('canvas.apikeyid IS NULL').orWhere("canvas.apikeyid = ''")
            }

            const results = await query.orderBy('canvas.name', 'ASC').getMany()
            if (results.length < 1) {
                throw this.createError(StatusCodes.NOT_FOUND, 'Canvas not found in the database!')
            }
            return results
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.getCanvasesByApiKey - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getCanvasById(canvasId: string, scope?: CanvasScope): Promise<Canvas> {
        try {
            return await this.loadCanvasOrThrow(canvasId, scope)
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error) {
                throw error
            }
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.getCanvasById - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async checkAndUpdateDocumentStoreUsage(canvas: Canvas): Promise<void> {
        const parsedFlowData = JSON.parse(canvas.flowData ?? '{}') as { nodes?: any[] }
        const nodes = Array.isArray(parsedFlowData?.nodes) ? parsedFlowData.nodes : []
        const documentStoreNode = nodes.length > 0 && nodes.find((node: any) => node?.data?.name === 'documentStore')
        const selectedStore = documentStoreNode?.data?.inputs?.selectedStore

        if (typeof selectedStore !== 'string' || selectedStore.length === 0) {
            await this.deps.updateDocumentStoreUsage(canvas.id, undefined)
            return
        }

        await this.deps.updateDocumentStoreUsage(canvas.id, selectedStore)
    }

    async saveCanvas(newChatFlow: Partial<Canvas>, scope?: CanvasScope): Promise<Canvas> {
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
                    canvasId: saved.id,
                    flowGraph: this.deps.getTelemetryFlowObj(JSON.parse(saved.flowData)?.nodes, JSON.parse(saved.flowData)?.edges)
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
                `Error: canvasesService.saveCanvas - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async importCanvases(newCanvass: Partial<Canvas>[], scope?: CanvasScope, queryRunner?: QueryRunner): Promise<any> {
        try {
            const space = await this.resolveSpace(scope, queryRunner)
            for (const data of newCanvass) {
                if (data.id && !validateUuid(data.id)) {
                    throw this.createError(StatusCodes.PRECONDITION_FAILED, 'Error: importCanvases - invalid id!')
                }
            }

            const repository = queryRunner ? queryRunner.manager.getRepository(Canvas) : this.canvasRepository

            if (newCanvass.length === 0) return

            const canvasIds = newCanvass.map((newCanvas) => newCanvas.id).filter((id): id is string => Boolean(id))

            let foundIds: string[] = []
            if (canvasIds.length > 0) {
                const selectResponse = await repository
                    .createQueryBuilder('cf')
                    .select('cf.id')
                    .where('cf.id IN (:...ids)', { ids: canvasIds })
                    .getMany()
                foundIds = selectResponse.map((response) => response.id)
            }

            const prepCanvass: Partial<Canvas>[] = newCanvass.map((newCanvas) => {
                let id = ''
                if (newCanvas.id) id = newCanvas.id
                let flowData = ''
                if (newCanvas.flowData) flowData = newCanvas.flowData
                if (foundIds.includes(id)) {
                    newCanvas.id = undefined
                    newCanvas.name = `${newCanvas.name ?? 'Canvas'} (1)`
                }
                newCanvas.flowData = JSON.stringify(JSON.parse(flowData))
                this.ensureVersioningFields(newCanvas)
                return newCanvas
            })

            const insertResult = await repository.insert(prepCanvass)

            const canvasRepo = this.getCanvasRepositoryForScope(queryRunner)
            const identifiers = insertResult.identifiers || []

            if (space) {
                await Promise.all(
                    identifiers.map(async (identifier: any, index: number) => {
                        const insertedId = identifier?.id ?? prepCanvass[index]?.id
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
                        const insertedId = identifier?.id ?? prepCanvass[index]?.id
                        if (!insertedId) {
                            return
                        }

                        const canvas = await canvasRepo.findOne({ where: { id: insertedId } })
                        if (canvas) {
                            await this.ensureCanvasLinkedToDefaultSpace(
                                canvas,
                                {
                                    unikId: scope?.unikId,
                                    fallbackName: prepCanvass[index]?.name
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
                `Error: canvasesService.saveCanvass - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async updateCanvas(canvas: Canvas, updateChatFlow: Canvas, scope?: CanvasScope): Promise<Canvas> {
        try {
            if (updateChatFlow.flowData && this.deps.containsBase64File({ flowData: updateChatFlow.flowData })) {
                updateChatFlow.flowData = await this.deps.updateFlowDataWithFilePaths(canvas.id, updateChatFlow.flowData)
            }

            const merged = this.canvasRepository.merge(canvas, updateChatFlow)
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
                `Error: canvasesService.updateCanvas - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    async getSinglePublicCanvas(canvasId: string): Promise<PublicCanvasResponse> {
        try {
            const canvas = await this.canvasRepository
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
                .where('canvas.id = :id', { id: canvasId })
                .getRawOne()

            if (!canvas) {
                throw this.createError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found`)
            }

            const isPublic = canvas.canvas_isPublic === true
            let hasPublicConfig = false

            if (!isPublic && canvas.canvas_chatbotConfig) {
                try {
                    const chatbotConfig = JSON.parse(canvas.canvas_chatbotConfig)
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
                id: canvas.canvas_id,
                name: canvas.canvas_name,
                flowData: canvas.canvas_flowData,
                isPublic: canvas.canvas_isPublic,
                type: canvas.canvas_type,
                unikId: canvas.space_unik_id ?? undefined,
                versionGroupId: canvas.canvas_version_group_id,
                versionUuid: canvas.canvas_version_uuid,
                versionLabel: canvas.canvas_version_label,
                versionDescription: canvas.canvas_version_description ?? undefined,
                versionIndex: canvas.canvas_version_index,
                isActive: canvas.canvas_is_active
            }
        } catch (error) {
            throw this.createError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: canvasesService.getSinglePublicCanvas - ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
