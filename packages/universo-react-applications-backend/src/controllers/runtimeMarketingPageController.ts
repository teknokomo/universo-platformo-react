import type { Request, Response } from 'express'
import {
    MARKETING_WIDGET_REGISTRY,
    getLayoutWidgetDefinition,
    MARKETING_SOURCE_CODENAMES,
    MARKETING_COPY_SOURCE_CODENAME,
    MARKETING_MAX_RUNTIME_RECORDS,
    layoutHashSchema,
    marketingActionSchema,
    marketingAtomicHeaderWidgetSchema,
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
    type ResourceSource,
    type WidgetEntityBindingEnvelope
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
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { isCompatibleMarketingHeroObject, projectMarketingWidgetBindingData } from '../services/marketingHeroEntityBinding'
import {
    MARKETING_CHILD_RECORD_LIMIT,
    MARKETING_COLLECTION_ROW_LIMIT,
    asMarketingBoolean,
    asMarketingNumber,
    asMarketingRecord,
    asMarketingString,
    selectPricingBenefitSemanticKeysForTiers,
    toMarketingLocalizedMap,
    toMarketingLocalizedNumericMap,
    toMarketingLocalizedOptionalMap,
    toMarketingSemanticKey,
    applyMarketingFieldMap,
    type MarketingSerializableRecord
} from '../services/marketingRuntimeSerialization'

type RawRecord = Record<string, unknown>

const parseMarketingPageRecord = (record: MarketingSerializableRecord): MarketingPageRecord | null => {
    const parsed = marketingPageRecordSchema.safeParse(record)
    return parsed.success ? (parsed.data as MarketingPageRecord) : null
}

const applyPageFieldMap = (records: MarketingPageRecord[], fieldMap: Record<string, string>): MarketingPageRecord[] | null =>
    applyMarketingFieldMap(records, fieldMap, { parseRecord: parseMarketingPageRecord })

const MARKETING_OBJECTS = MARKETING_SOURCE_CODENAMES

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
    bindings?: WidgetEntityBindingEnvelope
}

type ValidatedMarketingWidgetConfig = {
    config: Record<string, unknown>
    source?: MarketingWidgetSource
    copySource?: MarketingWidgetSource
    bindings?: WidgetEntityBindingEnvelope
}

export interface MarketingRuntimeContext {
    applicationId?: string
    schemaIdent: string
    manager: DbExecutor
    currentWorkspaceId: string | null
    userId?: string
    role?: 'owner' | 'admin' | 'editor' | 'member'
}

export interface RuntimeMarketingPageControllerOptions {
    resolveRuntimeContext?: (req: Request, res: Response) => Promise<MarketingRuntimeContext | null>
    resolveEffectiveLayout?: (
        ctx: MarketingRuntimeContext,
        applicationId: string,
        target: ReturnType<typeof parseRuntimeTarget>
    ) => Promise<EffectiveLayoutSuccess>
}

const asRecord = asMarketingRecord
const asString = asMarketingString
const asNumber = asMarketingNumber
const asBoolean = (value: unknown, fallback = true): boolean => asMarketingBoolean(value, fallback)
const localized = toMarketingLocalizedMap
const localizedNumeric = toMarketingLocalizedNumericMap
const localizedOptional = toMarketingLocalizedOptionalMap
const safeSemanticKey = toMarketingSemanticKey

const readSingleQueryValue = (value: unknown): { valid: true; value?: string } | { valid: false } => {
    if (value === undefined) return { valid: true }
    return typeof value === 'string' ? { valid: true, value: value.trim() } : { valid: false }
}

export const safeAction = (value: unknown): MarketingAction | null => {
    return parseMarketingActionHref(value)
}

export const safeMedia = (
    value: unknown,
    kind: 'logo' | 'hero' | 'avatar' | 'feature' | 'highlight',
    alt: Record<string, string>,
    options?: { decorative?: boolean }
) => {
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
            ...(options?.decorative ? { decorative: true } : { alt, decorative: false })
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
      AND _upl_archived = false
      AND _app_archived = false
      AND _app_published = true
    ORDER BY id ASC
`

const componentQuery = (schemaIdent: string) => `
    SELECT id, object_id, codename, column_name, data_type, is_required, validation_rules
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

export const toConfig = (value: unknown): MarketingPageConfig => {
    const parsed = marketingPageConfigSchema.safeParse(value ?? {})
    if (!parsed.success) throw new Error('Marketing runtime configuration is invalid')
    return parsed.data
}

type MarketingRuntimeTarget = {
    entityTypeId: string | null
    recordKey: string | null
}

export class MarketingRuntimeRequestError extends Error {
    readonly httpStatus: number
    readonly code: string

    constructor(httpStatus: number, code: string, message: string) {
        super(message)
        this.name = 'MarketingRuntimeRequestError'
        this.httpStatus = httpStatus
        this.code = code
    }
}

const failMarketingRuntime = (httpStatus: number, code: string, message: string): never => {
    throw new MarketingRuntimeRequestError(httpStatus, code, message)
}

const resolveMarketingRuntimeTarget = async (
    manager: DbExecutor,
    schemaIdent: string,
    req: Request,
    targetKind: string | undefined
): Promise<MarketingRuntimeTarget> => {
    const entityTypeId = readSingleQueryValue(req.query.entityTypeId)
    const entityTypeCodename = readSingleQueryValue(req.query.entityTypeCodename)
    const recordKey = readSingleQueryValue(req.query.recordKey)
    if (!entityTypeId.valid || !entityTypeCodename.valid || !recordKey.valid) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_QUERY_INVALID', 'Marketing runtime query parameters are invalid.')
    }
    const requestedEntityTypeId = entityTypeId.value ?? ''
    const requestedEntityTypeCodename = entityTypeCodename.value ?? ''
    const requestedRecordKey = recordKey.value ?? ''

    if (requestedEntityTypeId && requestedEntityTypeCodename) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_AMBIGUOUS', 'Choose an entity type id or codename, not both.')
    }
    if (targetKind !== undefined && targetKind !== 'page' && targetKind !== 'object') {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_INVALID', 'The marketing target kind is invalid.')
    }
    if ((requestedEntityTypeId || requestedEntityTypeCodename) && !targetKind) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_INVALID', 'The marketing target kind is required.')
    }
    if (!requestedEntityTypeId && !requestedEntityTypeCodename && targetKind) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_INVALID', 'An entity selector is required for the target kind.')
    }
    if (requestedEntityTypeId && !marketingPersistedIdSchema.safeParse(requestedEntityTypeId).success) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_INVALID', 'The marketing entity type identifier is invalid.')
    }
    if (requestedEntityTypeCodename && !MARKETING_RUNTIME_ENTITY_CODENAME_PATTERN.test(requestedEntityTypeCodename)) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_TARGET_INVALID', 'The marketing entity type codename is invalid.')
    }
    if (requestedRecordKey && !marketingSemanticKeySchema.safeParse(requestedRecordKey).success) {
        return failMarketingRuntime(400, 'MARKETING_RUNTIME_RECORD_TARGET_INVALID', 'The marketing record key is invalid.')
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
        return failMarketingRuntime(404, 'MARKETING_RUNTIME_TARGET_NOT_FOUND', 'The selected marketing entity type was not found.')
    }
    if (rows.length > 1) {
        return failMarketingRuntime(409, 'MARKETING_RUNTIME_TARGET_AMBIGUOUS', 'The selected marketing entity type is ambiguous.')
    }
    return { entityTypeId: rows[0].id, recordKey: requestedRecordKey || null }
}

export function createRuntimeMarketingPageController(getDbExecutor: () => DbExecutor, options: RuntimeMarketingPageControllerOptions = {}) {
    const query = createQueryHelper(getDbExecutor)
    const resolveContext: NonNullable<RuntimeMarketingPageControllerOptions['resolveRuntimeContext']> =
        options.resolveRuntimeContext ??
        (async (req: Request, res: Response) => {
            const context = await resolveRuntimeSchema(getDbExecutor, query, req, res, req.params.applicationId)
            return context ? { ...context, applicationId: req.params.applicationId } : null
        })
    const resolveLayout =
        options.resolveEffectiveLayout ??
        ((ctx: MarketingRuntimeContext, applicationId: string, target: ReturnType<typeof parseRuntimeTarget>) => {
            if (!ctx.userId || !ctx.role) throw new EffectiveLayoutError('UNAUTHORIZED')
            return resolveEffectiveLayoutForRequest(ctx.manager, { applicationId, userId: ctx.userId, role: ctx.role }, target)
        })

    const getMarketingPage = async (req: Request, res: Response) => {
        const ctx = await resolveContext(req, res)
        if (!ctx) return
        const applicationId = ctx.applicationId ?? req.params.applicationId
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
        let target: MarketingRuntimeTarget
        try {
            target = await resolveMarketingRuntimeTarget(ctx.manager, ctx.schemaIdent, req, targetKind.value)
        } catch (error) {
            if (error instanceof MarketingRuntimeRequestError) {
                return res.status(error.httpStatus).json({ code: error.code, error: error.message })
            }
            throw error
        }

        let effectiveLayout: EffectiveLayoutSuccess
        try {
            const effectiveTarget = parseRuntimeTarget(applicationId, {
                ...(target.entityTypeId ? { targetKind: targetKind.value, entityTypeId: target.entityTypeId } : {}),
                ...(workspaceId.value ? { workspaceId: workspaceId.value } : {}),
                locale: requestedLocale,
                ...(themeVariant.value ? { themeVariant: themeVariant.value } : {})
            })
            effectiveLayout = await resolveLayout(ctx, applicationId, effectiveTarget)
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
                version: widget.version,
                bindings: getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
            }))
        if (!widgetRows.some((widget) => widget.is_active)) {
            return res.status(409).json({ code: 'MARKETING_LAYOUT_INCOMPLETE', error: 'Marketing page has no active widget composition.' })
        }
        const invalidLayout = (message: string) => res.status(409).json({ code: 'MARKETING_LAYOUT_INVALID', error: message })
        const unavailableSource = (message: string) => res.status(409).json({ code: 'MARKETING_SOURCE_UNAVAILABLE', error: message })
        const validatedWidgetConfigs = new Map<string, ValidatedMarketingWidgetConfig>()
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
            let source: MarketingWidgetSource | undefined
            const hasBindingSlot = Boolean(getLayoutWidgetDefinition(widgetRow.widget_key)?.bindingSlots?.length)
            if (registryEntry.dataOwnership === 'entity' && !hasBindingSlot) {
                const parsedSource = marketingWidgetSourceSchema.safeParse(config.source)
                if (!parsedSource.success) return invalidLayout('Marketing widget data source is invalid.')
                const allowedSources = marketingWidgetSourceCodenames(
                    widgetRow.widget_key as MarketingWidgetKey,
                    typeof config.variant === 'string' ? (config.variant as MarketingCollectionVariant) : undefined
                )
                if (!allowedSources.includes(parsedSource.data.entityCodename)) {
                    return invalidLayout('Marketing widget data source does not match the widget variant.')
                }
                source = parsedSource.data
            }
            if (hasBindingSlot && (config.source !== undefined || config.copySource !== undefined)) {
                return invalidLayout('Marketing widgets with binding slots must use their registered Entity binding.')
            }

            let copySource: MarketingWidgetSource | undefined
            if (config.copySource !== undefined) {
                if (!['marketing.collection', 'marketing.pricing', 'marketing.footer'].includes(widgetRow.widget_key)) {
                    return invalidLayout('This marketing widget does not support a copy source.')
                }
                const parsedCopySource = marketingWidgetSourceSchema.safeParse(config.copySource)
                if (!parsedCopySource.success) return invalidLayout('Marketing widget copy source is invalid.')
                copySource = parsedCopySource.data
            }

            const instanceKey = String(config.instanceKey)
            if (instanceKeys.has(instanceKey)) return invalidLayout('Marketing widget instance keys must be unique within a layout.')
            instanceKeys.add(instanceKey)

            validatedWidgetConfigs.set(widgetRow.id, {
                config,
                ...(source ? { source } : {}),
                ...(copySource ? { copySource } : {}),
                ...(widgetRow.bindings === undefined ? {} : { bindings: widgetRow.bindings })
            })
        }
        const safeRuntimeAction = (value: unknown): MarketingAction | null => {
            const action = safeAction(value)
            if (!action) return null
            if (action.kind === 'email' && !runtimeConfig.allowEmailActions) return null
            if (action.kind === 'tel' && !runtimeConfig.allowTelephoneActions) return null
            if (action.kind === 'external') return marketingActionSchema.parse({ ...action, target: runtimeConfig.externalLinkTarget })
            return action
        }

        const bindingObjectNames = [
            ...new Set(
                widgetRows.flatMap((widget) => {
                    const definition = getLayoutWidgetDefinition(widget.widget_key)
                    if (!definition?.bindingSlots?.length || !widget.bindings) return []
                    return widget.bindings.slots.flatMap((slot) => slot.targets.map(({ entityCodename }) => entityCodename))
                })
            )
        ]
        const queriedObjectNames = [...new Set([...MARKETING_OBJECTS, ...bindingObjectNames])]
        const objectRows = await ctx.manager.query<RawRecord>(objectQuery(ctx.schemaIdent), [queriedObjectNames])
        const objectsByName = new Map(objectRows.map((row) => [resolveRuntimeCodenameText(row.codename), row]))
        const objectIds = objectRows.map((row) => asString(row.id)).filter((id) => UUID_REGEX.test(id))
        const componentRows = objectIds.length > 0 ? await ctx.manager.query<RawRecord>(componentQuery(ctx.schemaIdent), [objectIds]) : []
        const componentsByObject = new Map<string, RawRecord[]>()
        for (const component of componentRows) {
            const list = componentsByObject.get(asString(component.object_id)) ?? []
            list.push(component)
            componentsByObject.set(asString(component.object_id), list)
        }

        const heroBindingObjectNames = [
            ...new Set(
                widgetRows.flatMap((widget) => {
                    if (widget.widget_key !== 'marketing.hero' || !widget.bindings) return []
                    return widget.bindings.slots.flatMap((slot) => slot.targets.map(({ entityCodename }) => entityCodename))
                })
            )
        ].filter((objectName) => {
            const matchingObjects = objectRows.filter((row) => resolveRuntimeCodenameText(row.codename) === objectName)
            if (matchingObjects.length !== 1) return false
            const object = matchingObjects[0]
            return isCompatibleMarketingHeroObject(object, componentsByObject.get(asString(object.id)) ?? [])
        })
        const objectNamesToLoad = [...new Set([...MARKETING_OBJECTS, ...heroBindingObjectNames])]
        const loadedEntries = await Promise.all(
            objectNamesToLoad.map(async (objectName) => {
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
        const brandWidgetConfig = asRecord(widgetRows.find((widget) => widget.widget_key === 'marketing.brand')?.config ?? null)
        const configuredBrandName = asString(brandWidgetConfig.brandName)
        const configuredBrandMedia = asMarketingRecord(brandWidgetConfig.brandLogo)
        const configuredBrandLogo = configuredBrandMedia.resource
            ? safeMedia(
                  configuredBrandMedia.resource,
                  'logo',
                  toMarketingLocalizedOptionalMap(configuredBrandMedia.alt, requestedLocale) ?? {},
                  { decorative: configuredBrandMedia.decorative === true }
              )
            : undefined
        const brandName = configuredBrandName
            ? { en: configuredBrandName, ru: configuredBrandName }
            : localized(siteSettings.BrandName, requestedLocale, '')
        const siteSettingsRecord = {
            ...runtimeBaseRecord(siteSettings, requestedLocale, 'site-settings', 'site-settings'),
            semanticKey: 'site-settings',
            kind: 'siteSettings' as const,
            brandName,
            brandLogo: configuredBrandLogo ?? safeMedia(siteSettings.BrandLogo, 'logo', brandName),
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
            // Partner/ecosystem entries may intentionally be text-only; keep
            // the localized label available to the renderer.
            return {
                ...runtimeBaseRecord(row, requestedLocale, `logo-${index + 1}`, row.LogoKey),
                kind: 'logo',
                name: alt,
                ...(media ? { media } : {}),
                ...(darkMedia && darkMedia !== media ? { darkMedia } : {})
            } as MarketingPageRecord
        })
        await addRecords(
            'MarketingPageFeature',
            (row, index) =>
                ({
                    ...runtimeBaseRecord(row, requestedLocale, `feature-${index + 1}`, row.FeatureKey),
                    kind: 'feature',
                    title: localized(row.Title, requestedLocale, ''),
                    // Description is optional content: an empty localized map is
                    // invalid and must be omitted instead of failing the runtime.
                    ...(localizedOptional(row.Description, requestedLocale)
                        ? { description: localizedOptional(row.Description, requestedLocale) }
                        : {}),
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
            ].filter(
                (benefit, benefitIndex, all) => all.findIndex((candidate) => candidate.semanticKey === benefit.semanticKey) === benefitIndex
            )
            return {
                ...runtimeBaseRecord(row, requestedLocale, `pricing-${index + 1}`, row.TierKey),
                kind: 'pricingTier' as const,
                title: localized(row.Title, requestedLocale, ''),
                ...(description ? { description } : {}),
                price: localizedNumeric(row.Price, requestedLocale, ''),
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
            if (!recordKey) return applyPageFieldMap(available, parsedSource.data.fieldMap)
            const selected = available.filter((record) => record.semanticKey === recordKey)
            return selected.length > 0 ? applyPageFieldMap(selected, parsedSource.data.fieldMap) : null
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
            return copy ? applyPageFieldMap([copy], parsedSource.data.fieldMap) : null
        }

        const runtimeWidgets = []
        for (const widgetRow of widgetRows) {
            const validated = validatedWidgetConfigs.get(widgetRow.id)
            if (!validated) return invalidLayout('Marketing widget configuration is unavailable.')
            const { config, source, copySource, bindings } = validated
            const registryEntry = MARKETING_WIDGET_REGISTRY[widgetRow.widget_key as keyof typeof MARKETING_WIDGET_REGISTRY]
            if (!registryEntry) return invalidLayout('Marketing widget configuration is unavailable.')
            const contentRecords = source ? sourceRecords(source) : []
            const definition = getLayoutWidgetDefinition(widgetRow.widget_key)
            const hasBindingSlot = Boolean(definition?.bindingSlots?.length)
            if (registryEntry.dataOwnership === 'entity' && !hasBindingSlot && !source) {
                return invalidLayout('Marketing widget data source is unavailable.')
            }
            if (source && !contentRecords && widgetRow.is_active) return unavailableSource('Marketing widget data source is unavailable.')
            const copyRecords = sourceCopy(copySource)
            if (copyRecords === null && widgetRow.is_active) return unavailableSource('Marketing widget copy source is unavailable.')
            let bindingData: ReturnType<typeof projectMarketingWidgetBindingData>
            try {
                bindingData = projectMarketingWidgetBindingData({
                    widgetKey: widgetRow.widget_key,
                    bindings,
                    loadRecords: (target) => {
                        if (target.entityKind !== 'object') return []
                        const matchingObjects = objectRows.filter(
                            (row) => resolveRuntimeCodenameText(row.codename) === target.entityCodename
                        )
                        if (matchingObjects.length !== 1) return []
                        const object = objectsByName.get(target.entityCodename)
                        const components = object ? componentsByObject.get(asString(object.id)) ?? [] : []
                        if (!object || !isCompatibleMarketingHeroObject(object, components)) return []
                        return loaded.get(target.entityCodename) ?? []
                    },
                    config: runtimeConfig
                })
            } catch {
                return unavailableSource('Marketing widget Entity binding is unavailable.')
            }

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

            if (widgetRow.widget_key === 'marketing.brand') {
                appendRecords(contentRecords ?? [], 1)
            } else if (widgetRow.widget_key === 'marketing.auth') {
                // Authentication actions are derived from the current locale by the isolated renderer.
            } else if (widgetRow.widget_key === 'marketing.navigation') {
                appendRecords(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                appendRecords(contentRecords ?? [])
            } else if (widgetRow.widget_key === 'marketing.collection') {
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
            } else if (widgetRow.widget_key === 'marketing.pricing') {
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
                if (config.showBenefits !== false) {
                    // Child collections must not share the tier `maxItems` budget:
                    // benefits are bounded by the aggregate record limit and the
                    // tiers that actually reached the payload. Raw persisted rows
                    // are matched so semantic-key sanitization cannot desync them.
                    const includedTierRows = (loaded.get('MarketingPagePricing') ?? []).slice(0, maxItems)
                    const includedBenefitKeys = selectPricingBenefitSemanticKeysForTiers(
                        loaded.get('MarketingPagePricingBenefit') ?? [],
                        includedTierRows
                    )
                    appendRecords(
                        (recordsByObject.get('MarketingPagePricingBenefit') ?? []).filter((record) =>
                            includedBenefitKeys.has(asString(record.semanticKey))
                        ),
                        MARKETING_CHILD_RECORD_LIMIT
                    )
                }
            } else if (widgetRow.widget_key === 'marketing.footer') {
                appendRecords(recordsByObject.get('MarketingPageSiteSettings') ?? [], 1)
                appendRecords(copyRecords ?? [])
                appendRecords(contentRecords ?? [])
            }

            const rawWidget = {
                instanceKey: config.instanceKey,
                zone: widgetRow.zone,
                widgetKey: widgetRow.widget_key,
                sortOrder: widgetRow.sort_order,
                isActive: widgetRow.is_active,
                config,
                data: bindingData ?? { records: recordsForWidget }
            }
            const parsedWidget =
                widgetRow.widget_key === 'marketing.brand' || widgetRow.widget_key === 'marketing.auth'
                    ? marketingAtomicHeaderWidgetSchema.safeParse(rawWidget)
                    : marketingRuntimeWidgetSchema.safeParse(rawWidget)
            if (!parsedWidget.success) return invalidLayout('Marketing widget data is invalid.')
            // Inactive persisted rows still pass validation so corrupt data cannot
            // hide behind the toggle, but they never become public runtime data.
            if (widgetRow.is_active) runtimeWidgets.push(parsedWidget.data)
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
