// Universo Platformo | Unified bot routes
import express from 'express'
import botsController from '../../controllers/bots'

const router = express.Router()

// Universo Platformo | GET/POST /ar/:id - API for AR data
router.get('/ar/:id', (req, res, next) => {
    // Setting type is redundant here as controller is called directly
    console.log(`[AR API Route] GET request to /api/v1/bots/ar/${req.params.id}`)
    res.setHeader('Content-Type', 'application/json')
    const ARBotController = require('../../controllers/bots/ar').ARBotController
    const arController = new ARBotController()
    return arController.getBotConfig(req, res, next)
})
router.post('/ar/:id', (req, res, next) => {
    // Setting type is redundant here as controller is called directly
    console.log(`[AR API Route] POST request to /api/v1/bots/ar/${req.params.id}`)
    res.setHeader('Content-Type', 'application/json')
    const ARBotController = require('../../controllers/bots/ar').ARBotController
    const arController = new ARBotController()
    return arController.getBotConfig(req, res, next)
})

// Universo Platformo | GET /:id/config - General endpoint for bot configuration (defaults to chat)
router.get('/:id/config', botsController.getBotConfig)

// Universo Platformo | Removed specialized /config/* routes

// Universo Platformo | GET /:id - General endpoint for rendering bot view (defaults to chat)
router.get('/:id', botsController.renderBot)

// Universo Platformo | Removed specialized /render/* and duplicate /:id/render routes

// Universo Platformo | GET /:id/stream/... - Endpoint for chat streaming
router.get(['/:id/stream', '/:id/stream/', '/:id/stream/:sessionid', '/:id/stream/:sessionid/'], botsController.streamBot)

export default router
