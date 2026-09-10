import { z } from 'zod'
import {
    APPLICATION_TEMPLATE_REGISTRY,
    applicationTemplateKeySchema,
    getLayoutWidgetAllowedZones,
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    MARKETING_WIDGET_REGISTRY,
    marketingPageConfigSchema,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey,
    type LayoutCopyOptions
} from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import type { SqlQueryable } from '../../../utils'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    MetahubLayoutsService,
    LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY,
    createLayoutSchema,
    updateLayoutSchema,
    assignLayoutZoneWidgetSchema,
    moveLayoutZoneWidgetSchema,
    updateLayoutZoneWidgetConfigSchema,
    toggleLayoutZoneWidgetActiveSchema
} from '../services/MetahubLayoutsService'
import { OptimisticLockError, generateUuidV7, localizedContent, uuidV7Schema, validation } from '@universo-react/utils'
import { buildDashboardLayoutConfig } from '../../shared'
import { MetahubDomainError } from '../../shared/domainErrors'
import { findDuplicateActiveSingleInstanceWidgetKey } from '../widgetInvariants'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeLayoutCopyOptions } = validation

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredLocaleEntry = { content?: unknown } | unknown
type StoredLocaleMap = Record<string, StoredLocaleEntry>
type StoredPrimary = { _primary?: unknown }
type SourceWidgetRow = {
    id?: string
    zone?: string
    widget_key?: string
    sort_order?: number
    config?: unknown
    is_active?: boolean
}

type SourceLayoutWidgetOverrideRow = {
    base_widget_id?: string
    zone?: string | null
    sort_order?: number | null
    config?: unknown
    is_active?: boolean | null
    is_deleted_override?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const prepareCopiedWidgetConfig = (
    templateKey: ApplicationTemplateKey,
    widgetKey: unknown,
    zone: unknown,
    config: unknown
): Record<string, unknown> => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find((item) => item.key === widgetKey)
    const allowedZones = definition ? getLayoutWidgetAllowedZones(definition.key, templateKey) : undefined
    if (!definition || !definition.supportedTemplates.includes(templateKey) || !allowedZones?.includes(zone as ApplicationLayoutZone)) {
        throw new MetahubDomainError({
            message: 'Layout widget configuration is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }

    const rawConfig = isRecord(config) ? config : {}
    if (templateKey === 'dashboard') return rawConfig

    try {
        const isMarketingWidget =
            typeof widgetKey === 'string' && Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey)
        return parseApplicationLayoutWidgetConfig(
            widgetKey as ApplicationLayoutWidgetKey,
            isMarketingWidget ? { ...rawConfig, instanceKey: generateUuidV7() } : rawConfig
        )
    } catch {
        throw new MetahubDomainError({
            message: 'Marketing widget configuration is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR'
        })
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const parseExpectedVersionQuery = (value: unknown): number | null => {
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) {
        return null
    }
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const assertExpectedLayoutVersion = (row: Record<string, unknown>, expectedVersion: number | undefined): void => {
    if (expectedVersion === undefined) return
    const currentVersion = typeof row._upl_version === 'number' && row._upl_version > 0 ? row._upl_version : 1
    if (currentVersion !== expectedVersion) {
        throw new MetahubDomainError({
            message: 'Layout was modified by another request',
            statusCode: 409,
            code: 'CONFLICT',
            details: { operation: 'copy-layout' }
        })
    }
}

const assertNoDuplicateActiveSingleInstanceWidgets = (
    rows: readonly { widgetKey?: unknown; widget_key?: unknown; isActive?: unknown; is_active?: unknown }[]
): void => {
    if (findDuplicateActiveSingleInstanceWidgetKey(rows) !== null) {
        throw new MetahubDomainError({
            message: 'Active single-instance layout widgets must be unique within a layout',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: { operation: 'copy-layout' }
        })
    }
}

const parseUuidV7Param = (value: unknown): string | null => {
    const parsed = uuidV7Schema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return { en: 'Copy (copy)' }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

const copyLayoutSchema = z
    .object({
        name: z.union([z.string(), z.record(z.string())]).optional(),
        description: z.union([z.string(), z.record(z.string())]).optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyWidgets: z.boolean().optional(),
        deactivateAllWidgets: z.boolean().optional(),
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

            const copyOptions: LayoutCopyOptions = normalizeLayoutCopyOptions({
                copyWidgets: parsed.data.copyWidgets,
                deactivateAllWidgets: parsed.data.deactivateAllWidgets
            })
            const shouldDeactivateWidgets =
                copyOptions.copyWidgets && (parsed.data.deactivateAllWidgets ?? copyOptions.deactivateAllWidgets)

            const schemaName = await schemaService.ensureSchema(metahubId, userId)
            const layoutsQt = qSchemaTable(schemaName, '_mhb_layouts')
            const widgetsQt = qSchemaTable(schemaName, '_mhb_widgets')
            const overridesQt = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')

            const created = await exec.transaction(async (trx: SqlQueryable) => {
                const sourceLayout = await queryOne<Record<string, unknown>>(
                    trx,
                    `SELECT * FROM ${layoutsQt}
                     WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                     FOR UPDATE`,
                    [layoutId]
                )
                if (!sourceLayout) {
                    throw new MetahubDomainError({
                        message: 'Layout not found',
                        statusCode: 404,
                        code: 'NOT_FOUND',
                        details: { operation: 'copy-layout' }
                    })
                }
                assertExpectedLayoutVersion(sourceLayout, parsed.data.expectedVersion)

                const sourceTemplateKey = applicationTemplateKeySchema.parse(sourceLayout.template_key)
                const scopeEntityId = typeof sourceLayout.scope_entity_id === 'string' ? sourceLayout.scope_entity_id : null
                const baseLayoutId = typeof sourceLayout.base_layout_id === 'string' ? sourceLayout.base_layout_id : null
                const isScopedLayout = scopeEntityId !== null
                const isOverlayLayout = isScopedLayout && baseLayoutId !== null

                if (isOverlayLayout) {
                    const baseLayout = await queryOne<Record<string, unknown>>(
                        trx,
                        `SELECT id FROM ${layoutsQt}
                         WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                         FOR UPDATE`,
                        [baseLayoutId]
                    )
                    if (!baseLayout) {
                        throw new MetahubDomainError({
                            message: 'Layout base is no longer available',
                            statusCode: 409,
                            code: 'CONFLICT',
                            details: { operation: 'copy-layout' }
                        })
                    }
                }

                const sourceName = isRecord(sourceLayout.name) ? sourceLayout.name : {}
                const requestedName = parsed.data.name
                    ? sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
                    : buildDefaultCopyNameInput(sourceName)
                if (Object.keys(requestedName).length === 0) {
                    throw new MetahubDomainError({
                        message: 'Name is required',
                        statusCode: 400,
                        code: 'VALIDATION_ERROR',
                        details: { operation: 'copy-layout' }
                    })
                }

                const sourceNamePrimary = typeof sourceName._primary === 'string' ? sourceName._primary : 'en'
                const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
                if (!nameVlc) {
                    throw new MetahubDomainError({
                        message: 'Name is required',
                        statusCode: 400,
                        code: 'VALIDATION_ERROR',
                        details: { operation: 'copy-layout' }
                    })
                }

                let descriptionVlc: unknown = sourceLayout.description ?? null
                if (parsed.data.description !== undefined) {
                    const sanitizedDescription = sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.description))
                    descriptionVlc =
                        Object.keys(sanitizedDescription).length > 0
                            ? buildLocalizedContent(
                                  sanitizedDescription,
                                  parsed.data.descriptionPrimaryLocale,
                                  parsed.data.namePrimaryLocale ?? sourceNamePrimary
                              )
                            : null
                }

                const isDashboardLayout = sourceTemplateKey === 'dashboard'
                const sourceConfig = isRecord(sourceLayout.config) ? sourceLayout.config : {}
                if (!isDashboardLayout) {
                    const marketingConfig = marketingPageConfigSchema.safeParse(sourceConfig)
                    if (!marketingConfig.success) {
                        throw new MetahubDomainError({
                            message: 'Marketing layout configuration is invalid',
                            statusCode: 409,
                            code: 'VALIDATION_ERROR',
                            details: { operation: 'copy-layout' }
                        })
                    }
                }
                const now = new Date()

                const layoutConfig = !isDashboardLayout
                    ? sourceConfig
                    : copyOptions.copyWidgets
                    ? shouldDeactivateWidgets
                        ? { ...sourceConfig, ...buildDashboardLayoutConfig([]) }
                        : sourceConfig
                    : {
                          ...sourceConfig,
                          ...buildDashboardLayoutConfig([]),
                          [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
                      }

                const createdLayout = await queryOne<Record<string, unknown>>(
                    trx,
                    `INSERT INTO ${layoutsQt} (
            scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked,
            _mhb_published, _mhb_archived, _mhb_deleted
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $11, $12, $13,
            $14, $14, $14,
            $15, $14, $14
        ) RETURNING *`,
                    [
                        isScopedLayout ? scopeEntityId : null,
                        isScopedLayout ? baseLayoutId : null,
                        sourceTemplateKey,
                        JSON.stringify(nameVlc),
                        descriptionVlc ? JSON.stringify(descriptionVlc) : null,
                        JSON.stringify(layoutConfig),
                        sourceLayout.is_active !== false,
                        false,
                        typeof sourceLayout.sort_order === 'number' ? sourceLayout.sort_order : 0,
                        null,
                        now,
                        userId ?? null,
                        1,
                        false,
                        true
                    ]
                )

                if (!createdLayout) {
                    throw new MetahubDomainError({
                        message: 'Failed to create layout copy',
                        statusCode: 500,
                        code: 'SCHEMA_SYNC_FAILED',
                        details: { operation: 'copy-layout', layoutId }
                    })
                }

                if (copyOptions.copyWidgets) {
                    const sourceWidgets = await queryMany<SourceWidgetRow>(
                        trx,
                        `SELECT id, zone, widget_key, sort_order, config, is_active
           FROM ${widgetsQt}
           WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
           ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC
           FOR UPDATE`,
                        [layoutId]
                    )

                    const copiedWidgetRows: Array<{ widgetKey: unknown; isActive: boolean }> = []
                    if (sourceWidgets.length > 0) {
                        const placeholders: string[] = []
                        const params: unknown[] = []
                        let idx = 1
                        for (const widget of sourceWidgets) {
                            const copiedWidgetConfig = prepareCopiedWidgetConfig(
                                sourceTemplateKey,
                                widget.widget_key,
                                widget.zone,
                                widget.config
                            )
                            placeholders.push(
                                `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${
                                    idx + 6
                                }, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 9}, $${idx + 9}, $${idx + 10}, $${idx + 9}, $${idx + 9})`
                            )
                            const isActive = shouldDeactivateWidgets ? false : widget.is_active !== false
                            copiedWidgetRows.push({ widgetKey: widget.widget_key, isActive })
                            params.push(
                                createdLayout.id,
                                widget.zone,
                                widget.widget_key,
                                widget.sort_order ?? 1,
                                JSON.stringify(copiedWidgetConfig),
                                isActive,
                                now,
                                userId ?? null,
                                1,
                                false,
                                true
                            )
                            idx += 11
                        }
                        assertNoDuplicateActiveSingleInstanceWidgets(copiedWidgetRows)
                        const insertedWidgetRows = await trx.query<{ id: string }>(
                            `INSERT INTO ${widgetsQt} (
                layout_id, zone, widget_key, sort_order, config, is_active,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
                _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted
            ) VALUES ${placeholders.join(', ')}
            RETURNING id`,
                            params
                        )
                        if (insertedWidgetRows.length !== sourceWidgets.length) {
                            throw new MetahubDomainError({
                                message: 'Failed to create copied layout widgets',
                                statusCode: 500,
                                code: 'SCHEMA_SYNC_FAILED',
                                details: { operation: 'copy-layout' }
                            })
                        }
                    }

                    if (isOverlayLayout) {
                        const sourceOverrides = await queryMany<SourceLayoutWidgetOverrideRow>(
                            trx,
                            `SELECT base_widget_id, zone, sort_order, config, is_active, is_deleted_override
                             FROM ${overridesQt}
                             WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                             ORDER BY _upl_created_at ASC
                             FOR UPDATE`,
                            [layoutId]
                        )

                        const overrideMap = new Map(
                            sourceOverrides
                                .filter((row) => typeof row.base_widget_id === 'string' && row.base_widget_id.length > 0)
                                .map((row) => [String(row.base_widget_id), row])
                        )

                        const baseWidgets = await queryMany<{ id: string; widget_key?: string; is_active?: boolean }>(
                            trx,
                            `SELECT id, widget_key, is_active FROM ${widgetsQt}
                             WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC
                             FOR UPDATE`,
                            [baseLayoutId]
                        )

                        const overridesToCopy = shouldDeactivateWidgets
                            ? baseWidgets.map((baseWidget) => {
                                  const sourceOverride = overrideMap.get(baseWidget.id)
                                  if (sourceOverride?.is_deleted_override === true) {
                                      return {
                                          baseWidgetId: baseWidget.id,
                                          zone: sourceOverride.zone ?? null,
                                          sortOrder: sourceOverride.sort_order ?? null,
                                          config:
                                              sourceOverride.config && typeof sourceOverride.config === 'object'
                                                  ? (sourceOverride.config as Record<string, unknown>)
                                                  : null,
                                          isActive: null,
                                          isDeletedOverride: true
                                      }
                                  }

                                  return {
                                      baseWidgetId: baseWidget.id,
                                      zone: sourceOverride?.zone ?? null,
                                      sortOrder: sourceOverride?.sort_order ?? null,
                                      config:
                                          sourceOverride?.config && typeof sourceOverride.config === 'object'
                                              ? (sourceOverride.config as Record<string, unknown>)
                                              : null,
                                      isActive: false,
                                      isDeletedOverride: false
                                  }
                              })
                            : sourceOverrides
                                  .filter((row) => typeof row.base_widget_id === 'string' && row.base_widget_id.length > 0)
                                  .map((row) => ({
                                      baseWidgetId: String(row.base_widget_id),
                                      zone: row.zone ?? null,
                                      sortOrder: row.sort_order ?? null,
                                      config: row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null,
                                      isActive: typeof row.is_active === 'boolean' ? row.is_active : null,
                                      isDeletedOverride: row.is_deleted_override === true
                                  }))

                        assertNoDuplicateActiveSingleInstanceWidgets([
                            ...copiedWidgetRows,
                            ...baseWidgets.map((baseWidget) => {
                                const sourceOverride = overrideMap.get(baseWidget.id)
                                return {
                                    widgetKey: baseWidget.widget_key,
                                    isActive: shouldDeactivateWidgets
                                        ? false
                                        : sourceOverride?.is_deleted_override === true
                                        ? false
                                        : typeof sourceOverride?.is_active === 'boolean'
                                        ? sourceOverride.is_active
                                        : baseWidget.is_active !== false
                                }
                            })
                        ])

                        if (overridesToCopy.length > 0) {
                            const placeholders: string[] = []
                            const params: unknown[] = []
                            let idx = 1

                            for (const override of overridesToCopy) {
                                placeholders.push(
                                    `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${
                                        idx + 7
                                    }, $${idx + 8}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 10}, $${idx + 10}, $${
                                        idx + 11
                                    }, $${idx + 10}, $${idx + 10})`
                                )
                                params.push(
                                    createdLayout.id,
                                    override.baseWidgetId,
                                    override.zone,
                                    override.sortOrder,
                                    override.config ? JSON.stringify(override.config) : null,
                                    override.isActive,
                                    override.isDeletedOverride,
                                    now,
                                    userId ?? null,
                                    1,
                                    false,
                                    true
                                )
                                idx += 12
                            }

                            const insertedOverrideRows = await trx.query<{ id: string }>(
                                `INSERT INTO ${overridesQt} (
                layout_id, base_widget_id, zone, sort_order, config, is_active, is_deleted_override,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
                _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted
            ) VALUES ${placeholders.join(', ')}
            RETURNING id`,
                                params
                            )
                            if (insertedOverrideRows.length !== overridesToCopy.length) {
                                throw new MetahubDomainError({
                                    message: 'Failed to create copied layout overrides',
                                    statusCode: 500,
                                    code: 'SCHEMA_SYNC_FAILED',
                                    details: { operation: 'copy-layout' }
                                })
                            }
                        }
                    }
                }

                return createdLayout
            })

            return res.status(201).json({
                id: created.id,
                scopeEntityId: created.scope_entity_id ?? null,
                baseLayoutId: created.base_layout_id ?? null,
                templateKey: applicationTemplateKeySchema.parse(created.template_key),
                name: created.name ?? {},
                description: created.description ?? null,
                config: created.config ?? {},
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

    const widgetsObject = createHandler(async ({ req, res }) => {
        if (!parseUuidV7Param(req.params.layoutId)) return res.status(400).json({ error: 'Invalid layout ID' })

        const items = LAYOUT_WIDGET_DEFINITIONS.map((widget) => ({
            key: widget.key,
            templateKey: widget.templateKey,
            supportedTemplates: [...widget.supportedTemplates],
            allowedZones: [...widget.allowedZones],
            allowedZonesByTemplate: Object.fromEntries(
                Object.entries(widget.allowedZonesByTemplate).map(([supportedTemplateKey, zones]) => [supportedTemplateKey, [...zones]])
            ),
            multiInstance: widget.multiInstance,
            requiredHostCapabilities: [...widget.requiredHostCapabilities],
            shared: widget.shared,
            labelKey: widget.labelKey,
            defaultLabel: widget.defaultLabel
        }))
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
        widgetsObject,
        listZoneWidgets,
        assignZoneWidget,
        moveZoneWidget,
        removeZoneWidget,
        resetZoneWidgetOverride,
        updateZoneWidgetConfig,
        toggleZoneWidgetActive,
        listWidgetScopeVisibility,
        updateWidgetScopeVisibility
    }
}
