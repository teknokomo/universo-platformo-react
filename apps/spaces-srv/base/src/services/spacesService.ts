import { Repository, DataSource, EntityManager } from 'typeorm'
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
    ChatflowType
} from '../types'

export class SpacesService {
    private _spaceRepository?: Repository<Space>
    private _canvasRepository?: Repository<Canvas>
    private _spaceCanvasRepository?: Repository<SpaceCanvas>
    private _getDataSourceFn: () => DataSource

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

            // Create space
            const space = spaceRepo.create({
                ...data,
                unik: { id: unikId } as any
            })
            const savedSpace = await spaceRepo.save(space)

            // Create default canvas
            const canvas = canvasRepo.create({
                name: 'Main Canvas',
                flowData: '{}'
            })
            const savedCanvas = await canvasRepo.save(canvas)

            // Link space and canvas
            const spaceCanvas = spaceCanvasRepo.create({
                space: savedSpace,
                canvas: savedCanvas,
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
                updatedDate: savedSpace.updatedDate
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

            const canvases: CanvasResponse[] = space.spaceCanvases?.map((sc: any) => ({
                id: sc.canvas.id,
                name: sc.canvas.name,
                sortOrder: sc.sortOrder,
                deployed: sc.canvas.deployed,
                isPublic: sc.canvas.isPublic,
                flowData: sc.canvas.flowData,
                apikeyid: sc.canvas.apikeyid,
                chatbotConfig: sc.canvas.chatbotConfig,
                apiConfig: sc.canvas.apiConfig,
                analytic: sc.canvas.analytic,
                speechToText: sc.canvas.speechToText,
                followUpPrompts: sc.canvas.followUpPrompts,
                category: sc.canvas.category,
                type: sc.canvas.type,
                createdDate: sc.canvas.createdDate,
                updatedDate: sc.canvas.updatedDate
            })) || []

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
            // Compatibility bridge: auto-provision Space and mapping if it doesn't exist yet
            const spaceCount = await this.spaceRepository.count({ where: { id: spaceId } })
            if (spaceCount === 0) {
                // If a canvas with the same id exists (legacy behavior), create a Space and link it
                const legacyCanvas = await this.canvasRepository.findOne({ where: { id: spaceId } })
                if (legacyCanvas) {
                    const newSpace = this.spaceRepository.create({
                        id: spaceId as any, // allow explicit id assignment for compatibility
                        name: legacyCanvas.name || 'Migrated Space',
                        description: null as any,
                        visibility: 'private',
                        unik: { id: unikId } as any
                    })
                    await this.spaceRepository.save(newSpace)

                    const mapping = this.spaceCanvasRepository.create({
                        space: { id: spaceId } as any,
                        canvas: { id: legacyCanvas.id } as any,
                        sortOrder: 1
                    })
                    await this.spaceCanvasRepository.save(mapping)
                    // eslint-disable-next-line no-console
                    console.info('[SpacesService] Created compatibility Space+mapping', { unikId, spaceId })
                }
            }

            const spaceCanvases = await this.spaceCanvasRepository
                .createQueryBuilder('sc')
                .leftJoinAndSelect('sc.canvas', 'canvas')
                .leftJoin('sc.space', 'sp')
                .where('sc.space_id = :spaceId', { spaceId })
                .andWhere('sp.unik_id = :unikId', { unikId })
                // use DB column name to avoid alias translation issues
                .orderBy('sc.sort_order', 'ASC')
                .getMany()

            return spaceCanvases.map((sc: any) => ({
                id: sc.canvas.id,
                name: sc.canvas.name,
                sortOrder: sc.sortOrder,
                flowData: sc.canvas.flowData,
                deployed: sc.canvas.deployed,
                isPublic: sc.canvas.isPublic,
                apikeyid: sc.canvas.apikeyid,
                chatbotConfig: sc.canvas.chatbotConfig,
                apiConfig: sc.canvas.apiConfig,
                analytic: sc.canvas.analytic,
                speechToText: sc.canvas.speechToText,
                followUpPrompts: sc.canvas.followUpPrompts,
                category: sc.canvas.category,
                type: sc.canvas.type,
                createdDate: sc.canvas.createdDate,
                updatedDate: sc.canvas.updatedDate
            }))
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

        const c = spaceCanvas.canvas
        return {
            id: c.id,
            name: c.name,
            sortOrder: spaceCanvas.sortOrder,
            flowData: c.flowData,
            deployed: c.deployed,
            isPublic: c.isPublic,
            apikeyid: c.apikeyid,
            chatbotConfig: c.chatbotConfig,
            apiConfig: c.apiConfig,
            analytic: c.analytic,
            speechToText: c.speechToText,
            followUpPrompts: c.followUpPrompts,
            category: c.category,
            type: c.type,
            createdDate: c.createdDate,
            updatedDate: c.updatedDate
        }
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
            const canvas = canvasRepo.create({
                name: data.name || 'New Canvas',
                flowData: data.flowData || '{}'
            })
            const savedCanvas = await canvasRepo.save(canvas)

            // Link to space
            const spaceCanvas = spaceCanvasRepo.create({
                space: { id: spaceId } as any,
                canvas: savedCanvas,
                sortOrder: nextSortOrder
            })
            await spaceCanvasRepo.save(spaceCanvas)

            return {
                id: savedCanvas.id,
                name: savedCanvas.name,
                sortOrder: nextSortOrder,
                flowData: savedCanvas.flowData,
                deployed: savedCanvas.deployed,
                isPublic: savedCanvas.isPublic,
                apikeyid: savedCanvas.apikeyid,
                chatbotConfig: savedCanvas.chatbotConfig,
                apiConfig: savedCanvas.apiConfig,
                analytic: savedCanvas.analytic,
                speechToText: savedCanvas.speechToText,
                followUpPrompts: savedCanvas.followUpPrompts,
                category: savedCanvas.category,
                type: savedCanvas.type,
                createdDate: savedCanvas.createdDate,
                updatedDate: savedCanvas.updatedDate
            }
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

        return {
            id: updatedCanvas.id,
            name: updatedCanvas.name,
            sortOrder: spaceCanvas.sortOrder,
            flowData: updatedCanvas.flowData,
            deployed: updatedCanvas.deployed,
            isPublic: updatedCanvas.isPublic,
            apikeyid: updatedCanvas.apikeyid,
            chatbotConfig: updatedCanvas.chatbotConfig,
            apiConfig: updatedCanvas.apiConfig,
            analytic: updatedCanvas.analytic,
            speechToText: updatedCanvas.speechToText,
            followUpPrompts: updatedCanvas.followUpPrompts,
            category: updatedCanvas.category,
            type: updatedCanvas.type,
            createdDate: updatedCanvas.createdDate,
            updatedDate: updatedCanvas.updatedDate
        }
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

            // 2) If the canvas is no longer linked to any space, delete the canvas entity itself
            const remainingLinks = await manager.count(SpaceCanvas, { where: { canvas: { id: canvasId } as any } })
            if (remainingLinks === 0) {
                await manager.delete(Canvas, { id: canvasId })
            }

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
