// Universo Platformo | Publication controller
import { Request, Response } from 'express'
import { PublishService } from '../services/publishService'
import { PublishRequest } from '../interfaces/PublishInterfaces'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { UPDLFlow } from './types'
import { UPDLSceneGraph } from '../interfaces/UPDLTypes'
import fetch from 'node-fetch'
import logger from '../utils/logger'

// Universo Platformo | Import buildUPDLflow функцию для потоковой генерации из UPDL-узлов
let utilBuildUPDLflow: any
{
    const baseDir = __dirname
    // Пытаемся загрузить из собранного dist
    try {
        const prodPath = path.resolve(baseDir, '../../../../../packages/server/dist/utils/buildUPDLflow')
        utilBuildUPDLflow = require(prodPath).utilBuildUPDLflow
        logger.info(`[PublishController] Imported utilBuildUPDLflow from ${prodPath}`)
    } catch (e1) {
        // Пытаемся загрузить из исходников src
        try {
            const devPath = path.resolve(baseDir, '../../../../../packages/server/src/utils/buildUPDLflow')
            utilBuildUPDLflow = require(devPath).utilBuildUPDLflow
            logger.info(`[PublishController] Imported utilBuildUPDLflow from ${devPath}`)
        } catch (e2) {
            logger.error('[PublishController] Failed to import utilBuildUPDLflow:', e2)
            logger.warn('[PublishController] utilBuildUPDLflow not available, streamUPDL fallback will be used')
        }
    }
}

const publishService = new PublishService()

/**
 * Publishes a project
 */
export const publishProject = async (req: Request, res: Response) => {
    try {
        const publishRequest: PublishRequest = req.body

        if (!publishRequest.projectId || !publishRequest.platform) {
            return res.status(400).json({
                error: 'Invalid request. projectId and platform are required.'
            })
        }

        const result = await publishService.publishProject(publishRequest)
        return res.status(201).json(result)
    } catch (error: any) {
        console.error('Error publishing project:', error)
        return res.status(500).json({
            error: 'Failed to publish project',
            message: error.message
        })
    }
}

/**
 * Gets a list of published projects
 */
export const getPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await publishService.getPublishedProjects()
        return res.json(projects)
    } catch (error: any) {
        console.error('Error fetching published projects:', error)
        return res.status(500).json({
            error: 'Failed to fetch published projects',
            message: error.message
        })
    }
}

/**
 * Gets a published project by ID
 */
export const getPublishedProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(400).json({ error: 'Project ID is required' })
        }

        const project = await publishService.getPublishedProject(id)

        if (!project) {
            return res.status(404).json({ error: 'Project not found' })
        }

        return res.json(project)
    } catch (error: any) {
        console.error(`Error fetching project ${req.params.id}:`, error)
        return res.status(500).json({
            error: 'Failed to fetch project',
            message: error.message
        })
    }
}

// ExportResult interface
interface ExportResult {
    format: 'html' | 'js' | 'jsx' | 'zip'
    mainFile: {
        filename: string
        content: string
    }
    assets?: any[]
}

// PublishResult interface
export interface PublishResult {
    success: boolean
    publishedUrl?: string
    error?: string
    metadata: {
        exporterId?: string
        timestamp: string
        options?: Record<string, any>
    }
}

/**
 * Контроллер для работы с публикациями
 */
export class PublishController {
    /**
     * Directory to store publication data
     */
    private publicationDir: string

    /**
     * Constructor
     */
    constructor(
        options: {
            publicationDir?: string
        } = {}
    ) {
        // Set publication directory (default: public/p)
        this.publicationDir = options.publicationDir || path.resolve(process.cwd(), 'public', 'p')

        // Create directory if it doesn't exist
        this.ensureDirectoriesExist()
    }

    /**
     * Create required directories if they don't exist
     */
    private ensureDirectoriesExist(): void {
        if (!fs.existsSync(this.publicationDir)) {
            fs.mkdirSync(this.publicationDir, { recursive: true })
        }
    }

    /**
     * Публикация проекта AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(
            `[PublishController] publishARJS called. Request body: ${JSON.stringify(req.body)}, Params: ${JSON.stringify(req.params)}`
        )
        try {
            const { chatflowId, generationMode, isPublic, projectName } = req.body

            if (!chatflowId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // Генерируем уникальный идентификатор публикации
            // В режиме потоковой генерации используем сам chatflowId для упрощения
            const publicationId = generationMode === 'streaming' ? chatflowId : uuidv4()
            const createdAt = new Date().toISOString()

            // Universo Platformo | Возвращаем метаданные о публикации
            res.status(200).json({
                success: true,
                publicationId,
                chatflowId,
                projectName: projectName || `AR.js for ${chatflowId}`,
                generationMode: generationMode || 'streaming',
                isPublic: isPublic !== undefined ? isPublic : true,
                createdAt
            })
        } catch (error) {
            logger.error(`[PublishController] Error publishing AR.js:`, error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during publication'
            })
        }
    }

    /**
     * Получение списка публикаций AR.js для chatflow
     * @param req Запрос
     * @param res Ответ
     */
    public async getARJSPublications(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(`[PublishController] getARJSPublications called. ChatflowId: ${req.params.chatflowId}`)
        try {
            const { chatflowId } = req.params

            if (!chatflowId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // В режиме потоковой генерации не храним данные в JSON-файлах
            // Возвращаем пустой массив, так как локальное хранение отключено
            res.status(200).json([])
        } catch (error) {
            console.error('Error fetching AR.js publications:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publications',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Получение публичных данных публикации AR.js по ID
     * @param req Запрос
     * @param res Ответ
     */
    public async getPublicARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(`[PublishController] getPublicARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // Для режима потоковой генерации перенаправляем запрос к streamUPDL
            // Так как publicationId в streaming режиме = chatflowId
            logger.info(`[PublishController] Using streamUPDL for AR.js public data retrieval in streaming mode`)
            return await this.streamUPDL(req, res)
        } catch (error) {
            console.error('Error fetching AR.js publication data:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publication data',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Удаление публикации AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async deleteARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(`[PublishController] deleteARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // В режиме потоковой генерации не храним данные в JSON-файлах,
            // поэтому просто возвращаем успешный ответ
            res.status(200).json({
                success: true,
                message: 'Publication deleted successfully'
            })
        } catch (error) {
            console.error('Error deleting AR.js publication:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to delete AR.js publication',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Обновление публикации AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async updateARJSPublication(req: Request, res: Response): Promise<void> {
        // Universo Platformo | Add logging
        logger.info(
            `[PublishController] updateARJSPublication called. PublicationId: ${req.params.publicationId}, Body: ${JSON.stringify(
                req.body
            )}`
        )
        try {
            const { publicationId } = req.params
            const updates = req.body

            if (!publicationId) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // В режиме потоковой генерации не храним данные в JSON-файлах,
            // возвращаем сообщение, что обновление недоступно
            res.status(400).json({
                success: false,
                error: 'Update not available in streaming mode'
            })
        } catch (error) {
            console.error('Error updating AR.js publication:', error)
            res.status(500).json({
                success: false,
                error: 'Failed to update AR.js publication',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Получает данные UPDL сцены для потоковой генерации AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async streamUPDL(req: Request, res: Response): Promise<void> {
        const id = req.params.chatflowId || req.params.publicationId
        logger.info(`[PublishController] streamUPDL called for ID: ${id}`)

        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Missing ID parameter'
            })
            return
        }

        try {
            // Вызываем модифицированную функцию, которая теперь работает только с ID
            logger.info(`[PublishController] Calling utilBuildUPDLflow for id: ${id}`)
            const result = await utilBuildUPDLflow(id)

            // Определяем, какую сцену использовать (предпочитаем updlScene)
            const sceneToUse = result.updlScene || result.scene

            if (!sceneToUse || !sceneToUse.objects || sceneToUse.objects.length === 0) {
                logger.warn(`[PublishController] utilBuildUPDLflow returned empty scene for ${id}`)

                // Если сцена пустая, возвращаем ошибку
                res.status(404).json({
                    success: false,
                    error: 'UPDL scene not found or empty'
                })
                return
            }

            // Возвращаем реальную сцену из UPDL-узлов
            res.status(200).json({
                ...result,
                publicationId: id,
                projectName: sceneToUse.name || `AR.js for ${id}`,
                generationMode: 'streaming',
                success: true,
                updlScene: sceneToUse,
                scene: sceneToUse
            })
        } catch (error) {
            logger.error(`[PublishController] Error in streamUPDL:`, error)

            // В случае ошибки возвращаем ошибку, а не демо-сцену
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve UPDL scene',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}

// Создаем экземпляр контроллера для использования в routes
export const publishController = new PublishController()
