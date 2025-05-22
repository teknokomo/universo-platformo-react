// Universo Platformo | Publication routes
import express, { Router } from 'express'
import { publishController } from '../controllers/publishController'

const router: Router = express.Router()

/**
 * Маршруты AR.js публикации с потоковой генерацией
 */

/**
 * @route   POST /arjs
 * @desc    Создает новую публикацию AR.js (только метаданные)
 * @body    { chatflowId: string, generationMode: string, isPublic: boolean, projectName: string }
 */
router.post('/arjs', (req, res) => publishController.publishARJS(req, res))

/**
 * @route   GET /arjs/public/:publicationId
 * @desc    Возвращает данные UPDL сцены для публичной AR.js публикации
 * @param   publicationId - ID публикации (равен chatflowId)
 */
router.get('/arjs/public/:publicationId', (req, res) => publishController.getPublicARJSPublication(req, res))

/**
 * @route   GET /arjs/stream/:chatflowId
 * @desc    Прямой запрос к потоковой генерации UPDL сцены
 * @param   chatflowId - ID чатфлоу для генерации сцены
 */
router.get('/arjs/stream/:chatflowId', (req, res) => publishController.streamUPDL(req, res))

export default router
