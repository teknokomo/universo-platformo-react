import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import { uuid } from '@universo/utils'
import type { RequestWithDbContext, IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess } from '../guards/ensureGlobalAccess'
import { Locale } from '../database/entities/Locale'
import { CreateLocaleSchema, UpdateLocaleSchema, LocalesListQuerySchema, formatZodError } from '../schemas'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

export interface LocalesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDataSource: () => DataSource
}

/**
 * Transform Locale entity to API response (camelCase)
 */
function transformLocale(locale: Locale) {
    return {
        id: locale.id,
        code: locale.code,
        name: locale.name,
        nativeName: locale.nativeName,
        isEnabledContent: locale.isEnabledContent,
        isEnabledUi: locale.isEnabledUi,
        isDefaultContent: locale.isDefaultContent,
        isDefaultUi: locale.isDefaultUi,
        isSystem: locale.isSystem,
        sortOrder: locale.sortOrder,
        createdAt: locale.createdAt.toISOString(),
        updatedAt: locale.updatedAt.toISOString()
    }
}

/**
 * Create routes for locales management
 * Requires global access for all operations
 */
export function createLocalesRoutes(config: LocalesRoutesConfig): Router {
    const { globalAccessService, permissionService, getDataSource } = config
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const getLocaleRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(Locale)
    }

    /**
     * GET /api/v1/admin/locales
     * List all locales
     */
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
            const repo = getLocaleRepo(req)

            const qb = repo.createQueryBuilder('locale')

            if (!query.includeDisabled) {
                qb.where('locale.is_enabled_content = true OR locale.is_enabled_ui = true')
            }

            // Apply sorting
            const sortColumn =
                query.sortBy === 'code' ? 'locale.code' : query.sortBy === 'created_at' ? 'locale.created_at' : 'locale.sort_order'
            qb.orderBy(sortColumn, query.sortOrder.toUpperCase() as 'ASC' | 'DESC')

            const locales = await qb.getMany()

            res.json({
                success: true,
                data: {
                    items: locales.map(transformLocale),
                    total: locales.length
                }
            })
        })
    )

    /**
     * GET /api/v1/admin/locales/:id
     * Get single locale by ID
     */
    router.get(
        '/:id',
        ensureGlobalAccess('locales', 'read'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid UUID format'
                })
                return
            }

            const repo = getLocaleRepo(req)
            const locale = await repo.findOne({ where: { id: req.params.id } })

            if (!locale) {
                res.status(404).json({
                    success: false,
                    error: 'Locale not found'
                })
                return
            }

            res.json({
                success: true,
                data: transformLocale(locale)
            })
        })
    )

    /**
     * POST /api/v1/admin/locales
     * Create a new locale
     */
    router.post(
        '/',
        ensureGlobalAccess('locales', 'create'),
        asyncHandler(async (req, res) => {
            const parsed = CreateLocaleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
                return
            }

            const data = parsed.data
            const ds = getDataSource()
            const repo = getLocaleRepo(req)

            // Check if code already exists
            const existing = await repo.findOne({ where: { code: data.code } })
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: 'Locale code already exists'
                })
                return
            }

            // Use transaction to atomically handle default flags and creation
            const saved = await ds.transaction(async (manager) => {
                const txRepo = manager.getRepository(Locale)

                // Clear existing defaults if setting new one
                if (data.isDefaultContent) {
                    await txRepo.update({}, { isDefaultContent: false })
                }
                if (data.isDefaultUi) {
                    await txRepo.update({}, { isDefaultUi: false })
                }

                const locale = txRepo.create({
                    code: data.code,
                    name: data.name,
                    nativeName: data.nativeName ?? null,
                    isEnabledContent: data.isEnabledContent,
                    isEnabledUi: data.isEnabledUi,
                    isDefaultContent: data.isDefaultContent,
                    isDefaultUi: data.isDefaultUi,
                    isSystem: false,
                    sortOrder: data.sortOrder
                })

                return await txRepo.save(locale)
            })

            res.status(201).json({
                success: true,
                data: transformLocale(saved)
            })
        })
    )

    /**
     * PATCH /api/v1/admin/locales/:id
     * Update an existing locale
     */
    router.patch(
        '/:id',
        ensureGlobalAccess('locales', 'update'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid UUID format'
                })
                return
            }

            const parsed = UpdateLocaleSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: formatZodError(parsed.error)
                })
                return
            }

            const data = parsed.data
            const ds = getDataSource()
            const repo = getLocaleRepo(req)

            const locale = await repo.findOne({ where: { id: req.params.id } })
            if (!locale) {
                res.status(404).json({
                    success: false,
                    error: 'Locale not found'
                })
                return
            }

            // Prevent disabling if it's the only enabled locale (check outside transaction)
            if (data.isEnabledContent === false) {
                const enabledCount = await repo.count({ where: { isEnabledContent: true } })
                if (enabledCount <= 1 && locale.isEnabledContent) {
                    res.status(400).json({
                        success: false,
                        error: 'Cannot disable the only enabled content locale'
                    })
                    return
                }
            }

            // Use transaction to atomically handle default flags and updates
            const saved = await ds.transaction(async (manager) => {
                const txRepo = manager.getRepository(Locale)

                // Clear existing defaults if setting new one
                if (data.isDefaultContent === true && !locale.isDefaultContent) {
                    await txRepo.update({}, { isDefaultContent: false })
                }
                if (data.isDefaultUi === true && !locale.isDefaultUi) {
                    await txRepo.update({}, { isDefaultUi: false })
                }

                // Apply updates
                if (data.name !== undefined) locale.name = data.name
                if (data.nativeName !== undefined) locale.nativeName = data.nativeName
                if (data.isEnabledContent !== undefined) locale.isEnabledContent = data.isEnabledContent
                if (data.isEnabledUi !== undefined) locale.isEnabledUi = data.isEnabledUi
                if (data.isDefaultContent !== undefined) locale.isDefaultContent = data.isDefaultContent
                if (data.isDefaultUi !== undefined) locale.isDefaultUi = data.isDefaultUi
                if (data.sortOrder !== undefined) locale.sortOrder = data.sortOrder

                return await txRepo.save(locale)
            })

            res.json({
                success: true,
                data: transformLocale(saved)
            })
        })
    )

    /**
     * DELETE /api/v1/admin/locales/:id
     * Delete a locale
     */
    router.delete(
        '/:id',
        ensureGlobalAccess('locales', 'delete'),
        asyncHandler(async (req, res) => {
            if (!uuid.isValidUuid(req.params.id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid UUID format'
                })
                return
            }

            const repo = getLocaleRepo(req)
            const locale = await repo.findOne({ where: { id: req.params.id } })

            if (!locale) {
                res.status(404).json({
                    success: false,
                    error: 'Locale not found'
                })
                return
            }

            if (locale.isSystem) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot delete system locale'
                })
                return
            }

            if (locale.isDefaultContent || locale.isDefaultUi) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete default locale. Set another locale as default first.'
                })
                return
            }

            await repo.remove(locale)

            res.status(204).send()
        })
    )

    return router
}
