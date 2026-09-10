import type { Request, Response } from 'express'
import {
    MARKETING_WIDGET_REGISTRY,
    getLayoutWidgetDefinition,
    MARKETING_SOURCE_CODENAMES,
    MARKETING_COPY_SOURCE_CODENAME,
    MARKETING_MAX_RUNTIME_RECORDS,
    layoutHashSchema,
    marketingActionSchema,
    marketingPageConfigSchema,
    marketingPageDataSchema,
    marketingPageRecordSchema,
    marketingSemanticKeySchema,
    marketingPersistedIdSchema,
    marketingRuntimeWidgetSchema,
    marketingSectionCopyRecordSchema,
    marketingSiteSettingsRecordSchema,
    marketingWidgetSourceCodenames,
    marketingWidgetSourceSchema,
    parseApplicationLayoutWidgetConfig,
    resourceSourceSchema,
    type MarketingAction,
    type MarketingCollectionVariant,
    type MarketingScope,
    type MarketingPageConfig,
    type MarketingPageRecord,
    type MarketingWidgetKey,
    type MarketingWidgetSource,
    type ResourceSource
} from '@universo-react/types'
import { normalizeMarketingMedia, parseMarketingActionHref } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import {
    createQueryHelper,
    IDENTIFIER_REGEX,
    normalizeLocale,
    quoteIdentifier,
    resolveLocalizedContent,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    runtimeLayoutCapableFilterSql,
    runtimeObjectFilterSql,
    runtimeCodenameTextSql,
    UUID_REGEX
} from '../shared/runtimeHelpers'
import {
    EffectiveLayoutError,
    effectiveLayoutErrorBody,
    parseRuntimeTarget,
    type EffectiveLayoutSuccess
} from '../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForRequest } from '../services/effectiveLayoutResolver'

type RawRecord = Record<string, unknown>

const MARKETING_OBJECTS = MARKETING_SOURCE_CODENAMES

const MARKETING_COLLECTION_ROW_LIMIT = 1000

const MARKETING_RUNTIME_ENTITY_CODENAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/u

type MarketingObjectName = (typeof MARKETING_OBJECTS)[number]

type RuntimeWidgetRow = {
    id: string
    layout_id: string
    zone: string
    widget_key: string
    sort_order: number
    config: unknown
    is_active: boolean
    source_widget_id?: string | null
    source_base_widget_id?: string | null
    version?: number
}

const asRecord = (value: unknown): RawRecord => (value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {})

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asNumber = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const asBoolean = (value: unknown, fallback = true): boolean => (typeof value === 'boolean' ? value : fallback)

const readLocalizedMap = (value: unknown, fallback: string): Record<string, string> => {
    const record = asRecord(value)
    const locales =
        record.locales && typeof record.locales === 'object' && !Array.isArray(record.locales) ? (record.locales as RawRecord) : record
    const result: Record<string, string> = {}
    for (const [locale, entry] of Object.entries(locales)) {
        if (locale.startsWith('_')) continue
        const content = typeof entry === 'string' ? entry.trim() : asString(asRecord(entry).content)
        if (content) result[locale.toLowerCase().replace(/_/g, '-')] = content
    }
    if (Object.keys(result).length > 0) return result
    const direct = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value)
    return { en: direct || fallback }
}

const localized = (value: unknown, locale: string, fallback: string): Record<string, string> => {
    const map = readLocalizedMap(value, fallback)
    const selected = resolveLocalizedContent(value, locale, fallback)
    const normalizedLocale = normalizeLocale(locale)
    if (!map[normalizedLocale]) map[normalizedLocale] = selected
    return map
}

const hasLocalizedContent = (value: unknown): boolean =>
    Object.values(readLocalizedMap(value, '')).some((content) => content.trim().length > 0)

const readSingleQueryValue = (value: unknown): { valid: true; value?: string } | { valid: false } => {
    if (value === undefined) return { valid: true }
    return typeof value === 'string' ? { valid: true, value: value.trim() } : { valid: false }
}

const localizedOptional = (value: unknown, locale: string): Record<string, string> | undefined =>
    hasLocalizedContent(value) ? localized(value, locale, '') : undefined

const localizedLabelOptional = (value: unknown, locale: string): string | undefined =>
    hasLocalizedContent(value) ? resolveLocalizedContent(value, locale, '') : undefined

const safeSemanticKey = (value: unknown, fallback: string): string => {
    const raw = resolveRuntimeCodenameText(value).trim().toLowerCase()
    const normalized = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z]+/, '')
    return normalized || fallback
}

export const safeAction = (value: unknown): MarketingAction | null => {
    return parseMarketingActionHref(value)
}

export const safeMedia = (value: unknown, kind: 'logo' | 'hero' | 'avatar' | 'feature' | 'highlight', alt: Record<string, string>) => {
    const resource: ResourceSource | undefined =
        typeof value === 'string'
            ? asString(value)
                ? { type: 'url', url: asString(value), launchMode: 'inline' }
                : undefined
            : resourceSourceSchema.safeParse(value).success
            ? resourceSourceSchema.parse(value)
            : undefined
    if (!resource) return undefined
    try {
        return normalizeMarketingMedia({
            kind,
            resource,
            alt,
            decorative: false
        })
    } catch {
        return undefined
    }
}

const baseRecord = (
    row: RawRecord,
    locale: string,
    fallbackKey: string,
    semanticKeyValue: unknown = row.codename,
    scope: MarketingScope = 'application'
): Pick<MarketingPageRecord, 'id' | 'semanticKey' | 'locale' | 'order' | 'isVisible' | 'scope' | 'provenance'> => {
    const id = marketingPersistedIdSchema.parse(asString(row.id))
    const semanticKey = safeSemanticKey(semanticKeyValue, fallbackKey)
    const hasSeedSource = Boolean(asString(row._seed_source_key ?? row.seedSourceKey))
    const isAuthored = row._seed_source_owned === false || row.seedSourceOwned === false || !hasSeedSource
    const isSeeded = hasSeedSource && !isAuthored
    return {
        id,
        semanticKey,
        locale,
        order: Math.max(0, Math.min(10000, Math.trunc(asNumber(row.SortOrder ?? row.sort_order, 0)))),
        isVisible: asBoolean(row.IsVisible, true),
        scope,
        provenance: {
            layer: scope,
            ...(isSeeded ? { seedKey: semanticKey } : {}),
            isSeeded,
            isAuthored
        }
    }
}

const objectQuery = (schemaIdent: string) => `
    SELECT id, kind, codename, table_name, config
    FROM ${schemaIdent}._app_objects
    WHERE ${runtimeObjectFilterSql('kind', 'config')}
      AND ${runtimeCodenameTextSql('codename')} = ANY($1::text[])
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY id ASC
`

const componentQuery = (schemaIdent: string) => `
    SELECT id, object_id, codename, column_name, data_type
    FROM ${schemaIdent}._app_components
    WHERE object_id = ANY($1::uuid[])
      AND parent_component_id IS NULL
      AND _upl_deleted = false
      AND _app_deleted = false
    ORDER BY object_id ASC, sort_order ASC, _upl_created_at ASC
`

export const normalizeRuntimeRow = (row: RawRecord, components: RawRecord[]): RawRecord => {
    const normalized = { ...row }
    for (const component of components) {
        const codename = resolveRuntimeCodenameText(component.codename).trim()
        const columnName = asString(component.column_name)
        if (!codename || !IDENTIFIER_REGEX.test(columnName)) continue
        if (normalized[codename] === undefined && normalized[columnName] !== undefined) {
            normalized[codename] = normalized[columnName]
        }
    }
    return normalized
}

const loadObjectRows = async (
    manager: DbExecutor,
    schemaIdent: string,
    object: RawRecord,
    components: RawRecord[],
    workspaceId?: string | null
) => {
    const tableName = asString(object.table_name)
    if (!IDENTIFIER_REGEX.test(tableName)) throw new Error('Marketing runtime metadata contains an unsafe table name')
    const sortComponent = components.find((component) => resolveRuntimeCodenameText(component.codename).toLowerCase() === 'sortorder')
    const sortColumn =
        sortComponent && IDENTIFIER_REGEX.test(asString(sortComponent.column_name)) ? asString(sortComponent.column_name) : 'id'
    const table = `${schemaIdent}.${quoteIdentifier(tableName)}`
    const workspaceClause = workspaceId ? ` AND ${quoteIdentifier('workspace_id')} = $1` : ''
    const rows = await manager.query<RawRecord>(
        `SELECT * FROM ${table}
         WHERE _upl_deleted = false AND _app_deleted = false${workspaceClause}
         ORDER BY ${quoteIdentifier(sortColumn)} ASC NULLS LAST, id ASC
         LIMIT ${MARKETING_COLLECTION_ROW_LIMIT}`,
        workspaceId ? [workspaceId] : []
    )
    return rows.map((row) => normalizeRuntimeRow(row, components))
}

const firstRow = (rows: RawRecord[]): RawRecord => rows[0] ?? {}

const applyMarketingFieldMap = (records: MarketingPageRecord[], fieldMap: Record<string, string>): MarketingPageRecord[] | null => {
    if (Object.keys(fieldMap).length === 0 || records.length === 0) return records
    const mapped = records.map((record) => {
        const next = { ...record } as Record<string, unknown>
        for (const [alias, field] of Object.entries(fieldMap)) {
            const logicalField = field.length > 0 ? `${field[0].toLowerCase()}${field.slice(1)}` : field
            const value = record[field as keyof MarketingPageRecord] ?? record[logicalField as keyof MarketingPageRecord]
            if (value === undefined) return null
            next[alias] = value
        }
        return next
    })
    if (mapped.some((record) => record === null)) return null
    const parsed = marketingPageRecordSchema.array().safeParse(mapped)
    return parsed.success ? parsed.data : null
}

export const toConfig = (value: unknown): MarketingPageConfig => {
    const parsed = marketingPageConfigSchema.safeParse(value ?? {})
    if (!parsed.success) throw new Error('Marketing runtime configuration is invalid')
    return parsed.data
}

type MarketingRuntimeTarget = {
    entityTypeId: string | null
    recordKey: string | null
}

const resolveMarketingRuntimeTarget = async (
    manager: DbExecutor,
    schemaIdent: string,
    req: Request,
    res: Response,
    targetKind: string | undefined
): Promise<MarketingRuntimeTarget | null> => {
    const entityTypeId = readSingleQueryValue(req.query.entityTypeId)
    const entityTypeCodename = readSingleQueryValue(req.query.entityTypeCodename)
    const recordKey = readSingleQueryValue(req.query.recordKey)
    if (!entityTypeId.valid || !entityTypeCodename.valid || !recordKey.valid) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_QUERY_INVALID', error: 'Marketing runtime query parameters are invalid.' })
        return null
    }
    const requestedEntityTypeId = entityTypeId.value ?? ''
    const requestedEntityTypeCodename = entityTypeCodename.value ?? ''
    const requestedRecordKey = recordKey.value ?? ''

    if (requestedEntityTypeId && requestedEntityTypeCodename) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_AMBIGUOUS', error: 'Choose an entity type id or codename, not both.' })
        return null
    }
    if (targetKind !== undefined && targetKind !== 'page' && targetKind !== 'object') {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_INVALID', error: 'The marketing target kind is invalid.' })
        return null
    }
    if ((requestedEntityTypeId || requestedEntityTypeCodename) && !targetKind) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_INVALID', error: 'The marketing target kind is required.' })
        return null
    }
    if (!requestedEntityTypeId && !requestedEntityTypeCodename && targetKind) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_INVALID', error: 'An entity selector is required for the target kind.' })
        return null
    }
    if (requestedEntityTypeId && !marketingPersistedIdSchema.safeParse(requestedEntityTypeId).success) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_INVALID', error: 'The marketing entity type identifier is invalid.' })
        return null
    }
    if (requestedEntityTypeCodename && !MARKETING_RUNTIME_ENTITY_CODENAME_PATTERN.test(requestedEntityTypeCodename)) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_TARGET_INVALID', error: 'The marketing entity type codename is invalid.' })
        return null
    }
    if (requestedRecordKey && !marketingSemanticKeySchema.safeParse(requestedRecordKey).success) {
        res.status(400).json({ code: 'MARKETING_RUNTIME_RECORD_TARGET_INVALID', error: 'The marketing record key is invalid.' })
        return null
    }

    if (!requestedEntityTypeId && !requestedEntityTypeCodename) {
        return { entityTypeId: null, recordKey: requestedRecordKey || null }
    }

    const rows = await manager.query<{ id: string; kind: string }>(
        `SELECT o.id, o.kind
         FROM ${schemaIdent}._app_objects AS o
         WHERE ${targetKind === 'page' ? 'o.kind = $1' : `${runtimeObjectFilterSql('o.kind', 'o.config')} AND $1 = 'object'`}
           AND o._upl_deleted = false
           AND o._app_deleted = false
           AND ${runtimeLayoutCapableFilterSql('o.config')}
           ${requestedEntityTypeId ? 'AND o.id = $2' : `AND ${runtimeCodenameTextSql('o.codename')} = $2`}
         LIMIT 2`,
        [targetKind, requestedEntityTypeId || requestedEntityTypeCodename]
    )
    if (rows.length === 0) {
        res.status(404).json({ code: 'MARKETING_RUNTIME_TARGET_NOT_FOUND', error: 'The selected marketing entity type was not found.' })
        return null
    }
    if (rows.length > 1) {
        res.status(409).json({ code: 'MARKETING_RUNTIME_TARGET_AMBIGUOUS', error: 'The selected marketing entity type is ambiguous.' })
        return null
    }
    return { entityTypeId: rows[0].id, recordKey: requestedRecordKey || null }
}

export function createRuntimeMarketingPageController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const getMarketingPage = async (req: Request, res: Response) => {
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        const locale = readSingleQueryValue(req.query.locale)
        if (!locale.valid) {
            return res
                .status(400)
                .json({ code: 'MARKETING_RUNTIME_QUERY_INVALID', error: 'Marketing runtime query parameters are invalid.' })
        }
        const requestedLocale = normalizeLocale(locale.value ?? 'en')
        const targetKind = readSingleQueryValue(req.query.targetKind)
        const workspaceId = readSingleQueryValue(req.query.workspaceId)
        const themeVariant = readSingleQueryValue(req.query.themeVariant)
        const expectedLayoutHash = readSingleQueryValue(req.query.expectedLayoutHash)
        if (
            !targetKind.valid ||
            !workspaceId.valid ||
            !themeVariant.valid ||
            !expectedLayoutHash.valid ||
            (expectedLayoutHash.value !== undefined && !layoutHashSchema.safeParse(expectedLayoutHash.value).success)
        ) {
            return res
                .status(400)
                .json({ code: 'MARKETING_RUNTIME_QUERY_INVALID', error: 'Marketing runtime query parameters are invalid.' })
        }
        const target = await resolveMarketingRuntimeTarget(ctx.manager, ctx.schemaIdent, req, res, targetKind.value)
        if (!target) return

        let effectiveLayout: EffectiveLayoutSuccess
        try {
            const effectiveTarget = parseRuntimeTarget(req.params.applicationId, {
                ...(target.entityTypeId ? { targetKind: targetKind.value, entityTypeId: target.entityTypeId } : {}),
                ...(workspaceId.value ? { workspaceId: workspaceId.value } : {}),
                locale: requestedLocale,
                ...(themeVariant.value ? { themeVariant: themeVariant.value } : {})
            })
            effectiveLayout = await resolveEffectiveLayoutForRequest(
                ctx.manager,
                { applicationId: req.params.applicationId, userId: ctx.userId, role: ctx.role },
                effectiveTarget
            )
        } catch (error) {
            if (error instanceof EffectiveLayoutError) {
                return res.status(error.httpStatus).json(effectiveLayoutErrorBody(error))
            }
            return res.status(503).json({
                status: 'failed',
                error: { code: 'LAYOUT_RUNTIME_QUERY_FAILED', httpStatus: 503 }
            })
        }
        if (expectedLayoutHash.value && expectedLayoutHash.value !== effectiveLayout.effectiveHash) {
            return res.status(409).json({
                code: 'MARKETING_RUNTIME_LAYOUT_STALE',
                error: 'The marketing layout changed while its content was loading. Reload and try again.'
            })
        }
        const parsedLayoutId = marketingPersistedIdSchema.safeParse(effectiveLayout.layout.id)
        if (!parsedLayoutId.success)
            return res.status(409).json({ code: 'MARKETING_LAYOUT_INVALID', error: 'Marketing layout identifier is invalid.' })
        const templateKey = effectiveLayout.layout.templateKey
        if (templateKey !== 'marketing-page') return res.status(409).json({ error: 'Application does not use marketing-page template' })
        let runtimeConfig: MarketingPageConfig
        try {
            runtimeConfig = toConfig(effectiveLayout.layout.config)
        } catch {
            return res.status(409).json({ code: 'MARKETING_CONFIG_INVALID', error: 'Marketing page configuration is invalid.' })
        }
        const widgetRows: RuntimeWidgetRow[] = effectiveLayout.widgets
            .filter((widget) => !getLayoutWidgetDefinition(widget.widgetKey)?.shared)
            .map((widget) => ({
                id: widget.id,
                layout_id: effectiveLayout.layout.id,
                zone: widget.zone,
                widget_key: widget.widgetKey,
                sort_order: widget.sortOrder,
                config: widget.config,
                is_active: widget.isActive,
                source_widget_id: widget.sourceWidgetId,
                source_base_widget_id: widget.sourceBaseWidgetId,
                version: widget.version
            }))
        if (!widgetRows.some((widget) => widget.is_active)) {
            return res.status(409).json({ code: 'MARKETING_LAYOUT_INCOMPLETE', error: 'Marketing page has no active widget composition.' })
        }
        const invalidLayout = (message: string) => res.status(409).json({ code: 'MARKETING_LAYOUT_INVALID', error: message })
        const unavailableSource = (message: string) => res.status(409).json({ code: 'MARKETING_SOURCE_UNAVAILABLE', error: message })
        const validatedWidgetConfigs = new Map<
            string,
            { config: Record<string, unknown>; source: MarketingWidgetSource; copySource?: MarketingWidgetSource }
        >()
        const instanceKeys = new Set<string>()
        for (const widgetRow of widgetRows) {
            const registryEntry = MARKETING_WIDGET_REGISTRY[widgetRow.widget_key as keyof typeof MARKETING_WIDGET_REGISTRY]
            if (!registryEntry || !registryEntry.allowedZones.includes(widgetRow.zone as (typeof registryEntry.allowedZones)[number])) {
                return invalidLayout('Marketing widget placement or key is invalid.')
            }

            let config: Record<string, unknown>
            try {
                config = parseApplicationLayoutWidgetConfig(widgetRow.widget_key, widgetRow.config)
            } catch {
                return invalidLayout('Marketing widget configuration is invalid.')
            }
            const parsedSource = marketingWidgetSourceSchema.safeParse(config.source)
            if (!parsedSource.success) return invalidLayout('Marketing widget data source is invalid.')
            const allowedSources = marketingWidgetSourceCodenames(
                widgetRow.widget_key as MarketingWidgetKey,
                typeof config.variant === 'string' ? (config.variant as MarketingCollectionVariant) : undefined
            )
            if (!allowedSources.includes(parsedSource.data.entityCodename)) {
                return invalidLayout('Marketing widget data source does not match the widget variant.')
            }

            let copySource: MarketingWidgetSource | undefined
            if (config.copySource !== undefined) {
                if (!['marketing.hero', 'marketing.collection', 'marketing.pricing', 'marketing.footer'].includes(widgetRow.widget_key)) {
                    return invalidLayout('This marketing widget does not support a copy source.')
                }
                const parsedCopySource = marketingWidgetSourceSchema.safeParse(config.copySource)
                if (!parsedCopySource.success) return invalidLayout('Marketing widget copy source is invalid.')
                copySource = parsedCopySource.data
            }

            const instanceKey = String(config.instanceKey)
            if (instanceKeys.has(instanceKey)) return invalidLayout('Marketing widget instance keys must be unique within a layout.')
            instanceKeys.add(instanceKey)

            validatedWidgetConfigs.set(widgetRow.id, { config, source: parsedSource.data, copySource })
        }
        const safeRuntimeAction = (value: unknown): MarketingAction | null => {
            const action = safeAction(value)
            if (!action) return null
            if (action.kind === 'email' && !runtimeConfig.allowEmailActions) return null
            if (action.kind === 'tel' && !runtimeConfig.allowTelephoneActions) return null
            if (action.kind === 'external') return marketingActionSchema.parse({ ...action, target: runtimeConfig.externalLinkTarget })
            return action
        }

        const objectRows = await ctx.manager.query<RawRecord>(objectQuery(ctx.schemaIdent), [MARKETING_OBJECTS])
        const objectsByName = new Map(objectRows.map((row) => [resolveRuntimeCodenameText(row.codename), row]))
        const objectIds = objectRows.map((row) => asString(row.id)).filter((id) => UUID_REGEX.test(id))
        const componentRows = objectIds.length > 0 ? await ctx.manager.query<RawRecord>(componentQuery(ctx.schemaIdent), [objectIds]) : []
        const componentsByObject = new Map<string, RawRecord[]>()
        for (const component of componentRows) {
            const list = componentsByObject.get(asString(component.object_id)) ?? []
            list.push(component)
            componentsByObject.set(asString(component.object_id), list)
        }

        const loadedEntries = await Promise.all(
            MARKETING_OBJECTS.map(async (objectName) => {
                const object = objectsByName.get(objectName)
                if (!object) return null
                const rows = await loadObjectRows(
                    ctx.manager,
                    ctx.schemaIdent,
                    object,
                    componentsByObject.get(asString(object.id)) ?? [],
                    ctx.currentWorkspaceId
                )
                return [objectName, rows] as const
            })
        )
        const loaded = new Map<string, RawRecord[]>(loadedEntries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)))

        const loadedRecordCount = Array.from(loaded.values()).reduce((total, rows) => total + rows.length, 0)
        if (loadedRecordCount > MARKETING_MAX_RUNTIME_RECORDS) {
            return res.status(413).json({
                code: 'MARKETING_RUNTIME_DATA_TOO_LARGE',
                error: 'Marketing page data exceeds the runtime record limit.'
            })
        }

        const siteSettingsRows = loaded.get('MarketingPageSiteSettings') ?? []
        if (siteSettingsRows.length !== 1) {
            return res.status(409).json({
                code: 'MARKETING_SINGLETON_INVALID',
                error: 'Marketing page requires exactly one site settings record.'
            })
        }
        const malformedRow = Array.from(loaded.values())
            .flat()
            .find((row) => !marketingPersistedIdSchema.safeParse(asString(row.id)).success)
        if (malformedRow) {
            return res.status(409).json({ code: 'MARKETING_RECORD_INVALID', error: 'Marketing page contains an invalid record.' })
        }
        const siteSettings = firstRow(siteSettingsRows)
        const runtimeScope: MarketingScope = ctx.currentWorkspaceId ? 'workspace' : 'application'
        const runtimeBaseRecord = (row: RawRecord, locale: string, fallbackKey: string, semanticKeyValue: unknown = row.codename) =>
            baseRecord(row, locale, fallbackKey, semanticKeyValue, runtimeScope)
        const recordsByObject = new Map<MarketingObjectName, MarketingPageRecord[]>()
        const sectionCopiesByKey = new Map<string, Extract<MarketingPageRecord, { kind: 'sectionCopy' }>>()
        const brandName = localized(siteSettings.BrandName, requestedLocale, '')
        const heroTitle = localized(siteSettings.HeroTitle, requestedLocale, '')
        const siteSettingsRecord = {
            ...runtimeBaseRecord(siteSettings, requestedLocale, 'site-settings', 'site-settings'),
            semanticKey: 'site-settings',
            kind: 'siteSettings' as const,
            brandName,
            brandLogo: safeMedia(siteSettings.BrandLogo, 'logo', brandName),
            heroTitle,
            heroSubtitle: localized(siteSettings.HeroSubtitle, requestedLocale, ''),
            heroAccent: localizedOptional(siteSettings.HeroAccent, requestedLocale),
            heroEmailLabel: localizedLabelOptional(siteSettings.HeroEmailLabel, requestedLocale),
            heroEmailPlaceholder: localizedLabelOptional(siteSettings.HeroEmailPlaceholder, requestedLocale),
            heroTermsText: localizedOptional(siteSettings.HeroTermsText, requestedLocale),
            heroPrimaryAction: safeRuntimeAction(siteSettings.HeroPrimaryActionHref)
                ? {
                      label: localized(siteSettings.HeroPrimaryActionLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.HeroPrimaryActionHref)!
                  }
                : undefined,
            heroSecondaryAction: safeRuntimeAction(siteSettings.HeroTermsHref)
                ? {
                      label: localized(siteSettings.HeroTermsLinkLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.HeroTermsHref)!
                  }
                : undefined,
            heroLightPreview: safeMedia(siteSettings.HeroLightPreview, 'hero', heroTitle),
            heroDarkPreview: safeMedia(siteSettings.HeroDarkPreview, 'hero', heroTitle),
            footerDescription: localizedOptional(siteSettings.FooterDescription, requestedLocale),
            copyright: localizedOptional(siteSettings.CopyrightText, requestedLocale),
            copyrightLabel: localizedOptional(siteSettings.CopyrightLabel, requestedLocale),
            copyrightAction: safeRuntimeAction(siteSettings.CopyrightHref)
                ? {
                      label: localized(siteSettings.CopyrightLabel, requestedLocale, ''),
                      action: safeRuntimeAction(siteSettings.CopyrightHref)!
                  }
                : undefined,
            newsletter:
                siteSettings.NewsletterEnabled === true
                    ? {
                          title: localized(siteSettings.NewsletterTitle, requestedLocale, ''),
                          description: localizedOptional(siteSettings.NewsletterDescription, requestedLocale),
                          emailLabel: resolveLocalizedContent(siteSettings.NewsletterLabel, requestedLocale, ''),
                          emailPlaceholder: resolveLocalizedContent(siteSettings.NewsletterPlaceholder, requestedLocale, ''),
                          submitLabel: resolveLocalizedContent(siteSettings.NewsletterActionLabel, requestedLocale, ''),
                          successMessage: localized(siteSettings.NewsletterSuccessMessage, requestedLocale, ''),
                          errorMessage: localized(siteSettings.NewsletterErrorMessage, requestedLocale, ''),
                          action: safeRuntimeAction(siteSettings.NewsletterActionHref) ?? undefined
                      }
                    : undefined
        }
        const parsedSiteSettings = marketingSiteSettingsRecordSchema.safeParse(siteSettingsRecord)
        if (!parsedSiteSettings.success) {
            return res.status(409).json({ code: 'MARKETING_RUNTIME_DATA_INVALID', error: 'Marketing page data is invalid.' })
        }
        recordsByObject.set('MarketingPageSiteSettings', [parsedSiteSettings.data])

        for (const [index, row] of (loaded.get('MarketingPageSection') ?? []).entries()) {
            const sectionKey = safeSemanticKey(row.SectionKey ?? row.codename, `section-${index + 1}`)
            const parsedSectionCopy = marketingSectionCopyRecordSchema.safeParse({
                ...runtimeBaseRecord(row, requestedLocale, sectionKey, sectionKey),
                kind: 'sectionCopy',
                sectionKey,
                title: localized(row.Title, requestedLocale, ''),
                description: localizedOptional(row.Description, requestedLocale)
            })
            if (!parsedSectionCopy.success) {
                return res.status(409).json({ code: 'MARKETING_RUNTIME_DATA_INVALID', error: 'Marketing section copy is invalid.' })
            }
            if (sectionCopiesByKey.has(sectionKey)) {
                return res
                    .status(409)
                    .json({ code: 'MARKETING_SECTION_DUPLICATE', error: 'Marketing page contains duplicate section copy.' })
            }
            sectionCopiesByKey.set(sectionKey, parsedSectionCopy.data)
        }

        const addRecords = async (
            objectName: MarketingObjectName,
            mapper: (row: RawRecord, index: number) => MarketingPageRecord | null
        ) => {
            const rows = loaded.get(objectName) ?? []
            const mappedRows: MarketingPageRecord[] = []
            for (let index = 0; index < rows.length; index += 1) {
                const mapped = mapper(rows[index], index)
                if (mapped) {
                    mappedRows.push(mapped)
                }
            }
            recordsByObject.set(objectName, mappedRows)
        }

        await addRecords('MarketingPageNavigation', (row, index) => {
            const label = localized(row.Label, requestedLocale, '')
            const action = safeRuntimeAction(row.Href)
            return action
                ? ({
                      ...runtimeBaseRecord(row, requestedLocale, `navigation-${index + 1}`, row.NavKey),
                      kind: 'navigationLink',
                      label,
                      action
                  } as MarketingPageRecord)
                : null
        })
        await addRecords('MarketingPageLogo', (row, index) => {
            const alt = localized(row.AltText, requestedLocale, '')
            const media = safeMedia(row.ImageLight, 'logo', alt)
            const darkMedia = safeMedia(row.ImageDark, 'logo', alt)
            const primaryMedia = media ?? darkMedia
            return primaryMedia
                ? ({
                      ...runtimeBaseRecord(row, requestedLocale, `logo-${index + 1}`, row.LogoKey),
                      kind: 'logo',
                      name: alt,
                      media: primaryMedia,
                      darkMedia: darkMedia && darkMedia !== primaryMedia ? darkMedia : undefined
                  } as MarketingPageRecord)
                : null
        })
        await addRecords(
            'MarketingPageFeature',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `feature-${index + 1}`, row.FeatureKey),
                    kind: 'feature',
                    title: localized(row.Title, requestedLocale, ''),
                    description: localized(row.Description, requestedLocale, ''),
                    ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {}),
                    lightMedia: safeMedia(row.ImageLight, 'feature', localized(row.Title, requestedLocale, '')),
                    darkMedia: safeMedia(row.ImageDark, 'feature', localized(row.Title, requestedLocale, ''))
                } as MarketingPageRecord)
        )
        await addRecords('MarketingPageTestimonial', (row, index) => {
            const name = localized(row.Name, requestedLocale, '')
            const lightLogo = safeMedia(row.LogoLightUrl, 'logo', name)
            const darkLogo = safeMedia(row.LogoDarkUrl, 'logo', name)
            return {
                ...runtimeBaseRecord(row, requestedLocale, `testimonial-${index + 1}`, row.TestimonialKey),
                kind: 'testimonial',
                quote: localized(row.Quote, requestedLocale, ''),
                author: name,
                company: localizedOptional(row.Occupation, requestedLocale),
                avatar: safeMedia(row.AvatarUrl, 'avatar', name),
                ...(lightLogo ? { logo: lightLogo } : {}),
                ...(darkLogo ? { darkLogo } : {})
            } as MarketingPageRecord
        })
        await addRecords(
            'MarketingPageHighlight',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `highlight-${index + 1}`, row.HighlightKey),
                    kind: 'highlight',
                    title: localized(row.Title, requestedLocale, ''),
                    description: localized(row.Description, requestedLocale, ''),
                    ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
                } as MarketingPageRecord)
        )

        const pricingBenefitsByTier = new Map<string, Array<Extract<MarketingPageRecord, { kind: 'pricingBenefit' }>>>()
        await addRecords('MarketingPagePricingBenefit', (row, index) => {
            const label = localized(row.Label, requestedLocale, '')
            if (!asBoolean(row.IsVisible, true)) return null

            const record = {
                ...runtimeBaseRecord(row, requestedLocale, `pricing-benefit-${index + 1}`, row.BenefitKey),
                kind: 'pricingBenefit' as const,
                label
            }
            const tierReference = asString(row.TierRef)
            const tierKey = asString(row.TierKey)
            for (const key of [tierReference, tierKey].filter(Boolean)) {
                const recordsForTier = pricingBenefitsByTier.get(key) ?? []
                recordsForTier.push(record)
                pricingBenefitsByTier.set(key, recordsForTier)
            }
            return record
        })

        await addRecords('MarketingPagePricing', (row, index) => {
            const label = localized(row.ActionLabel, requestedLocale, '')
            const action = safeRuntimeAction(row.ActionHref)
            const tierKey = asString(row.TierKey)
            const description = localizedOptional(row.Subheader, requestedLocale)
            const linkedBenefits = [
                ...(pricingBenefitsByTier.get(asString(row.id)) ?? []),
                ...(pricingBenefitsByTier.get(tierKey) ?? [])
            ].filter((benefit, benefitIndex, all) => all.findIndex((candidate) => candidate.id === benefit.id) === benefitIndex)
            return {
                ...runtimeBaseRecord(row, requestedLocale, `pricing-${index + 1}`, row.TierKey),
                kind: 'pricingTier' as const,
                title: localized(row.Title, requestedLocale, ''),
                ...(description ? { description } : {}),
                price: localized(row.Price, requestedLocale, ''),
                ...(localizedOptional(row.Period, requestedLocale) ? { period: localizedOptional(row.Period, requestedLocale) } : {}),
                action: action ? { label, action } : undefined,
                benefitKeys: linkedBenefits.map((benefit) => benefit.semanticKey),
                benefits: linkedBenefits.map((benefit) => benefit.label),
                featured: asBoolean(row.Featured, false)
            } as MarketingPageRecord
        })
        await addRecords(
            'MarketingPageFaq',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `faq-${index + 1}`, row.FaqKey),
                    kind: 'faq',
                    question: localized(row.Question, requestedLocale, ''),
                    answer: localized(row.Answer, requestedLocale, '')
                } as MarketingPageRecord)
        )

        await addRecords('MarketingPageFooterLink', (row, index) => {
            const action = safeRuntimeAction(row.Href)
            if (!action) return null
            return {
                ...runtimeBaseRecord(row, requestedLocale, `footer-link-${index + 1}`, row.LinkKey),
                kind: 'footerLink' as const,
                groupKey: safeSemanticKey(row.GroupKey, ''),
                ...(localizedOptional(row.GroupTitle, requestedLocale)
                    ? { groupTitle: localizedOptional(row.GroupTitle, requestedLocale) }
                    : {}),
                label: localized(row.Label, requestedLocale, ''),
                ...(localizedOptional(row.BottomLabel, requestedLocale)
                    ? { secondaryLabel: localizedOptional(row.BottomLabel, requestedLocale) }
                    : {}),
                action,
                ...(safeSemanticKey(row.IconKey, '') ? { iconKey: safeSemanticKey(row.IconKey, '') } : {})
            } as MarketingPageRecord
        })

        const sourceRecords = (source: MarketingWidgetSource): MarketingPageRecord[] | null => {
            const parsedSource = marketingWidgetSourceSchema.safeParse(source)
            if (!parsedSource.success || parsedSource.data.entityKind !== 'object') return null
            const objectName = parsedSource.data.entityCodename as MarketingObjectName
            if (!MARKETING_OBJECTS.includes(objectName) || !objectsByName.has(objectName)) return null
            const available = recordsByObject.get(objectName) ?? []
            const recordKey =
                parsedSource.data.recordKey ??
                (target.recordKey && parsedSource.data.entityCodename === 'MarketingPageSiteSettings' ? target.recordKey : undefined)
            if (!recordKey) return applyMarketingFieldMap(available, parsedSource.data.fieldMap)
            const selected = available.filter((record) => record.semanticKey === recordKey)
            return selected.length > 0 ? applyMarketingFieldMap(selected, parsedSource.data.fieldMap) : null
        }

        const sourceCopy = (source: MarketingWidgetSource | undefined): MarketingPageRecord[] | null => {
            if (!source) return []
            const parsedSource = marketingWidgetSourceSchema.safeParse(source)
            if (
                !parsedSource.success ||
                parsedSource.data.entityKind !== 'object' ||
                parsedSource.data.entityCodename !== MARKETING_COPY_SOURCE_CODENAME
            )
                return null
            if (!objectsByName.has(MARKETING_COPY_SOURCE_CODENAME)) return null
            const key = parsedSource.data.recordKey
            if (!key) return null
            const copy = sectionCopiesByKey.get(key)
            return copy ? applyMarketingFieldMap([copy], parsedSource.data.fieldMap) : null
        }

        const runtimeWidgets = []
        for (const widgetRow of widgetRows) {
            const validated = validatedWidgetConfigs.get(widgetRow.id)
            if (!validated) return invalidLayout('Marketing widget configuration is unavailable.')
            const { config, source, copySource } = validated
            const contentRecords = sourceRecords(source)
            if (!contentRecords && widgetRow.is_active) return unavailableSource('Marketing widget data source is unavailable.')
            const copyRecords = sourceCopy(copySource)
            if (copyRecords === null && widgetRow.is_active) return unavailableSource('Marketing widget copy source is unavailable.')

            if (
                widgetRow.is_active &&
                widgetRow.widget_key === 'marketing.pricing' &&
                config.showBenefits !== false &&
                !objectsByName.has('MarketingPagePricingBenefit')
            ) {
                return unavailableSource('Marketing pricing benefits source is unavailable.')
            }

            const maxItems = typeof config.maxItems === 'number' ? config.maxItems : MARKETING_COLLECTION_ROW_LIMIT
            const recordsForWidget: MarketingPageRecord[] = []
            const appendRecords = (values: MarketingPageRecord[], limit = maxItems) => {
                recordsForWidget.push(...values.slice(0, limit))
            }

            if (widgetRow.widget_key === 'marketing.navigation') {
                appendRecords(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                appendRecords(contentRecords ?? [])
            } else if (widgetRow.widget_key === 'marketing.hero') {
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [], 1)
            } else if (widgetRow.widget_key === 'marketing.collection') {
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
            } else if (widgetRow.widget_key === 'marketing.pricing') {
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
                if (config.showBenefits !== false) appendRecords(recordsByObject.get('MarketingPagePricingBenefit') ?? [])
            } else if (widgetRow.widget_key === 'marketing.footer') {
                appendRecords(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
            }

            const parsedWidget = marketingRuntimeWidgetSchema.safeParse({
                instanceKey: config.instanceKey,
                zone: widgetRow.zone,
                widgetKey: widgetRow.widget_key,
                sortOrder: widgetRow.sort_order,
                isActive: widgetRow.is_active,
                config,
                data: { records: recordsForWidget }
            })
            if (!parsedWidget.success) return invalidLayout('Marketing widget data is invalid.')
            runtimeWidgets.push(parsedWidget.data)
        }

        const parsedPage = marketingPageDataSchema.safeParse({
            templateKey: 'marketing-page',
            locale: requestedLocale,
            config: runtimeConfig,
            runtime: {
                layoutId: parsedLayoutId.data,
                layoutVersion: effectiveLayout.layout.version,
                layoutHash: effectiveLayout.effectiveHash,
                sourceLayoutId: effectiveLayout.layout.sourceLayoutId,
                sourceContentHash: effectiveLayout.layout.sourceContentHash
            },
            widgets: runtimeWidgets
        })
        if (!parsedPage.success) {
            return res.status(409).json({ code: 'MARKETING_RUNTIME_DATA_INVALID', error: 'Marketing page data is invalid.' })
        }
        return res.json({ templateKey: 'marketing-page', marketingPage: parsedPage.data })
    }

    return { getMarketingPage }
}
