import { Request, Response } from 'express'
import logger from '../utils/logger'
import { FlowDataService } from '../services/FlowDataService'
import { PublishLinkService } from '../services/PublishLinkService'
import {
    CreatePublishLinkDto,
    PublishLinkQuery,
    UpdatePublishLinkDto
} from '../types/publishLink.types'
import { PublishCanvas } from '../database/entities'

function resolveTechnology(value: unknown): PublishCanvas['technology'] {
    const normalized = String(value ?? 'generic').toLowerCase()
    if (normalized === 'arjs' || normalized === 'playcanvas') {
        return normalized
    }
    return 'generic'
}

export class PublishController {
    constructor(
        private readonly flowDataService: FlowDataService,
        private readonly publishLinkService: PublishLinkService
    ) {}

    async createPublishLink(req: Request, res: Response): Promise<void> {
        try {
            const body = req.body as Partial<CreatePublishLinkDto>
            if (!body?.unikId) {
                res.status(400).json({ success: false, error: 'unikId is required' })
                return
            }

            const payload: CreatePublishLinkDto = {
                unikId: body.unikId,
                spaceId: body.spaceId ?? null,
                technology: resolveTechnology(body.technology),
                versionGroupId: body.versionGroupId ?? null,
                targetCanvasId: body.targetCanvasId ?? null,
                targetVersionUuid: body.targetVersionUuid ?? null,
                customSlug: body.customSlug ?? null,
                isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : true
            }

            const link = await this.publishLinkService.createLink(payload)
            res.status(201).json({ success: true, data: link })
        } catch (error) {
            logger.error('[PublishController] createPublishLink error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create publish link'
            })
        }
    }

    async listPublishLinks(req: Request, res: Response): Promise<void> {
        try {
            const unikId = String(req.query.unikId ?? '')
            if (!unikId) {
                res.status(400).json({ success: false, error: 'unikId query param is required' })
                return
            }

            const query: PublishLinkQuery = {
                unikId,
                spaceId: req.query.spaceId ? String(req.query.spaceId) : undefined,
                technology: req.query.technology
                    ? resolveTechnology(req.query.technology)
                    : undefined,
                versionGroupId: req.query.versionGroupId ? String(req.query.versionGroupId) : undefined,
                targetVersionUuid: req.query.targetVersionUuid
                    ? String(req.query.targetVersionUuid)
                    : undefined
            }

            const links = await this.publishLinkService.listLinks(query)
            res.status(200).json({ success: true, data: links })
        } catch (error) {
            logger.error('[PublishController] listPublishLinks error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch publish links'
            })
        }
    }

    async updatePublishLink(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id
            if (!id) {
                res.status(400).json({ success: false, error: 'id param is required' })
                return
            }

            const payload: UpdatePublishLinkDto = {
                customSlug: req.body?.customSlug ?? undefined,
                isPublic: typeof req.body?.isPublic === 'boolean' ? req.body.isPublic : undefined,
                targetCanvasId: req.body?.targetCanvasId ?? undefined,
                targetVersionUuid: req.body?.targetVersionUuid ?? undefined
            }

            const updated = await this.publishLinkService.updateLink(id, payload)
            if (!updated) {
                res.status(404).json({ success: false, error: 'Publish link not found' })
                return
            }

            res.status(200).json({ success: true, data: updated })
        } catch (error) {
            logger.error('[PublishController] updatePublishLink error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update publish link'
            })
        }
    }

    async deletePublishLink(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id
            if (!id) {
                res.status(400).json({ success: false, error: 'id param is required' })
                return
            }

            const removed = await this.publishLinkService.deleteLink(id)
            if (!removed) {
                res.status(404).json({ success: false, error: 'Publish link not found' })
                return
            }

            res.status(200).json({ success: true })
        } catch (error) {
            logger.error('[PublishController] deletePublishLink error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete publish link'
            })
        }
    }

    async getPublicPublicationBySlug(req: Request, res: Response): Promise<void> {
        const slug = req.params.slug
        if (!slug) {
            res.status(400).json({ success: false, error: 'slug param is required' })
            return
        }

        try {
            const flowData = await this.flowDataService.getFlowDataBySlug(slug)
            res.status(200).json({
                success: true,
                publicationId: slug,
                projectName: flowData.canvas?.name || `UPDL Canvas ${slug}`,
                generationMode: 'streaming',
                flowData: flowData.flowData,
                libraryConfig: flowData.libraryConfig,
                renderConfig: flowData.renderConfig,
                playcanvasConfig: flowData.playcanvasConfig,
                technology: flowData.technology,
                canvasId: flowData.canvas?.id,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error('[PublishController] getPublicPublicationBySlug error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to load publication'
            })
        }
    }

    // Legacy endpoints retained for compatibility
    public async publishARJS(req: Request, res: Response): Promise<void> {
        logger.info('[PublishController] publishARJS legacy endpoint invoked')

        const canvasId = req.body?.canvasId
        const generationMode = req.body?.generationMode || 'streaming'
        const projectName = req.body?.projectName || `AR.js for ${canvasId}`
        const isPublic = req.body?.isPublic !== false

        if (!canvasId) {
            res.status(400).json({ success: false, error: 'Missing required parameter: canvasId' })
            return
        }

        try {
            const link = await this.publishLinkService.ensureGroupLinkForCanvas(canvasId, 'arjs')
            if (!isPublic && link.id) {
                await this.publishLinkService.updateLink(link.id, { isPublic: false })
            }

            res.status(200).json({
                success: true,
                publicationId: link.customSlug || link.baseSlug,
                canvasId,
                projectName,
                generationMode,
                isPublic: isPublic && link.isPublic,
                createdAt: link.createdAt.toISOString()
            })
        } catch (error) {
            logger.error('[PublishController] publishARJS error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to publish AR.js project'
            })
        }
    }

    public async getPublicARJSPublication(req: Request, res: Response): Promise<void> {
        const identifier = req.params.publicationId
        if (!identifier) {
            res.status(400).json({ success: false, error: 'publicationId is required' })
            return
        }

        try {
            let flowData
            try {
                flowData = await this.flowDataService.getFlowDataBySlug(identifier)
            } catch (slugError) {
                logger.warn('[PublishController] getPublicARJSPublication slug lookup failed, trying canvas fallback', slugError)
                flowData = await this.flowDataService.getFlowData(identifier)
            }

            res.status(200).json({
                success: true,
                publicationId: identifier,
                flowData: flowData.flowData,
                libraryConfig: flowData.libraryConfig,
                renderConfig: flowData.renderConfig,
                playcanvasConfig: flowData.playcanvasConfig,
                technology: flowData.technology,
                canvasId: flowData.canvas?.id,
                projectName: flowData.canvas?.name || `UPDL Canvas ${identifier}`
            })
        } catch (error) {
            logger.error('[PublishController] getPublicARJSPublication error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to load publication'
            })
        }
    }

    public async streamUPDL(req: Request, res: Response): Promise<void> {
        const slug = req.params.slug || req.params.canvasId || req.params.publicationId
        if (!slug) {
            res.status(400).json({ success: false, error: 'Missing identifier' })
            return
        }

        try {
            let flowData
            try {
                flowData = await this.flowDataService.getFlowDataBySlug(slug)
            } catch (slugError) {
                logger.warn('[PublishController] streamUPDL slug lookup failed, trying canvas fallback', slugError)
                flowData = await this.flowDataService.getFlowData(slug)
            }

            res.status(200).json({
                success: true,
                publicationId: slug,
                projectName: flowData.canvas?.name || `UPDL Canvas ${slug}`,
                generationMode: 'streaming',
                flowData: flowData.flowData,
                libraryConfig: flowData.libraryConfig,
                renderConfig: flowData.renderConfig,
                playcanvasConfig: flowData.playcanvasConfig,
                technology: flowData.technology,
                canvasId: flowData.canvas?.id,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error('[PublishController] streamUPDL error:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to retrieve flow data'
            })
        }
    }

    public async getGlobalSettings(req: Request, res: Response): Promise<void> {
        logger.info('[PublishController] getGlobalSettings called')
        try {
            const globalLibraryManagement = process.env.PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT === 'true'
            const enforceGlobalLibraryManagement = process.env.PUBLISH_ENFORCE_GLOBAL_LIBRARY_MANAGEMENT === 'true'
            const autoCorrectLegacySettings = process.env.PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS === 'true'
            const defaultLibrarySource = process.env.PUBLISH_DEFAULT_LIBRARY_SOURCE || 'kiberplano'

            res.setHeader('Content-Type', 'application/json')
            res.status(200).json({
                success: true,
                data: {
                    enableGlobalLibraryManagement: globalLibraryManagement,
                    enforceGlobalLibraryManagement: enforceGlobalLibraryManagement,
                    autoCorrectLegacySettings: autoCorrectLegacySettings,
                    defaultLibrarySource: defaultLibrarySource
                }
            })
        } catch (error) {
            logger.error('[PublishController] Error in getGlobalSettings:', error)

            res.setHeader('Content-Type', 'application/json')
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve global settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}
