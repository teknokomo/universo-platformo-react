// Universo Platformo | Publication routes
import express, { Router } from 'express'
// Use import with alias to avoid conflict with PublishController.ts
import { publishController } from '../controllers/publishController'
import { authMiddleware } from '../middlewares/authMiddleware'
import logger from '../utils/logger'

const router: Router = express.Router()

// Universo Platformo | Add request logging middleware for all routes in this file
router.use((req, res, next) => {
    logger.info(`[PUBLISH ROUTES] Request received. Method: ${req.method}, Original URL: ${req.originalUrl}, Path: ${req.path}`)
    if (req.body && Object.keys(req.body).length > 0) {
        logger.debug(`[PUBLISH ROUTES] Request Body: ${JSON.stringify(req.body)}`)
    }
    if (req.params && Object.keys(req.params).length > 0) {
        logger.debug(`[PUBLISH ROUTES] Request Params: ${JSON.stringify(req.params)}`)
    }
    if (req.query && Object.keys(req.query).length > 0) {
        logger.debug(`[PUBLISH ROUTES] Request Query: ${JSON.stringify(req.query)}`)
    }
    next()
})

/**
 * @route   POST /publish/projects
 * @desc    Publishes a project - This seems like a generic publish route, might need differentiation or its own controller if logic is different
 * @access  Public
 */
// router.post('/projects', projectPublishController.publishProject)

/**
 * @route   GET /publish/projects
 * @desc    Gets a list of published projects
 * @access  Public
 */
// router.get('/projects', projectPublishController.getPublishedProjects)

/**
 * @route   GET /publish/projects/:id
 * @desc    Gets a published project by ID
 * @access  Public
 */
// router.get('/projects/:id', projectPublishController.getPublishedProject)

// Маршруты публикации AR.js
// 1. Создание новой публикации AR.js (защищен авторизацией)
router.post('/arjs', authMiddleware, (req, res) => publishController.publishARJS(req, res))

// 2. Получение списка публикаций AR.js для конкретного chatflow (защищен авторизацией)
router.get('/arjs/chatflow/:chatflowId', authMiddleware, (req, res) => publishController.getARJSPublications(req, res))

// 3. Получение публичной публикации AR.js по ID (публичный доступ)
router.get('/arjs/public/:publicationId', (req, res) => publishController.getPublicARJSPublication(req, res))

// 4. Удаление публикации AR.js (защищен авторизацией)
router.delete('/arjs/:publicationId', authMiddleware, (req, res) => publishController.deleteARJSPublication(req, res))

// 5. Обновление публикации AR.js (защищен авторизацией)
router.patch('/arjs/:publicationId', authMiddleware, (req, res) => publishController.updateARJSPublication(req, res))

export default router
