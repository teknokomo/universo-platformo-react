import { z } from 'zod'
import { DASHBOARD_LAYOUT_WIDGETS, type LayoutCopyOptions } from '@universo/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import type { SqlQueryable } from '../../../utils'
import { queryMany, queryOne } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
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
import { OptimisticLockError, localizedContent, validation } from '@universo/utils'
import { buildDashboardLayoutConfig } from '../../shared'
import { MetahubDomainError } from '../../shared/domainErrors'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeLayoutCopyOptions } = validation

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredLocaleEntry = { content?: unknown } | unknown
type StoredLocaleMap = Record<string, StoredLocaleEntry>
type StoredPrimary = { _primary?: unknown }
type SourceWidgetRow = {
  zone?: string
  widget_key?: string
  sort_order?: number
  config?: unknown
  is_active?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

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
    deactivateAllWidgets: z.boolean().optional()
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
  search: z.string().optional()
})

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

  const create = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
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
  }, { permission: 'manageMetahub' })

  const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const layout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
    if (!layout) return res.status(404).json({ error: 'Layout not found' })
    return res.json(layout)
  })

  const copy = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const parsed = copyLayoutSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const sourceLayout = await layoutsService.getLayoutById(metahubId, layoutId, userId)
    if (!sourceLayout) {
      return res.status(404).json({ error: 'Layout not found' })
    }

    const requestedName = parsed.data.name
      ? sanitizeLocalizedInput(toLocalizedInputRecord(parsed.data.name))
      : buildDefaultCopyNameInput(sourceLayout.name)
    if (Object.keys(requestedName).length === 0) {
      return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
    }

    const sourceNamePrimary = sourceLayout.name?._primary ?? 'en'
    const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
    if (!nameVlc) {
      return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
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

    const copyOptions: LayoutCopyOptions = normalizeLayoutCopyOptions({
      copyWidgets: parsed.data.copyWidgets,
      deactivateAllWidgets: parsed.data.deactivateAllWidgets
    })
    const shouldDeactivateWidgets =
      copyOptions.copyWidgets && (parsed.data.deactivateAllWidgets ?? copyOptions.deactivateAllWidgets)

    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const layoutsQt = qSchemaTable(schemaName, '_mhb_layouts')
    const widgetsQt = qSchemaTable(schemaName, '_mhb_widgets')

    const created = await exec.transaction(async (trx: SqlQueryable) => {
      const now = new Date()

      const layoutConfig = copyOptions.copyWidgets
        ? shouldDeactivateWidgets
          ? buildDashboardLayoutConfig([])
          : sourceLayout.config ?? {}
        : {
            ...buildDashboardLayoutConfig([]),
            [LAYOUT_CONFIG_SKIP_DEFAULT_WIDGET_SEED_KEY]: true
          }

      const createdLayout = await queryOne<Record<string, unknown>>(
        trx,
        `INSERT INTO ${layoutsQt} (
            template_key, name, description, config, is_active, is_default, sort_order, owner_id,
            _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
            _upl_archived, _upl_deleted, _upl_locked,
            _mhb_published, _mhb_archived, _mhb_deleted
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $9, $10, $11,
            $12, $12, $12,
            $13, $12, $12
        ) RETURNING *`,
        [
          sourceLayout.templateKey ?? 'dashboard',
          JSON.stringify(nameVlc),
          descriptionVlc ? JSON.stringify(descriptionVlc) : null,
          JSON.stringify(layoutConfig),
          sourceLayout.isActive ?? true,
          false,
          sourceLayout.sortOrder ?? 0,
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
          `SELECT zone, widget_key, sort_order, config, is_active
           FROM ${widgetsQt}
           WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
           ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
          [layoutId]
        )

        if (sourceWidgets.length > 0) {
          const placeholders: string[] = []
          const params: unknown[] = []
          let idx = 1
          for (const widget of sourceWidgets) {
            placeholders.push(
              `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${
                idx + 6
              }, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 9}, $${idx + 9}, $${idx + 10}, $${idx + 9}, $${idx + 9})`
            )
            params.push(
              createdLayout.id,
              widget.zone,
              widget.widget_key,
              widget.sort_order ?? 1,
              JSON.stringify(widget.config ?? {}),
              shouldDeactivateWidgets ? false : widget.is_active !== false,
              now,
              userId ?? null,
              1,
              false,
              true
            )
            idx += 11
          }
          await trx.query(
            `INSERT INTO ${widgetsQt} (
                layout_id, zone, widget_key, sort_order, config, is_active,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
                _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted
            ) VALUES ${placeholders.join(', ')}
            RETURNING id`,
            params
          )
        }
      }

      return createdLayout
    })

    return res.status(201).json({
      id: created.id,
      templateKey: created.template_key ?? 'dashboard',
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
  }, { permission: 'manageMetahub' })

  const update = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

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
  }, { permission: 'manageMetahub' })

  const remove = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    await layoutsService.deleteLayout(metahubId, layoutId, userId)
    return res.status(204).send()
  }, { permission: 'manageMetahub' })

  const widgetsCatalog = createHandler(async ({ res }) => {
    return res.json({
      items: DASHBOARD_LAYOUT_WIDGETS.map((widget) => ({
        key: widget.key,
        allowedZones: widget.allowedZones,
        multiInstance: widget.multiInstance
      }))
    })
  })

  const listZoneWidgets = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const items = await layoutsService.listLayoutZoneWidgets(metahubId, layoutId, userId)
    return res.json({ items })
  })

  const assignZoneWidget = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const parsed = assignLayoutZoneWidgetSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const item = await layoutsService.assignLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
    return res.json(item)
  }, { permission: 'manageMetahub' })

  const moveZoneWidget = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId } = req.params

    const parsed = moveLayoutZoneWidgetSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const items = await layoutsService.moveLayoutZoneWidget(metahubId, layoutId, parsed.data, userId)
    return res.json({ items })
  }, { permission: 'manageMetahub' })

  const removeZoneWidget = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId, widgetId } = req.params

    const uuidSchema = z.string().uuid()
    const parseResult = uuidSchema.safeParse(widgetId)
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid widget ID' })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    await layoutsService.removeLayoutZoneWidget(metahubId, layoutId, parseResult.data, userId)
    return res.status(204).send()
  }, { permission: 'manageMetahub' })

  const updateZoneWidgetConfig = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId, widgetId } = req.params

    const uuidSchema = z.string().uuid()
    const widgetIdResult = uuidSchema.safeParse(widgetId)
    if (!widgetIdResult.success) {
      return res.status(400).json({ error: 'Invalid widget ID' })
    }

    const parsed = updateLayoutZoneWidgetConfigSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const widget = await layoutsService.updateLayoutZoneWidgetConfig(
      metahubId,
      layoutId,
      widgetIdResult.data,
      parsed.data.config,
      userId
    )
    return res.json({ item: widget })
  }, { permission: 'manageMetahub' })

  const toggleZoneWidgetActive = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
    const { layoutId, widgetId } = req.params

    const uuidSchema = z.string().uuid()
    const widgetIdResult = uuidSchema.safeParse(widgetId)
    if (!widgetIdResult.success) {
      return res.status(400).json({ error: 'Invalid widget ID' })
    }

    const parsed = toggleLayoutZoneWidgetActiveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    }

    const layoutsService = new MetahubLayoutsService(exec, schemaService)
    const widget = await layoutsService.toggleLayoutZoneWidgetActive(
      metahubId,
      layoutId,
      widgetIdResult.data,
      parsed.data.isActive,
      userId
    )
    return res.json({ item: widget })
  }, { permission: 'manageMetahub' })

  return {
    list,
    create,
    getById,
    copy,
    update,
    remove,
    widgetsCatalog,
    listZoneWidgets,
    assignZoneWidget,
    moveZoneWidget,
    removeZoneWidget,
    updateZoneWidgetConfig,
    toggleZoneWidgetActive
  }
}
