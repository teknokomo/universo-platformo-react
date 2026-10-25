import {
    dashboardWidgetConfigSchemaByKey,
    detailsTabsWidgetConfigSchema,
    menuWidgetConfigSchema,
    publicDashboardNavigationActionSchema,
    publicDashboardMenuDataSchema,
    publicDashboardLayoutConfigSchema,
    publicDashboardReadOnlyDataSchema,
    publicDashboardRuntimeSchema,
    publicInterpretationNetworkRendererConfigSchema,
    pageBlockContentSchema,
    type PublicDashboardPlacement,
    type PublicDashboardRuntime,
    type RuntimePageBlock
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { ResolvedPublicApplication } from './publicApplicationRuntime'
import { PublicApplicationUnavailableError } from './publicApplicationRuntime'
import { resolveEffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeDataResolver'
import type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import type { EffectiveLayoutSuccess } from './effectiveLayoutContract'
import type { EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'

const PUBLIC_HIDDEN_WIDGET_CONFIG_SCHEMAS = {
    workspaceSwitcher: dashboardWidgetConfigSchemaByKey.workspaceSwitcher,
    optionsMenu: dashboardWidgetConfigSchemaByKey.optionsMenu,
    userProfile: dashboardWidgetConfigSchemaByKey.userProfile
} as const
type PublicHiddenWidgetKey = keyof typeof PUBLIC_HIDDEN_WIDGET_CONFIG_SCHEMAS
const isPublicHiddenWidgetKey = (widgetKey: string): widgetKey is PublicHiddenWidgetKey =>
    Object.prototype.hasOwnProperty.call(PUBLIC_HIDDEN_WIDGET_CONFIG_SCHEMAS, widgetKey)
const PUBLIC_SHELL_WIDGETS = new Set(['appNavbar', 'header', 'languageSwitcher', 'colorModeSwitcher'])
const PUBLIC_TABLE_ACTION_CONFIG_KEYS = new Set([
    'createTargets',
    'rowActions',
    'restoreTarget',
    'rowCountWarning',
    'sequencePolicy',
    'workflowActions',
    'enableRowReordering'
])
const PUBLIC_INTERPRETATION_NETWORK_RENDERER_CONFIG_KEYS = [
    'structureMode',
    'matrixMode',
    'allowedMatrixViews',
    'defaultMatrixView',
    'tableProjection',
    'breadcrumbDepth',
    'toolbarLayout',
    'showHierarchicalTableHeaders',
    'showHierarchicalTableHeaderCard',
    'showMatrixTreeTotalCells',
    'colorBreadcrumbsByCell',
    'cellStylePolicy',
    'splitPane',
    'templatePanel',
    'hierarchyRowMode',
    'positionNumbering',
    'allowNewAxesInCellDialog'
] as const

export class PublicDashboardMaterializationError extends Error {
    constructor() {
        super('Public Dashboard projection is unavailable')
        this.name = 'PublicDashboardMaterializationError'
    }
}

export class PublicRuntimeTransientError extends Error {
    constructor() {
        super('Public runtime data is temporarily unavailable')
        this.name = 'PublicRuntimeTransientError'
    }
}

type EffectiveWidget = EffectiveLayoutSuccess['widgets'][number]
type PublicDashboardDraft = {
    instanceKey: string
    zone: EffectiveWidget['zone']
    sortOrder: number
    parentInstanceKey: string | null
    slotKey: string | null
    widgetKey: PublicDashboardPlacement['widgetKey']
    config: unknown
    runtimeData?: unknown
}

interface ClassifiedDashboard {
    readonly layoutConfig: NonNullable<PublicDashboardRuntime['layoutConfig']>
    readonly placements: PublicDashboardDraft[]
    readonly menuWidgets: EffectiveWidget[]
    readonly readOnlyTableWidgets: EffectiveWidget[]
    readonly interpretationNetworkWidget: EffectiveWidget | null
}

const unavailable = (): never => {
    throw new PublicApplicationUnavailableError('materialization_invalid')
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const projectPublicPageBlockText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value
    if (!isPlainRecord(value) || !isPlainRecord(value.locales)) return ''

    const primaryLocale = typeof value._primary === 'string' ? value._primary : 'en'
    const candidates = [...new Set([locale.split(/[-_]/u)[0], locale, primaryLocale, 'en', 'ru'])]
    for (const candidate of candidates) {
        const entry = value.locales[candidate]
        if (!isPlainRecord(entry) || entry.isActive === false || typeof entry.content !== 'string') continue
        return entry.content
    }
    return ''
}

const projectPublicPageBlock = (block: RuntimePageBlock, locale: string): RuntimePageBlock => {
    const id = block.id === undefined ? {} : { id: block.id }
    switch (block.type) {
        case 'paragraph':
            return { ...id, type: 'paragraph', data: { text: projectPublicPageBlockText(block.data.text, locale) } }
        case 'header':
            return {
                ...id,
                type: 'header',
                data: {
                    text: projectPublicPageBlockText(block.data.text, locale),
                    ...(block.data.level !== undefined ? { level: block.data.level } : {})
                }
            }
        case 'list':
            return {
                ...id,
                type: 'list',
                data: {
                    items: block.data.items.map((item) => projectPublicPageBlockText(item, locale)),
                    ...(block.data.style !== undefined ? { style: block.data.style } : {})
                }
            }
        case 'quote':
            return {
                ...id,
                type: 'quote',
                data: {
                    text: projectPublicPageBlockText(block.data.text, locale),
                    ...(block.data.caption !== undefined ? { caption: projectPublicPageBlockText(block.data.caption, locale) } : {}),
                    ...(block.data.alignment !== undefined ? { alignment: block.data.alignment } : {})
                }
            }
        case 'table':
            return {
                ...id,
                type: 'table',
                data: {
                    content: block.data.content.map((row) => row.map((cell) => projectPublicPageBlockText(cell, locale))),
                    ...(block.data.withHeadings !== undefined ? { withHeadings: block.data.withHeadings } : {})
                }
            }
        case 'image':
            return {
                ...id,
                type: 'image',
                data: {
                    url: block.data.url,
                    ...(block.data.caption !== undefined ? { caption: projectPublicPageBlockText(block.data.caption, locale) } : {}),
                    ...(block.data.alt !== undefined ? { alt: projectPublicPageBlockText(block.data.alt, locale) } : {})
                }
            }
        case 'embed':
            return {
                ...id,
                type: 'embed',
                data: {
                    url: block.data.url,
                    ...(block.data.caption !== undefined ? { caption: projectPublicPageBlockText(block.data.caption, locale) } : {})
                }
            }
        case 'delimiter':
            return { ...id, type: 'delimiter', data: {} }
    }
}

const projectBase = (widget: EffectiveWidget) => ({
    instanceKey: widget.instanceKey,
    zone: widget.zone,
    sortOrder: widget.sortOrder,
    parentInstanceKey: widget.parentInstanceKey,
    slotKey: widget.slotKey
})

const projectPublicDashboardLayoutConfig = (value: unknown): NonNullable<PublicDashboardRuntime['layoutConfig']> | null => {
    const sourceConfig = value === undefined ? {} : value
    if (!isPlainRecord(sourceConfig)) return null

    const projectedConfig = Object.prototype.hasOwnProperty.call(sourceConfig, 'sideMenu') ? { sideMenu: sourceConfig.sideMenu } : {}
    const parsed = publicDashboardLayoutConfigSchema.safeParse(projectedConfig)
    return parsed.success ? parsed.data : null
}

const projectPublicInterpretationNetworkConfig = (value: unknown): Record<string, unknown> | null => {
    const fullConfig = dashboardWidgetConfigSchemaByKey.interpretationNetworkWorkspace.safeParse(value)
    if (!fullConfig.success) return null

    const rendererConfig = Object.fromEntries(
        PUBLIC_INTERPRETATION_NETWORK_RENDERER_CONFIG_KEYS.flatMap((key) =>
            Object.prototype.hasOwnProperty.call(fullConfig.data, key) ? [[key, fullConfig.data[key]]] : []
        )
    )
    const publicConfig = publicInterpretationNetworkRendererConfigSchema.safeParse(rendererConfig)
    return publicConfig.success ? publicConfig.data : null
}

const projectPublicDetailsTableConfig = (value: unknown): { config: Record<string, unknown>; variant: string } | null => {
    const parsed = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(value)
    if (!parsed.success || parsed.data.variant === 'report') return null

    const config = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => !PUBLIC_TABLE_ACTION_CONFIG_KEYS.has(key))) as Record<
        string,
        unknown
    >
    const variant = parsed.data.variant ?? 'records'
    const normalized = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse({ ...config, variant })
    return normalized.success ? { config: normalized.data as Record<string, unknown>, variant } : null
}

const projectPublicReadOnlyRuntimeData = (data: EffectiveWidgetRuntimeData | undefined) => {
    if (data?.status === 'network-error' || data?.status === 'server-error') throw new PublicRuntimeTransientError()
    if (data?.status !== 'ready') return { status: 'empty' as const }

    const source = data.data
    if (source.kind === 'table') {
        const publicData = publicDashboardReadOnlyDataSchema.safeParse({
            kind: 'table',
            columns: source.columns.map(({ key, label, valueType }) => ({ key, label, ...(valueType ? { valueType } : {}) })),
            rows: source.rows.map(({ key, cells }) => ({
                key,
                cells: cells.map(({ key: cellKey, value }) => ({ key: cellKey, value }))
            })),
            ...(source.pagination
                ? {
                      pagination: {
                          total: source.pagination.total,
                          limit: source.pagination.limit,
                          offset: source.pagination.offset
                      }
                  }
                : {})
        })
        if (!publicData.success) return unavailable()
        if (publicData.data.kind === 'table' && publicData.data.rows.length === 0) return { status: 'empty' as const }
        return { status: 'ready' as const, data: publicData.data }
    }

    if (source.kind === 'record') {
        const publicData = publicDashboardReadOnlyDataSchema.safeParse({
            kind: 'record',
            title: source.title,
            fields: source.fields.map(({ label, value }) => ({ label, value }))
        })
        if (!publicData.success) return unavailable()
        return { status: 'ready' as const, data: publicData.data }
    }

    return { status: 'empty' as const }
}

/** Validate the whole active placement set and hidden-placeholder dependency closure before data reads. */
export const classifyPublicDashboardPlacements = (layout: EffectiveLayoutSuccess): ClassifiedDashboard => {
    if (layout.layout.templateKey !== 'dashboard') return unavailable()
    const layoutConfig = projectPublicDashboardLayoutConfig(layout.layout.config)
    if (!layoutConfig) return unavailable()

    const activeWidgets = layout.widgets.filter((widget) => widget.isActive)
    const activeKeys = new Set(activeWidgets.map((widget) => widget.instanceKey))
    if (activeKeys.size !== activeWidgets.length) return unavailable()

    const hiddenWidgets = activeWidgets.filter((widget) => isPublicHiddenWidgetKey(widget.widgetKey))
    const hiddenKeys = new Set(hiddenWidgets.map((widget) => widget.instanceKey))
    if (activeWidgets.some((widget) => widget.parentInstanceKey !== null && hiddenKeys.has(widget.parentInstanceKey))) return unavailable()

    const placements: PublicDashboardDraft[] = []
    const menuWidgets: EffectiveWidget[] = []
    const readOnlyTableWidgets: EffectiveWidget[] = []
    let interpretationNetworkWidget: EffectiveWidget | null = null

    for (const widget of activeWidgets) {
        if (isPublicHiddenWidgetKey(widget.widgetKey)) {
            const configSchema = PUBLIC_HIDDEN_WIDGET_CONFIG_SCHEMAS[widget.widgetKey]
            if (!configSchema.safeParse(widget.config).success) return unavailable()
            continue
        }

        const base = projectBase(widget)
        if (widget.widgetKey === 'menuWidget') {
            const config = menuWidgetConfigSchema.safeParse(widget.config)
            if (!config.success || config.data.variant !== 'generated') return unavailable()
            placements.push({ ...base, widgetKey: 'menuWidget', config: config.data })
            menuWidgets.push(widget)
            continue
        }

        if (PUBLIC_SHELL_WIDGETS.has(widget.widgetKey)) {
            if (Object.keys(widget.config).length !== 0) return unavailable()
            placements.push({
                ...base,
                widgetKey: widget.widgetKey as 'appNavbar' | 'header' | 'languageSwitcher' | 'colorModeSwitcher',
                config: {}
            })
            continue
        }

        if (widget.widgetKey === 'detailsTabs') {
            const config = detailsTabsWidgetConfigSchema.safeParse(widget.config)
            if (!config.success) return unavailable()
            placements.push({ ...base, widgetKey: 'detailsTabs', config: config.data })
            continue
        }

        if (widget.widgetKey === 'detailsTable') {
            const projected = projectPublicDetailsTableConfig(widget.config)
            if (!projected) {
                const parsed = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(widget.config)
                // Saved reports remain private and are omitted from the anonymous dashboard.
                if (parsed.success && parsed.data.variant === 'report') continue
                return unavailable()
            }

            placements.push({
                ...base,
                widgetKey: 'detailsTable',
                config: projected.config,
                runtimeData: { status: 'empty' }
            })
            if (projected.variant === 'records') readOnlyTableWidgets.push(widget)
            continue
        }

        if (widget.widgetKey === 'interpretationNetworkWorkspace') {
            const config = projectPublicInterpretationNetworkConfig(widget.config)
            if (!config || interpretationNetworkWidget !== null) return unavailable()
            interpretationNetworkWidget = widget
            placements.push({
                ...base,
                widgetKey: 'interpretationNetworkWorkspace',
                config,
                runtimeData: { status: 'deferred' }
            })
            continue
        }

        return unavailable()
    }

    // Validate the projected graph after the only permitted anonymous omission.
    const projectedKeys = new Set(placements.map((placement) => placement.instanceKey))
    for (const placement of placements) {
        if (placement.parentInstanceKey !== null && !projectedKeys.has(placement.parentInstanceKey)) return unavailable()
    }
    for (const widget of activeWidgets) {
        if (widget.parentInstanceKey !== null && !activeKeys.has(widget.parentInstanceKey)) return unavailable()
    }

    return { layoutConfig, placements, menuWidgets, readOnlyTableWidgets, interpretationNetworkWidget }
}

const projectMenuData = (data: EffectiveWidgetRuntimeData | undefined) => {
    if (data?.status === 'network-error' || data?.status === 'server-error') throw new PublicRuntimeTransientError()
    if (data?.status !== 'ready' || data.data.kind !== 'menu' || !isPlainRecord(data.data)) return unavailable()

    const items = Array.isArray(data.data.items) ? data.data.items.filter((item) => isPlainRecord(item) && item.kind !== 'workspaces') : []
    const overflowItems = Array.isArray(data.data.overflowItems)
        ? data.data.overflowItems.filter((item) => isPlainRecord(item) && item.kind !== 'workspaces')
        : []
    const visibleMenuItems = [...items, ...overflowItems]
    const firstItem = visibleMenuItems[0]
    const sectionItems = visibleMenuItems.filter((item) => isPlainRecord(item) && item.kind === 'section' && isPlainRecord(item.target))
    const firstSection = sectionItems[0]
    const nextSection = sectionItems[1]
    const navigationAction =
        firstSection && nextSection
            ? publicDashboardNavigationActionSchema.safeParse({
                  label: nextSection.label,
                  source: firstSection.target,
                  target: nextSection.target
              })
            : undefined
    const parsed = publicDashboardMenuDataSchema.safeParse({
        title: data.data.title,
        showTitle: data.data.showTitle,
        overflowLabel: data.data.overflowLabel,
        items: firstItem ? [firstItem] : [],
        overflowItems: [],
        ...(navigationAction?.success ? { navigationAction: navigationAction.data } : {})
    })
    if (!parsed.success) return unavailable()
    return { status: 'ready' as const, data: parsed.data }
}

export const projectPublicDashboardRuntime = async (input: {
    executor: DbExecutor
    resolved: ResolvedPublicApplication
    workspaceId: string | null
    workspaceAvailable: boolean
    locale: 'en' | 'ru'
    effectiveLayout: EffectiveLayoutSuccess
    pageBlockContent?: unknown
    resolveRuntimeData?: (
        executor: DbExecutor,
        scope: EffectiveWidgetRuntimeReadScope,
        widgets: readonly EffectiveWidgetRuntimeCandidate[],
        locale: string
    ) => Promise<ReadonlyMap<string, EffectiveWidgetRuntimeData>>
}): Promise<PublicDashboardRuntime> => {
    const classified = classifyPublicDashboardPlacements(input.effectiveLayout)
    const resolver = input.resolveRuntimeData ?? resolveEffectiveWidgetRuntimeData
    let runtimeDataById: ReadonlyMap<string, EffectiveWidgetRuntimeData> = new Map()

    const runtimeWidgets = [...classified.menuWidgets, ...(input.workspaceAvailable ? classified.readOnlyTableWidgets : [])]
    if (runtimeWidgets.length > 0) {
        const scope: EffectiveWidgetRuntimeReadScope = {
            applicationId: input.resolved.application.id,
            schemaName: input.resolved.application.schemaName,
            workspaceId: input.workspaceId,
            workspacesEnabled: input.resolved.application.workspacesEnabled,
            currentUserId: null,
            role: null,
            publishedRecordsOnly: true,
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: false
            }
        }
        const candidates: EffectiveWidgetRuntimeCandidate[] = runtimeWidgets.map((widget) => ({
            id: widget.id,
            widgetKey: widget.widgetKey,
            config: widget.config,
            isActive: true,
            bindings: widget.widgetKey === 'menuWidget' ? null : getApplicationLayoutWidgetSourceBindingState(widget)?.bindings ?? null
        }))
        runtimeDataById = await resolver(input.executor, scope, candidates, input.locale)
    }

    const placements = classified.placements.map((placement) => {
        if (placement.widgetKey === 'menuWidget') {
            const source = classified.menuWidgets.find((widget) => widget.instanceKey === placement.instanceKey)
            if (!source) return unavailable()
            return { ...placement, runtimeData: projectMenuData(runtimeDataById.get(source.id)) } as PublicDashboardPlacement
        }
        if (placement.widgetKey === 'detailsTable' && isPlainRecord(placement.config) && placement.config.variant === 'records') {
            const source = classified.readOnlyTableWidgets.find((widget) => widget.instanceKey === placement.instanceKey)
            if (!source) return unavailable()
            return {
                ...placement,
                runtimeData: projectPublicReadOnlyRuntimeData(runtimeDataById.get(source.id))
            } as PublicDashboardPlacement
        }
        return placement as PublicDashboardPlacement
    })

    const parsedPageBlockContent =
        input.pageBlockContent === undefined || input.pageBlockContent === null
            ? null
            : pageBlockContentSchema.safeParse(input.pageBlockContent)
    if (parsedPageBlockContent && !parsedPageBlockContent.success) return unavailable()
    const pageBlocks = parsedPageBlockContent?.success
        ? (parsedPageBlockContent.data.blocks ?? parsedPageBlockContent.data.data?.blocks ?? []).map((block) =>
              projectPublicPageBlock(block, input.locale)
          )
        : undefined

    const parsed = publicDashboardRuntimeSchema.safeParse({
        locale: input.locale,
        workspaceAvailability: input.workspaceAvailable ? 'available' : 'none',
        layoutConfig: classified.layoutConfig,
        ...(pageBlocks?.length ? { pageBlocks } : {}),
        placements
    })
    if (!parsed.success) return unavailable()
    return parsed.data
}
