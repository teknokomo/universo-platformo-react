import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../../fixtures/test'
import {
    assignLayoutZoneWidget,
    createLayout,
    createLoggedInApiContext,
    createMetahub,
    createComponent,
    createObjectCollection,
    createRecord,
    disposeApiContext,
    getLayout,
    getRecord,
    getLayoutZoneWidgetBindings,
    listObjectCollections,
    listLayoutZoneWidgets
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { resolveFixtureOutputPath } from '../../support/fixtureOutputPath'
import { assertMessengerAppFixtureEnvelopeContract } from '../../support/messengerAppFixtureContract'
import { buildSnapshotEnvelope, buildVLC, createLocalizedContent, validateSnapshotEnvelope } from '@universo-react/utils'

const FIXTURE_FILENAME = 'metahubs-messenger-app-snapshot.json'
const FIXTURE_OUTPUT_PATH = resolveFixtureOutputPath('MESSENGER_APP_FIXTURE_OUTPUT_PATH', FIXTURE_FILENAME)

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type MessengerBindingTarget = {
    entityKind: 'object'
    entityCodename: string
    selector: Record<string, unknown>
    projection: Array<{ field: string; componentCodename: string }>
}

const readEnglishText = (value: unknown): string | null => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
    return typeof locales?.en?.content === 'string' ? locales.en.content : null
}

const recordSetTarget = (entityCodename: string, projection: MessengerBindingTarget['projection'] = []): MessengerBindingTarget => ({
    entityKind: 'object',
    entityCodename,
    selector: { kind: 'record-set' },
    projection
})

const recordSetBinding = (slot: string, target: MessengerBindingTarget) => ({ version: 1, slots: [{ slot, targets: [target] }] })

const ensureMessengerFixtureData = async (api: ApiContext, metahubId: string) => {
    const entitiesResponse = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
    const entities = entitiesResponse.items ?? []
    const entityByCodename = new Map(
        entities.map((entity: Record<string, unknown>) => [readEnglishText(entity.codename), entity]).filter(([codename]) => codename)
    )
    const recordsEntity = entityByCodename.get('DashboardDemoRecords') as Record<string, unknown> | undefined
    const contentEntity = entityByCodename.get('DashboardDemoContent') as Record<string, unknown> | undefined
    const seriesEntity = entityByCodename.get('DashboardDemoSeries') as Record<string, unknown> | undefined
    if (typeof recordsEntity?.id !== 'string' || typeof contentEntity?.id !== 'string' || typeof seriesEntity?.id !== 'string') {
        throw new Error('Basic Demo did not seed the Messenger fixture Object sources')
    }

    const detailEntity = await createObjectCollection(api, metahubId, {
        name: { en: 'Messenger record detail', ru: 'Детали записи Messenger' },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', 'DashboardDemoRecordDetail')
    })
    if (typeof detailEntity?.id !== 'string') throw new Error('Creating the Messenger record detail source did not return an id')

    const pageViewsEntity = await createObjectCollection(api, metahubId, {
        name: { en: 'Messenger page views', ru: 'Просмотры страниц Messenger' },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', 'DashboardDemoPageViews')
    })
    if (typeof pageViewsEntity?.id !== 'string') throw new Error('Creating the Messenger page views source did not return an id')

    const resourceEntity = await createObjectCollection(api, metahubId, {
        name: { en: 'Messenger resource guide', ru: 'Ресурс Messenger' },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', 'DashboardDemoMessengerResources')
    })
    if (typeof resourceEntity?.id !== 'string') throw new Error('Creating the Messenger resource source did not return an id')

    const relationEntity = await createObjectCollection(api, metahubId, {
        name: { en: 'Messenger related records', ru: 'Связанные записи Messenger' },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', 'DashboardDemoMessengerRelations')
    })
    if (typeof relationEntity?.id !== 'string') throw new Error('Creating the Messenger relation source did not return an id')

    const createField = async (
        objectId: string,
        codename: string,
        name: { en: string; ru: string },
        dataType: 'JSON' | 'STRING' | 'NUMBER' | 'REF',
        options: Record<string, unknown> = {}
    ) =>
        createComponent(api, metahubId, objectId, {
            name,
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', codename),
            dataType,
            isRequired: false,
            ...options
        })

    await createField(pageViewsEntity.id, 'Order', { en: 'Order', ru: 'Порядок' }, 'NUMBER', { isRequired: true })
    await createField(pageViewsEntity.id, 'SeriesKey', { en: 'Series key', ru: 'Ключ ряда' }, 'STRING', {
        isRequired: true,
        validationRules: { maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' }
    })
    await createField(pageViewsEntity.id, 'SeriesLabel', { en: 'Series label', ru: 'Название ряда' }, 'STRING', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true },
        validationRules: { localized: true, maxLength: 160 }
    })
    await createField(pageViewsEntity.id, 'Timestamp', { en: 'Timestamp', ru: 'Дата и время' }, 'STRING', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true }
    })
    await createField(pageViewsEntity.id, 'Value', { en: 'Value', ru: 'Значение' }, 'NUMBER', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true }
    })

    await createField(resourceEntity.id, 'Key', { en: 'Resource key', ru: 'Ключ ресурса' }, 'STRING', {
        isRequired: true,
        validationRules: { unique: true, maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' }
    })
    await createField(resourceEntity.id, 'Title', { en: 'Title', ru: 'Название' }, 'STRING', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true },
        validationRules: { localized: true, maxLength: 255 }
    })
    await createField(resourceEntity.id, 'Resource', { en: 'Resource source', ru: 'Источник ресурса' }, 'JSON', {
        uiConfig: { publicMessengerSafe: true, resourceSource: true, widget: 'resourceSource' }
    })

    await createField(relationEntity.id, 'Parent', { en: 'Parent record', ru: 'Родительская запись' }, 'REF', {
        isRequired: true,
        targetEntityId: detailEntity.id,
        targetEntityKind: 'object',
        uiConfig: { serverOwned: true }
    })
    await createField(relationEntity.id, 'Title', { en: 'Title', ru: 'Название' }, 'STRING', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true },
        validationRules: { localized: true, maxLength: 255 }
    })
    await createField(relationEntity.id, 'SortOrder', { en: 'Sort order', ru: 'Порядок' }, 'NUMBER', {
        isRequired: true,
        uiConfig: { hidden: true, serverOwned: true }
    })
    await createField(relationEntity.id, 'Description', { en: 'Description', ru: 'Описание' }, 'STRING', {
        validationRules: { localized: true, maxLength: 1000 },
        uiConfig: { publicMessengerSafe: true, rows: 3, widget: 'textarea' }
    })
    await createField(detailEntity.id, 'Title', { en: 'Title', ru: 'Название' }, 'STRING', {
        isRequired: true,
        uiConfig: { publicMessengerSafe: true },
        validationRules: { localized: true, maxLength: 255 }
    })
    await createField(detailEntity.id, 'SortOrder', { en: 'Sort order', ru: 'Порядок' }, 'NUMBER', {
        isRequired: true,
        uiConfig: { hidden: true }
    })
    await createField(detailEntity.id, 'Description', { en: 'Description', ru: 'Описание' }, 'STRING', {
        uiConfig: { publicMessengerSafe: true, rows: 3, widget: 'textarea' },
        validationRules: { localized: true, maxLength: 1000 }
    })

    const resourceRecord = await createRecord(api, metahubId, resourceEntity.id, {
        data: {
            Key: 'messenger-resource-guide',
            Title: buildVLC('Messenger resource guide', 'Руководство Messenger'),
            Resource: { type: 'url', url: 'https://example.com/messenger-guide', launchMode: 'newTab' }
        }
    })
    if (typeof resourceRecord?.id !== 'string') throw new Error('Creating the Messenger resource record did not return an id')
    const persistedResourceRecord = await getRecord(api, metahubId, resourceEntity.id, resourceRecord.id)
    const persistedResourceData = persistedResourceRecord?.data as Record<string, unknown> | undefined
    if (persistedResourceData?.Key !== 'messenger-resource-guide') {
        throw new Error('Messenger resource semantic key was not persisted on DashboardDemoMessengerResources')
    }

    const detailRecord = await createRecord(api, metahubId, detailEntity.id, {
        data: {
            Title: buildVLC('Focused record detail', 'Карточка записи'),
            SortOrder: 1,
            Description: buildVLC(
                'A single safe record projected in the public read-only detail view.',
                'Одна безопасная запись в публичном режиме просмотра без редактирования.'
            )
        }
    })
    if (typeof detailRecord?.id !== 'string') throw new Error('Creating the Messenger detail record did not return an id')

    const relationRecords = [
        {
            title: 'Related architecture notes',
            titleRu: 'Заметки по архитектуре',
            description: 'A related sample record shown through the read-only relationship viewer.',
            descriptionRu: 'Связанная демонстрационная запись в режиме просмотра отношений.'
        },
        {
            title: 'Related public routing guide',
            titleRu: 'Руководство по публичной маршрутизации',
            description: 'A second related record confirms the panel renders multiple rows.',
            descriptionRu: 'Вторая связанная запись подтверждает отображение нескольких строк.'
        }
    ]
    for (const [index, related] of relationRecords.entries()) {
        await createRecord(api, metahubId, relationEntity.id, {
            data: {
                Title: buildVLC(related.title, related.titleRu),
                SortOrder: index + 1,
                Description: buildVLC(related.description, related.descriptionRu),
                Parent: detailRecord.id
            }
        })
    }

    const seriesPoints = [
        ['2026-10-25T00:00:00.000Z', 118],
        ['2026-10-26T00:00:00.000Z', 132],
        ['2026-10-27T00:00:00.000Z', 127],
        ['2026-10-28T00:00:00.000Z', 151],
        ['2026-10-29T00:00:00.000Z', 146],
        ['2026-10-30T00:00:00.000Z', 169],
        ['2026-10-31T00:00:00.000Z', 181]
    ] as const
    for (const [index, [timestamp, value]] of seriesPoints.entries()) {
        await createRecord(api, metahubId, pageViewsEntity.id, {
            data: {
                SeriesKey: 'page-views',
                SeriesLabel: buildVLC('Page views', 'Просмотры страниц'),
                Timestamp: timestamp,
                Value: value,
                Order: 8 + index
            }
        })
    }

    return {
        detailEntityCodename: 'DashboardDemoRecordDetail',
        pageViewsEntityCodename: 'DashboardDemoPageViews',
        resourceEntityCodename: 'DashboardDemoMessengerResources',
        relationEntityCodename: 'DashboardDemoMessengerRelations'
    }
}

test.describe('Messenger App fixture generator', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) await disposeApiContext(api)
    })

    test('@generator create canonical Messenger App metahub through authoring APIs and export its snapshot fixture', async ({
        runManifest
    }) => {
        test.setTimeout(360_000)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} Messenger App fixture`
        const metahubCodename = `${runManifest.runId.toLowerCase().replace(/[^a-z0-9]+/g, '')}-messenger-fixture`.slice(0, 60)
        const metahub = await createMetahub(api, {
            name: { en: metahubName, ru: `${metahubName} / Мессенджер` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic-demo'
        })
        if (typeof metahub?.id !== 'string') throw new Error('Messenger fixture generator did not receive a metahub id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })
        const fixtureData = await ensureMessengerFixtureData(api, metahub.id)

        const layout = await createLayout(api, metahub.id, {
            templateKey: 'messenger-app',
            name: { en: 'Messenger App', ru: 'Приложение Messenger' },
            namePrimaryLocale: 'en',
            isActive: true,
            isDefault: true
        })
        if (typeof layout?.id !== 'string') throw new Error('Creating Messenger source layout did not return an id')

        const persistedLayout = await getLayout(api, metahub.id, layout.id)
        expect(persistedLayout.templateKey).toBe('messenger-app')
        expect(persistedLayout.isActive).toBe(true)
        expect(persistedLayout.isDefault).toBe(true)
        const initialPlacements = await listLayoutZoneWidgets(api, metahub.id, layout.id)
        expect(initialPlacements.items?.some((placement: Record<string, unknown>) => placement.zone === 'top')).toBe(true)
        const tabsPlacement = initialPlacements.items?.find(
            (placement: Record<string, unknown>) =>
                placement.widgetKey === 'detailsTabs' && placement.zone === 'center' && typeof placement.instanceKey === 'string'
        ) as { id?: string; instanceKey?: string } | undefined
        if (!tabsPlacement?.instanceKey || !tabsPlacement.id) {
            throw new Error('Messenger layout did not seed its Overview tab placement')
        }

        const assignCenterWidget = async (
            widgetKey: string,
            sortOrder: number,
            config: Record<string, unknown>,
            bindings: Record<string, unknown>,
            parentInstanceKey?: string,
            slotKey?: string
        ) => {
            const currentLayout = await getLayout(api, metahub.id, layout.id)
            if (!Number.isSafeInteger(currentLayout?.version) || currentLayout.version < 1) {
                throw new Error(`Messenger layout ${layout.id} did not return a current version before adding ${widgetKey}`)
            }
            return assignLayoutZoneWidget(api, metahub.id, layout.id, {
                widgetKey,
                zone: 'center',
                sortOrder,
                ...(parentInstanceKey ? { parentInstanceKey } : {}),
                ...(slotKey ? { slotKey } : {}),
                config: Array.isArray(bindings.slots) && bindings.slots.length > 0 ? { ...config, __layout: { bindings } } : config,
                expectedVersion: currentLayout.version
            })
        }

        const overviewTitle = await assignCenterWidget(
            'detailsTitle',
            1,
            { level: 'h2' },
            {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'DashboardDemoContent',
                                selector: { kind: 'semantic-key', field: 'key', value: 'overview-heading' },
                                projection: [
                                    { field: 'body', componentCodename: 'Body' },
                                    { field: 'key', componentCodename: 'Key' },
                                    { field: 'title', componentCodename: 'Title' }
                                ]
                            }
                        ]
                    }
                ]
            },
            tabsPlacement.instanceKey,
            'tab:overview'
        )
        const overviewRecords = await assignCenterWidget(
            'detailsTable',
            2,
            { maxRows: 3, showSearch: false, showViewToggle: false, defaultViewMode: 'card' },
            {
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'DashboardDemoRecords',
                                selector: { kind: 'record-set' },
                                projection: []
                            }
                        ]
                    }
                ]
            },
            tabsPlacement.instanceKey,
            'tab:overview'
        )
        expect(overviewTitle.widgetKey).toBe('detailsTitle')
        expect(overviewRecords.widgetKey).toBe('detailsTable')

        const overviewCards = await assignCenterWidget(
            'overviewCards',
            3,
            { maxCards: 4, density: 'standard' },
            recordSetBinding(
                'metrics',
                recordSetTarget('DashboardDemoMetrics', [
                    { field: 'interval', componentCodename: 'Interval' },
                    { field: 'metricKey', componentCodename: 'MetricKey' },
                    { field: 'order', componentCodename: 'Order' },
                    { field: 'title', componentCodename: 'Title' },
                    { field: 'value', componentCodename: 'Value' }
                ])
            )
        )
        expect(overviewCards.widgetKey).toBe('overviewCards')

        const detailTable = await assignCenterWidget(
            'detailsTable',
            4,
            { maxRows: 1, showSearch: false, showViewToggle: false, defaultViewMode: 'card' },
            recordSetBinding('rows', recordSetTarget(fixtureData.detailEntityCodename)),
            tabsPlacement.instanceKey,
            'tab:overview'
        )
        expect(detailTable.widgetKey).toBe('detailsTable')

        const resourcePreview = await assignCenterWidget(
            'resourcePreview',
            5,
            { displayMode: 'card' },
            {
                version: 1,
                slots: [
                    {
                        slot: 'resource',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: fixtureData.resourceEntityCodename,
                                selector: { kind: 'semantic-key', field: 'key', value: 'messenger-resource-guide' },
                                projection: [
                                    { field: 'key', componentCodename: 'Key' },
                                    { field: 'resource', componentCodename: 'Resource' },
                                    { field: 'title', componentCodename: 'Title' }
                                ]
                            }
                        ]
                    }
                ]
            },
            tabsPlacement.instanceKey,
            'tab:overview'
        )
        expect(resourcePreview.widgetKey).toBe('resourcePreview')

        const relationConfig = {
            parentLabel: { en: 'Related records', ru: 'Связанные записи' },
            panels: [
                {
                    slotKey: 'panel:related-records',
                    title: { en: 'Related records', ru: 'Связанные записи' },
                    parentFieldCodename: 'Parent',
                    parentFieldRequired: true,
                    titleFieldCodename: 'Title',
                    sortOrderFieldCodename: 'SortOrder',
                    displayFields: [{ fieldCodename: 'Description', valueType: 'string', localized: true, required: false }]
                }
            ]
        }
        const relationBuilder = await assignCenterWidget(
            'relationBuilder',
            6,
            relationConfig,
            {
                version: 1,
                slots: [
                    {
                        slot: 'parent',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: fixtureData.detailEntityCodename,
                                selector: { kind: 'record-set' },
                                projection: [
                                    { field: 'title', componentCodename: 'Title' },
                                    { field: 'order', componentCodename: 'SortOrder' }
                                ]
                            }
                        ]
                    },
                    {
                        slot: 'panel:related-records',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: fixtureData.relationEntityCodename,
                                selector: { kind: 'relation-set', parentSlot: 'parent' },
                                projection: [
                                    { field: 'display1', componentCodename: 'Description' },
                                    { field: 'order', componentCodename: 'SortOrder' },
                                    { field: 'parent', componentCodename: 'Parent' },
                                    { field: 'title', componentCodename: 'Title' }
                                ]
                            }
                        ]
                    }
                ]
            },
            tabsPlacement.instanceKey,
            'tab:overview'
        )
        expect(relationBuilder.widgetKey).toBe('relationBuilder')

        const columnsContainer = await assignCenterWidget(
            'columnsContainer',
            7,
            {
                columns: [
                    { slotKey: 'column:sessions', width: 6 },
                    { slotKey: 'column:page-views', width: 6 }
                ]
            },
            { version: 1, slots: [] }
        )
        expect(columnsContainer.widgetKey).toBe('columnsContainer')

        const messengerPlacements = await listLayoutZoneWidgets(api, metahub.id, layout.id)
        const persistedColumns = messengerPlacements.items?.find(
            (placement: Record<string, unknown>) =>
                placement.widgetKey === 'columnsContainer' && placement.parentInstanceKey === null && placement.slotKey === null
        ) as { instanceKey?: string } | undefined
        if (!persistedColumns?.instanceKey) throw new Error('Messenger analytics columns container was not persisted')

        const seriesProjection = [
            { field: 'order', componentCodename: 'Order' },
            { field: 'seriesKey', componentCodename: 'SeriesKey' },
            { field: 'seriesLabel', componentCodename: 'SeriesLabel' },
            { field: 'timestamp', componentCodename: 'Timestamp' },
            { field: 'value', componentCodename: 'Value' }
        ]
        const seriesBinding = recordSetBinding('series', recordSetTarget('DashboardDemoSeries', seriesProjection))
        const pageViewsBinding = recordSetBinding('series', recordSetTarget(fixtureData.pageViewsEntityCodename, seriesProjection))
        const sessionsChart = await assignCenterWidget(
            'sessionsChart',
            1,
            { title: { en: 'Weekly sessions', ru: 'Сессии за неделю' }, interval: 'day', chartStyle: 'line', maxPoints: 7 },
            seriesBinding,
            persistedColumns.instanceKey,
            'column:sessions'
        )
        const pageViewsChart = await assignCenterWidget(
            'pageViewsChart',
            1,
            { title: { en: 'Weekly page views', ru: 'Просмотры страниц за неделю' }, interval: 'day', chartStyle: 'bar', maxPoints: 7 },
            pageViewsBinding,
            persistedColumns.instanceKey,
            'column:page-views'
        )
        expect(sessionsChart.widgetKey).toBe('sessionsChart')
        expect(pageViewsChart.widgetKey).toBe('pageViewsChart')

        if (typeof overviewRecords.id !== 'string') throw new Error('Messenger Overview records placement was not persisted')
        const persistedTableBinding = await getLayoutZoneWidgetBindings(api, metahub.id, layout.id, overviewRecords.id, 'en')
        expect(persistedTableBinding.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ slot: 'rows', sourceKey: 'DashboardDemoRecords' })])
        )

        const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
            .map(([name, value]: [string, string]) => `${name}=${value}`)
            .join('; ')
        const exportResponse = await fetch(new URL(`/api/v1/metahub/${metahub.id}/export`, api.baseURL as string).toString(), {
            method: 'GET',
            headers: { Accept: 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) }
        })
        expect(exportResponse.ok).toBe(true)

        const exported = validateSnapshotEnvelope((await exportResponse.json()) as Record<string, unknown>)
        const fixture = buildSnapshotEnvelope({
            metahub: {
                ...exported.metahub,
                name: buildVLC('Messenger App Fixture', 'Демонстрация Messenger App'),
                codename: createLocalizedContent('en', 'messenger-app-fixture'),
                description: buildVLC(
                    'Canonical fixture for the public read-only Messenger application runtime.',
                    'Канонический fixture публичного рантайма приложения Messenger только для чтения.'
                )
            },
            publication: exported.publication,
            sourceInstance: exported.sourceInstance,
            snapshot: exported.snapshot
        })
        validateSnapshotEnvelope(fixture)
        assertMessengerAppFixtureEnvelopeContract(fixture, { requireOverviewContent: true })

        fs.mkdirSync(path.dirname(FIXTURE_OUTPUT_PATH), { recursive: true })
        fs.writeFileSync(FIXTURE_OUTPUT_PATH, `${JSON.stringify(fixture, null, 4)}\n`, 'utf8')
        expect(fs.existsSync(FIXTURE_OUTPUT_PATH)).toBe(true)
        expect(path.relative(repoRoot, FIXTURE_OUTPUT_PATH)).toContain('metahubs-messenger-app-snapshot.json')
    })
})
