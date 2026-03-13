import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { listActiveTemplatesForCatalog, findTemplateByIdNotDeleted, listTemplateVersions } from '../../../persistence'
import type { SqlQueryable } from '../../../persistence'

/**
 * Templates routes — read-only catalog of available metahub templates.
 *
 * All authenticated users can list templates.
 * Template management (create/update/delete) is admin-only and
 * handled via the seeder at startup, not through API routes.
 */
export function createTemplatesRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => SqlQueryable,
    readLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    // ============ LIST TEMPLATES ============
    router.get(
        '/templates',
        readLimiter,
        asyncHandler(async (_req, res) => {
            const exec = getDbExecutor()
            const templates = await listActiveTemplatesForCatalog(exec)

            const result = templates.map((t) => ({
                id: t.id,
                codename: t.codename,
                name: t.name,
                description: t.description,
                icon: t.icon,
                isSystem: t.isSystem,
                sortOrder: t.sortOrder,
                activeVersion: t.activeVersionData
                    ? {
                          id: t.activeVersionData.id,
                          versionNumber: t.activeVersionData.versionNumber,
                          versionLabel: t.activeVersionData.versionLabel,
                          changelog: t.activeVersionData.changelog
                      }
                    : null
            }))

            return res.json({ data: result, total: result.length })
        })
    )

    // ============ GET TEMPLATE BY ID ============
    router.get(
        '/templates/:templateId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const exec = getDbExecutor()
            const template = await findTemplateByIdNotDeleted(exec, req.params.templateId)

            if (!template) {
                return res.status(404).json({ error: 'Template not found' })
            }

            const versions = await listTemplateVersions(exec, template.id)

            return res.json({
                id: template.id,
                codename: template.codename,
                name: template.name,
                description: template.description,
                icon: template.icon,
                isSystem: template.isSystem,
                isActive: template.isActive,
                sortOrder: template.sortOrder,
                activeVersionId: template.activeVersionId,
                versions: versions.map((v) => ({
                    id: v.id,
                    versionNumber: v.versionNumber,
                    versionLabel: v.versionLabel,
                    isActive: v.isActive,
                    changelog: v.changelog,
                    createdAt: v._uplCreatedAt
                }))
            })
        })
    )

    return router
}
