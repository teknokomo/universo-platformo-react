import type { Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { OptimisticLockError, uuidV7Schema } from '@universo-react/utils'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { Router, type RequestHandler } from 'express'

import { asyncHandler } from '../../shared'
import { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import {
    copyThemePresetInputSchema,
    createThemePresetInputSchema,
    layoutAppearanceMutationSchema,
    layoutAppearanceResetSchema,
    presetVersionMutationSchema,
    ThemePresetVersionConflictError,
    updateThemePresetInputSchema,
    MetahubThemePresetsService
} from '../themePresetsService'

const parseUuidV7Param = (value: unknown): string | null => {
    const parsed = uuidV7Schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

export function createThemePresetsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)
    router.use((req, res, next) => {
        if (req.params.metahubId && !uuidV7Schema.safeParse(req.params.metahubId).success) {
            res.status(400).json({ error: 'Invalid metahub ID', code: 'THEME_PRESET_INVALID' })
            return
        }
        next()
    })

    const createHandler = createMetahubHandlerFactory(getDbExecutor)
    // TH-14: validate :metahubId before any handler logic (the shared factory
    // reads it raw; garbage would reach the membership SQL as PG 22P02 → 500).
    const parseMetahubIdParam = (req: { params: Record<string, string> }): string | null => {
        const parsed = uuidV7Schema.safeParse(req.params.metahubId)
        return parsed.success ? parsed.data : null
    }
    // Preset mutations surface the TZ §11.5 version-conflict code instead of
    // the generic optimistic-lock payload.
    const createManagedHandler = (
        handler: Parameters<ReturnType<typeof createMetahubHandlerFactory>>[0],
        options?: Parameters<ReturnType<typeof createMetahubHandlerFactory>>[1]
    ) =>
        createHandler(async (ctx) => {
            try {
                return await handler(ctx)
            } catch (error) {
                if (error instanceof OptimisticLockError) throw new ThemePresetVersionConflictError(error.conflict)
                throw error
            }
        }, options)

    const service = (exec: DbExecutor, schemaService: MetahubSchemaService) => new MetahubThemePresetsService(exec, schemaService)

    const ctrl = {
        list: createHandler(async ({ req, res, metahubId, exec, schemaService }) => {
            const includeArchived = req.query.includeArchived === 'true'
            const result = await service(exec, schemaService).listPresets(metahubId, includeArchived)
            return res.json(result)
        }),
        create: createManagedHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const parsed = createThemePresetInputSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
                }
                const created = await service(exec, schemaService).createPreset(metahubId, parsed.data, userId)
                return res.status(201).json(created)
            },
            { permission: 'manageMetahub' }
        ),
        getById: createHandler(async ({ req, res, metahubId, exec, schemaService }) => {
            const presetId = parseUuidV7Param(req.params.presetId)
            if (!presetId) return res.status(400).json({ error: 'Invalid preset ID', code: 'THEME_PRESET_INVALID' })
            const preset = await service(exec, schemaService).getPreset(metahubId, presetId)
            if (!preset) return res.status(404).json({ error: 'Theme preset not found', code: 'THEME_PRESET_NOT_FOUND' })
            return res.json(preset)
        }),
        update: createManagedHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const presetId = parseUuidV7Param(req.params.presetId)
                if (!presetId) return res.status(400).json({ error: 'Invalid preset ID', code: 'THEME_PRESET_INVALID' })
                const parsed = updateThemePresetInputSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
                }
                const updated = await service(exec, schemaService).updatePreset(metahubId, presetId, parsed.data, userId)
                return res.json(updated)
            },
            { permission: 'manageMetahub' }
        ),
        remove: createManagedHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const presetId = parseUuidV7Param(req.params.presetId)
                if (!presetId) return res.status(400).json({ error: 'Invalid preset ID', code: 'THEME_PRESET_INVALID' })
                const parsed = presetVersionMutationSchema.safeParse(req.body ?? {})
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
                }
                const serviceInstance = service(exec, schemaService)
                const preset = await serviceInstance.getPreset(metahubId, presetId)
                if (!preset) return res.status(404).json({ error: 'Theme preset not found', code: 'THEME_PRESET_NOT_FOUND' })
                const result = preset.archived
                    ? await serviceInstance.deletePreset(metahubId, presetId, parsed.data.expectedVersion, userId)
                    : await serviceInstance.archivePreset(metahubId, presetId, parsed.data.expectedVersion, userId)
                return res.json(result)
            },
            { permission: 'manageMetahub' }
        ),
        copy: createManagedHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const parsed = copyThemePresetInputSchema.safeParse(req.body ?? {})
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
                }
                const created = await service(exec, schemaService).copyPreset(metahubId, parsed.data, userId)
                return res.status(201).json(created)
            },
            { permission: 'manageMetahub' }
        ),
        exportPreset: createManagedHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const presetId = parseUuidV7Param(req.params.presetId)
                if (!presetId) return res.status(400).json({ error: 'Invalid preset ID', code: 'THEME_PRESET_INVALID' })
                const codenameOverride = typeof req.query.codename === 'string' ? req.query.codename : undefined
                const envelope = await service(exec, schemaService).exportPreset(metahubId, presetId, codenameOverride, userId)
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.setHeader('Content-Disposition', `attachment; filename="${envelope.id}.theme.json"`)
                return res.status(200).send(JSON.stringify(envelope, null, 2))
            },
            { permission: 'manageMetahub' }
        ),
        applyAppearance: createHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const layoutId = parseUuidV7Param(req.params.layoutId)
                if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
                const parsed = layoutAppearanceMutationSchema.safeParse(req.body)
                if (!parsed.success) {
                    return res
                        .status(400)
                        .json({ error: 'Invalid input', code: 'THEME_PRESET_INVALID', details: parsed.error.flatten() })
                }
                const result = await service(exec, schemaService).applyLayoutAppearance(metahubId, layoutId, parsed.data, userId)
                return res.json(result)
            },
            { permission: 'manageMetahub' }
        ),
        resetAppearance: createHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const layoutId = parseUuidV7Param(req.params.layoutId)
                if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
                const parsed = layoutAppearanceResetSchema.safeParse(req.body ?? {})
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
                }
                const result = await service(exec, schemaService).resetLayoutAppearance(
                    metahubId,
                    layoutId,
                    parsed.data.expectedVersion,
                    userId
                )
                return res.json(result)
            },
            { permission: 'manageMetahub' }
        ),
        applyLatestAppearance: createHandler(
            async ({ req, res, metahubId, userId, exec, schemaService }) => {
                const layoutId = parseUuidV7Param(req.params.layoutId)
                if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
                const parsed = layoutAppearanceResetSchema.safeParse(req.body ?? {})
                if (!parsed.success) {
                    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
                }
                const result = await service(exec, schemaService).applyLatestLayoutAppearance(
                    metahubId,
                    layoutId,
                    parsed.data.expectedVersion,
                    userId
                )
                return res.json(result)
            },
            { permission: 'manageMetahub' }
        )
    }

    router.get('/metahub/:metahubId/theme-presets', readLimiter, asyncHandler(ctrl.list))
    router.post('/metahub/:metahubId/theme-presets', writeLimiter, asyncHandler(ctrl.create))
    router.get('/metahub/:metahubId/theme-presets/:presetId', readLimiter, asyncHandler(ctrl.getById))
    router.patch('/metahub/:metahubId/theme-presets/:presetId', writeLimiter, asyncHandler(ctrl.update))
    router.delete('/metahub/:metahubId/theme-presets/:presetId', writeLimiter, asyncHandler(ctrl.remove))
    router.post('/metahub/:metahubId/theme-presets/:presetId/copy', writeLimiter, asyncHandler(ctrl.copy))
    router.get('/metahub/:metahubId/theme-presets/:presetId/export', readLimiter, asyncHandler(ctrl.exportPreset))

    router.patch('/metahub/:metahubId/layout/:layoutId/appearance', writeLimiter, asyncHandler(ctrl.applyAppearance))
    router.post('/metahub/:metahubId/layout/:layoutId/appearance/reset', writeLimiter, asyncHandler(ctrl.resetAppearance))
    router.post('/metahub/:metahubId/layout/:layoutId/appearance/apply-latest', writeLimiter, asyncHandler(ctrl.applyLatestAppearance))

    return router
}
