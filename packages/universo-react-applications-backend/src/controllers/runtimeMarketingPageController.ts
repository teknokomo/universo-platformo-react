import type { Request, Response } from 'express'
import {
    MARKETING_WIDGET_REGISTRY,
    getLayoutWidgetDefinition,
    MARKETING_MAX_RUNTIME_RECORDS,
    layoutHashSchema,
    marketingAtomicHeaderWidgetSchema,
    marketingPageConfigSchema,
    marketingPageDataSchema,
    marketingSemanticKeySchema,
    marketingPersistedIdSchema,
    marketingRuntimeWidgetSchema,
    parseApplicationLayoutWidgetConfig,
    resourceSourceSchema,
    validateWidgetBindings,
    type MarketingAction,
    type MarketingPageConfig,
    type ResourceSource,
    type WidgetBindingSlotDefinition,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import { normalizeMarketingMedia, parseMarketingActionHref } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import {
    createQueryHelper,
    normalizeLocale,
    resolveRuntimeSchema,
    runtimeLayoutCapableFilterSql,
    runtimeObjectFilterSql,
    runtimeCodenameTextSql
} from '../shared/runtimeHelpers'
import {
    EffectiveLayoutError,
    effectiveLayoutErrorBody,
    parseRuntimeTarget,
    type EffectiveLayoutSuccess
} from '../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForRequest } from '../services/effectiveLayoutResolver'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { projectMarketingWidgetBindingData } from '../services/marketingWidgetEntityBinding'
import {
    loadRuntimeWidgetBindingMetadata,
    loadWidgetBindingRuntimeRecords,
    WidgetBindingRuntimeDataError,
    type RuntimeWidgetBindingObjectMetadata
} from '../persistence/widgetBindingRuntimeStore'
import { asMarketingString } from '../services/marketingRuntimeSerialization'

const MARKETING_RUNTIME_ENTITY_CODENAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/u

export interface MarketingRuntimeContext {
    applicationId?: string
    schemaIdent: string
    schemaName?: string
    manager: DbExecutor
    currentWorkspaceId: string | null
    workspacesEnabled?: boolean
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

const asString = asMarketingString

const safeMarketingBindingFailureCategory = (error: unknown): string => {
    if (error instanceof WidgetBindingRuntimeDataError) return 'runtime-data-invalid'
    if (error instanceof Error && /^MARKETING_WIDGET_[A-Z0-9_]+$/u.test(error.message)) return error.message
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: unknown }).code
        if (typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code)) return `database-${code}`
    }
    return error instanceof Error ? error.name : 'unknown-error'
}

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
        const widgetRows = effectiveLayout.widgets.filter((widget) => !getLayoutWidgetDefinition(widget.widgetKey, widget.config)?.shared)
        if (effectiveLayout.scope === 'global' && !widgetRows.some((widget) => widget.isActive)) {
            return res.status(409).json({ code: 'MARKETING_LAYOUT_INCOMPLETE', error: 'Marketing page has no active widget composition.' })
        }
        const invalidLayout = (message: string) => res.status(409).json({ code: 'MARKETING_LAYOUT_INVALID', error: message })
        const unavailableSource = (message: string) => res.status(409).json({ code: 'MARKETING_BINDING_UNAVAILABLE', error: message })
        const validatedWidgets = new Map<string, { config: Record<string, unknown>; bindings?: WidgetEntityBindingEnvelope }>()
        const instanceKeys = new Set<string>()
        const componentCodenamesByEntity = new Map<string, Set<string>>()

        for (const widget of widgetRows) {
            if (!widget.isActive) continue
            const registryEntry = MARKETING_WIDGET_REGISTRY[widget.widgetKey as keyof typeof MARKETING_WIDGET_REGISTRY]
            if (!registryEntry || !registryEntry.allowedZones.includes(widget.zone as (typeof registryEntry.allowedZones)[number])) {
                return invalidLayout('Marketing widget placement or key is invalid.')
            }

            let config: Record<string, unknown>
            try {
                config = parseApplicationLayoutWidgetConfig(widget.widgetKey, widget.config)
            } catch {
                return invalidLayout('Marketing widget configuration is invalid.')
            }
            const definition = getLayoutWidgetDefinition(widget.widgetKey, config)
            if (!definition) return invalidLayout('Marketing widget definition is unavailable.')
            const rawBindings = getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
            if (definition.bindingSlots?.length && !rawBindings) {
                return invalidLayout('Marketing widget Entity bindings are missing.')
            }
            if (!definition.bindingSlots?.length && rawBindings) {
                return invalidLayout('This widget does not accept Entity bindings.')
            }
            let bindings: WidgetEntityBindingEnvelope | undefined
            if (rawBindings) {
                try {
                    bindings = validateWidgetBindings(definition, rawBindings)
                } catch {
                    return invalidLayout('Marketing widget Entity bindings are invalid.')
                }
            }
            for (const boundSlot of bindings?.slots ?? []) {
                const slot = definition.bindingSlots?.find(({ key }) => key === boundSlot.slot)
                if (!slot) return invalidLayout('Marketing widget Entity binding slot is invalid.')
                for (const target of boundSlot.targets) {
                    const requiredComponents = componentCodenamesByEntity.get(target.entityCodename) ?? new Set<string>()
                    for (const component of slot.requirements.components) requiredComponents.add(component.componentCodename)
                    componentCodenamesByEntity.set(target.entityCodename, requiredComponents)
                }
            }

            const instanceKey = String(config.instanceKey)
            if (instanceKeys.has(instanceKey)) return invalidLayout('Marketing widget instance keys must be unique within a layout.')
            instanceKeys.add(instanceKey)
            validatedWidgets.set(widget.id, { config, ...(bindings ? { bindings } : {}) })
        }

        let bindingMetadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>
        try {
            bindingMetadata = await loadRuntimeWidgetBindingMetadata(
                ctx.manager,
                ctx.schemaName ?? ctx.schemaIdent.replace(/^"|"$/gu, ''),
                new Map([...componentCodenamesByEntity].map(([codename, components]) => [codename, [...components]]))
            )
        } catch {
            return unavailableSource('Marketing Entity metadata is unavailable.')
        }
        if ([...componentCodenamesByEntity.keys()].some((codename) => !bindingMetadata.objectsByCodename.has(codename))) {
            return unavailableSource('A bound Marketing Entity is unavailable.')
        }

        const loadedRecords = new Map<string, Awaited<ReturnType<typeof loadWidgetBindingRuntimeRecords>>>()
        const runtimeWidgets = []
        let runtimeRecordCount = 0
        for (const widget of widgetRows) {
            if (!widget.isActive) continue
            const validated = validatedWidgets.get(widget.id)
            if (!validated) return invalidLayout('Marketing widget configuration is unavailable.')
            const { config, bindings } = validated
            const definition = getLayoutWidgetDefinition(widget.widgetKey, config)
            if (!definition) return invalidLayout('Marketing widget definition is unavailable.')

            let data: Awaited<ReturnType<typeof projectMarketingWidgetBindingData>>
            let bindingSlot: string | null = null
            try {
                data = await projectMarketingWidgetBindingData({
                    widgetKey: widget.widgetKey,
                    bindings,
                    config: runtimeConfig,
                    rendererConfig: config,
                    loadRecords: async (query) => {
                        bindingSlot = query.slot
                        const object = bindingMetadata.objectsByCodename.get(query.target.entityCodename)
                        const slot = definition.bindingSlots?.find(({ key }) => key === query.slot)
                        if (!object || !slot || query.target.entityKind !== 'object') {
                            throw new Error('Marketing widget binding target is unavailable.')
                        }
                        let parentObjectId: string | undefined
                        let parentObject: RuntimeWidgetBindingObjectMetadata | undefined
                        let parentSlot: WidgetBindingSlotDefinition | undefined
                        if (query.kind === 'relation-set') {
                            const parent = bindingMetadata.objectsByCodename.get(query.selector.parentTarget.entityCodename)
                            const relation = slot.relation
                            const parentSlotDefinition = relation
                                ? definition.bindingSlots?.find(({ key }) => key === relation.parentSlot)
                                : undefined
                            if (!parent || !parentSlotDefinition || query.selector.parentTarget.entityKind !== 'object') {
                                throw new Error('Marketing widget relation parent is unavailable.')
                            }
                            parentObjectId = String(parent.id)
                            parentObject = parent
                            parentSlot = parentSlotDefinition
                        }
                        const cacheKey = JSON.stringify({ query, objectId: object.id, parentObjectId })
                        const cached = loadedRecords.get(cacheKey)
                        if (cached) return cached
                        const rows = await loadWidgetBindingRuntimeRecords(ctx.manager, {
                            schemaName: ctx.schemaName ?? ctx.schemaIdent.replace(/^"|"$/gu, ''),
                            workspaceId: ctx.currentWorkspaceId,
                            workspacesEnabled: ctx.workspacesEnabled ?? ctx.currentWorkspaceId !== null,
                            query,
                            object,
                            ...(parentObject ? { parentObject } : {}),
                            ...(parentSlot ? { parentSlot } : {}),
                            components: bindingMetadata.componentsByObjectId.get(String(object.id)) ?? [],
                            slot,
                            ...(parentObjectId ? { parentObjectId } : {})
                        })
                        loadedRecords.set(cacheKey, rows)
                        return rows
                    }
                })
            } catch (error) {
                console.error('[ApplicationsRuntime] Marketing widget Entity binding is unavailable', {
                    widgetKey: widget.widgetKey,
                    slot: bindingSlot,
                    failureCategory: safeMarketingBindingFailureCategory(error)
                })
                return unavailableSource('Marketing widget Entity binding is unavailable.')
            }

            if (widget.widgetKey === 'marketing.image' && data && Array.isArray(data.records) && data.records.length === 0) {
                continue
            }

            runtimeRecordCount += data?.records.length ?? 0
            if (runtimeRecordCount > MARKETING_MAX_RUNTIME_RECORDS) {
                return res.status(413).json({
                    code: 'MARKETING_RUNTIME_DATA_TOO_LARGE',
                    error: 'Marketing page data exceeds the runtime record limit.'
                })
            }

            const rawWidget = {
                instanceKey: config.instanceKey,
                zone: widget.zone,
                widgetKey: widget.widgetKey,
                sortOrder: widget.sortOrder,
                isActive: widget.isActive,
                config,
                data: data ?? { records: [] }
            }
            const parsedWidget =
                widget.widgetKey === 'marketing.brand' || widget.widgetKey === 'marketing.auth'
                    ? marketingAtomicHeaderWidgetSchema.safeParse(rawWidget)
                    : marketingRuntimeWidgetSchema.safeParse(rawWidget)
            if (!parsedWidget.success) return invalidLayout('Marketing widget data is invalid.')
            runtimeWidgets.push(parsedWidget.data)
        }

        const parsedPage = marketingPageDataSchema.safeParse({
            templateKey: 'marketing-page',
            locale: requestedLocale,
            config: runtimeConfig,
            runtime: {
                layoutVersion: effectiveLayout.layout.version,
                layoutHash: effectiveLayout.effectiveHash
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
