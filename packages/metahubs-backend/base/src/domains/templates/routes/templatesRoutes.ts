import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Template } from '../../../database/entities/Template'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'

/**
 * Templates routes — read-only catalog of available metahub templates.
 *
 * All authenticated users can list templates.
 * Template management (create/update/delete) is admin-only and
 * handled via the seeder at startup, not through API routes.
 */
export function createTemplatesRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
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
            const ds = getDataSource()
            const templateRepo = ds.getRepository(Template)

            const templates = await templateRepo.find({
                where: { isActive: true, _uplDeleted: false },
                order: { sortOrder: 'ASC', _uplCreatedAt: 'ASC' },
                relations: ['activeVersion']
            })

            const result = templates.map((t) => ({
                id: t.id,
                codename: t.codename,
                name: t.name,
                description: t.description,
                icon: t.icon,
                isSystem: t.isSystem,
                sortOrder: t.sortOrder,
                activeVersion: t.activeVersion
                    ? {
                          id: t.activeVersion.id,
                          versionNumber: t.activeVersion.versionNumber,
                          versionLabel: t.activeVersion.versionLabel,
                          changelog: t.activeVersion.changelog
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
            const ds = getDataSource()
            const templateRepo = ds.getRepository(Template)
            const versionRepo = ds.getRepository(TemplateVersion)

            const template = await templateRepo.findOne({
                where: { id: req.params.templateId, _uplDeleted: false }
            })

            if (!template) {
                return res.status(404).json({ error: 'Template not found' })
            }

            const versions = await versionRepo.find({
                where: { templateId: template.id },
                order: { versionNumber: 'DESC' },
                select: ['id', 'versionNumber', 'versionLabel', 'isActive', 'changelog', '_uplCreatedAt']
            })

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
