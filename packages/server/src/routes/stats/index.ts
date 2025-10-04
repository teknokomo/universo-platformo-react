import express from 'express'
import statsController from '../../controllers/stats'

const router = express.Router()

// READ
router.get(['/', '/:id'], statsController.getCanvasStats)

export default router
