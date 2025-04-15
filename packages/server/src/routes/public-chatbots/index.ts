import express from 'express'
import chatflowsController from '../../controllers/chatflows'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:id'], chatflowsController.getSinglePublicBotConfig)

// UPDATE

// DELETE

export default router
