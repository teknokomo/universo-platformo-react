import { z } from 'zod'
import {
    APPLICATION_TEMPLATE_REGISTRY,
    applicationTemplateKeySchema,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    decodeLayoutConfigEnvelope,
    type ApplicationTemplateKey
} from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import {
    MetahubLayoutsService,
    createLayoutSchema,
    updateLayoutSchema,
    updateLayoutZoneSettingSchema,
    resetLayoutZoneSettingSchema,
    assignLayoutZoneWidgetSchema,
    duplicateLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema,
    toggleLayoutZoneWidgetActiveSchema
} from '../services/MetahubLayoutsService'
import { OptimisticLockError, localizedContent, uuidV7Schema } from '@universo-react/utils'
import { copyMetahubLayout } from '../services/copyMetahubLayout'
import { ensureMetahubAccess } from '../../shared/guards'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredLocaleEntry = { content?: unknown } | unknown
type StoredLocaleMap = Record<string, StoredLocaleEntry>
type StoredPrimary = { _primary?: unknown }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseExpectedVersionQuery = (value: unknown): number | null => {
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) {
        return null
    }
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const parseUuidV7Param = (value: unknown): string | null => {
    const parsed = uuidV7Schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const copyLayoutSchema = z
    .object({
        name: z.union([z.string(), z.record(z.string())]).optional(),
        description: z.union([z.string(), z.record(z.string())]).optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyWidgets: z.boolean().optional(),
        deactivateAllWidgets: z.boolean().optional(),
        entityBindingCopyMode: z.enum(['reuse', 'omit']).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const toLocalizedInputRecord = (value: unknown): Record<string, string | undefined> => {
    if (typeof value === 'string') {
        return { en: value }
    }
    if (value && typeof value === 'object') {
        return value as Record<string, string | undefined>
    }
    return {}
}

const toStoredLocalizedRecord = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object') return {}

    if ('locales' in (value as Record<string, unknown>)) {
        const locales = (value as { locales?: StoredLocaleMap }).locales
        const result: Record<string, string> = {}
        if (!locales || typeof locales !== 'object') return result
        for (const [locale, entry] of Object.entries(locales)) {
            const content =
                typeof entry === 'object' && entry !== null && 'content' in entry ? (entry as { content?: unknown }).content : entry
            if (typeof content !== 'string') continue
            const trimmed = content.trim()
            if (!trimmed) continue
            result[locale] = trimmed
        }
        return result
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of Object.entries(value as Record<string, unknown>)) {
        if (typeof content !== 'string') continue
        const trimmed = content.trim()
        if (!trimmed) continue
        result[locale] = trimmed
    }
    return result
}

const listQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    sortBy: z.enum(['name', 'created', 'updated']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    scopeEntityId: uuidV7Schema.optional(),
    search: z.string().optional()
})

const updateWidgetScopeVisibilitySchema = z
    .object({
        isVisible: z.boolean(),
        expectedVersion: z.number().int().positive()
    })
    .strict()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createLayoutsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const parsed = listQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const layoutsService = new MetahubLayoutsService(exec, schemaService)
        const result = await layoutsService.listLayouts(metahubId, parsed.data, userId)
        return res.json(result)
    })

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const sanitizedName = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
            const nameVlc = buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: ReturnType<typeof buildLocalizedContent> | null | undefined = undefined
            if (parsed.data.description === null) {
                descriptionVlc = null
            } else if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                descriptionVlc =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(
                              sanitizedDescription,
                              parsed.data.descriptionPrimaryLocale,
                              parsed.data.namePrimaryLocale ?? 'en'
                          )
                        : null
            }

            const createInput = {
                ...parsed.data,
                name: nameVlc,
                description: descriptionVlc
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const created = await layoutsService.createLayout(metahubId, createInput, userId)
            return res.status(201).json(created)
        },
        { permission: 'manageMetahub' }
    )

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const layoutId = parseUuidV7Param(req.params.layoutId)
        if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

        const layoutsService = new MetahubLayoutsService(exec, schemaService)
        const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
        if (!layout) return res.status(404).json({ error: 'Layout not found' })
        return res.json(layout)
    })

    const copy = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const parsed = copyLayoutSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const created = await copyMetahubLayout({
                executor: exec,
                schemaName,
                layoutId,
                userId,
                input: parsed.data
            })
            const createdTemplateKey = applicationTemplateKeySchema.parse(created.template_key)
            const createdEnvelope = decodeLayoutConfigEnvelope(created.config ?? {}, { templateKey: createdTemplateKey })
            return res.status(201).json({
                id: created.id,
                scopeEntityId: created.scope_entity_id ?? null,
                baseLayoutId: created.base_layout_id ?? null,
                templateKey: createdTemplateKey,
                name: created.name ?? {},
                description: created.description ?? null,
                config: createdEnvelope.rendererConfig,
                neutral: createdEnvelope.neutral,
                isActive: created.is_active !== false,
                isDefault: created.is_default === true,
                sortOrder: typeof created.sort_order === 'number' ? created.sort_order : 0,
                version: typeof created._upl_version === 'number' ? created._upl_version : 1,
                createdAt: created._upl_created_at,
                updatedAt: created._upl_updated_at
            })
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = updateLayoutSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const existingLayout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
            if (!existingLayout) {
                return res.status(404).json({ error: 'Layout not found' })
            }

            const updateInput = { ...parsed.data }
            const existingNamePrimary =
                existingLayout.name && typeof existingLayout.name === 'object' && '_primary' in existingLayout.name
                    ? String((existingLayout.name as StoredPrimary)._primary)
                    : undefined
            const existingDescriptionPrimary =
                existingLayout.description && typeof existingLayout.description === 'object' && '_primary' in existingLayout.description
                    ? String((existingLayout.description as StoredPrimary)._primary)
                    : undefined

            if (parsed.data.name !== undefined) {
                const existingName = toStoredLocalizedRecord(existingLayout.name)
                const incomingName = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
                const mergedName = { ...existingName, ...incomingName }
                const namePrimaryLocale = parsed.data.namePrimaryLocale ?? existingNamePrimary
                const nameVlc = buildLocalizedContent(mergedName, namePrimaryLocale, 'en')
                if (!nameVlc) {
                    return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
                }
                updateInput.name = nameVlc
            }

            if (parsed.data.description !== undefined) {
                if (parsed.data.description === null) {
                    updateInput.description = null
                } else {
                    const existingDescription = toStoredLocalizedRecord(existingLayout.description)
                    const incomingDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                    const mergedDescription = { ...existingDescription, ...incomingDescription }
                    const descriptionPrimaryLocale =
                        parsed.data.descriptionPrimaryLocale ??
                        existingDescriptionPrimary ??
                        parsed.data.namePrimaryLocale ??
                        existingNamePrimary
                    updateInput.description =
                        Object.keys(mergedDescription).length > 0
                            ? buildLocalizedContent(mergedDescription, descriptionPrimaryLocale, descriptionPrimaryLocale ?? 'en')
                            : null
                }
            }
            try {
                const updated = await layoutsService.updateLayout(metahubId, layoutId, updateInput, userId)
                return res.json(updated)
            } catch (error: unknown) {
                if (error instanceof OptimisticLockError) {
                    return res.status(409).json({ error: error.message, code: error.code, conflict: error.conflict })
                }
                throw error
            }
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const expectedVersion = parseExpectedVersionQuery(req.query.expectedVersion)
            if (expectedVersion === null) {
                return res.status(400).json({ error: 'Invalid expected version' })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            await layoutsService.deleteLayout(metahubId, layoutId, expectedVersion, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    const updateZoneSetting = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = updateLayoutZoneSettingSchema.safeParse({
                ...(req.body ?? {}),
                zone: req.params.zone,
                settingKey: req.params.settingKey
            })
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const updated = await layoutsService.updateLayoutZoneSetting(
                metahubId,
                layoutId,
                parsed.data.zone,
                parsed.data.settingKey,
                parsed.data.value,
                userId,
                parsed.data.expectedVersion
            )
            return res.json({ item: updated })
        },
        { permission: 'manageMetahub' }
    )

    const resetZoneSetting = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = resetLayoutZoneSettingSchema.safeParse({
                ...(req.body ?? {}),
                zone: req.params.zone,
                settingKey: req.params.settingKey
            })
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const updated = await layoutsService.resetLayoutZoneSetting(
                metahubId,
                layoutId,
                parsed.data.zone,
                parsed.data.settingKey,
                userId,
                parsed.data.expectedVersion
            )
            return res.json({ item: updated })
        },
        { permission: 'manageMetahub' }
    )

    const widgetsObject = createHandler(async ({ req, res }) => {
        if (!parseUuidV7Param(req.params.layoutId)) return res.status(400).json({ error: 'Invalid layout ID' })

        const items = LAYOUT_WIDGET_DEFINITIONS.map((widget) => ({ ...widget }))
        const templates = (Object.keys(APPLICATION_TEMPLATE_REGISTRY) as ApplicationTemplateKey[]).map((templateKey) => ({
            ...APPLICATION_TEMPLATE_REGISTRY[templateKey],
            zones: LAYOUT_ZONE_DEFINITIONS.filter((zone) => zone.templateKey === templateKey),
            widgets: items.filter((widget) => widget.supportedTemplates.includes(templateKey))
        }))

        return res.json({
            items,
            templates
        })
    })

    const listZoneWidgets = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const layoutId = parseUuidV7Param(req.params.layoutId)
        if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

        const layoutsService = new MetahubLayoutsService(exec, schemaService)
        const items = await layoutsService.listLayoutZoneWidgets(metahubId, layoutId, userId)
        return res.json({ items })
    })

    const assignZoneWidget = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = assignLayoutZoneWidgetSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const definition = getLayoutWidgetDefinition(parsed.data.widgetKey, parsed.data.config)
            if (definition?.bindingSlots?.some(({ cardinality }) => cardinality.min > 0)) {
                await ensureMetahubAccess(exec, userId, metahubId, 'editContent')
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const item = await layoutsService.assignLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const moveZoneWidget = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = moveLayoutZoneWidgetSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const items = await layoutsService.moveLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const duplicateZoneWidgetPlacement = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            const parsed = duplicateLayoutZoneWidgetSchema.safeParse(req.body)
            if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const item = await layoutsService.duplicateLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
            return res.status(201).json(item)
        },
        { permission: 'manageMetahub' }
    )

    const removeZoneWidget = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const expectedVersion = parseExpectedVersionQuery(req.query.expectedVersion)
            if (expectedVersion === null) {
                return res.status(400).json({ error: 'Invalid expected version' })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            await layoutsService.removeLayoutZoneWidget(metahubId, layoutId, widgetId, userId, expectedVersion)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    const updateZoneWidgetConfig = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const parsed = updateLayoutZoneWidgetConfigSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const widget = await layoutsService.updateLayoutZoneWidgetConfig(
                metahubId,
                layoutId,
                widgetId,
                parsed.data.config,
                userId,
                parsed.data.expectedVersion
            )
            return res.json({ item: widget })
        },
        { permission: 'manageMetahub' }
    )

    const resetZoneWidgetOverride = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })
            const expectedVersion = parseExpectedVersionQuery(req.query.expectedVersion)
            if (expectedVersion === null) {
                return res.status(400).json({ error: 'Invalid expected version' })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            await layoutsService.resetLayoutZoneWidgetOverride(metahubId, layoutId, widgetId, userId, expectedVersion)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    const toggleZoneWidgetActive = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const parsed = toggleLayoutZoneWidgetActiveSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const widget = await layoutsService.toggleLayoutZoneWidgetActive(
                metahubId,
                layoutId,
                widgetId,
                parsed.data.isActive,
                userId,
                parsed.data.expectedVersion
            )
            return res.json({ item: widget })
        },
        { permission: 'manageMetahub' }
    )

    const listWidgetScopeVisibility = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const items = await layoutsService.listLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId, userId)
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const updateWidgetScopeVisibility = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const layoutId = parseUuidV7Param(req.params.layoutId)
            const widgetId = parseUuidV7Param(req.params.widgetId)
            const scopeEntityId = parseUuidV7Param(req.params.scopeEntityId)
            if (!layoutId) return res.status(400).json({ error: 'Invalid layout ID' })
            if (!widgetId) return res.status(400).json({ error: 'Invalid widget ID' })
            if (!scopeEntityId) return res.status(400).json({ error: 'Invalid scope entity ID' })

            const parsed = updateWidgetScopeVisibilitySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const layoutsService = new MetahubLayoutsService(exec, schemaService)
            const items = await layoutsService.setLayoutWidgetScopeVisibility(
                metahubId,
                layoutId,
                widgetId,
                scopeEntityId,
                parsed.data.isVisible,
                userId,
                parsed.data.expectedVersion
            )
            const item = items.find((row) => row.scopeEntityId === scopeEntityId)
            return res.json({ item })
        },
        { permission: 'manageMetahub' }
    )

    return {
        list,
        create,
        getById,
        copy,
        update,
        remove,
        updateZoneSetting,
        resetZoneSetting,
        widgetsObject,
        listZoneWidgets,
        assignZoneWidget,
        duplicateZoneWidgetPlacement,
        moveZoneWidget,
        removeZoneWidget,
        resetZoneWidgetOverride,
        updateZoneWidgetConfig,
        toggleZoneWidgetActive,
        listWidgetScopeVisibility,
        updateWidgetScopeVisibility
    }
}
