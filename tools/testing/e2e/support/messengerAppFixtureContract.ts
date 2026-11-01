import { getLayoutWidgetDefinition, uuidV7Schema, type ApplicationLayoutZone } from '@universo-react/types'

type JsonRecord = Record<string, unknown>
type MessengerFixtureContractOptions = { requireOverviewContent?: boolean }

const asRecord = (value: unknown): JsonRecord | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null

const fail = (message: string): never => {
    throw new Error(`Messenger App fixture contract failed: ${message}`)
}

const readLocalizedText = (value: unknown, locale: 'en' | 'ru'): string | null => {
    if (typeof value === 'string') return value
    const localized = asRecord(value)
    const locales = asRecord(localized?.locales)
    const entry = asRecord(locales?.[locale])
    return typeof entry?.content === 'string' ? entry.content : null
}

const readBindingTargets = (placement: JsonRecord): JsonRecord[] => {
    const config = asRecord(placement.config)
    const layoutConfig = asRecord(config?.__layout)
    const bindings = asRecord(layoutConfig?.bindings)
    const slots = Array.isArray(bindings?.slots) ? bindings.slots.map(asRecord) : []
    return slots.flatMap((slot) =>
        Array.isArray(slot?.targets) ? slot.targets.map(asRecord).filter((item): item is JsonRecord => Boolean(item)) : []
    )
}

const assertOverviewContent = (snapshot: JsonRecord, placements: JsonRecord[], layoutId: string): void => {
    const entities = asRecord(snapshot.entities)
    if (!entities) fail('Public Messenger content requires snapshot entity definitions')
    const findEntity = (codename: string): { id: string; value: JsonRecord } | null => {
        for (const [id, value] of Object.entries(entities)) {
            const entity = asRecord(value)
            if (readLocalizedText(entity?.codename, 'en') === codename) return { id, value: entity }
        }
        return null
    }
    const rowsFor = (entity: { id: string; value: JsonRecord } | null, label: string): JsonRecord[] => {
        if (!entity) fail(`${label} source is required`)
        const elements = asRecord(snapshot.elements)
        const rows = elements && Array.isArray(elements[entity.id]) ? elements[entity.id].map(asRecord) : []
        return rows.filter((row): row is JsonRecord => Boolean(row))
    }
    const assertSafeVisibleText = (label: string, value: string | null): void => {
        if (!value || /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu.test(value)) {
            fail(`${label} must contain visible safe fixture text`)
        }
        if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value)) fail(`${label} must not contain email data`)
    }

    const metricsEntity = findEntity('DashboardDemoMetrics')
    const seriesEntity = findEntity('DashboardDemoSeries')
    const pageViewsEntity = findEntity('DashboardDemoPageViews')
    const recordsEntity = findEntity('DashboardDemoRecords')
    const resourceEntity = findEntity('DashboardDemoMessengerResources')
    const detailEntity = findEntity('DashboardDemoRecordDetail')
    const relationEntity = findEntity('DashboardDemoMessengerRelations')
    const metrics = rowsFor(metricsEntity, 'Overview cards metrics')
    const series = rowsFor(seriesEntity, 'Analytics chart series')
    const pageViews = rowsFor(pageViewsEntity, 'Page views chart series')
    const records = rowsFor(recordsEntity, 'Overview records table')
    const resourceRecords = rowsFor(resourceEntity, 'Messenger resource preview')
    const details = rowsFor(detailEntity, 'Single-record details table')
    const relations = rowsFor(relationEntity, 'Messenger relation viewer')

    const recordTitles = records.map((record) => readLocalizedText(asRecord(record.data)?.Title, 'en'))
    for (const title of ['Platform foundations', 'Data modeling', 'Application design']) {
        if (!recordTitles.includes(title)) fail(`Overview record ${title} is required as visible fixture data`)
    }
    if (records.length < 3) fail('Overview table must contain multiple visible demo records')
    for (const row of records) {
        const data = asRecord(row.data)
        assertSafeVisibleText('Overview record title', readLocalizedText(data?.Title, 'en'))
        assertSafeVisibleText('Overview record description', readLocalizedText(data?.Description, 'en'))
    }

    const metricTitles = metrics.map((row) => readLocalizedText(asRecord(row.data)?.Title, 'en'))
    for (const title of ['Active learners', 'Published courses', 'Completed lessons', 'Learning hours']) {
        if (!metricTitles.includes(title)) fail(`Overview card ${title} is required as visible fixture data`)
    }
    if (metrics.some((row) => typeof asRecord(row.data)?.Value !== 'number' || !Number.isFinite(asRecord(row.data)?.Value as number))) {
        fail('Overview cards require finite numeric values')
    }

    for (const row of [...series, ...pageViews]) {
        const data = asRecord(row.data)
        if (typeof data?.Value !== 'number' || !Number.isFinite(data.Value)) fail('Analytics chart values must be finite numbers')
        assertSafeVisibleText('Analytics chart label', readLocalizedText(data?.SeriesLabel, 'en'))
    }
    if (series.filter((row) => readLocalizedText(asRecord(asRecord(row.data)?.SeriesLabel), 'en') === 'Learning activity').length < 7) {
        fail('Sessions chart requires at least seven Learning activity points in DashboardDemoSeries')
    }
    if (pageViews.filter((row) => readLocalizedText(asRecord(asRecord(row.data)?.SeriesLabel), 'en') === 'Page views').length < 7) {
        fail('Page views chart requires at least seven Page views points in DashboardDemoPageViews')
    }

    if (details.length !== 1) fail('Record-detail source must contain exactly one row for the public detail projection')
    const detailRow = details[0]
    const detailData = asRecord(detailRow.data)
    if (readLocalizedText(detailData?.Title, 'en') !== 'Focused record detail') {
        fail('Record-detail source must expose the Focused record detail title')
    }
    assertSafeVisibleText('Record-detail description', readLocalizedText(detailData?.Description, 'en'))

    const resourceRow = resourceRecords.find((row) => asRecord(row.data)?.Key === 'messenger-resource-guide')
    if (!resourceRow) fail('Resource preview requires its semantic-key content record')
    const resourceData = asRecord(resourceRow.data)
    const resourceTitle = readLocalizedText(resourceData?.Title, 'en')
    assertSafeVisibleText('Resource preview title', resourceTitle)
    const rawResourceSource = resourceData?.Resource
    let resourceSource = asRecord(rawResourceSource)
    if (!resourceSource && typeof rawResourceSource === 'string') {
        try {
            resourceSource = asRecord(JSON.parse(rawResourceSource))
        } catch {
            fail('Resource preview source must be valid JSON resource data')
        }
    }
    if (!resourceSource) fail('Resource preview source must be valid JSON resource data')
    if (resourceSource?.type !== 'url' || resourceSource.url !== 'https://example.com/messenger-guide') {
        fail('Resource preview requires the safe HTTPS fixture URL')
    }

    const relationFields = Array.isArray(relationEntity?.value.fields) ? relationEntity.value.fields.map(asRecord) : []
    const parentField = relationFields.find((field) => readLocalizedText(field?.codename, 'en') === 'Parent')
    if (parentField?.dataType !== 'REF' || parentField.targetEntityKind !== 'object' || parentField.targetEntityId !== detailEntity?.id) {
        fail('Relation viewer Parent field must reference the single-record detail Object')
    }
    const relatedRows = relations.filter((row) => asRecord(row.data)?.Parent === detailRow.id)
    const relatedTitles = relatedRows.map((row) => readLocalizedText(asRecord(row.data)?.Title, 'en'))
    for (const title of ['Related architecture notes', 'Related public routing guide']) {
        if (!relatedTitles.includes(title)) fail(`Relation viewer requires the visible related row ${title}`)
    }
    for (const row of relatedRows) {
        assertSafeVisibleText('Related record title', readLocalizedText(asRecord(row.data)?.Title, 'en'))
        assertSafeVisibleText('Related record description', readLocalizedText(asRecord(row.data)?.Description, 'en'))
    }

    const messengerPlacements = placements.filter((placement) => placement.layoutId === layoutId)
    const requireWidget = (widgetKey: string): JsonRecord => {
        const matches = messengerPlacements.filter((item) => item.widgetKey === widgetKey)
        if (matches.length !== 1) fail(`Public Messenger requires exactly one ${widgetKey} Must widget, received ${matches.length}`)
        const placement = matches[0]
        if (!placement) fail(`Public Messenger requires the ${widgetKey} Must widget`)
        return placement
    }
    const widgetTargets = (placement: JsonRecord): JsonRecord[] => readBindingTargets(placement)
    const hasRecordSetTarget = (placement: JsonRecord, entityCodename: string): boolean =>
        widgetTargets(placement).some(
            (target) =>
                target.entityKind === 'object' &&
                target.entityCodename === entityCodename &&
                asRecord(target.selector)?.kind === 'record-set'
        )

    const tabs = requireWidget('detailsTabs')
    if (tabs.zone !== 'center' || typeof tabs.id !== 'string') fail('detailsTabs must be placed in the center zone')
    const tabConfig = asRecord(tabs.config)
    const overviewTab = Array.isArray(tabConfig?.tabs)
        ? tabConfig.tabs.map(asRecord).find((tab) => tab?.slotKey === 'tab:overview' && tab.isDefault === true)
        : undefined
    if (!overviewTab) fail('detailsTabs must provide a selected Overview tab')

    const overviewCards = requireWidget('overviewCards')
    if (!hasRecordSetTarget(overviewCards, 'DashboardDemoMetrics')) fail('overviewCards must project DashboardDemoMetrics')

    const titlePlacement = requireWidget('detailsTitle')
    if (
        titlePlacement.parentWidgetId !== tabs.id ||
        titlePlacement.slotKey !== 'tab:overview' ||
        !widgetTargets(titlePlacement).some(
            (target) =>
                target.entityKind === 'object' &&
                target.entityCodename === 'DashboardDemoContent' &&
                asRecord(target.selector)?.kind === 'semantic-key' &&
                asRecord(target.selector)?.value === 'overview-heading'
        )
    ) {
        fail('detailsTitle must project the localized overview-heading content in the Overview tab')
    }

    const tables = messengerPlacements.filter((placement) => placement.widgetKey === 'detailsTable')
    if (tables.length !== 2) fail(`detailsTable must include one multi-row table and one record-detail case, received ${tables.length}`)
    const multiRowTable = tables.find(
        (placement) =>
            placement.parentWidgetId === tabs.id &&
            placement.slotKey === 'tab:overview' &&
            hasRecordSetTarget(placement, 'DashboardDemoRecords')
    )
    if (!multiRowTable) fail('detailsTable must project the multi-row DashboardDemoRecords source in the Overview tab')
    const multiRowLimit = asRecord(multiRowTable.config)?.maxRows
    if (typeof multiRowLimit === 'number' && multiRowLimit < 2) {
        fail('The multi-row detailsTable must allow at least two visible records')
    }
    const detailTable = tables.find(
        (placement) =>
            placement.parentWidgetId === tabs.id &&
            placement.slotKey === 'tab:overview' &&
            hasRecordSetTarget(placement, 'DashboardDemoRecordDetail') &&
            asRecord(placement.config)?.maxRows === 1
    )
    if (!detailTable) fail('detailsTable must project the one-row DashboardDemoRecordDetail case')

    const resourcePreview = requireWidget('resourcePreview')
    if (
        resourcePreview.parentWidgetId !== tabs.id ||
        resourcePreview.slotKey !== 'tab:overview' ||
        !widgetTargets(resourcePreview).some(
            (target) =>
                target.entityCodename === 'DashboardDemoMessengerResources' &&
                asRecord(target.selector)?.kind === 'semantic-key' &&
                asRecord(target.selector)?.field === 'key' &&
                asRecord(target.selector)?.value === 'messenger-resource-guide'
        )
    ) {
        fail('resourcePreview must project the safe semantic-key resource record in the Overview tab')
    }

    const relationBuilder = requireWidget('relationBuilder')
    const relationConfig = asRecord(relationBuilder.config)
    const panels = Array.isArray(relationConfig?.panels) ? relationConfig.panels.map(asRecord) : []
    const relationPanel = panels.find((panel) => panel?.slotKey === 'panel:related-records' && panel.parentFieldCodename === 'Parent')
    if (!relationPanel || relationBuilder.parentWidgetId !== tabs.id || relationBuilder.slotKey !== 'tab:overview') {
        fail('relationBuilder must be placed in the Overview tab and use the Parent relation')
    }
    if (
        !widgetTargets(relationBuilder).some(
            (target) => target.entityCodename === 'DashboardDemoRecordDetail' && asRecord(target.selector)?.kind === 'record-set'
        ) ||
        !widgetTargets(relationBuilder).some(
            (target) =>
                target.entityCodename === 'DashboardDemoMessengerRelations' &&
                asRecord(target.selector)?.kind === 'relation-set' &&
                asRecord(target.selector)?.parentSlot === 'parent'
        )
    ) {
        fail('relationBuilder must project one safe parent and its related child records')
    }

    const columnsContainer = requireWidget('columnsContainer')
    const columnsConfig = asRecord(columnsContainer.config)
    const columns = Array.isArray(columnsConfig?.columns) ? columnsConfig.columns.map(asRecord) : []
    if (columnsContainer.parentWidgetId !== null || columnsContainer.slotKey !== null) {
        fail('columnsContainer must be a root placement because tab slots cannot contain nested containers')
    }
    for (const [widgetKey, slotKey, label, entityCodename] of [
        ['sessionsChart', 'column:sessions', 'Learning activity', 'DashboardDemoSeries'],
        ['pageViewsChart', 'column:page-views', 'Page views', 'DashboardDemoPageViews']
    ] as const) {
        const chart = requireWidget(widgetKey)
        if (
            chart.parentWidgetId !== columnsContainer.id ||
            chart.slotKey !== slotKey ||
            !columns.some((column) => column?.slotKey === slotKey) ||
            !hasRecordSetTarget(chart, entityCodename)
        ) {
            fail(`${widgetKey} must project ${entityCodename} inside its declared columnsContainer slot`)
        }
        const sourceRows = entityCodename === 'DashboardDemoSeries' ? series : pageViews
        if (sourceRows.filter((row) => readLocalizedText(asRecord(asRecord(row.data)?.SeriesLabel), 'en') === label).length < 7) {
            fail(`${widgetKey} requires at least seven visible ${label} data points`)
        }
    }

    for (const placement of messengerPlacements) {
        if (JSON.stringify(placement.config).match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu)) {
            fail(`widget ${String(placement.widgetKey)} bindings must use semantic keys rather than UUIDs`)
        }
    }
}

export const assertMessengerAppFixtureEnvelopeContract = (value: unknown, options: MessengerFixtureContractOptions = {}): void => {
    const envelope = asRecord(value)
    const snapshot = asRecord(envelope?.snapshot)
    if (!snapshot) fail('snapshot must be an object')
    if (Object.prototype.hasOwnProperty.call(snapshot, 'layoutConfig')) {
        fail('snapshot must use canonical layouts and placements without the retired layoutConfig projection')
    }

    const layouts = Array.isArray(snapshot.layouts) ? snapshot.layouts.map(asRecord) : null
    if (!layouts) fail('snapshot layouts are required')
    const messengerLayouts = layouts.filter((layout): layout is JsonRecord => layout?.templateKey === 'messenger-app')
    if (messengerLayouts.length !== 1) fail(`expected one Messenger layout, received ${messengerLayouts.length}`)

    const layout = messengerLayouts[0]
    if (typeof layout.id !== 'string') fail('Messenger layout id is required')
    uuidV7Schema.parse(layout.id)
    if (layout.isActive !== true || layout.isDefault !== true) fail('Messenger layout must be active and default')
    if (snapshot.defaultLayoutId !== layout.id) fail('snapshot defaultLayoutId must point to the Messenger layout')

    const placements = Array.isArray(snapshot.layoutZoneWidgets) ? snapshot.layoutZoneWidgets.map(asRecord) : null
    if (!placements) fail('snapshot layout placements are required')
    const messengerPlacements = placements.filter((placement) => placement?.layoutId === layout.id)
    if (messengerPlacements.length === 0) fail('Messenger layout must contain its seeded read-only composition')

    const zones = new Set<string>()
    for (const placement of messengerPlacements) {
        if (
            !placement ||
            typeof placement.id !== 'string' ||
            typeof placement.widgetKey !== 'string' ||
            typeof placement.zone !== 'string'
        ) {
            fail('each placement must have id, widgetKey, and zone')
        }
        uuidV7Schema.parse(placement.id)
        if (placement.zone === 'left' || placement.zone === 'right') fail(`unsupported platform zone ${placement.zone}`)
        zones.add(placement.zone)

        const definition = getLayoutWidgetDefinition(placement.widgetKey, placement.config)
        if (!definition?.supportedTemplates.includes('messenger-app')) {
            fail(`widget ${placement.widgetKey} is not registered for Messenger`)
        }
        if (!definition.allowedZonesByTemplate['messenger-app']?.includes(placement.zone as ApplicationLayoutZone)) {
            fail(`widget ${placement.widgetKey} is not allowed in the ${placement.zone} zone`)
        }
    }
    if (!zones.has('top') || !zones.has('center')) fail('seeded composition must populate the top and center zones')

    const requireOverviewContent = options.requireOverviewContent ?? snapshot.elements !== undefined
    if (requireOverviewContent) assertOverviewContent(snapshot, messengerPlacements, layout.id)
}
