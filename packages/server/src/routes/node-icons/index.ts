import express from 'express'
import nodeIconsController from '../../controllers/node-icons'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:name'], nodeIconsController.getSingleNodeIcon)

// UPDATE

// DELETE

export default router
