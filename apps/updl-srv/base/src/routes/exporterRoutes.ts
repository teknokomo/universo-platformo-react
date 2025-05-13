// Universo Platformo | Exporter routes
import { Router } from 'express'
import * as exporterController from '../controllers/exporterController'

const router = Router()

/**
 * @route   GET /api/updl/exporters
 * @desc    Get all available exporters
 * @access  Public
 */
router.get('/exporters', exporterController.getExporters)

/**
 * @route   POST /api/updl/export
 * @desc    Export UPDL scene to specified format
 * @access  Public
 */
router.post('/export', exporterController.exportScene)

export default router
