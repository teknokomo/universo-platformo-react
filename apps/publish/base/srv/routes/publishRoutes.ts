// Universo Platformo | Publish Routes
// Express routes for publication API

import { Router } from 'express'
import { PublishController } from '../controllers/PublishController'

// Create router
const router = Router()

// Create controller instance
const publishController = new PublishController()

/**
 * Get all available exporters
 * GET /api/v1/publish/exporters
 */
router.get('/exporters', (req, res) => publishController.getExporters(req, res))

/**
 * Publish a flow
 * POST /api/v1/publish
 * Body: { flowId, exporterId, options }
 */
router.post('/', (req, res) => publishController.publishFlow(req, res))

/**
 * Get available markers for AR.js
 * GET /api/v1/publish/arjs/markers
 */
router.get('/arjs/markers', (req, res) => publishController.getARJSMarkers(req, res))

export default router
