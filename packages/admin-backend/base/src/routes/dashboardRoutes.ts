import { Router } from 'express'
import type { GlobalAccessService } from '../services/globalAccessService'
import { getRequestDbSession, isAdminPanelEnabled } from '@universo/utils'
import type { RequestWithGlobalRole } from '../guards/ensureGlobalAccess'

export interface DashboardRoutesConfig {
    globalAccessService: GlobalAccessService
}

export function createDashboardRoutes({ globalAccessService }: DashboardRoutesConfig): Router {
    const router = Router()

    router.get('/stats', async (req, res, next) => {
        try {
            if (!isAdminPanelEnabled()) {
                return res.status(403).json({ success: false, error: 'Admin panel is disabled' })
            }

            const userId = (req as RequestWithGlobalRole).user?.id
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Authentication required' })
            }

            const hasDashboardAccess = await globalAccessService.hasWorkspaceAccess(userId, getRequestDbSession(req))

            if (!hasDashboardAccess) {
                return res.status(403).json({ success: false, error: 'Access denied: dashboard is unavailable for this role' })
            }

            const stats = await globalAccessService.getStats()
            res.json({ success: true, data: stats })
        } catch (error) {
            next(error)
        }
    })

    return router
}
