import { Router, type Request, type RequestHandler, type Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { OptimisticLockError, uuidV7Schema, type DbExecutor } from '@universo-react/utils'

import { asyncHandler } from '../shared/asyncHandler'
import { resolveUserId } from '../shared/runtimeHelpers'
import { resolveApplicationLayoutReadRoles } from '../controllers/applicationReadPolicy'
import { getApplicationRuntimeSchemaName } from '../persistence/applicationLayoutsStore'
import { ensureApplicationAccess, type ApplicationRole } from '../routes/guards'
import { ThemePresetCodenameConflictError, ThemePresetNotFoundError } from '../persistence/themePresetsStore'
import {
    copyThemePresetInputSchema,
    createThemePresetInputSchema,
    layoutAppearanceMutationSchema,
    layoutAppearanceResetSchema,
    presetVersionMutationSchema,
    updateThemePresetInputSchema,
    ApplicationThemePresetsService,
    ApplicationsDomainError
} from '../services/applicationThemePresetsService'

const parseUuidV7Param = (req: Request, res: Response, key: string): string | null => {
    const parsed = uuidV7Schema.safeParse(req.params[key])
    if (!parsed.success) {
        res.status(400).json({ error: `Invalid ${key}`, code: 'THEME_PRESET_INVALID' })
        return null
    }
    return parsed.data
}

/**
 * Bot-bindings style controller: request-scoped RLS executor, manager
 * authorization inside the transaction, and controller-level typed error
 * mapping (the applications backend has no domain error handler middleware).
 */
export function createThemePresetsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler,
    getRequestDbExecutor?: (req: Request) => DbExecutor
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const requestExecutor = (req: Request): DbExecutor => {
        if (!getRequestDbExecutor) {
            throw new Error('Request-scoped database executor is required for theme presets')
        }
        return getRequestDbExecutor(req)
    }

    const APPLICATION_MANAGER_ROLES: readonly ApplicationRole[] = ['owner', 'admin']

    const authorizeManager = async (executor: DbExecutor, userId: string, applicationId: string): Promise<void> => {
        await ensureApplicationAccess(executor, userId, applicationId, [...APPLICATION_MANAGER_ROLES])
    }

    // "See the layout — see its theme": reads follow the application's
    // configurable layouts read policy; mutations stay owner/admin.
    const authorizeReader = async (executor: DbExecutor, userId: string, applicationId: string): Promise<void> => {
        const roles = await resolveApplicationLayoutReadRoles(executor, applicationId)
        await ensureApplicationAccess(executor, userId, applicationId, roles)
    }

    const parseApplicationId = (req: Request, res: Response): string | null => parseUuidV7Param(req, res, 'applicationId')

    const service = (executor: DbExecutor, applicationId: string): ApplicationThemePresetsService =>
        new ApplicationThemePresetsService(executor, async () => {
            // Fail closed like the layouts controller: a soft-deleted or
            // unknown application must not fall back to a default schema.
            const schemaName = await getApplicationRuntimeSchemaName(executor, applicationId)
            if (!schemaName) {
                throw new ThemePresetNotFoundError()
            }
            return schemaName
        })

    const toErrorBody = (error: unknown): { status: number; body: Record<string, unknown> } | null => {
        if (error instanceof ApplicationsDomainError) {
            return {
                status: error.statusCode,
                body: { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }
            }
        }
        if (error instanceof ThemePresetNotFoundError) {
            return { status: 404, body: { error: error.message, code: 'THEME_PRESET_NOT_FOUND' } }
        }
        if (error instanceof ThemePresetCodenameConflictError) {
            return {
                status: 409,
                body: {
                    error: error.message,
                    code: 'THEME_PRESET_INVALID',
                    details: { reason: 'codename-conflict', codename: error.codename }
                }
            }
        }
        if (error instanceof OptimisticLockError) {
            return { status: 409, body: { error: 'Theme preset was modified by another user', code: 'THEME_PRESET_VERSION_CONFLICT' } }
        }
        return null
    }

    const list = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const executor = requestExecutor(req)
        await authorizeReader(executor, userId, applicationId)
        const includeArchived = req.query.includeArchived === 'true'
        try {
            const result = await service(executor, applicationId).listPresets(applicationId, includeArchived)
            return res.json(result)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const create = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const parsed = createThemePresetInputSchema.safeParse(req.body)
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            const created = await executor.transaction(async (tx) => {
                await authorizeManager(tx, userId, applicationId)
                return service(tx, applicationId).createPreset(applicationId, parsed.data, userId)
            })
            return res.status(201).json(created)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const getById = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const presetId = parseUuidV7Param(req, res, 'presetId')
        if (!presetId) return
        const executor = requestExecutor(req)
        await authorizeReader(executor, userId, applicationId)
        try {
            const preset = await service(executor, applicationId).getPreset(applicationId, presetId)
            if (!preset) return res.status(404).json({ error: 'Theme preset not found', code: 'THEME_PRESET_NOT_FOUND' })
            return res.json(preset)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const update = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const presetId = parseUuidV7Param(req, res, 'presetId')
        if (!presetId) return
        const parsed = updateThemePresetInputSchema.safeParse(req.body)
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            const updated = await executor.transaction(async (tx) => {
                await authorizeManager(tx, userId, applicationId)
                return service(tx, applicationId).updatePreset(applicationId, presetId, parsed.data, userId)
            })
            return res.json(updated)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const remove = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const presetId = parseUuidV7Param(req, res, 'presetId')
        if (!presetId) return
        const parsed = presetVersionMutationSchema.safeParse(req.body ?? {})
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            const result = await executor.transaction(async (tx) => {
                await authorizeManager(tx, userId, applicationId)
                const serviceInstance = service(tx, applicationId)
                const preset = await serviceInstance.getPreset(applicationId, presetId)
                if (!preset) return null
                return preset.archived
                    ? serviceInstance.deletePreset(applicationId, presetId, parsed.data.expectedVersion, userId)
                    : serviceInstance.archivePreset(applicationId, presetId, parsed.data.expectedVersion, userId)
            })
            if (!result) return res.status(404).json({ error: 'Theme preset not found', code: 'THEME_PRESET_NOT_FOUND' })
            return res.json(result)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const copy = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const parsed = copyThemePresetInputSchema.safeParse(req.body ?? {})
        if (!parsed.success)
            return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            const created = await executor.transaction(async (tx) => {
                await authorizeManager(tx, userId, applicationId)
                return service(tx, applicationId).copyPreset(applicationId, parsed.data, userId)
            })
            return res.status(201).json(created)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const exportPreset = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const presetId = parseUuidV7Param(req, res, 'presetId')
        if (!presetId) return
        const executor = requestExecutor(req)
        await authorizeManager(executor, userId, applicationId)
        try {
            const codenameOverride = typeof req.query.codename === 'string' ? req.query.codename : undefined
            const envelope = await service(executor, applicationId).exportPreset(applicationId, presetId, codenameOverride, userId)
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Content-Disposition', `attachment; filename="${envelope.id}.theme.json"`)
            return res.status(200).send(JSON.stringify(envelope, null, 2))
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const applyAppearance = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const layoutId = parseUuidV7Param(req, res, 'layoutId')
        if (!layoutId) return
        const parsed = layoutAppearanceMutationSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
        }
        const executor = requestExecutor(req)
        try {
            // Note: the preset lookup inside resolveAppearanceDraft must run on
            // the request executor outside a knex transaction — the RLS JWT
            // context does not survive a nested BEGIN on a pooled connection.
            await authorizeManager(executor, userId, applicationId)
            const result = await service(executor, applicationId).applyLayoutAppearance(applicationId, layoutId, parsed.data, userId)
            return res.json(result)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const resetAppearance = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const layoutId = parseUuidV7Param(req, res, 'layoutId')
        if (!layoutId) return
        const parsed = layoutAppearanceResetSchema.safeParse(req.body ?? {})
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            const result = await executor.transaction(async (tx) => {
                await authorizeManager(tx, userId, applicationId)
                return service(tx, applicationId).resetLayoutAppearance(applicationId, layoutId, parsed.data.expectedVersion, userId)
            })
            return res.json(result)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    const applyLatestAppearance = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return
        const layoutId = parseUuidV7Param(req, res, 'layoutId')
        if (!layoutId) return
        const parsed = layoutAppearanceResetSchema.safeParse(req.body ?? {})
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        const executor = requestExecutor(req)
        try {
            await authorizeManager(executor, userId, applicationId)
            const result = await service(executor, applicationId).applyLatestLayoutAppearance(
                applicationId,
                layoutId,
                parsed.data.expectedVersion,
                userId
            )
            return res.json(result)
        } catch (error) {
            const mapped = toErrorBody(error)
            if (mapped) return res.status(mapped.status).json(mapped.body)
            throw error
        }
    }

    router.get('/applications/:applicationId/theme-presets', readLimiter, asyncHandler(list))
    router.post('/applications/:applicationId/theme-presets', writeLimiter, asyncHandler(create))
    router.get('/applications/:applicationId/theme-presets/:presetId', readLimiter, asyncHandler(getById))
    router.patch('/applications/:applicationId/theme-presets/:presetId', writeLimiter, asyncHandler(update))
    router.delete('/applications/:applicationId/theme-presets/:presetId', writeLimiter, asyncHandler(remove))
    router.post('/applications/:applicationId/theme-presets/:presetId/copy', writeLimiter, asyncHandler(copy))
    router.get('/applications/:applicationId/theme-presets/:presetId/export', readLimiter, asyncHandler(exportPreset))

    router.patch('/applications/:applicationId/layouts/:layoutId/appearance', writeLimiter, asyncHandler(applyAppearance))
    router.post('/applications/:applicationId/layouts/:layoutId/appearance/reset', writeLimiter, asyncHandler(resetAppearance))
    router.post('/applications/:applicationId/layouts/:layoutId/appearance/apply-latest', writeLimiter, asyncHandler(applyLatestAppearance))

    return router
}
