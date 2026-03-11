import { Router, Request, Response, RequestHandler } from 'express'
import { getRequestDbExecutor, uuid, type DbExecutor } from '@universo/utils'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess, type RequestWithGlobalRole } from '../guards/ensureGlobalAccess'
import {
    listLocales,
    findLocaleById,
    findLocaleByCode,
    createLocale,
    updateLocale,
    deleteLocale,
    transformLocaleRow
} from '../persistence/localesStore'
import { CreateLocaleSchema, UpdateLocaleSchema, LocalesListQuerySchema, formatZodError } from '../schemas'

export interface LocalesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDbExecutor: () => DbExecutor
}

/**
 * Create routes for locales management
 * Requires global access for all operations
 */
export function createLocalesRoutes(config: LocalesRoutesConfig): Router {
    const { globalAccessService, permissionService, getDbExecutor } = config
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get(
        '/',
        ensureGlobalAccess('locales', 'read'),
        asyncHandler(async (req, res) => {
            const parsed = LocalesListQuerySchema.safeParse(req.query)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
                return
            }

            const query = parsed.data
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const { items, total } = await listLocales(exec, {
                includeDisabled: query.includeDisabled,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
                limit: query.limit,
                offset: query.offset
            })

            res.json({
                success: true,
                data: {
                    items: items.map(transformLocaleRow),
                    total
                }
            })
        })
    )

    router.get(
        '/:id',
        ensureGlobalAccess('locales', 'read'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({ success: false, error: 'Invalid UUID format' })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const locale = await findLocaleById(exec, req.params.id)

            if (!locale) {
                res.status(404).json({ success: false, error: 'Locale not found' })
                return
            }

            res.json({ success: true, data: transformLocaleRow(locale) })
        })
    )

    router.post(
        '/',
        ensureGlobalAccess('locales', 'create'),
        asyncHandler(async (req, res) => {
            const parsed = CreateLocaleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const data = parsed.data
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const existing = await findLocaleByCode(exec, data.code)
            if (existing) {
                res.status(409).json({ success: false, error: 'Locale code already exists' })
                return
            }

            const saved = await createLocale(exec, {
                code: data.code,
                name: data.name,
                nativeName: data.nativeName ?? null,
                isEnabledContent: data.isEnabledContent,
                isEnabledUi: data.isEnabledUi,
                isDefaultContent: data.isDefaultContent,
                isDefaultUi: data.isDefaultUi,
                sortOrder: data.sortOrder
            })

            res.status(201).json({ success: true, data: transformLocaleRow(saved) })
        })
    )

    router.patch(
        '/:id',
        ensureGlobalAccess('locales', 'update'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({ success: false, error: 'Invalid UUID format' })
                return
            }

            const parsed = UpdateLocaleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const data = parsed.data
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const locale = await findLocaleById(exec, req.params.id)
            if (!locale) {
                res.status(404).json({ success: false, error: 'Locale not found' })
                return
            }

            let saved
            try {
                saved = await updateLocale(exec, req.params.id, {
                    name: data.name,
                    nativeName: data.nativeName,
                    isEnabledContent: data.isEnabledContent,
                    isEnabledUi: data.isEnabledUi,
                    isDefaultContent: data.isDefaultContent,
                    isDefaultUi: data.isDefaultUi,
                    sortOrder: data.sortOrder
                })
            } catch (err) {
                if (err instanceof Error && err.message === 'LAST_ENABLED_LOCALE') {
                    res.status(400).json({
                        success: false,
                        error: 'Cannot disable the only enabled content locale'
                    })
                    return
                }
                throw err
            }

            res.json({ success: true, data: transformLocaleRow(saved) })
        })
    )

    router.delete(
        '/:id',
        ensureGlobalAccess('locales', 'delete'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({ success: false, error: 'Invalid UUID format' })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const locale = await findLocaleById(exec, req.params.id)

            if (!locale) {
                res.status(404).json({ success: false, error: 'Locale not found' })
                return
            }

            if (locale.is_system) {
                res.status(403).json({ success: false, error: 'Cannot delete system locale' })
                return
            }

            if (locale.is_default_content || locale.is_default_ui) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete default locale. Set another locale as default first.'
                })
                return
            }

            await deleteLocale(exec, req.params.id, (req as RequestWithGlobalRole).user?.id)
            res.status(204).send()
        })
    )

    return router
}
