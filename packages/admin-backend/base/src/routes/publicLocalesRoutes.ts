import { Router, Request, Response, RequestHandler } from 'express'
import type { DbExecutor } from '@universo/utils'
import { listEnabledContentLocales, listEnabledUiLocales } from '../persistence/localesStore'

export interface PublicLocalesRoutesConfig {
    getDbExecutor: () => DbExecutor
}

export function createPublicLocalesRoutes(config: PublicLocalesRoutesConfig): Router {
    const { getDbExecutor } = config
    const router = Router()

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get(
        '/content',
        asyncHandler(async (_req, res) => {
            const exec = getDbExecutor()
            const locales = await listEnabledContentLocales(exec)

            res.set('Cache-Control', 'public, max-age=300')

            res.json({
                locales: locales.map((l) => ({
                    code: l.code,
                    label: l.native_name || l.code.toUpperCase(),
                    isDefault: l.is_default_content
                })),
                defaultLocale: locales.find((l) => l.is_default_content)?.code || 'en'
            })
        })
    )

    router.get(
        '/ui',
        asyncHandler(async (_req, res) => {
            const exec = getDbExecutor()
            const locales = await listEnabledUiLocales(exec)

            res.set('Cache-Control', 'public, max-age=300')

            res.json({
                locales: locales.map((l) => ({
                    code: l.code,
                    label: l.native_name || l.code.toUpperCase(),
                    isDefault: l.is_default_ui
                })),
                defaultLocale: locales.find((l) => l.is_default_ui)?.code || 'en'
            })
        })
    )

    return router
}
