// Universo Platformo | Publish Routes Factory
// Creates publish routes with dependency injection for DataSource
// REFACTORED: Using lazy initialization pattern like profile-srv

import express, { Router, Request, Response } from 'express'
import { DataSource } from 'typeorm'
import { PublishController } from '../controllers/publishController'
import { FlowDataService } from '../services/FlowDataService'
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
        return new PublishController(flowDataService)
    }

    /**
     * @route   POST /arjs
     * @desc    Создает новую публикацию AR.js (только метаданные)
     * @body    { chatflowId: string, generationMode: string, isPublic: boolean, projectName: string }
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
     * @desc    Возвращает данные UPDL сцены для публичной AR.js публикации
     * @param   publicationId - ID публикации (равен chatflowId)
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
     * @route   GET /arjs/stream/:chatflowId
     * @desc    Прямой запрос к потоковой генерации UPDL сцены
     * @param   chatflowId - ID чатфлоу для генерации сцены
     */
    router.get('/arjs/stream/:chatflowId', async (req: Request, res: Response) => {
        try {
            const controller = await getController()
            return await controller.streamUPDL(req, res)
        } catch (error) {
            logger.error('[createPublishRoutes] Error in GET /arjs/stream/:chatflowId:', error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during UPDL streaming'
            })
        }
    })

    return router
}

export default createPublishRoutes
