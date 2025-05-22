// Universo Platformo | Main router for UPDL server
import { Router } from 'express'
import { errorHandler } from '../middlewares/errorHandler'

const router = Router()

// Error handling middleware always comes last
router.use(errorHandler)

export default router
