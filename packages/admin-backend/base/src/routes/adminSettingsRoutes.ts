import { Router, Request, Response, RequestHandler } from 'express'
import { z } from 'zod'
import { getRequestDbExecutor, type DbExecutor } from '@universo/utils'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess, type RequestWithGlobalRole } from '../guards/ensureGlobalAccess'
import { listSettings, findSetting, upsertSetting, bulkUpsertSettings, deleteSetting, transformSettingRow } from '../persistence/settingsStore'
import { formatZodError } from '../schemas'

export interface AdminSettingsRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDbExecutor: () => DbExecutor
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
// ROUTES
// ═══════════════════════════════════════════════════════════════

export function createAdminSettingsRoutes(config: AdminSettingsRoutesConfig): Router {
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
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const categoryFilter = (req.query as { category?: string }).category
            const settings = await listSettings(exec, categoryFilter)

            res.json({
                success: true,
                data: {
                    items: settings.map(transformSettingRow),
                    total: settings.length
                }
            })
        })
    )

    router.get(
        '/:category',
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const settings = await listSettings(exec, parsed.data.category)

            res.json({
                success: true,
                data: {
                    items: settings.map(transformSettingRow),
                    total: settings.length
                }
            })
        })
    )

    router.get(
        '/:category/:key',
        ensureGlobalAccess('settings', 'read'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryKeyParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const setting = await findSetting(exec, parsed.data.category, parsed.data.key)

            if (!setting) {
                res.status(404).json({ success: false, error: 'Setting not found' })
                return
            }

            res.json({ success: true, data: transformSettingRow(setting) })
        })
    )

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

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const updatedSettings = await bulkUpsertSettings(exec, category, entries)

            res.json({
                success: true,
                data: {
                    items: updatedSettings.map(transformSettingRow),
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

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const setting = await upsertSetting(exec, category, key, bodyParsed.data.value)

            res.json({ success: true, data: transformSettingRow(setting) })
        })
    )

    router.delete(
        '/:category/:key',
        ensureGlobalAccess('settings', 'delete'),
        asyncHandler(async (req, res) => {
            const parsed = CategoryKeyParamSchema.safeParse(req.params)
            if (!parsed.success) {
                res.status(400).json({ success: false, error: formatZodError(parsed.error) })
                return
            }

            const exec = getRequestDbExecutor(req, getDbExecutor())
            const setting = await findSetting(exec, parsed.data.category, parsed.data.key)

            if (!setting) {
                res.status(404).json({ success: false, error: 'Setting not found' })
                return
            }

            await deleteSetting(exec, parsed.data.category, parsed.data.key, (req as RequestWithGlobalRole).user?.id)
            res.json({ success: true })
        })
    )

    return router
}
