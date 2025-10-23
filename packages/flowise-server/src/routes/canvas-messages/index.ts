import express from 'express'
import canvasMessageController from '../../controllers/canvas-messages'
const router = express.Router()

// CREATE
router.post(['/', '/:id'], canvasMessageController.createChatMessage)

// READ
router.get(['/', '/:id'], canvasMessageController.getAllChatMessages)

// UPDATE
router.put(['/abort/', '/abort/:canvasId/:chatId'], canvasMessageController.abortChatMessage)

// DELETE
router.delete(['/', '/:id'], canvasMessageController.removeAllChatMessages)

export default router
