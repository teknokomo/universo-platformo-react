import express from 'express'
import canvasService from '../../services/spacesCanvas'
import botsController from '../../controllers/bots'
import { resolveRequestUserId, workspaceAccessService } from '../../services/access-control'
import logger from '../../utils/logger'
import { getErrorMessage } from '../../errors/utils'

const router = express.Router()

router.get(['/', '/:canvasId', '/:id'], async (req, res, next) => {
    try {
        const canvasId = req.params.canvasId ?? req.params.id
        if (!canvasId) {
            return res.status(412).json({ error: 'canvasId param is required' })
        }

        const canvas = await canvasService.getSinglePublicCanvas(canvasId)

        // Maintain compatibility for downstream controllers expecting legacy param name
        if (!req.params.id) {
            ;(req.params as any).id = canvasId
        }

        if (canvas && canvas.unikId) {
            const userId = resolveRequestUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
            }

            const hasAccess = await workspaceAccessService.hasUnikAccess(req, userId, canvas.unikId)
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied: You do not have permission to access this bot' })
            }
        }

        return botsController.getBotConfig(req, res, next)
    } catch (error) {
        logger.error(`Error getting unified bot config: ${getErrorMessage(error)}`)
        return res.status(500).json({ error: getErrorMessage(error) })
    }
})

export default router
