import { Repository, DataSource, EntityManager } from 'typeorm'
import { randomUUID } from 'crypto'
import { Space } from '../database/entities/Space'
import { Canvas } from '../database/entities/Canvas'
import { SpaceCanvas } from '../database/entities/SpaceCanvas'
import { removeFolderFromStorage } from 'flowise-components'
import { cleanupCanvasStorage, purgeSpacesForUnik } from './purgeUnikSpaces'
import {
    CreateSpaceDto,
    UpdateSpaceDto,
    CreateCanvasDto,
    UpdateCanvasDto,
    ReorderCanvasesDto,
    SpaceResponse,
    SpaceDetailsResponse,
    CanvasResponse,
    CanvasVersionResponse,
    CreateCanvasVersionDto,
    UpdateCanvasVersionDto,
    ChatflowType
} from '../types'
import { PublishLinkService } from '@universo/publish-srv'

function toCanvasVersionResponse(canvas: Canvas): CanvasVersionResponse {
    return {
        id: canvas.id,
        versionGroupId: canvas.versionGroupId,
        versionUuid: canvas.versionUuid,
        versionLabel: canvas.versionLabel,
        versionDescription: canvas.versionDescription ?? undefined,
        versionIndex: canvas.versionIndex,
        isActive: Boolean(canvas.isActive),
        createdDate: canvas.createdDate,
        updatedDate: canvas.updatedDate
    }
}

function toCanvasResponse(canvas: Canvas, sortOrder: number): CanvasResponse {
    return {
        id: canvas.id,
        name: canvas.name,
        sortOrder,
        flowData: canvas.flowData,
        deployed: canvas.deployed,
        isPublic: canvas.isPublic,
        apikeyid: canvas.apikeyid,
        chatbotConfig: canvas.chatbotConfig,
        apiConfig: canvas.apiConfig,
        analytic: canvas.analytic,
        speechToText: canvas.speechToText,
        followUpPrompts: canvas.followUpPrompts,
        category: canvas.category,
        type: canvas.type,
        createdDate: canvas.createdDate,
        updatedDate: canvas.updatedDate,
        versionGroupId: canvas.versionGroupId,
        versionUuid: canvas.versionUuid,
        versionLabel: canvas.versionLabel,
        versionDescription: canvas.versionDescription ?? undefined,
        versionIndex: canvas.versionIndex,
        isActive: Boolean(canvas.isActive)
    }
}

export class SpacesService {
    private _spaceRepository?: Repository<Space>
    private _canvasRepository?: Repository<Canvas>
    private _spaceCanvasRepository?: Repository<SpaceCanvas>
    private _getDataSourceFn: () => DataSource
    private _publishLinkService?: PublishLinkService

    constructor(getDataSourceFn: () => DataSource) {
        console.log('[SpacesService] Constructor with DataSource function')
        this._getDataSourceFn = getDataSourceFn
    }

    // Get DataSource dynamically from the function that's passed in routes
    private get dataSource(): DataSource {
        // Get fresh DataSource each time to ensure it's initialized
        const ds = this._getDataSourceFn()
        if (!ds.isInitialized) {
            throw new Error('DataSource is not initialized yet')
        }
        return ds
    }

    // Lazy getters for repositories
    private get spaceRepository(): Repository<Space> {
        if (!this._spaceRepository) {
            console.log('[SpacesService] Creating Space repository lazily')
            this._spaceRepository = this.dataSource.getRepository(Space)
        }
        return this._spaceRepository
    }

    private get canvasRepository(): Repository<Canvas> {
        if (!this._canvasRepository) {
            console.log('[SpacesService] Creating Canvas repository lazily')
            this._canvasRepository = this.dataSource.getRepository(Canvas)
        }
        return this._canvasRepository
    }

    private get spaceCanvasRepository(): Repository<SpaceCanvas> {
        if (!this._spaceCanvasRepository) {
            console.log('[SpacesService] Creating SpaceCanvas repository lazily')
            this._spaceCanvasRepository = this.dataSource.getRepository(SpaceCanvas)
        }
        return this._spaceCanvasRepository
    }

    private get publishLinkService(): PublishLinkService {
        if (!this._publishLinkService) {
            this._publishLinkService = new PublishLinkService(this.dataSource)
        }
        return this._publishLinkService
    }

    private async loadCanvasForSpace(
        unikId: string,
        spaceId: string,
        canvasId: string,
        manager?: EntityManager
    ): Promise<Canvas | null> {
        const repo = manager ? manager.getRepository(Canvas) : this.canvasRepository
        return repo
            .createQueryBuilder('canvas')
            .innerJoin('spaces_canvases', 'sc', 'sc.version_group_id = canvas.version_group_id')
            .innerJoin('spaces', 'space', 'space.id = sc.space_id')
            .where('canvas.id = :canvasId', { canvasId })
            .andWhere('space.id = :spaceId', { spaceId })
            .andWhere('space.unik_id = :unikId', { unikId })
            .getOne()
    }

    /**
     * Get all spaces for a unik with canvas count
     */
    async getSpacesForUnik(unikId: string): Promise<SpaceResponse[]> {
        try {
            const spaces = await this.spaceRepository
                .createQueryBuilder('sp')
                .leftJoin('sp.spaceCanvases', 'sc')
                .leftJoin('sc.canvas', 'canvas')
                .where('sp.unik_id = :unikId', { unikId })
                .select([
                    'sp.id',
                    'sp.name',
                    'sp.description',
                    'sp.visibility',
                    'sp.createdDate',
                    'sp.updatedDate'
                ])
                .addSelect('COUNT(canvas.id)', 'canvasCount')
                .groupBy('sp.id')
                .getRawAndEntities()

            console.log('[SpacesService.getSpacesForUnik] query result raw:', spaces.raw)
            console.log('[SpacesService.getSpacesForUnik] entities length:', spaces.entities?.length)

            return spaces.entities.map((space: any, index: number) => ({
                id: space.id,
                name: space.name,
                description: space.description,
                visibility: space.visibility,
                canvasCount: parseInt(spaces.raw[index].canvasCount) || 0,
                createdDate: space.createdDate,
                updatedDate: space.updatedDate
            }))
        } catch (e: any) {
            console.error('[SpacesService] getSpacesForUnik failed', { unikId, error: String(e?.message || e) })
            throw e
        }
    }

    /**
     * Create a new space with default canvas
     */
    async createSpace(unikId: string, data: CreateSpaceDto): Promise<SpaceResponse> {
        return await this.dataSource.transaction(async (manager) => {
            const spaceRepo = manager.getRepository(Space)
            const canvasRepo = manager.getRepository(Canvas)
            const spaceCanvasRepo = manager.getRepository(SpaceCanvas)

            const { defaultCanvasName, defaultCanvasFlowData, ...spacePayload } = data
            const sanitizedSpace: Partial<Space> = {
                ...spacePayload,
                name: spacePayload.name?.trim(),
                description: spacePayload.description?.trim() || undefined
            }

            const resolvedCanvasName = (defaultCanvasName ?? 'Main Canvas').trim() || 'Main Canvas'
            const normalizedCanvasName = resolvedCanvasName.slice(0, 200)
            const canvasFlowData = typeof defaultCanvasFlowData === 'string' && defaultCanvasFlowData.trim().length
                ? defaultCanvasFlowData
                : '{}'

            // Create space
            const space = spaceRepo.create({
                ...sanitizedSpace,
                unik: { id: unikId } as any
            })
            const savedSpace = await spaceRepo.save(space)

            // Create default canvas
            const versionGroupId = randomUUID()
            const canvas = canvasRepo.create({
                name: normalizedCanvasName,
                flowData: canvasFlowData,
                versionGroupId,
                versionUuid: randomUUID(),
                versionLabel: 'v1',
                versionIndex: 1,
                isActive: true
            })
            const savedCanvas = await canvasRepo.save(canvas)

            // Link space and canvas
            const spaceCanvas = spaceCanvasRepo.create({
                space: savedSpace,
                canvas: savedCanvas,
                versionGroupId,
                sortOrder: 1
            })
            await spaceCanvasRepo.save(spaceCanvas)

            return {
                id: savedSpace.id,
                name: savedSpace.name,
                description: savedSpace.description,
                visibility: savedSpace.visibility,
                canvasCount: 1,
                createdDate: savedSpace.createdDate,
                updatedDate: savedSpace.updatedDate,
                defaultCanvas: toCanvasResponse(savedCanvas, 1)
            }
        })
    }

    /**
     * Get space details with canvases
     */
    async getSpaceDetails(unikId: string, spaceId: string): Promise<SpaceDetailsResponse | null> {
        try {
            const space = await this.spaceRepository
                .createQueryBuilder('sp')
                .leftJoinAndSelect('sp.spaceCanvases', 'sc')
                .leftJoinAndSelect('sc.canvas', 'canvas')
                .where('sp.id = :spaceId', { spaceId })
                .andWhere('sp.unik_id = :unikId', { unikId })
                // use DB column name to avoid alias translation issues
                .orderBy('sc.sort_order', 'ASC')
                .getOne()

            if (!space) {
                return null
            }

            const canvases: CanvasResponse[] = space.spaceCanvases?.map((sc: any) =>
                toCanvasResponse(sc.canvas, sc.sortOrder)
            ) || []

            return {
                id: space.id,
                name: space.name,
                description: space.description,
                visibility: space.visibility,
                canvasCount: canvases.length,
                createdDate: space.createdDate,
                updatedDate: space.updatedDate,
                canvases
            }
        } catch (e: any) {
            console.error('[SpacesService] getSpaceDetails failed', { unikId, spaceId, error: String(e?.message || e) })
            throw e
        }
    }

    /**
     * Update space
     */
    async updateSpace(unikId: string, spaceId: string, data: UpdateSpaceDto): Promise<SpaceResponse | null> {
        const result = await this.spaceRepository.update(
            { id: spaceId, unik: { id: unikId } },
            { ...data, updatedDate: new Date() }
        )

        if (result.affected === 0) {
            return null
        }

        const updatedSpace = await this.spaceRepository.findOne({
            where: { id: spaceId, unik: { id: unikId } }
        })

        if (!updatedSpace) {
            return null
        }

        // Get canvas count
        const canvasCount = await this.spaceCanvasRepository.count({
            where: { space: { id: spaceId } }
        })

        return {
            id: updatedSpace.id,
            name: updatedSpace.name,
            description: updatedSpace.description,
            visibility: updatedSpace.visibility,
            canvasCount,
            createdDate: updatedSpace.createdDate,
            updatedDate: updatedSpace.updatedDate
        }
    }

    /**
     * Delete space and all its canvases
     */
    async deleteSpace(unikId: string, spaceId: string): Promise<boolean> {
        // Ensure space exists and belongs to unik
        const space = await this.spaceRepository.findOne({ where: { id: spaceId, unikId } })
        if (!space) return false

        const result = await this.dataSource.transaction((manager: EntityManager) =>
            purgeSpacesForUnik(manager, { unikId, spaceIds: [spaceId] })
        )

        if (result.deletedCanvasIds.length > 0) {
            await cleanupCanvasStorage(result.deletedCanvasIds, removeFolderFromStorage, {
                source: 'SpacesService'
            })
        }

        return result.deletedSpaceIds.length > 0
    }

    /**
     * Get canvases for a space
     */
    async getCanvasesForSpace(unikId: string, spaceId: string): Promise<CanvasResponse[]> {
        try {
            const spaceCanvases = await this.spaceCanvasRepository
                .createQueryBuilder('sc')
                .leftJoinAndSelect('sc.canvas', 'canvas')
                .leftJoin('sc.space', 'sp')
                .where('sc.space_id = :spaceId', { spaceId })
                .andWhere('sp.unik_id = :unikId', { unikId })
                // use DB column name to avoid alias translation issues
                .orderBy('sc.sort_order', 'ASC')
                .getMany()

            return spaceCanvases.map((sc: any) => toCanvasResponse(sc.canvas, sc.sortOrder))
        } catch (e: any) {
            console.error('[SpacesService] getCanvasesForSpace failed', { unikId, spaceId, error: String(e?.message || e) })
            throw e
        }
    }

    /**
     * Get single canvas by id (ensuring it belongs to unik)
     */
    async getCanvasById(unikId: string, canvasId: string): Promise<CanvasResponse | null> {
        // Verify canvas belongs to unik via SpaceCanvas
        const spaceCanvas = await this.spaceCanvasRepository
            .createQueryBuilder('sc')
            .leftJoinAndSelect('sc.canvas', 'canvas')
            .leftJoin('sc.space', 'sp')
            .where('sc.canvas_id = :canvasId', { canvasId })
            .andWhere('sp.unik_id = :unikId', { unikId })
            .getOne()

        if (!spaceCanvas) return null

        return toCanvasResponse(spaceCanvas.canvas, spaceCanvas.sortOrder)
    }

    /**
     * Create new canvas in space
     */
    async createCanvas(unikId: string, spaceId: string, data: CreateCanvasDto): Promise<CanvasResponse | null> {
        // Verify space exists and belongs to unik
        const space = await this.spaceRepository.findOne({
            where: { id: spaceId, unik: { id: unikId } }
        })

        if (!space) {
            return null
        }

        // Get next sort order
        const maxSortOrder = await this.spaceCanvasRepository
            .createQueryBuilder('sc')
            .where('sc.space_id = :spaceId', { spaceId })
            // use DB column name
            .select('MAX(sc.sort_order)', 'maxOrder')
            .getRawOne()

        const nextSortOrder = (maxSortOrder?.maxOrder || 0) + 1

        return await this.dataSource.transaction(async (manager: EntityManager) => {
            const canvasRepo = manager.getRepository(Canvas)
            const spaceCanvasRepo = manager.getRepository(SpaceCanvas)

            // Create canvas
            const versionGroupId = randomUUID()
            const canvas = canvasRepo.create({
                name: data.name || 'New Canvas',
                flowData: data.flowData || '{}',
                versionGroupId,
                versionUuid: randomUUID(),
                versionLabel: 'v1',
                versionIndex: 1,
                isActive: true
            })
            const savedCanvas = await canvasRepo.save(canvas)

            // Link to space
            const spaceCanvas = spaceCanvasRepo.create({
                space: { id: spaceId } as any,
                canvas: savedCanvas,
                versionGroupId,
                sortOrder: nextSortOrder
            })
            await spaceCanvasRepo.save(spaceCanvas)

            return toCanvasResponse(savedCanvas, nextSortOrder)
        })
    }

    /**
     * Update canvas
     */
    async updateCanvas(unikId: string, canvasId: string, data: UpdateCanvasDto): Promise<CanvasResponse | null> {
        // Verify canvas exists and belongs to unik
        const spaceCanvas = await this.spaceCanvasRepository
            .createQueryBuilder('sc')
            .leftJoinAndSelect('sc.canvas', 'canvas')
            .leftJoin('sc.space', 'space')
            .where('sc.canvas_id = :canvasId', { canvasId })
            .andWhere('space.unik_id = :unikId', { unikId })
            .getOne()

        if (!spaceCanvas) {
            return null
        }

        // Update canvas
        await this.canvasRepository.update(canvasId, {
            ...data,
            updatedDate: new Date()
        })

        // Get updated canvas
        const updatedCanvas = await this.canvasRepository.findOne({ where: { id: canvasId } })

        if (!updatedCanvas) {
            return null
        }

        return toCanvasResponse(updatedCanvas, spaceCanvas.sortOrder)
    }

    /**
     * Delete canvas
     */
    async deleteCanvas(unikId: string, canvasId: string): Promise<boolean> {
        // Verify canvas exists and belongs to unik (and get owning space link)
        const spaceCanvas = await this.spaceCanvasRepository
            .createQueryBuilder('sc')
            .leftJoinAndSelect('sc.space', 'space')
            .where('sc.canvas_id = :canvasId', { canvasId })
            .andWhere('space.unik_id = :unikId', { unikId })
            .getOne()

        if (!spaceCanvas) {
            return false
        }

        const versionGroupId = spaceCanvas.versionGroupId

        // Check if this is the last canvas in the space
        const canvasCount = await this.spaceCanvasRepository.count({
            where: { space: { id: spaceCanvas.space.id } }
        })

        if (canvasCount <= 1) {
            throw new Error('Cannot delete the last canvas in a space')
        }

        return await this.dataSource.transaction(async (manager: EntityManager) => {
            // 1) Remove the space<->canvas link first to avoid FK issues on DBs without ON DELETE CASCADE
            await manager.delete(SpaceCanvas, { id: spaceCanvas.id })

            // 2) Remove all canvas versions tied to this group
            await manager
                .createQueryBuilder()
                .delete()
                .from(Canvas)
                .where('version_group_id = :versionGroupId', { versionGroupId })
                .execute()

            // 3) Renumber remaining canvases in this space to keep sort_order contiguous
            const remainingCanvases = await manager
                .createQueryBuilder(SpaceCanvas, 'sc')
                .where('sc.space_id = :spaceId', { spaceId: spaceCanvas.space.id })
                .orderBy('sc.sort_order', 'ASC')
                .getMany()

            for (let i = 0; i < remainingCanvases.length; i++) {
                await manager.update(SpaceCanvas, remainingCanvases[i].id, { sortOrder: i + 1 })
            }

            return true
        })
    }

    /**
     * List versions for a canvas group
     */
    async getCanvasVersions(
        unikId: string,
        spaceId: string,
        canvasId: string
    ): Promise<CanvasVersionResponse[] | null> {
        const canvas = await this.loadCanvasForSpace(unikId, spaceId, canvasId)
        if (!canvas) {
            return null
        }

        const versions = await this.canvasRepository.find({
            where: { versionGroupId: canvas.versionGroupId },
            order: { versionIndex: 'ASC', createdDate: 'ASC' }
        })

        return versions.map(toCanvasVersionResponse)
    }

    /**
     * Create a new version snapshot for a canvas group
     */
    async createCanvasVersion(
        unikId: string,
        spaceId: string,
        canvasId: string,
        data: CreateCanvasVersionDto
    ): Promise<CanvasVersionResponse | null> {
        return this.dataSource.transaction(async (manager: EntityManager) => {
            const baseCanvas = await this.loadCanvasForSpace(unikId, spaceId, canvasId, manager)
            if (!baseCanvas) {
                return null
            }

            const canvasRepo = manager.getRepository(Canvas)
            const spaceCanvasRepo = manager.getRepository(SpaceCanvas)

            if (data.activate) {
                await canvasRepo
                    .createQueryBuilder()
                    .update(Canvas)
                    .set({ isActive: false })
                    .where('version_group_id = :versionGroupId', { versionGroupId: baseCanvas.versionGroupId })
                    .execute()
            }

            const nextIndexRaw = await canvasRepo
                .createQueryBuilder('canvas')
                .select('COALESCE(MAX(canvas.version_index), 0) + 1', 'nextIndex')
                .where('canvas.version_group_id = :versionGroupId', { versionGroupId: baseCanvas.versionGroupId })
                .getRawOne<{ nextIndex?: string }>()

            const nextIndex = Number(nextIndexRaw?.nextIndex ?? 1)
            const trimmedLabel = data.label?.trim()
            const trimmedDescription = data.description?.trim()

            const {
                id,
                createdDate,
                updatedDate,
                spaceCanvases,
                versionUuid,
                versionLabel,
                versionDescription,
                versionIndex,
                isActive,
                ...baseCanvasRest
            } = baseCanvas

            const newCanvas = canvasRepo.create({
                ...baseCanvasRest,
                versionGroupId: baseCanvas.versionGroupId,
                versionUuid: randomUUID(),
                versionLabel: trimmedLabel && trimmedLabel.length > 0 ? trimmedLabel : `v${nextIndex}`,
                versionDescription: trimmedDescription || undefined,
                versionIndex: nextIndex,
                isActive: Boolean(data.activate)
            })

            const savedCanvas = await canvasRepo.save(newCanvas)

            if (data.activate) {
                await spaceCanvasRepo
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({ canvas: { id: savedCanvas.id } as any })
                    .where('space_id = :spaceId', { spaceId })
                    .andWhere('version_group_id = :versionGroupId', { versionGroupId: baseCanvas.versionGroupId })
                    .execute()

                // Keep group publication links pointing to the newly activated version
                await this.publishLinkService.updateGroupTarget(baseCanvas.versionGroupId, savedCanvas.id, manager)
            }

            return toCanvasVersionResponse(savedCanvas)
        })
    }

    /**
     * Update metadata for a specific canvas version
     */
    async updateCanvasVersion(
        unikId: string,
        spaceId: string,
        canvasId: string,
        versionId: string,
        data: UpdateCanvasVersionDto
    ): Promise<CanvasVersionResponse | null> {
        return this.dataSource.transaction(async (manager: EntityManager) => {
            const reference = await this.loadCanvasForSpace(unikId, spaceId, canvasId, manager)
            if (!reference) {
                return null
            }

            const target = await this.loadCanvasForSpace(unikId, spaceId, versionId, manager)
            if (!target) {
                return null
            }

            if (reference.versionGroupId !== target.versionGroupId) {
                throw new Error('Requested version does not belong to the canvas group')
            }

            const canvasRepo = manager.getRepository(Canvas)

            if (data.label !== undefined) {
                const trimmedLabel = data.label?.trim()
                target.versionLabel = trimmedLabel && trimmedLabel.length > 0
                    ? trimmedLabel
                    : `v${target.versionIndex}`
            }

            if (data.description !== undefined) {
                const trimmedDescription = data.description?.trim()
                target.versionDescription = trimmedDescription && trimmedDescription.length > 0
                    ? trimmedDescription
                    : undefined
            }

            target.updatedDate = new Date()

            const saved = await canvasRepo.save(target)
            return toCanvasVersionResponse(saved)
        })
    }

    /**
     * Activate a specific canvas version within a group
     */
    async activateCanvasVersion(
        unikId: string,
        spaceId: string,
        canvasId: string,
        versionId: string
    ): Promise<CanvasResponse | null> {
        return this.dataSource.transaction(async (manager: EntityManager) => {
            const reference = await this.loadCanvasForSpace(unikId, spaceId, canvasId, manager)
            if (!reference) {
                return null
            }

            const target = await this.loadCanvasForSpace(unikId, spaceId, versionId, manager)
            if (!target) {
                return null
            }

            if (reference.versionGroupId !== target.versionGroupId) {
                throw new Error('Requested version does not belong to the canvas group')
            }

            const canvasRepo = manager.getRepository(Canvas)
            const spaceCanvasRepo = manager.getRepository(SpaceCanvas)

            await canvasRepo
                .createQueryBuilder()
                .update(Canvas)
                .set({ isActive: false })
                .where('version_group_id = :versionGroupId', { versionGroupId: reference.versionGroupId })
                .execute()

            await canvasRepo
                .createQueryBuilder()
                .update(Canvas)
                .set({ isActive: true })
                .where('id = :versionId', { versionId })
                .execute()

            await spaceCanvasRepo
                .createQueryBuilder()
                .update(SpaceCanvas)
                .set({ canvas: { id: versionId } as any })
                .where('space_id = :spaceId', { spaceId })
                .andWhere('version_group_id = :versionGroupId', { versionGroupId: reference.versionGroupId })
                .execute()

            await this.publishLinkService.updateGroupTarget(reference.versionGroupId, versionId, manager)

            const active = await canvasRepo.findOne({ where: { id: versionId } })
            if (!active) {
                return null
            }

            const mapping = await spaceCanvasRepo
                .createQueryBuilder('sc')
                .where('sc.space_id = :spaceId', { spaceId })
                .andWhere('sc.version_group_id = :versionGroupId', { versionGroupId: reference.versionGroupId })
                .getOne()

            return toCanvasResponse(active, mapping?.sortOrder ?? 1)
        })
    }

    /**
     * Delete a non-active canvas version
     */
    async deleteCanvasVersion(
        unikId: string,
        spaceId: string,
        canvasId: string,
        versionId: string
    ): Promise<boolean> {
        return this.dataSource.transaction(async (manager: EntityManager) => {
            const reference = await this.loadCanvasForSpace(unikId, spaceId, canvasId, manager)
            if (!reference) {
                return false
            }

            const target = await this.loadCanvasForSpace(unikId, spaceId, versionId, manager)
            if (!target || target.versionGroupId !== reference.versionGroupId) {
                return false
            }

            if (target.isActive) {
                throw new Error('Cannot delete the active version. Activate another version first.')
            }

            const canvasRepo = manager.getRepository(Canvas)
            const versionCount = await canvasRepo.count({ where: { versionGroupId: reference.versionGroupId } })
            if (versionCount <= 1) {
                throw new Error('Cannot delete the last version of a canvas')
            }

            await manager.delete(Canvas, { id: target.id })
            return true
        })
    }

    /**
     * Reorder canvases in a space
     */
    async reorderCanvases(unikId: string, spaceId: string, data: ReorderCanvasesDto): Promise<boolean> {
        // Verify space exists and belongs to unik
        const space = await this.spaceRepository.findOne({
            where: { id: spaceId, unik: { id: unikId } }
        })

        if (!space) {
            return false
        }

        // Update sort orders atomically, avoiding unique constraint conflicts by using a two-phase update
        await this.dataSource.transaction(async (manager: EntityManager) => {
            // Phase 1: shift to temporary high values
            for (const { canvasId, sortOrder } of data.canvasOrders) {
                await manager
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({ sortOrder: sortOrder + 1000 })
                    .where('canvas_id = :canvasId', { canvasId })
                    .andWhere('space_id = :spaceId', { spaceId })
                    .execute()
            }
            // Phase 2: set final values
            for (const { canvasId, sortOrder } of data.canvasOrders) {
                await manager
                    .createQueryBuilder()
                    .update(SpaceCanvas)
                    .set({ sortOrder })
                    .where('canvas_id = :canvasId', { canvasId })
                    .andWhere('space_id = :spaceId', { spaceId })
                    .execute()
            }
        })

        return true
    }

    /**
     * Check if space exists and belongs to unik
     */
    async spaceExists(unikId: string, spaceId: string): Promise<boolean> {
        const count = await this.spaceRepository.count({
            where: { id: spaceId, unik: { id: unikId } }
        })
        return count > 0
    }

    /**
     * Check if canvas exists and belongs to unik
     */
    async canvasExists(unikId: string, canvasId: string): Promise<boolean> {
        const count = await this.spaceCanvasRepository
            .createQueryBuilder('sc')
            .leftJoin('sc.space', 'space')
            .where('sc.canvas_id = :canvasId', { canvasId })
            .andWhere('space.unik_id = :unikId', { unikId })
            .getCount()

        return count > 0
    }
}
