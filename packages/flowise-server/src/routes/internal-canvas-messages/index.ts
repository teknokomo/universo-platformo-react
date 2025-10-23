import express from 'express'
import canvasMessagesController from '../../controllers/canvas-messages'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:id'], canvasMessagesController.getAllInternalChatMessages)

// UPDATE

// DELETE

export default router
