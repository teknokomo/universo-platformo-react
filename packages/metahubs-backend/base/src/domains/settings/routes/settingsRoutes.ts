import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { getRequestDbExecutor, type DbExecutor } from '../../../utils'
import type { SqlQueryable } from '../../../persistence'
import { ensureMetahubAccess } from '../../shared/guards'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubSettingsService } from '../services/MetahubSettingsService'
import { METAHUB_SETTINGS_REGISTRY, getSettingDefinition } from '@universo/types'
import type { MetahubSettingRow } from '@universo/types'
import { validateSettingValue } from '../../shared/validateSettingValue'

type RegistryEntry = (typeof METAHUB_SETTINGS_REGISTRY)[number]

type RequestWithUser = Request & { user?: { id?: string; sub?: string; user_id?: string; userId?: string } }

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const settingsUpdateSchema = z.object({
    settings: z
        .array(
            z.object({
                key: z.string().min(1).max(100),
                value: z.record(z.unknown())
            })
        )
        .min(1)
        .max(50)
})

/**
 * Merge database rows with the registry defaults into a unified array.
 * Used by both GET and PUT to produce a consistent response shape.
 */
function mergeSettingsWithDefaults(dbRows: MetahubSettingRow[], registry: readonly RegistryEntry[] = METAHUB_SETTINGS_REGISTRY) {
    const dbMap = new Map(dbRows.map((r) => [r.key, r]))
    return registry.map((def) => {
        const dbRow = dbMap.get(def.key)
        if (dbRow) {
            return {
                key: def.key,
                value: dbRow.value,
                id: dbRow.id,
                version: dbRow._upl_version,
                updatedAt: dbRow._upl_updated_at,
                isDefault: false
            }
        }
        return {
            key: def.key,
            value: { _value: def.defaultValue },
            id: null,
            version: 0,
            updatedAt: null,
            isDefault: true
        }
    })
}

const SYSTEM_LANGUAGE_OPTION = 'system'

const buildLanguageOptions = (codes: string[]): string[] => {
    const normalized = codes
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.trim())
        .filter((code) => code.length > 0)

    const unique = Array.from(new Set(normalized))
    if (!unique.includes(SYSTEM_LANGUAGE_OPTION)) {
        return [SYSTEM_LANGUAGE_OPTION, ...unique]
    }
    return unique
}

const getContentLocaleCodes = async (ds: SqlQueryable): Promise<string[]> => {
    try {
        const rows = (await ds.query(
            `
                SELECT code
                FROM admin.locales
                WHERE is_enabled_content = true
                ORDER BY sort_order ASC, code ASC
            `
        )) as Array<{ code?: unknown }>

        const codes = rows.map((row) => (typeof row.code === 'string' ? row.code : '')).filter((code) => code.length > 0)

        return buildLanguageOptions(codes)
    } catch {
        const def = METAHUB_SETTINGS_REGISTRY.find((entry) => entry.key === 'general.language')
        return buildLanguageOptions((def?.options ?? []) as string[])
    }
}

const withDynamicLanguageOptions = (languageOptions: string[]): RegistryEntry[] => {
    return METAHUB_SETTINGS_REGISTRY.map((def) => {
        if (def.key !== 'general.language') return def
        return {
            ...def,
            options: languageOptions
        } as RegistryEntry
    })
}

export function createSettingsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        const settingsService = new MetahubSettingsService(schemaService)
        return { exec, settingsService }
    }

    // GET /metahub/:metahubId/settings
    // Returns all settings merged with registry defaults
    router.get(
        '/metahub/:metahubId/settings',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = resolveUserId(req)
            if (!userId || !metahubId) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const { exec, settingsService } = services(req)
            await ensureMetahubAccess(exec, userId, metahubId)

            const dbRows = await settingsService.findAll(metahubId, userId)
            const languageOptions = await getContentLocaleCodes(exec)
            const registry = withDynamicLanguageOptions(languageOptions)
            const merged = mergeSettingsWithDefaults(dbRows, registry)
            const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)

            res.json({ settings: merged, registry, meta: { hasHubNesting } })
        })
    )

    // PUT /metahub/:metahubId/settings
    // Bulk upsert settings (transactional)
    router.put(
        '/metahub/:metahubId/settings',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = resolveUserId(req)
            if (!userId || !metahubId) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const { exec, settingsService } = services(req)
            await ensureMetahubAccess(exec, userId, metahubId, 'manageMetahub')
            const languageOptions = await getContentLocaleCodes(exec)

            const parsed = settingsUpdateSchema.safeParse(req.body)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.issues })
                return
            }

            // Validate each value against registry definition
            const validationErrors: Array<{ key: string; error: string }> = []
            for (const s of parsed.data.settings) {
                const err = validateSettingValue(s.key, s.value, s.key === 'general.language' ? languageOptions : undefined)
                if (err) validationErrors.push({ key: s.key, error: err })
            }
            if (validationErrors.length > 0) {
                res.status(400).json({ error: 'Invalid setting values', details: validationErrors })
                return
            }

            await settingsService.bulkUpsert(metahubId, parsed.data.settings, userId)

            // One-shot action: clear hub nesting links and immediately reset trigger flag.
            const requestedResetNesting =
                parsed.data.settings.find((entry) => entry.key === 'hubs.resetNestingOnce')?.value?._value === true
            if (requestedResetNesting) {
                await settingsService.clearHubNesting(metahubId, userId)
                await settingsService.resetToDefault(metahubId, 'hubs.resetNestingOnce', userId)
            }

            // Re-load all settings for a complete merged response (consistent with GET)
            const dbRows = await settingsService.findAll(metahubId, userId)
            const registry = withDynamicLanguageOptions(languageOptions)
            const merged = mergeSettingsWithDefaults(dbRows, registry)
            const hasHubNesting = await settingsService.hasHubNesting(metahubId, userId)
            res.json({ settings: merged, registry, meta: { hasHubNesting } })
        })
    )

    // GET /metahub/:metahubId/setting/:key
    // Get a single setting (singular path for single resource)
    router.get(
        '/metahub/:metahubId/setting/:key',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, key } = req.params
            const userId = resolveUserId(req)
            if (!userId || !metahubId) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const { exec, settingsService } = services(req)
            await ensureMetahubAccess(exec, userId, metahubId)

            const row = await settingsService.findByKey(metahubId, key, userId)
            if (!row) {
                // Return default from registry
                const def = METAHUB_SETTINGS_REGISTRY.find((s) => s.key === key)
                if (!def) {
                    res.status(404).json({ error: `Unknown setting key: ${key}` })
                    return
                }
                res.json({ key: def.key, value: { _value: def.defaultValue }, isDefault: true })
                return
            }
            res.json({ key: row.key, value: row.value, isDefault: false, version: row._upl_version })
        })
    )

    // DELETE /metahub/:metahubId/setting/:key
    // Reset setting to default (singular path for single resource)
    router.delete(
        '/metahub/:metahubId/setting/:key',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, key } = req.params
            const userId = resolveUserId(req)
            if (!userId || !metahubId) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            // Validate key exists in registry
            const def = getSettingDefinition(key)
            if (!def) {
                res.status(404).json({ error: `Unknown setting key: ${key}` })
                return
            }

            const { exec, settingsService } = services(req)
            await ensureMetahubAccess(exec, userId, metahubId, 'manageMetahub')

            await settingsService.resetToDefault(metahubId, key, userId)
            res.json({ key, value: { _value: def.defaultValue }, isDefault: true })
        })
    )

    return router
}
