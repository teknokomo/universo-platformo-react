// Universo Platformo | Publish Routes Factory
// Creates publish routes with dependency injection for DataSource
// REFACTORED: Using lazy initialization pattern like profile-backend

import express, { Router, Request, Response } from 'express'
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit'
import { DataSource } from 'typeorm'
import { PublishController } from '../controllers/publishController'
import { FlowDataService } from '../services/FlowDataService'
import { PublishLinkService } from '../services/PublishLinkService'
import { getPublicationCaptchaConfig } from '../services/captchaService'
import { renderQuizHtml } from '../services/quizRenderService'
import logger from '../utils/logger'

/**
 * Creates publish routes with injected DataSource
 * This factory pattern breaks circular dependencies by accepting DataSource at runtime
 * ARCHITECTURE: Uses lazy controller initialization to ensure DataSource is ready
 *
 * @param dataSource Initialized TypeORM DataSource from main server
 * @returns Express Router with configured publish routes
 */
export function createPublishRoutes(dataSource: DataSource): Router {
    const router: Router = express.Router()

    // Rate limiting (MVP, conservative defaults)
    // Note: ensure app.set('trust proxy', 1) at the server entry if behind a proxy
    const createRateLimitHandler = (type: 'read' | 'write'): RateLimitRequestHandler =>
        rateLimit({
            windowMs: 60 * 1000,
            max: type === 'read' ? 200 : 60,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const limitInfo = (req as any).rateLimit
                const resetMs = limitInfo?.resetTime ? Math.max(0, limitInfo.resetTime.getTime() - Date.now()) : 60_000
                const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000))

                res.set({
                    'Retry-After': retryAfterSeconds.toString(),
                    'X-RateLimit-Limit': String(limitInfo?.limit ?? 0),
                    'X-RateLimit-Remaining': String(limitInfo?.remaining ?? 0),
                    'X-RateLimit-Reset': limitInfo?.resetTime ? limitInfo.resetTime.toISOString() : ''
                })

                logger.warn(`[publish:${type}] rate limit exceeded for ${req.ip} (${limitInfo?.current}/${limitInfo?.limit})`)

                res.status(429).json({ success: false, error: 'Too many requests, please try again later.' })
            }
        })

    const writeLimiter = createRateLimitHandler('write')
    const readLimiter = createRateLimitHandler('read')

    // Helper to create controller lazily after DataSource is ready
    const getController = async (): Promise<PublishController> => {
        // Ensure DataSource is initialized before creating repository
        if (!dataSource.isInitialized) {
            logger.info('[createPublishRoutes] DataSource not initialized, initializing...')
            await dataSource.initialize()
            logger.info('[createPublishRoutes] DataSource initialized successfully')
        }

        // Create services with initialized DataSource
        const flowDataService = new FlowDataService(dataSource)
        const publishLinkService = new PublishLinkService(dataSource)
        return new PublishController(flowDataService, publishLinkService)
    }

    router.post('/links', writeLimiter, async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.createPublishLink(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in POST /links:', error)
            res.status(500).json({ success: false, error: 'Failed to create publish link' })
        }
    })

    router.get('/links', readLimiter, async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.listPublishLinks(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /links:', error)
            res.status(500).json({ success: false, error: 'Failed to load publish links' })
        }
    })

    router.patch('/links/:id', writeLimiter, async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.updatePublishLink(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in PATCH /links/:id:', error)
            res.status(500).json({ success: false, error: 'Failed to update publish link' })
        }
    })

    router.delete('/links/:id', writeLimiter, async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.deletePublishLink(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in DELETE /links/:id:', error)
            res.status(500).json({ success: false, error: 'Failed to delete publish link' })
        }
    })

    router.get('/public/:slug', readLimiter, async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.getPublicPublicationBySlug(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /public/:slug:', error)
            res.status(500).json({ success: false, error: 'Failed to load publication' })
        }
    })

    /**
     * @route   POST /arjs
     * @desc    Creates a new AR.js publication (metadata only)
     * @body    { canvasId: string, generationMode: string, isPublic: boolean, projectName: string }
     */
    router.post('/arjs', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.publishARJS(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in POST /arjs:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during publication creation'
            })
        }
    })

    /**
     * @route   GET /arjs/public/:publicationId
     * @desc    Returns UPDL scene data for a public AR.js publication by slug
     * @param   publicationId - Base58 publication slug (parameter name kept for legacy compatibility)
     */
    router.get('/arjs/public/:publicationId', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.getPublicARJSPublication(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /arjs/public/:publicationId:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during publication retrieval'
            })
        }
    })

    /**
     * @route   GET /canvas/:canvasId
     * @desc    Streams UPDL scene data for a public canvas publication by slug
     * @param   canvasId - Base58 publication slug (parameter name kept for legacy compatibility)
     */
    router.get('/canvas/:canvasId', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.streamUPDL(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /canvas/:canvasId:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during UPDL streaming'
            })
        }
    })

    // ========================================
    // NEW CANVAS-BASED ROUTES
    // ========================================

    /**
     * @route   POST /canvas
     * @desc    Creates a new canvas publication (new format)
     * @body    { canvasId: string, generationMode: string, isPublic: boolean, projectName: string }
     */
    router.post('/canvas', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.publishARJS(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in POST /canvas:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during canvas publication creation'
            })
        }
    })

    /**
     * @route   GET /canvas/public/:canvasId
     * @desc    Returns UPDL scene data for a public canvas publication by slug (new format)
     * @param   canvasId - Base58 publication slug (parameter name kept for legacy compatibility)
     */
    router.get('/canvas/public/:canvasId', async (req: Request, res: Response) => {
        try {
            // Map canvasId to publicationId for controller compatibility
            req.params.publicationId = req.params.canvasId
            const controller = await getController()
            return await controller.getPublicARJSPublication(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /canvas/public/:canvasId:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during canvas publication retrieval'
            })
        }
    })

    // ========================================
    // REDIRECT ROUTES (Legacy to New)
    // ========================================

    /**
     * @route   GET /settings/global
     * @desc    Получить глобальные настройки публикации
     */
    router.get('/settings/global', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            await controller.getGlobalSettings(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in /settings/global:', error)
            res.setHeader('Content-Type', 'application/json')
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    })

    /**
     * @route   GET /captcha/config
     * @desc    Get captcha configuration for published content (quizzes, AR experiences)
     * @access  Public (needed by Space Builder UI to show/hide captcha options)
     */
    router.get('/captcha/config', readLimiter, async (_req: Request, res: Response) => {
        try {
            const config = getPublicationCaptchaConfig()
            logger.info('[createPublishRoutes] Captcha config requested:', { enabled: config.enabled })
            res.json({
                success: true,
                data: config
            })
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /captcha/config:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to get captcha configuration'
            })
        }
    })

    /**
     * @route   GET /render/:slug
     * @desc    Render and serve quiz HTML for a publication slug
     * @access  Public (served in iframe on /p/:slug pages)
     * 
     * This endpoint generates quiz HTML on the server to ensure:
     * - Proper domain origin for Yandex SmartCaptcha (not blob: or about:srcdoc)
     * - Consistent rendering across all clients
     */
    router.get('/render/:slug', readLimiter, async (req: Request, res: Response) => {
        const slug = req.params.slug
        if (!slug) {
            res.status(400).send('<!-- Error: slug parameter is required -->')
            return
        }

        try {
            const controller = await getController()
            const flowDataService = (controller as any).flowDataService as FlowDataService

            // Get flow data by slug
            const flowDataResult = await flowDataService.getFlowDataBySlug(slug)
            
            logger.info('[createPublishRoutes] Rendering quiz for slug:', {
                slug,
                canvasName: flowDataResult.canvas?.name,
                canvasId: flowDataResult.canvas?.id
            })

            // Render HTML on server
            const renderResult = await renderQuizHtml({
                flowData: flowDataResult.flowData,
                projectName: flowDataResult.canvas?.name || `Quiz ${slug}`,
                canvasId: flowDataResult.canvas?.id,
                libraryConfig: flowDataResult.libraryConfig,
                renderConfig: flowDataResult.renderConfig
            })

            if (!renderResult.success || !renderResult.html) {
                logger.error('[createPublishRoutes] Quiz render failed:', { error: renderResult.error })
                res.status(500).send(`<!-- Error: ${renderResult.error || 'Failed to render quiz'} -->`)
                return
            }

            // Serve HTML with proper content type
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            res.send(renderResult.html)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('[createPublishRoutes] Error in GET /render/:slug:', { error: errorMessage })
            res.status(404).send(`<!-- Error: ${errorMessage} -->`)
        }
    })

    return router
}

export default createPublishRoutes
