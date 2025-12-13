import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { Locale } from '../database/entities/Locale'

export interface PublicLocalesRoutesConfig {
    getDataSource: () => DataSource
}

/**
 * Public routes for locale information (no authentication required)
 *
 * Used by LocalizedFieldEditor and other components outside admin panel.
 * Returns minimal locale data with caching headers.
 */
export function createPublicLocalesRoutes(config: PublicLocalesRoutesConfig): Router {
    const { getDataSource } = config
    const router = Router()

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    /**
     * GET /api/v1/locales/content
     * Get enabled content locales (public, cached)
     *
     * Returns minimal data for LocalizedFieldEditor dropdown
     */
    router.get(
        '/content',
        asyncHandler(async (_req, res) => {
            const ds = getDataSource()
            const repo = ds.getRepository(Locale)

            const locales = await repo.find({
                where: { isEnabledContent: true },
                order: { sortOrder: 'ASC' },
                select: ['code', 'nativeName', 'isDefaultContent']
            })

            // Set cache headers (5 minutes)
            res.set('Cache-Control', 'public, max-age=300')

            res.json({
                locales: locales.map((l) => ({
                    code: l.code,
                    label: l.nativeName || l.code.toUpperCase(),
                    isDefault: l.isDefaultContent
                })),
                defaultLocale: locales.find((l) => l.isDefaultContent)?.code || 'en'
            })
        })
    )

    /**
     * GET /api/v1/locales/ui
     * Get enabled UI locales (public, cached)
     *
     * Returns minimal data for LanguageSwitcher component
     */
    router.get(
        '/ui',
        asyncHandler(async (_req, res) => {
            const ds = getDataSource()
            const repo = ds.getRepository(Locale)

            const locales = await repo.find({
                where: { isEnabledUi: true },
                order: { sortOrder: 'ASC' },
                select: ['code', 'nativeName', 'isDefaultUi']
            })

            // Set cache headers (5 minutes)
            res.set('Cache-Control', 'public, max-age=300')

            res.json({
                locales: locales.map((l) => ({
                    code: l.code,
                    label: l.nativeName || l.code.toUpperCase(),
                    isDefault: l.isDefaultUi
                })),
                defaultLocale: locales.find((l) => l.isDefaultUi)?.code || 'en'
            })
        })
    )

    return router
}
