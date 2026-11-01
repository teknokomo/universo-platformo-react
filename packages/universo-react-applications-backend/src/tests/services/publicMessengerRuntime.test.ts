import type { DbExecutor } from '@universo-react/utils'
import { DEFAULT_MESSENGER_APP_ZONE_WIDGETS } from '@universo-react/types'
import type { EffectiveLayoutSuccess } from '../../services/effectiveLayoutContract'
import type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from '../../services/effectiveWidgetRuntimeDataContracts'
import type { EffectiveWidgetRuntimeData } from '../../services/effectiveWidgetRuntimeData'
import { projectPublicMessengerRuntime, type PublicMessengerRuntimeLoadInput } from '../../services/publicMessengerRuntime'
import { PublicApplicationUnavailableError } from '../../services/publicApplicationRuntime'
import { PublicRuntimeTransientError } from '../../services/publicDashboardRuntime'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const idFor = (index: number) => `0190a9b5-3cde-7abc-8def-${String(index).padStart(12, '0')}`

const application = {
    id: applicationId,
    name: { _primary: 'en', locales: { en: { content: 'Public Messenger' }, ru: { content: 'Публичный мессенджер' } } },
    schemaName: 'app_0190a9b53cde7abc8def0123456789ab',
    workspacesEnabled: false
}

const makeWidget = (
    widgetKey: string,
    instanceKey: string,
    zone: 'top' | 'center' | 'bottom',
    sortOrder: number,
    config: Record<string, unknown>,
    overrides: Record<string, unknown> = {}
) => ({
    id: idFor(sortOrder + 1),
    layoutId: idFor(100),
    instanceKey,
    parentInstanceKey: null,
    slotKey: null,
    zone,
    semanticRegion: zone === 'top' ? 'header' : zone === 'bottom' ? 'footer' : 'main',
    widgetKey,
    sortOrder,
    config,
    isActive: true,
    ...overrides
})

const messengerLayout = (overrides: { widgets?: object[]; config?: Record<string, unknown> } = {}) =>
    ({
        status: 'ok',
        target: { applicationId, targetKind: null, locale: 'ru' },
        layout: { id: idFor(100), templateKey: 'messenger-app', config: overrides.config ?? {} },
        widgets: overrides.widgets ?? [
            makeWidget('header', 'messenger-header', 'top', 0, {}),
            makeWidget('overviewCards', 'messenger-overview', 'center', 1, { maxCards: 2 }),
            makeWidget('detailsTitle', 'messenger-title', 'center', 2, { level: 'h2' }),
            makeWidget('detailsTabs', 'messenger-tabs', 'center', 3, {
                tabs: [{ slotKey: 'tab:main', label: { en: 'Messages', ru: 'Сообщения' }, isDefault: true }]
            }),
            makeWidget(
                'detailsTable',
                'messenger-records',
                'center',
                4,
                {
                    variant: 'records',
                    maxRows: 20,
                    createTargets: [
                        { id: 'create-message', label: { en: 'Create message', ru: 'Создать сообщение' }, sectionCodename: 'Message' }
                    ],
                    rowActions: [{ id: 'toggle-starred', kind: 'library.toggle', libraryView: 'starred' }],
                    restoreTarget: { targetSectionCodename: 'Message', labelFields: ['Subject'] },
                    enableRowReordering: true
                },
                { parentInstanceKey: 'messenger-tabs', slotKey: 'tab:main' }
            ),
            makeWidget('resourcePreview', 'messenger-resource', 'center', 5, { displayMode: 'card' }),
            makeWidget('relationBuilder', 'messenger-relation', 'center', 6, {
                wizardMode: true,
                enableRowReordering: true,
                parentLabel: { en: 'Conversation', ru: 'Диалог' },
                emptyParentMessage: { en: 'No conversation', ru: 'Нет диалога' },
                panels: [
                    {
                        slotKey: 'panel:messages',
                        title: { en: 'Messages', ru: 'Сообщения' },
                        width: 12,
                        order: 0,
                        parentFieldCodename: 'Parent',
                        titleFieldCodename: 'Title',
                        sortOrderFieldCodename: 'SortOrder',
                        displayFields: [
                            { fieldCodename: 'emailAddress', valueType: 'string', localized: false, required: false },
                            { fieldCodename: 'Assignee', valueType: 'string', localized: false, required: false },
                            { fieldCodename: 'phoneNumber', valueType: 'string', localized: false, required: false },
                            { fieldCodename: 'ContactNote', valueType: 'string', localized: true, required: false },
                            { fieldCodename: 'Subject', valueType: 'string', localized: true, required: true },
                            { fieldCodename: 'Description', valueType: 'string', localized: true, required: false },
                            { fieldCodename: 'firstName', valueType: 'string', localized: false, required: false },
                            { fieldCodename: 'lastName', valueType: 'string', localized: false, required: false }
                        ],
                        rowLink: { fieldCodename: 'Subject', pathTemplate: '/apps/{applicationId}/messages/{value}', label: 'Open' },
                        enableRowReordering: true,
                        createDefaults: [],
                        createWizard: { steps: [{ id: 'message', label: 'Message', fieldCodenames: ['Subject'] }] }
                    }
                ]
            }),
            makeWidget('columnsContainer', 'messenger-columns', 'center', 7, {
                columns: [{ slotKey: 'column:resource', width: 12 }]
            }),
            makeWidget(
                'resourcePreview',
                'messenger-resource-column',
                'center',
                8,
                { displayMode: 'compact' },
                {
                    parentInstanceKey: 'messenger-columns',
                    slotKey: 'column:resource'
                }
            ),
            makeWidget('sessionsChart', 'messenger-sessions', 'center', 9, { chartStyle: 'line', maxPoints: 30 }),
            makeWidget('pageViewsChart', 'messenger-pageviews', 'center', 10, { chartStyle: 'bar', maxPoints: 30 })
        ]
    } as unknown as EffectiveLayoutSuccess)

const createOverviewCardWidgets = (count: number) =>
    Array.from({ length: count }, (_, index) => makeWidget('overviewCards', `overview-card-${index + 1}`, 'center', index, { maxCards: 2 }))

const readyData: Record<string, EffectiveWidgetRuntimeData> = {
    menuWidget: {
        status: 'ready',
        data: {
            kind: 'menu',
            title: 'Navigation',
            showTitle: false,
            overflowLabel: 'More',
            items: [
                { key: 'nav.hub.content', label: 'Content', icon: 'folder', kind: 'group', target: { kind: 'hub', codename: 'Content' } },
                { key: 'nav.page.start', label: 'Start', icon: 'page', kind: 'section', target: { kind: 'page', codename: 'Start' } },
                { key: 'nav.object.main', label: 'Main', icon: 'database', kind: 'section', target: { kind: 'object', codename: 'Main' } },
                { key: 'runtime-workspaces', label: 'Workspaces', icon: null, kind: 'workspaces' }
            ],
            overflowItems: []
        }
    },
    overviewCards: {
        status: 'ready',
        data: {
            kind: 'metrics',
            cards: [
                { label: 'Messages', value: '18', trend: 'up', sparkline: [4, 8, 18] },
                { label: 'Members', value: '4' },
                { label: 'Customer Name', value: 'Private metric name value' },
                { label: 'Hidden', value: '1' }
            ]
        }
    },
    detailsTitle: { status: 'ready', data: { kind: 'title', text: 'Message details' } },
    detailsTable: {
        status: 'ready',
        data: {
            kind: 'table',
            columns: [
                { key: 'ID', label: 'Identifier', valueType: 'string' },
                { key: 'Subject', label: 'Subject', valueType: 'string' },
                { key: 'emailAddress', label: 'Contact', valueType: 'string' },
                { key: 'phoneNumber', label: 'Phone number', valueType: 'string' },
                { key: 'ownerUserId', label: 'Owner', valueType: 'string' },
                { key: 'profileNote', label: 'Электронная почта', valueType: 'string' },
                { key: 'firstName', label: 'First name', valueType: 'string' },
                { key: 'lastName', label: 'Фамилия', valueType: 'string' },
                { key: 'full_name', label: 'Full Name', valueType: 'string' },
                { key: 'surname', label: 'Surname', valueType: 'string' },
                { key: 'Name', label: 'Name', valueType: 'string' },
                { key: 'personName', label: 'Person Name', valueType: 'string' },
                { key: 'customerName', label: 'Customer Name', valueType: 'string' },
                { key: 'memberName', label: 'Member name', valueType: 'string' },
                { key: 'profileName', label: 'Profile name', valueType: 'string' },
                { key: 'publicNote', label: 'Описание', valueType: 'string' }
            ],
            rows: [
                {
                    key: 'internal-row-key',
                    target: {
                        entityCodename: 'Message',
                        recordHandle: `rh1.${'A'.repeat(32)}`,
                        displayType: 'message',
                        starred: false,
                        shared: false
                    },
                    actionTarget: { entityCodename: 'Message', recordHandle: `rh1.${'B'.repeat(32)}` },
                    mutationTarget: { entityCodename: 'Message', recordHandle: `rh1.${'C'.repeat(32)}`, version: 1 },
                    cells: [
                        { key: 'ID', value: idFor(400) },
                        { key: 'Subject', value: 'Welcome' },
                        { key: 'emailAddress', value: 'member@example.test' },
                        { key: 'phoneNumber', value: '+1 415 555 0134' },
                        { key: 'ownerUserId', value: idFor(401) },
                        { key: 'profileNote', value: 'private-locale@example.test' },
                        { key: 'firstName', value: 'Private first name value' },
                        { key: 'lastName', value: 'Private last name value' },
                        { key: 'full_name', value: 'Private full name value' },
                        { key: 'surname', value: 'Private surname value' },
                        { key: 'Name', value: 'Private exact-name value' },
                        { key: 'personName', value: 'Private person-name value' },
                        { key: 'customerName', value: 'Private customer-name value' },
                        { key: 'memberName', value: 'Private member-name value' },
                        { key: 'profileName', value: 'Private profile-name value' },
                        { key: 'publicNote', value: 'Объявление для всех' }
                    ]
                }
            ],
            pagination: { total: 1, limit: 20, offset: 0, complete: true },
            sourceEntityCodename: 'Message'
        }
    },
    resourcePreview: {
        status: 'ready',
        data: {
            kind: 'resource',
            title: 'Help guide',
            source: { type: 'url', url: 'https://cdn.example.test/help.pdf', launchMode: 'inline' }
        }
    },
    relationBuilder: {
        status: 'ready',
        data: {
            kind: 'relation',
            parents: [
                {
                    key: 'raw-parent-key',
                    label: 'Support inbox',
                    target: { entityCodename: 'Conversation', recordHandle: `rh1.${'D'.repeat(32)}` }
                },
                {
                    key: 'ownerUserId',
                    label: 'Private owner',
                    target: { entityCodename: 'Conversation', recordHandle: `rh1.${'F'.repeat(32)}` }
                },
                {
                    key: 'localized-parent-key',
                    label: 'Электронная почта',
                    target: { entityCodename: 'Conversation', recordHandle: `rh1.${'G'.repeat(32)}` }
                }
            ],
            panels: [
                {
                    slotKey: 'panel:messages',
                    title: 'Messages',
                    targetEntityCodename: 'Message',
                    parentFieldCodename: 'Parent',
                    displayColumns: [
                        { key: 'display1', label: 'emailAddress' },
                        { key: 'display2', label: 'ownerUserId' },
                        { key: 'display3', label: 'phoneNumber' },
                        { key: 'display4', label: 'Электронная почта' },
                        { key: 'display5', label: 'Subject' },
                        { key: 'display6', label: 'Описание' },
                        { key: 'display7', label: 'Contact' },
                        { key: 'display8', label: 'Owner name' }
                    ],
                    rows: [
                        {
                            key: 'raw-message-key',
                            parentKey: 'raw-parent-key',
                            label: 'Welcome',
                            target: { entityCodename: 'Message', recordHandle: `rh1.${'E'.repeat(32)}`, version: 1 },
                            cells: [
                                { key: 'display1', value: 'relation-private@example.test' },
                                { key: 'display2', value: idFor(402) },
                                { key: 'display3', value: '+1 415 555 0144' },
                                { key: 'display4', value: 'localized-relation-private@example.test' },
                                { key: 'display5', value: 'Welcome to the service' },
                                { key: 'display6', value: 'Общее описание' }
                            ]
                        },
                        {
                            key: 'private-label-row',
                            parentKey: 'raw-parent-key',
                            label: 'phoneNumber',
                            target: { entityCodename: 'Message', recordHandle: `rh1.${'H'.repeat(32)}`, version: 1 },
                            cells: [
                                { key: 'display1', value: 'hidden@example.test' },
                                { key: 'display2', value: idFor(403) },
                                { key: 'display3', value: '+1 415 555 0145' },
                                { key: 'display4', value: 'hidden-localized@example.test' },
                                { key: 'display5', value: 'Private label' },
                                { key: 'display6', value: 'Private row' }
                            ]
                        },
                        {
                            key: 'child-of-private-parent',
                            parentKey: 'ownerUserId',
                            label: 'Hidden parent record',
                            target: { entityCodename: 'Message', recordHandle: `rh1.${'I'.repeat(32)}`, version: 1 },
                            cells: [
                                { key: 'display1', value: 'hidden-parent@example.test' },
                                { key: 'display2', value: idFor(404) },
                                { key: 'display3', value: '+1 415 555 0146' },
                                { key: 'display4', value: 'hidden-parent-localized@example.test' },
                                { key: 'display5', value: 'Hidden child' },
                                { key: 'display6', value: 'Hidden parent child' }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    sessionsChart: {
        status: 'ready',
        data: { kind: 'series', title: 'Sessions', labels: ['Mon', 'Tue'], series: [{ id: idFor(501), label: 'Visits', values: [2, 5] }] }
    },
    pageViewsChart: {
        status: 'ready',
        data: {
            kind: 'series',
            title: 'Views',
            labels: ['Mon', 'Tue'],
            series: [
                { id: 'private-series-id', label: 'Page views', values: [3, 8] },
                { id: 'private-name-series-id', label: 'Person Name', values: [4, 9] }
            ]
        }
    }
}

const createInput = (
    layout: EffectiveLayoutSuccess = messengerLayout(),
    resolveRuntimeData: PublicMessengerRuntimeLoadInput['resolveRuntimeData'] = async (_executor, _scope, candidates) =>
        new Map(candidates.map((candidate) => [candidate.id, readyData[candidate.widgetKey]]))
): PublicMessengerRuntimeLoadInput => ({
    executor: {} as DbExecutor,
    resolved: { application: application as never, route: {} as never },
    workspaceId: null,
    workspaceAvailable: true,
    locale: 'ru',
    effectiveLayout: layout,
    resolveRuntimeData
})

describe('public Messenger runtime projection', () => {
    it('fails closed when published Messenger Page blocks contain credential-bearing resource URLs', async () => {
        await expect(
            projectPublicMessengerRuntime({
                ...createInput(),
                pageBlockContent: {
                    blocks: [
                        {
                            id: 'welcome-image',
                            type: 'image',
                            data: { url: 'https://cdn.example.test/welcome.png?access_token=fake-test' }
                        }
                    ]
                }
            })
        ).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
    })

    it('bounds runtime reads while accepting the generated layout placement count', async () => {
        const runtime = await projectPublicMessengerRuntime(createInput(messengerLayout({ widgets: createOverviewCardWidgets(16) })))
        expect(runtime.placements).toHaveLength(16)

        await expect(
            projectPublicMessengerRuntime(createInput(messengerLayout({ widgets: createOverviewCardWidgets(17) })))
        ).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
    })

    it('projects the UUID v7 seeded Overview navigation into safe semantic entries without requiring a workspace', async () => {
        const idsBySeedKey = new Map(
            DEFAULT_MESSENGER_APP_ZONE_WIDGETS.map((placement, index) => [placement.instanceKey, idFor(201 + index)])
        )
        const seededWidgets = DEFAULT_MESSENGER_APP_ZONE_WIDGETS.map((placement, index) =>
            makeWidget(placement.widgetKey, idFor(201 + index), placement.zone, placement.sortOrder, placement.config ?? {}, {
                id: idFor(301 + index),
                parentInstanceKey: placement.parentInstanceKey === null ? null : idsBySeedKey.get(placement.parentInstanceKey) ?? null,
                slotKey: placement.slotKey
            })
        )
        const resolver = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) => new Map(candidates.map((candidate) => [candidate.id, readyData[candidate.widgetKey]]))
        )
        const runtime = await projectPublicMessengerRuntime({
            ...createInput(messengerLayout({ widgets: seededWidgets }), resolver),
            workspaceAvailable: false
        })

        const byWidget = new Map(runtime.placements.map((placement) => [placement.widgetKey, placement]))
        const tabs = byWidget.get('detailsTabs')
        const menu = byWidget.get('menuWidget')
        expect(runtime.placements.every(({ instanceKey }) => !/^[0-9a-f]{8}-/iu.test(instanceKey))).toBe(true)
        const serialized = JSON.stringify(runtime)
        expect(serialized).not.toContain(idFor(301))
        expect(serialized).not.toContain(idFor(302))
        expect(serialized).not.toContain(idFor(303))
        expect(tabs?.instanceKey).toMatch(/^placement\./u)
        expect(menu?.parentInstanceKey).toBe(tabs?.instanceKey)
        expect(menu?.slotKey).toBe('tab:overview')
        expect(menu?.runtimeData).toEqual({
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Navigation',
                showTitle: false,
                overflowLabel: 'More',
                items: [
                    { key: 'messenger.item.1', label: 'Content', icon: null, kind: 'group', target: { kind: 'hub', codename: 'Content' } },
                    { key: 'messenger.item.2', label: 'Start', icon: null, kind: 'section', target: { kind: 'page', codename: 'Start' } },
                    { key: 'messenger.item.3', label: 'Main', icon: null, kind: 'section', target: { kind: 'object', codename: 'Main' } }
                ],
                overflowItems: []
            }
        })
        expect(resolver).toHaveBeenCalledTimes(1)
        expect(resolver.mock.calls[0]?.[2].map(({ widgetKey }) => widgetKey)).toEqual(['menuWidget'])
    })

    it('projects all enabled FR-006 widget classes with published anonymous scope and no private identities', async () => {
        const resolver = jest.fn(
            async (_executor: DbExecutor, scope: EffectiveWidgetRuntimeReadScope, candidates: readonly EffectiveWidgetRuntimeCandidate[]) =>
                new Map(candidates.map((candidate) => [candidate.id, readyData[candidate.widgetKey]]))
        )

        const runtime = await projectPublicMessengerRuntime(createInput(messengerLayout(), resolver))
        const serialized = JSON.stringify(runtime)
        const placement = (widgetKey: string) => runtime.placements.find((item) => item.widgetKey === widgetKey)

        expect(runtime).toMatchObject({ locale: 'ru', title: 'Публичный мессенджер' })
        expect(resolver).toHaveBeenCalledTimes(1)
        expect(resolver.mock.calls[0][1]).toMatchObject({
            applicationId,
            schemaName: application.schemaName,
            workspaceId: null,
            workspacesEnabled: false,
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
        })
        expect(placement('overviewCards')?.runtimeData).toMatchObject({
            status: 'ready',
            data: { kind: 'metrics', cards: [{ label: 'Messages' }, { label: 'Members' }] }
        })
        expect(placement('detailsTabs')?.config).toEqual({
            tabs: [{ slotKey: 'tab:main', label: 'Сообщения', isDefault: true }]
        })
        expect(placement('detailsTitle')?.runtimeData).toEqual({ status: 'ready', data: { kind: 'title', text: 'Message details' } })
        expect(placement('detailsTable')?.runtimeData).toMatchObject({
            status: 'ready',
            data: {
                kind: 'record',
                title: 'Welcome',
                fields: [
                    { label: 'Subject', value: 'Welcome' },
                    { label: 'Описание', value: 'Объявление для всех' }
                ]
            }
        })
        expect(placement('resourcePreview')?.runtimeData).toMatchObject({ status: 'ready', data: { kind: 'resource' } })
        expect(placement('columnsContainer')?.config).toEqual({ columns: [{ slotKey: 'column:resource', width: 12 }] })
        const columnsPlacement = placement('columnsContainer')!
        const nestedResourcePlacement = runtime.placements.find(
            (item) => item.widgetKey === 'resourcePreview' && item.config.displayMode === 'compact'
        )
        expect(nestedResourcePlacement?.parentInstanceKey).toBe(columnsPlacement.instanceKey)
        expect(nestedResourcePlacement?.slotKey).toBe('column:resource')
        expect(placement('relationBuilder')?.runtimeData).toEqual({
            status: 'ready',
            data: {
                kind: 'relation',
                parents: [{ key: 'parent1', label: 'Support inbox' }],
                panels: [
                    {
                        slotKey: 'panel:messages',
                        title: 'Messages',
                        displayColumns: [
                            { key: 'display1', label: 'Subject' },
                            { key: 'display2', label: 'Описание' }
                        ],
                        rows: [
                            {
                                key: 'row1-1',
                                parentKey: 'parent1',
                                label: 'Welcome',
                                cells: [
                                    { key: 'display1', value: 'Welcome to the service' },
                                    { key: 'display2', value: 'Общее описание' }
                                ]
                            }
                        ]
                    }
                ]
            }
        })
        expect(placement('sessionsChart')?.runtimeData).toMatchObject({ status: 'ready', data: { kind: 'series' } })
        expect(placement('pageViewsChart')?.runtimeData).toMatchObject({ status: 'ready', data: { kind: 'series' } })

        const detailsTable = placement('detailsTable')!
        expect(detailsTable.config).not.toHaveProperty('createTargets')
        expect(detailsTable.config).not.toHaveProperty('rowActions')
        expect(detailsTable.config).not.toHaveProperty('enableRowReordering')
        const relationConfig = placement('relationBuilder')!.config
        expect(relationConfig).not.toHaveProperty('wizardMode')
        expect(relationConfig).not.toHaveProperty('enableRowReordering')
        expect(relationConfig.panels[0]).not.toHaveProperty('rowLink')
        expect(relationConfig.panels[0]).not.toHaveProperty('createDefaults')
        expect(relationConfig.panels[0]).not.toHaveProperty('createWizard')
        expect(serialized).not.toContain(applicationId)
        expect(serialized).not.toContain(workspaceId)
        expect(serialized).not.toContain('recordHandle')
        expect(serialized).not.toContain('raw-message-key')
        expect(serialized).not.toContain('member@example.test')
        expect(serialized).not.toContain('+1 415 555 0134')
        expect(serialized).not.toContain('private-locale@example.test')
        expect(serialized).not.toContain('private-series-id')
        expect(serialized).not.toContain('relation-private@example.test')
        expect(serialized).not.toContain('localized-relation-private@example.test')
        expect(serialized).not.toContain('hidden@example.test')
        expect(serialized).not.toContain('hidden-parent@example.test')
        expect(serialized).not.toContain('+1 415 555 0144')
        expect(serialized).not.toContain('emailAddress')
        expect(serialized).not.toContain('ownerUserId')
        expect(serialized).not.toContain('phoneNumber')
        expect(serialized).not.toContain('Private first name value')
        expect(serialized).not.toContain('Private last name value')
        expect(serialized).not.toContain('Private full name value')
        expect(serialized).not.toContain('Private surname value')
        expect(serialized).not.toContain('Private exact-name value')
        expect(serialized).not.toContain('Private person-name value')
        expect(serialized).not.toContain('Private customer-name value')
        expect(serialized).not.toContain('Private member-name value')
        expect(serialized).not.toContain('Private profile-name value')
        expect(serialized).not.toContain('Электронная почта')
        expect(serialized).not.toContain('Private owner')
        expect(serialized).not.toContain('Private metric name value')
        expect(serialized).not.toContain('Person Name')
        expect(serialized).not.toContain('child-of-private-parent')
        expect(serialized).not.toContain('showInAppList')
        expect(serialized).not.toContain('currentWorkspaceId')
        expect(serialized).not.toContain('locales')
    })

    it('caps detailsTable resolver reads and public config at the Messenger row limit', async () => {
        const resolver = jest.fn(async (_executor, _scope, candidates) => new Map(candidates.map(({ id }) => [id, { status: 'empty' }])))
        const layout = messengerLayout({
            widgets: [makeWidget('detailsTable', 'messenger-records', 'center', 0, { variant: 'records', maxRows: 500 })]
        })

        const runtime = await projectPublicMessengerRuntime(createInput(layout, resolver))

        expect(resolver.mock.calls[0]?.[2][0]?.config).toMatchObject({ maxRows: 20 })
        expect(runtime.placements[0]?.config).toMatchObject({ maxRows: 20 })
    })

    it('caps public Messenger chart reads and config at thirty points', async () => {
        const resolver = jest.fn(async (_executor, _scope, candidates) => new Map(candidates.map(({ id }) => [id, { status: 'empty' }])))
        const layout = messengerLayout({
            widgets: [makeWidget('sessionsChart', 'messenger-sessions', 'center', 0, { chartStyle: 'line', maxPoints: 366 })]
        })

        const runtime = await projectPublicMessengerRuntime(createInput(layout, resolver))

        expect(resolver.mock.calls[0]?.[2][0]?.config).toMatchObject({ maxPoints: 30 })
        expect(runtime.placements[0]?.config).toMatchObject({ maxPoints: 30 })
    })

    it('fails transiently before returning projected runtime data above the byte budget', async () => {
        const columns = Array.from({ length: 16 }, (_, index) => ({
            key: `field${index + 1}`,
            label: `Public field ${index + 1}`,
            valueType: 'string' as const
        }))
        const value = 'x'.repeat(2000)
        const tableData: EffectiveWidgetRuntimeData = {
            status: 'ready',
            data: {
                kind: 'table',
                columns,
                rows: Array.from({ length: 20 }, (_, rowIndex) => ({
                    key: `source-row-${rowIndex + 1}`,
                    cells: columns.map(({ key }) => ({ key, value }))
                })),
                pagination: { total: 20, limit: 20, offset: 0, complete: true },
                sourceEntityCodename: 'Message'
            }
        }
        const resolver: NonNullable<PublicMessengerRuntimeLoadInput['resolveRuntimeData']> = async (_executor, _scope, candidates) =>
            new Map(candidates.map(({ id }) => [id, tableData]))
        const layout = messengerLayout({
            widgets: Array.from({ length: 5 }, (_, index) =>
                makeWidget('detailsTable', `messenger-records-${index + 1}`, 'center', index, { variant: 'records', maxRows: 20 })
            )
        })

        await expect(projectPublicMessengerRuntime(createInput(layout, resolver))).rejects.toBeInstanceOf(PublicRuntimeTransientError)
    })

    it('projects multi-row Messenger tables without source row or column identities', async () => {
        const resolver: NonNullable<PublicMessengerRuntimeLoadInput['resolveRuntimeData']> = async (_executor, _scope, candidates) =>
            new Map(
                candidates.map((candidate) => [
                    candidate.id,
                    candidate.widgetKey === 'detailsTable'
                        ? {
                              status: 'ready',
                              data: {
                                  kind: 'table',
                                  columns: [
                                      { key: 'Title', label: 'Title', valueType: 'string' },
                                      { key: 'Status', label: 'Status', valueType: 'string' }
                                  ],
                                  rows: [
                                      {
                                          key: 'source-row-1',
                                          cells: [
                                              { key: 'Title', value: 'First public record' },
                                              { key: 'Status', value: 'Open' }
                                          ]
                                      },
                                      {
                                          key: 'source-row-2',
                                          cells: [
                                              { key: 'Title', value: 'Second public record' },
                                              { key: 'Status', value: 'Closed' }
                                          ]
                                      }
                                  ],
                                  pagination: { total: 2, limit: 10, offset: 0, complete: true },
                                  sourceEntityCodename: 'Message'
                              }
                          }
                        : { status: 'empty' }
                ])
            )
        const runtime = await projectPublicMessengerRuntime(
            createInput(
                messengerLayout({ widgets: [makeWidget('detailsTable', 'messenger-records', 'center', 0, { variant: 'records' })] }),
                resolver
            )
        )

        expect(runtime.placements[0]?.runtimeData).toEqual({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [
                    { key: 'column1', label: 'Title', valueType: 'string' },
                    { key: 'column2', label: 'Status', valueType: 'string' }
                ],
                rows: [
                    {
                        key: 'row1',
                        cells: [
                            { key: 'column1', value: 'First public record' },
                            { key: 'column2', value: 'Open' }
                        ]
                    },
                    {
                        key: 'row2',
                        cells: [
                            { key: 'column1', value: 'Second public record' },
                            { key: 'column2', value: 'Closed' }
                        ]
                    }
                ],
                pagination: { total: 2, limit: 10, offset: 0 }
            }
        })
        const serialized = JSON.stringify(runtime)
        expect(serialized).not.toContain('source-row')
        expect(serialized).not.toContain('sourceEntityCodename')
    })

    it('filters personal names from record data when only localized labels are available', async () => {
        const resolver = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) =>
                new Map(
                    candidates.map((candidate) => [
                        candidate.id,
                        candidate.widgetKey === 'detailsTable'
                            ? {
                                  status: 'ready',
                                  data: {
                                      kind: 'record',
                                      title: 'Public announcement',
                                      fields: [
                                          { label: 'First name', value: 'Record first name secret' },
                                          { label: 'Full Name', value: 'Record full name secret' },
                                          { label: 'surname', value: 'Record surname secret' },
                                          { label: 'Name', value: 'Record exact-name secret' },
                                          { label: 'Person Name', value: 'Record person-name secret' },
                                          { label: 'Customer Name', value: 'Record customer-name secret' },
                                          { label: 'Member name', value: 'Record member-name secret' },
                                          { label: 'Profile name', value: 'Record profile-name secret' },
                                          { label: 'Фамилия', value: 'Record last name secret' },
                                          { label: 'Subject', value: 'Public subject' }
                                      ]
                                  }
                              }
                            : readyData[candidate.widgetKey]
                    ])
                )
        )

        const runtime = await projectPublicMessengerRuntime(createInput(messengerLayout(), resolver))
        const serialized = JSON.stringify(runtime)
        expect(serialized).not.toContain('Record first name secret')
        expect(serialized).not.toContain('Record full name secret')
        expect(serialized).not.toContain('Record surname secret')
        expect(serialized).not.toContain('Record exact-name secret')
        expect(serialized).not.toContain('Record person-name secret')
        expect(serialized).not.toContain('Record customer-name secret')
        expect(serialized).not.toContain('Record member-name secret')
        expect(serialized).not.toContain('Record profile-name secret')
        expect(serialized).not.toContain('Record last name secret')
        expect(serialized).toContain('Public subject')
    })

    it.each([
        ['access token query', 'https://cdn.example.test/help.pdf?access_token=do-not-return-this'],
        ['signature abbreviation', 'https://cdn.example.test/help.pdf?sig=do-not-return-this'],
        ['private key fragment', 'https://cdn.example.test/help.pdf#private_key=do-not-return-this'],
        ['signed AWS URL', 'https://cdn.example.test/help.pdf?X-Amz-Signature=do-not-return-this']
    ])('fails closed for credential-bearing resource URLs (%s)', async (_description, url) => {
        const resolver = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) =>
                new Map(
                    candidates.map((candidate) => [
                        candidate.id,
                        candidate.widgetKey === 'resourcePreview'
                            ? {
                                  status: 'ready',
                                  data: {
                                      kind: 'resource',
                                      title: 'Help guide',
                                      source: {
                                          type: 'url',
                                          url,
                                          launchMode: 'inline'
                                      }
                                  }
                              }
                            : readyData[candidate.widgetKey]
                    ])
                )
        )

        await expect(projectPublicMessengerRuntime(createInput(messengerLayout(), resolver))).rejects.toBeInstanceOf(
            PublicApplicationUnavailableError
        )
    })

    it('keeps ordinary author query parameters in public resource URLs', async () => {
        const resolver = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) =>
                new Map(
                    candidates.map((candidate) => [
                        candidate.id,
                        candidate.widgetKey === 'resourcePreview'
                            ? {
                                  status: 'ready',
                                  data: {
                                      kind: 'resource',
                                      title: 'Help guide',
                                      source: {
                                          type: 'url',
                                          url: 'https://cdn.example.test/help.pdf?author=docs',
                                          launchMode: 'inline'
                                      }
                                  }
                              }
                            : readyData[candidate.widgetKey]
                    ])
                )
        )

        const runtime = await projectPublicMessengerRuntime(createInput(messengerLayout(), resolver))
        expect(JSON.stringify(runtime)).toContain('author=docs')
    })

    it('fails closed when a field value contains a private key header', async () => {
        const privateKey = '-----BEGIN PRIVATE KEY-----\\nprivate-data\\n-----END PRIVATE KEY-----'
        const resolver = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) =>
                new Map(
                    candidates.map((candidate) => [
                        candidate.id,
                        candidate.widgetKey === 'detailsTable'
                            ? {
                                  status: 'ready',
                                  data: { kind: 'record', title: 'Announcement', fields: [{ label: 'Notes', value: privateKey }] }
                              }
                            : readyData[candidate.widgetKey]
                    ])
                )
        )

        await expect(projectPublicMessengerRuntime(createInput(messengerLayout(), resolver))).rejects.toBeInstanceOf(
            PublicApplicationUnavailableError
        )
    })

    it('accepts a resolver record payload through the read-only detailsTable projection', async () => {
        const directRecordResolver: NonNullable<PublicMessengerRuntimeLoadInput['resolveRuntimeData']> = async (
            _executor,
            _scope,
            candidates
        ) =>
            new Map(
                candidates.map((candidate) => [
                    candidate.id,
                    candidate.widgetKey === 'detailsTable'
                        ? {
                              status: 'ready',
                              data: { kind: 'record', title: 'Announcement', fields: [{ label: 'Body', value: 'Welcome' }] }
                          }
                        : { status: 'empty' }
                ])
            )
        const runtime = await projectPublicMessengerRuntime(
            createInput(
                messengerLayout({ widgets: [makeWidget('detailsTable', 'messenger-record', 'center', 0, { variant: 'records' })] }),
                directRecordResolver
            )
        )

        expect(runtime.placements[0].runtimeData).toEqual({
            status: 'ready',
            data: { kind: 'record', title: 'Announcement', fields: [{ label: 'Body', value: 'Welcome' }] }
        })
    })

    it('fails closed for unsupported active configs and invalid active placement graphs before data reads', async () => {
        const resolver = jest.fn().mockResolvedValue(new Map())
        const unsupported = messengerLayout({
            widgets: [makeWidget('detailsTable', 'records', 'center', 0, { variant: 'report', reportCodename: 'PrivateReport' })]
        })
        await expect(projectPublicMessengerRuntime(createInput(unsupported, resolver))).rejects.toBeInstanceOf(
            PublicApplicationUnavailableError
        )

        const invalidGraph = messengerLayout({
            widgets: [
                makeWidget(
                    'detailsTable',
                    'records',
                    'center',
                    0,
                    { variant: 'records' },
                    { parentInstanceKey: 'missing-parent', slotKey: 'tab:missing' }
                )
            ]
        })
        await expect(projectPublicMessengerRuntime(createInput(invalidGraph, resolver))).rejects.toBeInstanceOf(
            PublicApplicationUnavailableError
        )
        expect(resolver).not.toHaveBeenCalled()
    })

    it('rejects resource URLs that carry credential-like query parameters', async () => {
        const resolver = async (
            _executor: DbExecutor,
            _scope: EffectiveWidgetRuntimeReadScope,
            candidates: readonly EffectiveWidgetRuntimeCandidate[]
        ) =>
            new Map(
                candidates.map((candidate) => [
                    candidate.id,
                    candidate.widgetKey === 'resourcePreview'
                        ? {
                              status: 'ready',
                              data: {
                                  kind: 'resource',
                                  title: 'Private',
                                  source: {
                                      type: 'url',
                                      url: 'https://cdn.example.test/file?access_token=secret-value',
                                      launchMode: 'inline'
                                  }
                              }
                          }
                        : { status: 'empty' }
                ])
            )
        await expect(
            projectPublicMessengerRuntime(
                createInput(messengerLayout({ widgets: [makeWidget('resourcePreview', 'resource', 'center', 0, {})] }), resolver)
            )
        ).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
    })
})
