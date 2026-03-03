import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import { z } from 'zod'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess } from '../guards/ensureGlobalAccess'
import { AdminSetting } from '../database/entities/AdminSetting'
import { formatZodError } from '../schemas'
import { getRequestManager } from '../utils'

export interface AdminSettingsRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDataSource: () => DataSource
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

const CategoryParamSchema = z.object({
    category: z
        .string()
        .min(1, 'Category is required')
        .max(50, 'Category must be at most 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Category must be alphanumeric with underscores/dashes')
})

const CategoryKeyParamSchema = CategoryParamSchema.extend({
    key: z
        .string()
        .min(1, 'Key is required')
        .max(100, 'Key must be at most 100 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Key must be alphanumeric with underscores/dashes')
})

const UpdateSettingBodySchema = z.object({
    value: z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())])
})

const BulkUpdateSettingsBodySchema = z.object({
    values: z
        .record(z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())]))
        .refine((value) => Object.keys(value).length > 0, 'At least one setting must be provided')
})

const METAHUB_SETTING_VALUE_SCHEMAS: Record<string, z.ZodTypeAny> = {
    codenameStyle: z.enum(['pascal-case', 'kebab-case']),
    codenameAlphabet: z.enum(['en', 'ru', 'en-ru']),
    codenameAllowMixedAlphabets: z.boolean(),
    codenameAutoConvertMixedAlphabets: z.boolean(),
    codenameLocalizedEnabled: z.boolean()
}

const METAHUB_ALLOWED_SETTING_KEYS = new Set(Object.keys(METAHUB_SETTING_VALUE_SCHEMAS))

const validateSettingValueByCategory = (category: string, key: string, value: unknown): string | null => {
    if (category !== 'metahubs') return null

    if (!METAHUB_ALLOWED_SETTING_KEYS.has(key)) {
        return `Unknown metahubs setting key: ${key}`
    }

    const schema = METAHUB_SETTING_VALUE_SCHEMAS[key]
    if (!schema) {
        return `Unknown metahubs setting key: ${key}`
    }

    const parsed = schema.safeParse(value)
    if (parsed.success) return null

    const issue = parsed.error.issues[0]
    return issue?.message ?? 'Invalid value for setting key'
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE TRANSFORMS
// ═══════════════════════════════════════════════════════════════

/**
 * Transform AdminSetting entity to API response (camelCase)
 */
function transformSetting(setting: AdminSetting) {
    return {
        id: setting.id,
        category: setting.category,
        key: setting.key,
        value: setting.value,
        createdAt: setting.createdAt.toISOString(),
        updatedAt: setting.updatedAt.toISOString()
    }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * Create routes for admin settings management
 * Settings are organized by category (e.g., 'metahubs', 'applications')
 * Requires global access for all operations
 */
export function createAdminSettingsRoutes(config: AdminSettingsRoutesConfig): Router {
    const { globalAccessService, permissionService, getDataSource } = config
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const getSettingsRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(AdminSetting)
    }

    const upsertSettingAtomic = async (req: Request, category: string, key: string, value: unknown): Promise<AdminSetting> => {
        const repo = getSettingsRepo(req)
        await repo.upsert(
            {
                category,
                key,
                value: { _value: value }
            },
            ['category', 'key']
        )

        const persisted = await repo.findOne({ where: { category, key } })
        if (!persisted) {
            throw new Error('Failed to persist setting')
        }

        return persisted
    }

    /**
     * GET /api/v1/admin/settings
     * List all settings (optionally filtered by category via query param)
     */
    router.get(
        '/',
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const repo = getSettingsRepo(req)

            const categoryFilter = req.query.category as string | undefined
            const where = categoryFilter ? { category: categoryFilter } : {}

            const settings = await repo.find({
                where,
                order: { category: 'ASC', key: 'ASC' }
            })

            res.json({
                success: true,
                data: {
                    items: settings.map(transformSetting),
                    total: settings.length
                }
            })
        })
    )

    /**
     * GET /api/v1/admin/settings/:category
     * List all settings for a specific category
     */
    router.get(
        '/:category',
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const repo = getSettingsRepo(req)
            const settings = await repo.find({
                where: { category: parsed.data.category },
                order: { key: 'ASC' }
            })

            res.json({
                success: true,
                data: {
                    items: settings.map(transformSetting),
                    total: settings.length
                }
            })
        })
    )

    /**
     * GET /api/v1/admin/settings/:category/:key
     * Get a single setting by category and key
     */
    router.get(
        '/:category/:key',
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryKeyParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const repo = getSettingsRepo(req)
            const setting = await repo.findOne({
                where: { category: parsed.data.category, key: parsed.data.key }
            })

            if (!setting) {
                res.status(404).json({ success: false, error: 'Setting not found' })
                return
            }

            res.json({
                success: true,
                data: transformSetting(setting)
            })
        })
    )

    /**
     * PUT /api/v1/admin/settings/:category/:key
     * Create or update a setting (upsert)
     */
    router.put(
        '/:category',
        ensureGlobalAccess('settings', 'update'),
        asyncHandler(async (req, res) => {
            const paramsParsed = CategoryParamSchema.safeParse(req.params)
            if (!paramsParsed.success) {
                res.status(400).json({ success: false, error: formatZodError(paramsParsed.error) })
                return
            }

            const bodyParsed = BulkUpdateSettingsBodySchema.safeParse(req.body)
            if (!bodyParsed.success) {
                res.status(400).json({ success: false, error: formatZodError(bodyParsed.error) })
                return
            }

            const { category } = paramsParsed.data
            const entries = Object.entries(bodyParsed.data.values)

            for (const [key, value] of entries) {
                const keyParsed = CategoryKeyParamSchema.shape.key.safeParse(key)
                if (!keyParsed.success) {
                    res.status(400).json({ success: false, error: formatZodError(keyParsed.error) })
                    return
                }

                const valueValidationError = validateSettingValueByCategory(category, key, value)
                if (valueValidationError) {
                    res.status(400).json({ success: false, error: valueValidationError })
                    return
                }
            }

            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const updatedSettings = await manager.transaction(async (transactionManager) => {
                const repo = transactionManager.getRepository(AdminSetting)

                for (const [key, value] of entries) {
                    await repo.upsert(
                        {
                            category,
                            key,
                            value: { _value: value }
                        },
                        ['category', 'key']
                    )
                }

                return repo.find({
                    where: {
                        category,
                        key: In(entries.map(([key]) => key))
                    },
                    order: { key: 'ASC' }
                })
            })

            res.json({
                success: true,
                data: {
                    items: updatedSettings.map(transformSetting),
                    total: updatedSettings.length
                }
            })
        })
    )

    router.put(
        '/:category/:key',
        ensureGlobalAccess('settings', 'update'),
        asyncHandler(async (req, res) => {
            const paramsParsed = CategoryKeyParamSchema.safeParse(req.params)
            if (!paramsParsed.success) {
                res.status(400).json({ success: false, error: formatZodError(paramsParsed.error) })
                return
            }

            const bodyParsed = UpdateSettingBodySchema.safeParse(req.body)
            if (!bodyParsed.success) {
                res.status(400).json({ success: false, error: formatZodError(bodyParsed.error) })
                return
            }

            const { category, key } = paramsParsed.data
            const valueValidationError = validateSettingValueByCategory(category, key, bodyParsed.data.value)
            if (valueValidationError) {
                res.status(400).json({ success: false, error: valueValidationError })
                return
            }

            const setting = await upsertSettingAtomic(req, category, key, bodyParsed.data.value)

            res.json({
                success: true,
                data: transformSetting(setting)
            })
        })
    )

    /**
     * DELETE /api/v1/admin/settings/:category/:key
     * Delete / reset a setting to default
     */
    router.delete(
        '/:category/:key',
        ensureGlobalAccess('settings', 'delete'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryKeyParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const repo = getSettingsRepo(req)
            const setting = await repo.findOne({
                where: { category: parsed.data.category, key: parsed.data.key }
            })

            if (!setting) {
                res.status(404).json({ success: false, error: 'Setting not found' })
                return
            }

            await repo.remove(setting)

            res.json({ success: true })
        })
    )

    return router
}
