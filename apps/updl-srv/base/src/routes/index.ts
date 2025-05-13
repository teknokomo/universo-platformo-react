// Universo Platformo | Main router for UPDL server
import { Router } from 'express'
import exporterRoutes from './exporterRoutes'
import { errorHandler } from '../middlewares/errorHandler'

const router = Router()

// API routes
router.use('/api/updl', exporterRoutes)

// Error handling middleware always comes last
router.use(errorHandler)

export default router
