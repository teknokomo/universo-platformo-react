import {
    dashboardWidgetConfigSchemaByKey,
    getLayoutWidgetAllowedZones,
    isPublicMessengerCredentialUrlParameter,
    isPublicPersonalIdentityFieldName,
    isPublicMessengerTextSafe,
    MAX_PUBLIC_MESSENGER_PLACEMENTS,
    MAX_PUBLIC_MESSENGER_CHART_POINTS,
    MAX_PUBLIC_MESSENGER_RUNTIME_DATA_BYTES,
    MAX_PUBLIC_MESSENGER_TABLE_ROWS,
    messengerAppConfigSchema,
    publicDashboardReadOnlyDataSchema,
    publicMessengerAppRuntimeSchema,
    publicMessengerPlacementSchema,
    type PublicMessengerAppRuntime
} from '@universo-react/types'
import { isRuntimeSensitiveFieldName, isRuntimeTechnicalFieldName, type DbExecutor } from '@universo-react/utils'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import {
    PublicApplicationUnavailableError,
    resolvePublicApplicationDisplayName,
    type ResolvedPublicApplication
} from './publicApplicationRuntime'
import type { EffectiveLayoutSuccess, EffectiveLayoutWidget } from './effectiveLayoutContract'
import type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import type { EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'
import { resolveEffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeDataResolver'
import { PublicRuntimeTransientError } from './publicDashboardRuntime'

const PUBLIC_MESSENGER_WIDGET_KEYS = [
    'header',
    'menuWidget',
    'overviewCards',
    'detailsTable',
    'detailsTitle',
    'detailsTabs',
    'resourcePreview',
    'relationBuilder',
    'columnsContainer',
    'sessionsChart',
    'pageViewsChart'
] as const

type PublicMessengerWidgetKey = (typeof PUBLIC_MESSENGER_WIDGET_KEYS)[number]
type MessengerEffectiveWidget = EffectiveLayoutWidget & { widgetKey: PublicMessengerWidgetKey }

// The canonical generated Messenger layout has 14 active data-reading placements.
const MAX_PUBLIC_MESSENGER_RUNTIME_WIDGETS = 16
const MAX_PUBLIC_MESSENGER_RUNTIME_RECORDS_PER_SLOT = 30
const MAX_PUBLIC_MESSENGER_RUNTIME_RECORDS_PER_LAYOUT = 256
const PUBLIC_MESSENGER_WIDGET_KEY_SET: ReadonlySet<string> = new Set(PUBLIC_MESSENGER_WIDGET_KEYS)
const PUBLIC_MESSENGER_RUNTIME_WIDGETS: ReadonlySet<PublicMessengerWidgetKey> = new Set([
    'menuWidget',
    'overviewCards',
    'detailsTable',
    'detailsTitle',
    'resourcePreview',
    'relationBuilder',
    'sessionsChart',
    'pageViewsChart'
])

const PUBLIC_RUNTIME_PERMISSIONS: EffectiveWidgetRuntimeReadScope['permissions'] = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
}

const unavailable = (): never => {
    throw new PublicApplicationUnavailableError('materialization_invalid')
}

interface ValidatedMessengerPlacementSet {
    widgets: MessengerEffectiveWidget[]
    publicKeysByInternalKey: ReadonlyMap<string, string>
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const localizeConfigText = (value: unknown, locale: 'en' | 'ru'): string => {
    if (typeof value === 'string') return value
    if (!isRecord(value)) return unavailable()
    const localized = value[locale]
    if (typeof localized === 'string') return localized
    const fallback = value.en ?? value.ru ?? Object.values(value).find((item) => typeof item === 'string')
    return typeof fallback === 'string' ? fallback : unavailable()
}

const copyDefined = (source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
    Object.fromEntries(keys.flatMap((key) => (source[key] === undefined ? [] : [[key, source[key]]])))

const projectMessengerConfig = (widget: MessengerEffectiveWidget, locale: 'en' | 'ru'): Record<string, unknown> => {
    const configSchema = dashboardWidgetConfigSchemaByKey[widget.widgetKey]
    const parsed = configSchema.safeParse(widget.config)
    if (!parsed.success || !isRecord(parsed.data)) return unavailable()
    const config = parsed.data

    switch (widget.widgetKey) {
        case 'header':
            return {}
        case 'menuWidget':
            if (config.variant !== 'generated') return unavailable()
            return { variant: 'generated' }
        case 'overviewCards':
            return copyDefined(config, ['maxCards', 'density', 'trendDisplay'])
        case 'detailsTable':
            if (config.variant !== undefined && config.variant !== 'records') return unavailable()
            return {
                variant: 'records',
                ...copyDefined(config, [
                    'showSearch',
                    'showViewToggle',
                    'defaultViewMode',
                    'showFilterBar',
                    'cardColumns',
                    'rowHeight',
                    'maxRows'
                ]),
                maxRows:
                    typeof config.maxRows === 'number'
                        ? Math.min(config.maxRows, MAX_PUBLIC_MESSENGER_TABLE_ROWS)
                        : MAX_PUBLIC_MESSENGER_TABLE_ROWS
            }
        case 'detailsTitle':
            return copyDefined(config, ['align', 'level'])
        case 'detailsTabs': {
            if (!Array.isArray(config.tabs)) return unavailable()
            return {
                tabs: config.tabs.map((tab) => {
                    if (!isRecord(tab)) return unavailable()
                    return {
                        slotKey: tab.slotKey,
                        label: localizeConfigText(tab.label, locale),
                        ...(tab.isDefault !== undefined ? { isDefault: tab.isDefault } : {})
                    }
                })
            }
        }
        case 'resourcePreview':
            return {
                ...copyDefined(config, ['displayMode']),
                ...(config.titleOverride !== undefined ? { titleOverride: localizeConfigText(config.titleOverride, locale) } : {})
            }
        case 'relationBuilder':
            if (!Array.isArray(config.panels)) return unavailable()
            return {
                ...(config.parentLabel !== undefined ? { parentLabel: localizeConfigText(config.parentLabel, locale) } : {}),
                ...(config.emptyParentMessage !== undefined
                    ? { emptyParentMessage: localizeConfigText(config.emptyParentMessage, locale) }
                    : {}),
                panels: config.panels.map((panel) => {
                    if (!isRecord(panel)) return unavailable()
                    return {
                        slotKey: panel.slotKey,
                        title: localizeConfigText(panel.title, locale),
                        ...(panel.width !== undefined ? { width: panel.width } : {}),
                        ...(panel.order !== undefined ? { order: panel.order } : {})
                    }
                })
            }
        case 'columnsContainer':
            if (!Array.isArray(config.columns)) return unavailable()
            return {
                columns: config.columns.map((column) => {
                    if (!isRecord(column)) return unavailable()
                    return { slotKey: column.slotKey, width: column.width }
                })
            }
        case 'sessionsChart':
        case 'pageViewsChart':
            return {
                ...copyDefined(config, ['interval', 'chartStyle', 'maxPoints']),
                maxPoints:
                    typeof config.maxPoints === 'number'
                        ? Math.min(config.maxPoints, MAX_PUBLIC_MESSENGER_CHART_POINTS)
                        : MAX_PUBLIC_MESSENGER_CHART_POINTS,
                ...(config.title !== undefined ? { title: localizeConfigText(config.title, locale) } : {})
            }
    }
}

const resolverConfig = (widget: MessengerEffectiveWidget): Record<string, unknown> => {
    if (!isRecord(widget.config)) return unavailable()
    if (widget.widgetKey === 'sessionsChart' || widget.widgetKey === 'pageViewsChart') {
        const parsed = dashboardWidgetConfigSchemaByKey[widget.widgetKey].safeParse(widget.config)
        if (!parsed.success || !isRecord(parsed.data)) return unavailable()
        const maxPoints =
            typeof parsed.data.maxPoints === 'number'
                ? Math.min(parsed.data.maxPoints, MAX_PUBLIC_MESSENGER_CHART_POINTS)
                : MAX_PUBLIC_MESSENGER_CHART_POINTS
        return { ...widget.config, maxPoints }
    }
    if (widget.widgetKey !== 'detailsTable') return widget.config
    const parsed = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(widget.config)
    if (!parsed.success || !isRecord(parsed.data) || parsed.data.variant === 'report') return unavailable()
    const maxRows =
        typeof parsed.data.maxRows === 'number'
            ? Math.min(parsed.data.maxRows, MAX_PUBLIC_MESSENGER_TABLE_ROWS)
            : MAX_PUBLIC_MESSENGER_TABLE_ROWS
    return { ...widget.config, maxRows }
}

const isPrivateColumn = (key: string, label: string): boolean => {
    const names = [key, label]
    return names.some((name) => {
        const normalized = name.toLowerCase().replace(/[^a-z0-9а-яё]/gu, '')
        return (
            isRuntimeTechnicalFieldName(name) ||
            isRuntimeSensitiveFieldName(name) ||
            isPublicPersonalIdentityFieldName(name) ||
            ['почт', 'телефон', 'адрес', 'парол', 'токен', 'секрет', 'пользовател', 'владелец', 'идентификатор'].some((marker) =>
                normalized.includes(marker)
            )
        )
    })
}

const projectMessengerTableData = (
    data: Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data'],
    config: Record<string, unknown>
): unknown => {
    if (data.kind === 'record') {
        const fields = data.fields.filter((field) => !isPrivateColumn(field.label, field.label))
        if (fields.length === 0) return unavailable()
        const projectedRecord = publicDashboardReadOnlyDataSchema.safeParse({ kind: 'record', title: data.title, fields })
        return projectedRecord.success && projectedRecord.data.kind === 'record' ? projectedRecord.data : unavailable()
    }
    if (data.kind !== 'table') return unavailable()
    const columns = data.columns
        .filter((column) => !isPrivateColumn(column.key, column.label))
        .map((column, index) => ({
            sourceKey: column.key,
            key: `column${index + 1}`,
            label: column.label,
            ...(column.valueType ? { valueType: column.valueType } : {})
        }))
    if (columns.length === 0) return unavailable()

    const maxRows =
        typeof config.maxRows === 'number' ? Math.min(config.maxRows, MAX_PUBLIC_MESSENGER_TABLE_ROWS) : MAX_PUBLIC_MESSENGER_TABLE_ROWS
    const visibleRows = data.rows.slice(0, maxRows)
    const rows = visibleRows.map((row, rowIndex) => ({
        key: `row${rowIndex + 1}`,
        cells: columns.flatMap((column) => {
            const cell = row.cells.find(({ key }) => key === column.sourceKey)
            return cell ? [{ key: column.key, value: cell.value }] : []
        })
    }))

    if (data.pagination?.total === 1 && data.pagination.offset === 0 && visibleRows.length === 1) {
        const fields = columns.flatMap((column) => {
            const cell = visibleRows[0].cells.find(({ key }) => key === column.sourceKey)
            return cell ? [{ label: column.label, value: cell.value }] : []
        })
        if (fields.length > 0) {
            const title = fields.find(({ label }) => /title|name|subject/iu.test(label))?.value ?? fields[0].value
            const projectedRecord = publicDashboardReadOnlyDataSchema.safeParse({ kind: 'record', title, fields })
            if (projectedRecord.success && projectedRecord.data.kind === 'record') return projectedRecord.data
            return unavailable()
        }
    }

    const projected = {
        kind: 'table',
        columns: columns.map(({ sourceKey: _sourceKey, ...column }) => column),
        rows,
        ...(data.pagination
            ? {
                  pagination: {
                      total: data.pagination.total,
                      limit: Math.min(data.pagination.limit, maxRows),
                      offset: data.pagination.offset
                  }
              }
            : {})
    }
    const publicDashboardData = publicDashboardReadOnlyDataSchema.safeParse(projected)
    return publicDashboardData.success && publicDashboardData.data.kind === 'table' ? publicDashboardData.data : unavailable()
}

const projectMessengerRelationData = (
    data: Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data'],
    sourceConfig: unknown
): unknown => {
    if (data.kind !== 'relation') return unavailable()
    const parsedConfig = dashboardWidgetConfigSchemaByKey.relationBuilder.safeParse(sourceConfig)
    if (!parsedConfig.success) return unavailable()

    const sourcePanelsBySlot = new Map(parsedConfig.data.panels.map((panel) => [panel.slotKey, panel]))
    const parentKeys = new Map<string, string>()
    const parents: Array<{ key: string; label: string }> = []
    const seenParentKeys = new Set<string>()
    const parentTitleField = parsedConfig.data.parentTitleFieldCodename ?? 'Title'
    for (const parent of data.parents) {
        if (seenParentKeys.has(parent.key)) return unavailable()
        seenParentKeys.add(parent.key)
        if (isPrivateColumn(parentTitleField, parentTitleField) || isPrivateColumn(parent.key, parent.label)) continue
        const key = `parent${parents.length + 1}`
        parentKeys.set(parent.key, key)
        parents.push({ key, label: parent.label })
    }

    const panels = data.panels.map((panel, panelIndex) => {
        const sourcePanel = sourcePanelsBySlot.get(panel.slotKey)
        if (!sourcePanel) return unavailable()
        const sourceColumns = panel.displayColumns ?? []
        const sourceFields = sourcePanel.displayFields ?? []
        if (sourceColumns.length !== sourceFields.length) return unavailable()

        const displayColumnKeys = new Map<string, string>()
        const sourceDisplayColumns: Array<{ sourceKey: string; key: string; label: string }> = []
        for (const [columnIndex, column] of sourceColumns.entries()) {
            const sourceField = sourceFields[columnIndex]
            const expectedSourceKey = `display${columnIndex + 1}`
            if (column.key !== expectedSourceKey || displayColumnKeys.has(column.key) || !sourceField) return unavailable()
            if (isPrivateColumn(sourceField.fieldCodename, column.label) || isPrivateColumn(column.key, column.label)) continue
            const key = `display${sourceDisplayColumns.length + 1}`
            displayColumnKeys.set(column.key, key)
            sourceDisplayColumns.push({ sourceKey: column.key, key, label: column.label })
        }

        const displayColumns = sourceDisplayColumns.map(({ sourceKey: _sourceKey, ...column }) => column)
        const rows: Array<{
            key: string
            parentKey: string
            label: string
            cells: Array<{ key: string; value: string }>
        }> = []
        const titleField = sourcePanel.titleFieldCodename ?? 'Title'
        for (const row of panel.rows) {
            const parentKey = parentKeys.get(row.parentKey)
            if (!parentKey || isPrivateColumn(titleField, titleField) || isPrivateColumn(row.key, row.label)) continue
            const sourceCells = new Map((row.cells ?? []).map((cell) => [cell.key, cell.value]))
            if (sourceCells.size !== (row.cells ?? []).length) return unavailable()
            const cells = sourceDisplayColumns.map(({ sourceKey, key }) => {
                const value = sourceCells.get(sourceKey)
                if (value === undefined) return unavailable()
                return { key, value }
            })
            rows.push({ key: `row${panelIndex + 1}-${rows.length + 1}`, parentKey, label: row.label, cells })
        }
        return { slotKey: panel.slotKey, title: panel.title, displayColumns, rows }
    })
    return { kind: 'relation', parents, panels }
}

const hasCredentialLikeUrlParameter = (value: string): boolean => {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return true
    }
    if (url.username || url.password) return true

    const queryParameters = url.searchParams
    const fragmentParameters = new URLSearchParams(url.hash.replace(/^#/u, ''))
    return [queryParameters, fragmentParameters].some((parameters) =>
        Array.from(parameters.keys()).some(isPublicMessengerCredentialUrlParameter)
    )
}

const projectMessengerResourceData = (
    data: Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data'],
    config: Record<string, unknown>
): unknown => {
    if (data.kind !== 'resource' || !isRecord(data.source)) return unavailable()
    const source = data.source
    let publicSource: Record<string, unknown>
    if (source.type === 'page' && typeof source.pageCodename === 'string') {
        publicSource = { type: 'page', pageCodename: source.pageCodename, launchMode: source.launchMode }
    } else if (typeof source.url === 'string' && typeof source.type === 'string' && !hasCredentialLikeUrlParameter(source.url)) {
        publicSource = { type: source.type, url: source.url, launchMode: source.launchMode }
    } else {
        // Storage locators and package descriptors can carry private IDs or credentials.
        return unavailable()
    }
    return {
        kind: 'resource',
        title: typeof config.titleOverride === 'string' ? config.titleOverride : data.title,
        source: publicSource
    }
}

const projectMessengerSeriesData = (
    data: Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data'],
    config: Record<string, unknown>
): unknown => {
    if (data.kind !== 'series') return unavailable()
    const maxPoints = typeof config.maxPoints === 'number' ? config.maxPoints : 366
    const labels = data.labels.slice(-maxPoints)
    return {
        kind: 'series',
        title: data.title,
        labels,
        series: data.series
            .filter(({ label }) => !isPrivateColumn(label, label))
            .map(({ label, values }) => ({ label, values: values.slice(-maxPoints) }))
    }
}

const projectMessengerRuntimeData = (
    widgetKey: PublicMessengerWidgetKey,
    data: EffectiveWidgetRuntimeData | undefined,
    config: Record<string, unknown>,
    sourceConfig: unknown
): unknown => {
    if (!data) return unavailable()
    if (data.status === 'network-error' || data.status === 'server-error') throw new PublicRuntimeTransientError()
    if (data.status === 'stale-source' || data.status === 'malformed-config') return unavailable()
    if (data.status !== 'ready') return { status: 'empty' }

    let projectedData: unknown
    switch (widgetKey) {
        case 'menuWidget': {
            if (data.data.kind !== 'menu') return unavailable()
            const items = data.data.items.flatMap((item, index) => {
                if (
                    (item.kind !== 'group' && item.kind !== 'section') ||
                    !item.target ||
                    (item.kind === 'group' && item.target.kind !== 'hub') ||
                    (item.kind === 'section' && item.target.kind === 'hub')
                ) {
                    return []
                }
                if (!isPublicMessengerTextSafe(item.label) || isPublicPersonalIdentityFieldName(item.label)) return []
                return [
                    {
                        key: `messenger.item.${index + 1}`,
                        label: item.label,
                        icon: null,
                        kind: item.kind,
                        target: item.target
                    }
                ]
            })
            projectedData = {
                kind: 'menu',
                title: data.data.title,
                showTitle: data.data.showTitle,
                overflowLabel: data.data.overflowLabel,
                items,
                overflowItems: []
            }
            break
        }
        case 'overviewCards': {
            if (data.data.kind !== 'metrics') return unavailable()
            const maxCards = typeof config.maxCards === 'number' ? config.maxCards : 4
            projectedData = {
                kind: 'metrics',
                cards: data.data.cards.filter(({ label }) => !isPrivateColumn(label, label)).slice(0, maxCards)
            }
            break
        }
        case 'detailsTable':
            projectedData = projectMessengerTableData(data.data, config)
            break
        case 'detailsTitle':
            if (data.data.kind !== 'title') return unavailable()
            projectedData = data.data
            break
        case 'resourcePreview':
            projectedData = projectMessengerResourceData(data.data, config)
            break
        case 'relationBuilder':
            projectedData = projectMessengerRelationData(data.data, sourceConfig)
            break
        case 'sessionsChart':
        case 'pageViewsChart':
            projectedData = projectMessengerSeriesData(data.data, config)
            break
        case 'header':
        case 'detailsTabs':
        case 'columnsContainer':
            return unavailable()
    }
    return { status: 'ready', data: projectedData }
}

const validateActivePlacementSet = (layout: EffectiveLayoutSuccess, locale: 'en' | 'ru', title: string): ValidatedMessengerPlacementSet => {
    if (layout.layout.templateKey !== 'messenger-app') return unavailable()
    const activeWidgets = layout.widgets.filter((widget) => widget.isActive)
    if (activeWidgets.length > MAX_PUBLIC_MESSENGER_PLACEMENTS) return unavailable()

    const activeKeys = new Set<string>()
    const publicKeysByInternalKey = new Map<string, string>()
    const projected: unknown[] = []
    const messengerWidgets: MessengerEffectiveWidget[] = []

    for (const [index, widget] of activeWidgets.entries()) {
        if (!PUBLIC_MESSENGER_WIDGET_KEY_SET.has(widget.widgetKey)) return unavailable()
        const messengerWidget = widget as MessengerEffectiveWidget
        const allowedZones = getLayoutWidgetAllowedZones(messengerWidget.widgetKey, 'messenger-app')
        if (!allowedZones?.includes(messengerWidget.zone)) return unavailable()
        if (activeKeys.has(messengerWidget.instanceKey)) return unavailable()
        activeKeys.add(messengerWidget.instanceKey)
        publicKeysByInternalKey.set(messengerWidget.instanceKey, `placement.${index + 1}.${messengerWidget.widgetKey}`)
        messengerWidgets.push(messengerWidget)
    }

    const allByKey = new Map(layout.widgets.map((widget) => [widget.instanceKey, widget]))
    for (const messengerWidget of messengerWidgets) {
        if (messengerWidget.parentInstanceKey !== null) {
            const parent = allByKey.get(messengerWidget.parentInstanceKey)
            if (!parent || !parent.isActive || !activeKeys.has(parent.instanceKey)) return unavailable()
        }

        const config = projectMessengerConfig(messengerWidget, locale)
        const base = {
            instanceKey: publicKeysByInternalKey.get(messengerWidget.instanceKey),
            zone: messengerWidget.zone,
            sortOrder: messengerWidget.sortOrder,
            parentInstanceKey:
                messengerWidget.parentInstanceKey === null ? null : publicKeysByInternalKey.get(messengerWidget.parentInstanceKey),
            slotKey: messengerWidget.slotKey,
            widgetKey: messengerWidget.widgetKey,
            config
        }
        const hasRuntimeData = PUBLIC_MESSENGER_RUNTIME_WIDGETS.has(messengerWidget.widgetKey)
        projected.push(hasRuntimeData ? { ...base, runtimeData: { status: 'empty' } } : base)
    }

    // The shared DTO performs strict semantic-key, parent-slot, and cycle checks before any data read.
    const preflight = publicMessengerAppRuntimeSchema.safeParse({ locale, title, placements: projected })
    if (!preflight.success) return unavailable()

    return { widgets: messengerWidgets, publicKeysByInternalKey }
}

export interface PublicMessengerRuntimeLoadInput {
    executor: DbExecutor
    resolved: ResolvedPublicApplication
    workspaceId: string | null
    workspaceAvailable: boolean
    locale: 'en' | 'ru'
    effectiveLayout: EffectiveLayoutSuccess
    resolveRuntimeData?: (
        executor: DbExecutor,
        scope: EffectiveWidgetRuntimeReadScope,
        widgets: readonly EffectiveWidgetRuntimeCandidate[],
        locale: string
    ) => Promise<ReadonlyMap<string, EffectiveWidgetRuntimeData>>
}

/** Build a bounded anonymous Messenger DTO from published records and semantic placement keys only. */
export const projectPublicMessengerRuntime = async ({
    executor,
    resolved,
    workspaceId,
    workspaceAvailable,
    locale,
    effectiveLayout,
    resolveRuntimeData = resolveEffectiveWidgetRuntimeData
}: PublicMessengerRuntimeLoadInput): Promise<PublicMessengerAppRuntime> => {
    if (effectiveLayout.layout.templateKey !== 'messenger-app') return unavailable()
    const parsedMessengerConfig = messengerAppConfigSchema.safeParse(effectiveLayout.layout.config ?? {})
    if (!parsedMessengerConfig.success) return unavailable()

    const title = resolvePublicApplicationDisplayName(resolved.application.name, locale)
    const { widgets: activeWidgets, publicKeysByInternalKey } = validateActivePlacementSet(effectiveLayout, locale, title)
    const runtimeWidgets = activeWidgets.filter((widget) => PUBLIC_MESSENGER_RUNTIME_WIDGETS.has(widget.widgetKey))
    if (workspaceAvailable && runtimeWidgets.length > MAX_PUBLIC_MESSENGER_RUNTIME_WIDGETS) return unavailable()
    let runtimeDataById: ReadonlyMap<string, EffectiveWidgetRuntimeData> = new Map()

    const widgetsToResolve = workspaceAvailable
        ? runtimeWidgets
        : runtimeWidgets.filter((widget) => widget.widgetKey === 'menuWidget' && widget.config.variant === 'generated')
    if (widgetsToResolve.length > MAX_PUBLIC_MESSENGER_RUNTIME_WIDGETS) return unavailable()
    if (widgetsToResolve.length > 0) {
        const scope: EffectiveWidgetRuntimeReadScope = {
            applicationId: resolved.application.id,
            schemaName: resolved.application.schemaName,
            workspaceId: workspaceAvailable ? workspaceId : null,
            workspacesEnabled: resolved.application.workspacesEnabled,
            currentUserId: null,
            role: null,
            publishedRecordsOnly: true,
            publicRuntimePolicy: 'messenger-app',
            maxResolvedRecordsPerSlot: MAX_PUBLIC_MESSENGER_RUNTIME_RECORDS_PER_SLOT,
            maxResolvedRecordsPerLayout: MAX_PUBLIC_MESSENGER_RUNTIME_RECORDS_PER_LAYOUT,
            permissions: PUBLIC_RUNTIME_PERMISSIONS
        }
        const candidates: EffectiveWidgetRuntimeCandidate[] = widgetsToResolve.map((widget) => ({
            id: widget.id,
            widgetKey: widget.widgetKey,
            config: resolverConfig(widget),
            isActive: true,
            bindings: getApplicationLayoutWidgetSourceBindingState(widget)?.bindings ?? null
        }))
        runtimeDataById = await resolveRuntimeData(executor, scope, candidates, locale)
    }

    let projectedRuntimeDataBytes = 0
    const projected = activeWidgets.map((widget) => {
        const config = projectMessengerConfig(widget, locale)
        const base = {
            instanceKey: publicKeysByInternalKey.get(widget.instanceKey),
            zone: widget.zone,
            sortOrder: widget.sortOrder,
            parentInstanceKey: widget.parentInstanceKey === null ? null : publicKeysByInternalKey.get(widget.parentInstanceKey),
            slotKey: widget.slotKey,
            widgetKey: widget.widgetKey,
            config
        }
        if (!PUBLIC_MESSENGER_RUNTIME_WIDGETS.has(widget.widgetKey)) return base
        const runtimeData =
            runtimeDataById.get(widget.id) ?? (!workspaceAvailable ? ({ status: 'empty' } as EffectiveWidgetRuntimeData) : undefined)
        const projectedRuntimeData = projectMessengerRuntimeData(widget.widgetKey, runtimeData, config, widget.config)
        const placement = publicMessengerPlacementSchema.safeParse({ ...base, runtimeData: projectedRuntimeData })
        if (!placement.success) return unavailable()
        if (!('runtimeData' in placement.data)) return unavailable()
        const serializedRuntimeData = JSON.stringify(placement.data.runtimeData)
        if (serializedRuntimeData === undefined) throw new PublicRuntimeTransientError()
        projectedRuntimeDataBytes += Buffer.byteLength(serializedRuntimeData, 'utf8')
        if (projectedRuntimeDataBytes > MAX_PUBLIC_MESSENGER_RUNTIME_DATA_BYTES) throw new PublicRuntimeTransientError()
        return placement.data
    })

    const parsed = publicMessengerAppRuntimeSchema.safeParse({ locale, title, placements: projected })
    if (!parsed.success) return unavailable()
    return parsed.data
}
