// Universo Platformo | Publication controller
import { Request, Response } from 'express'
import path from 'path'
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

/**
 * Контроллер для работы с публикациями AR.js через UPDL
 */
export class PublishController {
    /**
     * Публикация проекта AR.js
     * @param req Запрос
     * @param res Ответ
     */
    public async publishARJS(req: Request, res: Response): Promise<void> {
        logger.info(`[PublishController] publishARJS called with params: ${JSON.stringify(req.body)}`)
        try {
            const { chatflowId, generationMode = 'streaming', isPublic = true, projectName } = req.body

            if (!chatflowId) {
                // Явно устанавливаем заголовок контента
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: chatflowId'
                })
                return
            }

            // В режиме потоковой генерации используем сам chatflowId для упрощения
            const publicationId = chatflowId
            const createdAt = new Date().toISOString()

            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')

            // Возвращаем метаданные о публикации
            res.status(200).json({
                success: true,
                publicationId,
                chatflowId,
                projectName: projectName || `AR.js for ${chatflowId}`,
                generationMode,
                isPublic,
                createdAt
            })
        } catch (error) {
            logger.error(`[PublishController] Error publishing AR.js:`, error)

            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during publication'
            })
        }
    }

    /**
     * Получение публичных данных публикации AR.js по ID
     * @param req Запрос
     * @param res Ответ
     */
    public async getPublicARJSPublication(req: Request, res: Response): Promise<void> {
        logger.info(`[PublishController] getPublicARJSPublication called. PublicationId: ${req.params.publicationId}`)
        try {
            const { publicationId } = req.params

            if (!publicationId) {
                // Явно устанавливаем заголовок контента
                res.setHeader('Content-Type', 'application/json')
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: publicationId'
                })
                return
            }

            // Для режима потоковой генерации перенаправляем запрос к streamUPDL
            // Так как publicationId в streaming режиме = chatflowId
            req.params.chatflowId = publicationId
            logger.info(`[PublishController] Using streamUPDL for AR.js public data retrieval with ID: ${publicationId}`)
            return await this.streamUPDL(req, res)
        } catch (error) {
            logger.error(`[PublishController] Error in getPublicARJSPublication:`, error)

            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')

            res.status(500).json({
                success: false,
                error: 'Failed to fetch AR.js publication data',
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
        logger.info(`[PublishController] Request params: ${JSON.stringify(req.params)}`)
        logger.info(`[PublishController] Request URL: ${req.originalUrl}`)

        if (!id) {
            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')
            logger.error(`[PublishController] Missing ID parameter! URL: ${req.originalUrl}, params: ${JSON.stringify(req.params)}`)
            res.status(400).json({
                success: false,
                error: 'Missing ID parameter'
            })
            return
        }

        try {
            if (!utilBuildUPDLflow) {
                throw new Error('utilBuildUPDLflow is not available')
            }

            // Вызываем функцию для получения данных UPDL из узлов
            logger.info(`[PublishController] Calling utilBuildUPDLflow for id: ${id}`)
            const result = await utilBuildUPDLflow(id)

            if (!result) {
                logger.warn(`[PublishController] utilBuildUPDLflow returned no result for ${id}`)
                throw new Error(`Failed to build UPDL flow for ${id}`)
            }

            // Определяем, какую сцену использовать (предпочитаем updlScene)
            const sceneToUse = result.updlScene || result.scene

            if (!sceneToUse || !sceneToUse.objects || sceneToUse.objects.length === 0) {
                logger.warn(`[PublishController] utilBuildUPDLflow returned empty scene for ${id}`)

                // Если сцена пустая, возвращаем ошибку
                // Явно устанавливаем заголовок контента
                res.setHeader('Content-Type', 'application/json')
                res.status(404).json({
                    success: false,
                    error: 'UPDL scene not found or empty'
                })
                return
            }

            logger.info(`[PublishController] Successfully built UPDL scene with ${sceneToUse.objects?.length || 0} objects`)

            // Возвращаем данные сцены для UPDL-узлов
            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')
            res.status(200).json({
                success: true,
                publicationId: id,
                projectName: sceneToUse.name || `AR.js for ${id}`,
                generationMode: 'streaming',
                updlScene: sceneToUse,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(`[PublishController] Error in streamUPDL:`, error)
            logger.error(`[PublishController] Error details: ${error instanceof Error ? error.stack : String(error)}`)

            // В случае ошибки возвращаем ошибку
            // Явно устанавливаем заголовок контента
            res.setHeader('Content-Type', 'application/json')
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
