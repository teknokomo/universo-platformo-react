import type { EffectiveLayoutSuccess } from '../../services/effectiveLayoutContract'
import type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from '../../services/effectiveWidgetRuntimeDataContracts'
import type { EffectiveWidgetRuntimeData } from '../../services/effectiveWidgetRuntimeData'
import {
    classifyPublicDashboardPlacements,
    projectPublicDashboardRuntime,
    PublicRuntimeTransientError
} from '../../services/publicDashboardRuntime'
import { PublicApplicationUnavailableError } from '../../services/publicApplicationRuntime'
import { attachApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'
import type { DbExecutor } from '@universo-react/utils'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const ids = {
    workspaceSwitcher: '0190a9b5-3cde-7abc-8def-0123456789ad',
    menuWidget: '0190a9b5-3cde-7abc-8def-0123456789ae',
    appNavbar: '0190a9b5-3cde-7abc-8def-0123456789af',
    header: '0190a9b5-3cde-7abc-8def-0123456789a1',
    languageSwitcher: '0190a9b5-3cde-7abc-8def-0123456789a2',
    colorModeSwitcher: '0190a9b5-3cde-7abc-8def-0123456789a3',
    interpretationNetworkWorkspace: '0190a9b5-3cde-7abc-8def-0123456789a4',
    optionsMenu: '0190a9b5-3cde-7abc-8def-0123456789a5',
    userProfile: '0190a9b5-3cde-7abc-8def-0123456789a6',
    detailsTabs: '0190a9b5-3cde-7abc-8def-0123456789a7',
    learnerTable: '0190a9b5-3cde-7abc-8def-0123456789a8',
    libraryTable: '0190a9b5-3cde-7abc-8def-0123456789a9',
    publicTable: '0190a9b5-3cde-7abc-8def-0123456789b1'
}

const canonicalInterpretationNetworkConfig = {
    structureMode: 'multiple',
    templatePanel: { showInStructureList: true, showInMatrix: true },
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
    defaultMatrixView: 'table',
    tableProjection: 'hierarchicalPath',
    breadcrumbDepth: { mode: 'full' },
    toolbarLayout: 'horizontal',
    showHierarchicalTableHeaders: false,
    showHierarchicalTableHeaderCard: true,
    showMatrixTreeTotalCells: true,
    colorBreadcrumbsByCell: true,
    splitPane: { enabled: true },
    hierarchyRowMode: 'focusedPath',
    allowNewAxesInCellDialog: false,
    positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
    cellStylePolicy: {
        allowedColors: ['#000000', '#FFFFFF'],
        allowCustomColors: true,
        editable: { fillColor: true, textColor: true, borderColor: true, borderWidth: true, borderStyle: true }
    },
    conceptCodename: 'Structure',
    interpretationCodename: 'Interpretation',
    relationCodename: 'Relation',
    materialCodename: 'Material',
    materialTitleField: 'Title',
    interpretationTitleField: 'Title',
    tableTemplateCodename: 'TableTemplate',
    matrixField: 'InterpretationMatrix',
    tableTemplateMatrixField: 'TemplateMatrix',
    conceptNameField: 'Name',
    conceptDescriptionField: 'Description',
    interpretationParentField: 'ParentStructure'
}

const widget = (widgetKey: string, instanceKey: string, config: Record<string, unknown>, id: string, overrides = {}) => ({
    id,
    layoutId,
    instanceKey,
    parentInstanceKey: null,
    slotKey: null,
    zone:
        widgetKey === 'menuWidget' || widgetKey === 'workspaceSwitcher'
            ? 'left'
            : widgetKey === 'interpretationNetworkWorkspace'
            ? 'center'
            : 'top',
    semanticRegion: widgetKey === 'interpretationNetworkWorkspace' ? 'main' : widgetKey === 'menuWidget' ? 'sidebar' : 'header',
    widgetKey,
    sortOrder: Object.keys(ids).indexOf(widgetKey) + 1,
    config,
    isActive: true,
    ...overrides
})

const canonicalLayout = (
    widgets = [
        widget('workspaceSwitcher', 'workspace-switcher', { variant: 'compact' }, ids.workspaceSwitcher),
        widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget),
        widget('appNavbar', 'application-navbar', {}, ids.appNavbar),
        widget('header', 'application-header', {}, ids.header),
        widget('languageSwitcher', 'language-switcher', {}, ids.languageSwitcher),
        widget('colorModeSwitcher', 'color-mode-switcher', {}, ids.colorModeSwitcher),
        widget(
            'interpretationNetworkWorkspace',
            'interpretation-workspace',
            canonicalInterpretationNetworkConfig,
            ids.interpretationNetworkWorkspace
        )
    ],
    config: Record<string, unknown> = {}
) =>
    ({
        status: 'ok',
        target: { applicationId, targetKind: null, locale: 'en' },
        layout: { id: layoutId, templateKey: 'dashboard', config },
        widgets
    } as unknown as EffectiveLayoutSuccess)

const menuPayload: EffectiveWidgetRuntimeData = {
    status: 'ready' as const,
    data: {
        kind: 'menu' as const,
        title: 'Navigation',
        showTitle: false,
        overflowLabel: 'More',
        items: [
            { key: 'nav.hub.Learning', label: 'Learning', icon: 'folder', kind: 'group', target: { kind: 'hub', codename: 'Learning' } },
            { key: 'nav.page.Home', label: 'Home', icon: 'page', kind: 'section', target: { kind: 'page', codename: 'Home' } },
            {
                key: 'nav.page.Structures',
                label: 'Structures',
                icon: 'page',
                kind: 'section',
                target: { kind: 'page', codename: 'Structures' }
            },
            { key: 'runtime-workspaces', label: 'Workspaces', icon: null, kind: 'workspaces' }
        ],
        overflowItems: [
            {
                key: 'nav.page.Templates',
                label: 'Templates',
                icon: 'page',
                kind: 'section',
                target: { kind: 'page', codename: 'Templates' }
            }
        ]
    }
}

describe('public Dashboard projection', () => {
    it('includes only validated authored Page blocks in the public Dashboard response', async () => {
        const pageBlockContent = {
            format: 'editorjs',
            blocks: [
                { id: 'intro-title', type: 'header', data: { text: 'Interpretation Network', level: 2 } },
                {
                    id: 'intro-purpose',
                    type: 'paragraph',
                    data: { text: 'The interpretation network helps build structures and relations.' }
                }
            ]
        }

        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
            workspaceId: null,
            workspaceAvailable: true,
            locale: 'en',
            effectiveLayout: canonicalLayout([]),
            pageBlockContent
        })

        expect(result.pageBlocks).toEqual(pageBlockContent.blocks)
        expect(JSON.stringify(result)).not.toContain('config')
        await expect(
            projectPublicDashboardRuntime({
                executor: {} as DbExecutor,
                resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
                workspaceId: null,
                workspaceAvailable: true,
                locale: 'en',
                effectiveLayout: canonicalLayout([]),
                pageBlockContent: {
                    format: 'editorjs',
                    blocks: [{ id: 'unsafe-intro', type: 'paragraph', data: { text: '<script>bad()</script>' } }]
                }
            })
        ).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
    })

    it('projects one active localized value per Page Block and removes unapproved metadata', async () => {
        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
            workspaceId: null,
            workspaceAvailable: true,
            locale: 'ru',
            effectiveLayout: canonicalLayout([]),
            pageBlockContent: {
                format: 'editorjs',
                blocks: [
                    {
                        id: 'localized-heading',
                        type: 'header',
                        data: {
                            text: {
                                _schema: '1',
                                _primary: 'ru',
                                privateMetadata: 'BLOCK_METADATA_SENTINEL',
                                locales: {
                                    en: {
                                        content: 'English public heading',
                                        version: 1,
                                        isActive: true,
                                        accessToken: 'LOCALIZED_METADATA_SENTINEL'
                                    },
                                    ru: { content: 'INACTIVE_RUSSIAN_SENTINEL', version: 1, isActive: false },
                                    fr: { content: 'OTHER_ACTIVE_LOCALE_SENTINEL', version: 1, isActive: true }
                                }
                            }
                        }
                    },
                    {
                        id: 'localized-list',
                        type: 'list',
                        data: {
                            style: 'unordered',
                            items: [
                                {
                                    _primary: 'ru',
                                    locales: {
                                        en: { content: 'English public list item', isActive: true },
                                        ru: { content: 'INACTIVE_LIST_ITEM_SENTINEL', isActive: false }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        id: 'localized-table',
                        type: 'table',
                        data: {
                            withHeadings: false,
                            content: [
                                [
                                    {
                                        _primary: 'ru',
                                        locales: {
                                            en: { content: 'English public table cell', isActive: true },
                                            ru: { content: 'INACTIVE_TABLE_CELL_SENTINEL', isActive: false }
                                        }
                                    }
                                ]
                            ]
                        }
                    }
                ]
            }
        })

        expect(result.pageBlocks).toEqual([
            { id: 'localized-heading', type: 'header', data: { text: 'English public heading' } },
            { id: 'localized-list', type: 'list', data: { style: 'unordered', items: ['English public list item'] } },
            { id: 'localized-table', type: 'table', data: { withHeadings: false, content: [['English public table cell']] } }
        ])
        const serialized = JSON.stringify(result)
        for (const sentinel of [
            'BLOCK_METADATA_SENTINEL',
            'LOCALIZED_METADATA_SENTINEL',
            'INACTIVE_RUSSIAN_SENTINEL',
            'OTHER_ACTIVE_LOCALE_SENTINEL',
            'INACTIVE_LIST_ITEM_SENTINEL',
            'INACTIVE_TABLE_CELL_SENTINEL'
        ]) {
            expect(serialized).not.toContain(sentinel)
        }
        expect(serialized).not.toContain('isActive')
        expect(serialized).not.toContain('accessToken')
    })

    it.each([
        [
            'compact',
            {
                availableModes: ['wide', 'compact'],
                primaryMode: 'compact',
                rememberUserChoice: false
            }
        ],
        [
            'overlay',
            {
                availableModes: ['wide', 'overlay'],
                primaryMode: 'overlay',
                rememberUserChoice: true
            }
        ]
    ])('projects the validated %s side menu and omits private layout config', async (_mode, sideMenu) => {
        const resolveRuntimeData = jest.fn(async () => new Map([[ids.menuWidget, menuPayload]]))
        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: true } } as never,
            workspaceId: null,
            workspaceAvailable: false,
            locale: 'en',
            effectiveLayout: canonicalLayout(undefined, {
                sideMenu,
                objectBehavior: { showCreateButton: false, createSurface: 'page' },
                privateRuntimeOption: { token: 'private-layout-config' }
            }),
            resolveRuntimeData
        })

        expect(result.layoutConfig).toEqual({ sideMenu })
        expect(result).not.toHaveProperty('objectBehavior')
        expect(JSON.stringify(result)).not.toContain('objectBehavior')
        expect(JSON.stringify(result)).not.toContain('privateRuntimeOption')
        expect(JSON.stringify(result)).not.toContain('private-layout-config')
        const serializedPublicRuntime = JSON.stringify(result)
        for (const persistenceId of [applicationId, layoutId, ...Object.values(ids)]) {
            expect(serializedPublicRuntime).not.toContain(persistenceId)
        }
        const publicMenu = result.placements.find(({ widgetKey }) => widgetKey === 'menuWidget')?.runtimeData
        expect(publicMenu?.status).toBe('ready')
        if (publicMenu?.status !== 'ready') throw new Error('Expected the public menu projection to be ready')
        expect(publicMenu.data.items.map(({ key }) => key)).toEqual(['nav.hub.Learning'])
        expect(publicMenu.data.overflowItems).toEqual([])
        expect(publicMenu.data.navigationAction).toEqual({
            label: 'Structures',
            source: { kind: 'page', codename: 'Home' },
            target: { kind: 'page', codename: 'Structures' }
        })
        expect(JSON.stringify(publicMenu)).not.toContain('runtime-workspaces')
        expect(JSON.stringify(publicMenu)).not.toContain('"kind":"workspaces"')
        expect(JSON.stringify(publicMenu)).not.toContain('nav.page.Structures')
        expect(JSON.stringify(publicMenu)).not.toContain('nav.page.Templates')
        expect(resolveRuntimeData).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                workspaceId: null,
                workspacesEnabled: true,
                currentUserId: null,
                role: null,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false,
                    readReports: false
                }
            }),
            [expect.objectContaining({ widgetKey: 'menuWidget' })],
            'en'
        )
    })

    it('rejects invalid effective side-menu config before public data reads', () => {
        expect(() =>
            classifyPublicDashboardPlacements(
                canonicalLayout(undefined, {
                    sideMenu: { availableModes: ['compact'], primaryMode: 'overlay' }
                })
            )
        ).toThrow(PublicApplicationUnavailableError)
    })

    it('projects canonical placements without persistence ids and reads only the approved menu datasource', async () => {
        const resolveRuntimeData = jest.fn(
            async (
                _executor: DbExecutor,
                _scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ): Promise<ReadonlyMap<string, EffectiveWidgetRuntimeData>> => {
                expect(candidates.map(({ widgetKey }) => widgetKey)).toEqual(['menuWidget'])
                return new Map([[ids.menuWidget, menuPayload]])
            }
        )

        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: true } } as never,
            workspaceId: '0190a9b5-3cde-7abc-8def-0123456789ad',
            workspaceAvailable: true,
            locale: 'en',
            effectiveLayout: canonicalLayout(),
            resolveRuntimeData
        })

        expect(result.placements.map(({ widgetKey }) => widgetKey)).toEqual([
            'menuWidget',
            'appNavbar',
            'header',
            'languageSwitcher',
            'colorModeSwitcher',
            'interpretationNetworkWorkspace'
        ])
        expect(result.placements.find(({ widgetKey }) => widgetKey === 'menuWidget')).toMatchObject({
            runtimeData: { status: 'ready', data: { items: [{ key: 'nav.hub.Learning' }] } }
        })
        const interpretationNetworkPlacement = result.placements.find(({ widgetKey }) => widgetKey === 'interpretationNetworkWorkspace')
        expect(interpretationNetworkPlacement).toMatchObject({
            runtimeData: { status: 'deferred' }
        })
        expect(interpretationNetworkPlacement?.config).toEqual({
            structureMode: 'multiple',
            templatePanel: { showInStructureList: true, showInMatrix: true },
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true,
            splitPane: { enabled: true },
            hierarchyRowMode: 'focusedPath',
            allowNewAxesInCellDialog: false,
            positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
            cellStylePolicy: canonicalInterpretationNetworkConfig.cellStylePolicy
        })
        for (const internalField of [
            'conceptCodename',
            'conceptNameField',
            'conceptDescriptionField',
            'interpretationCodename',
            'interpretationParentField',
            'matrixField',
            'relationCodename',
            'materialCodename',
            'materialTitleField',
            'interpretationTitleField',
            'tableTemplateCodename',
            'tableTemplateNameField',
            'tableTemplateDescriptionField',
            'tableTemplateMatrixField'
        ]) {
            expect(interpretationNetworkPlacement?.config).not.toHaveProperty(internalField)
        }
        expect(JSON.stringify(result)).not.toContain(layoutId)
        for (const id of Object.values(ids)) expect(JSON.stringify(result)).not.toContain(id)
        expect(JSON.stringify(result)).not.toContain('runtime-workspaces')
    })

    it('omits validated personal shell widgets but rejects unknown active placements before data reads', async () => {
        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
            workspaceId: null,
            workspaceAvailable: true,
            locale: 'en',
            effectiveLayout: canonicalLayout([
                widget('optionsMenu', 'application-options', { visibleActions: ['preferences'] }, ids.optionsMenu),
                widget('userProfile', 'application-profile', { variant: 'compact' }, ids.userProfile),
                widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget)
            ]),
            resolveRuntimeData: async () => new Map([[ids.menuWidget, menuPayload]])
        })

        expect(result.placements.map(({ widgetKey }) => widgetKey)).toEqual(['menuWidget'])

        const resolveRuntimeData = jest.fn()
        const layout = canonicalLayout([widget('search', 'application-search', {}, '0190a9b5-3cde-7abc-8def-0123456789b2')])

        await expect(
            projectPublicDashboardRuntime({
                executor: {} as DbExecutor,
                resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
                workspaceId: null,
                workspaceAvailable: true,
                locale: 'en',
                effectiveLayout: layout,
                resolveRuntimeData
            })
        ).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
        expect(resolveRuntimeData).not.toHaveBeenCalled()
    })

    it('renders LMS tab containers with empty personal views and only sanitized shared records', async () => {
        const bindings = { version: 1, slots: [{ slot: 'rows', targets: [] }] }
        const publicTableWidget = attachApplicationLayoutWidgetSourceBindingState(
            widget(
                'detailsTable',
                'public-catalog-table',
                {
                    variant: 'records',
                    showSearch: true,
                    createTargets: [{ id: 'create-course', label: 'Create course', objectCollectionCodename: 'Courses' }],
                    enableRowReordering: true
                },
                ids.publicTable,
                { zone: 'center', semanticRegion: 'main', parentInstanceKey: 'learner-home-tabs', slotKey: 'tab:public' }
            ),
            { persistedApplicationRow: true, bindings: bindings as never }
        )
        const detailsTabsWidget = widget(
            'detailsTabs',
            'learner-home-tabs',
            {
                tabs: [{ slotKey: 'tab:public', label: 'Public catalog', isDefault: true }]
            },
            ids.detailsTabs,
            { zone: 'center', semanticRegion: 'main' }
        )
        const learnerTableWidget = widget(
            'detailsTable',
            'learner-enrollments',
            {
                variant: 'learner-enrollments',
                maxRows: 24,
                rowHeight: 'auto'
            },
            ids.learnerTable,
            { zone: 'center', semanticRegion: 'main', parentInstanceKey: 'learner-home-tabs', slotKey: 'tab:public' }
        )
        const libraryTableWidget = widget(
            'detailsTable',
            'learner-library',
            {
                variant: 'library',
                libraryView: 'recent',
                createTargets: [{ id: 'create-resource', label: 'Create resource', objectCollectionCodename: 'LearningResources' }]
            },
            ids.libraryTable,
            { zone: 'center', semanticRegion: 'main', parentInstanceKey: 'learner-home-tabs', slotKey: 'tab:public' }
        )
        const sourceTable: EffectiveWidgetRuntimeData = {
            status: 'ready',
            data: {
                kind: 'table',
                sourceEntityCodename: 'Courses',
                columns: [{ key: 'Title', label: 'Course', valueType: 'string' }],
                rows: [
                    {
                        key: 'row-1',
                        actionTarget: { entityCodename: 'Courses', recordHandle: 'internal-record-handle' },
                        mutationTarget: { entityCodename: 'Courses', recordHandle: 'internal-record-handle', version: 1 },
                        cells: [{ key: 'Title', value: 'Public course' }]
                    }
                ],
                pagination: { total: 1, limit: 24, offset: 0, complete: true }
            }
        } as never
        const resolveRuntimeData = jest.fn(
            async (
                _executor: DbExecutor,
                scope: EffectiveWidgetRuntimeReadScope,
                candidates: readonly EffectiveWidgetRuntimeCandidate[]
            ) => {
                expect(scope).toMatchObject({
                    workspaceId: '0190a9b5-3cde-7abc-8def-0123456789b3',
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
                expect(candidates.map(({ widgetKey }) => widgetKey)).toEqual(['menuWidget', 'detailsTable'])
                expect(candidates.find(({ widgetKey }) => widgetKey === 'detailsTable')?.bindings).toEqual(bindings)
                return new Map([
                    [ids.menuWidget, menuPayload],
                    [ids.publicTable, sourceTable]
                ])
            }
        )

        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: true } } as never,
            workspaceId: '0190a9b5-3cde-7abc-8def-0123456789b3',
            workspaceAvailable: true,
            locale: 'en',
            effectiveLayout: canonicalLayout([
                widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget),
                detailsTabsWidget,
                learnerTableWidget,
                libraryTableWidget,
                publicTableWidget
            ]),
            resolveRuntimeData
        })

        expect(result.placements.map(({ widgetKey }) => widgetKey)).toEqual([
            'menuWidget',
            'detailsTabs',
            'detailsTable',
            'detailsTable',
            'detailsTable'
        ])
        expect(result.placements.find(({ instanceKey }) => instanceKey === 'learner-enrollments')?.runtimeData).toEqual({ status: 'empty' })
        expect(result.placements.find(({ instanceKey }) => instanceKey === 'learner-library')?.runtimeData).toEqual({ status: 'empty' })
        const publicTable = result.placements.find(({ instanceKey }) => instanceKey === 'public-catalog-table')
        expect(publicTable?.config).not.toHaveProperty('createTargets')
        expect(publicTable?.config).not.toHaveProperty('enableRowReordering')
        expect(publicTable?.runtimeData).toMatchObject({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [{ key: 'Title', label: 'Course', valueType: 'string' }],
                rows: [{ key: 'row-1', cells: [{ key: 'Title', value: 'Public course' }] }]
            }
        })
        expect(JSON.stringify(publicTable)).not.toContain('internal-record-handle')
        expect(JSON.stringify(publicTable)).not.toContain('mutationTarget')
        expect(JSON.stringify(publicTable)).not.toContain('actionTarget')
        expect(JSON.stringify(publicTable)).not.toContain('sourceEntityCodename')
    })

    it('never resolves public records without an available selected workspace', async () => {
        const records = attachApplicationLayoutWidgetSourceBindingState(
            widget('detailsTable', 'public-records', { variant: 'records' }, ids.publicTable),
            { persistedApplicationRow: true, bindings: { version: 1, slots: [] } as never }
        )
        const resolveRuntimeData = jest.fn(async (_executor, _scope, candidates: readonly EffectiveWidgetRuntimeCandidate[]) => {
            expect(candidates.map(({ widgetKey }) => widgetKey)).toEqual(['menuWidget'])
            return new Map([[ids.menuWidget, menuPayload]])
        })
        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: true } } as never,
            workspaceId: null,
            workspaceAvailable: false,
            locale: 'en',
            effectiveLayout: canonicalLayout([widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget), records]),
            resolveRuntimeData
        })

        expect(result.placements.find(({ instanceKey }) => instanceKey === 'public-records')?.runtimeData).toEqual({ status: 'empty' })
        expect(resolveRuntimeData).toHaveBeenCalledTimes(1)
    })

    it('checks dependency closure before omitting workspaceSwitcher', () => {
        const layout = canonicalLayout([
            widget('workspaceSwitcher', 'workspace-switcher', {}, ids.workspaceSwitcher),
            widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget, {
                parentInstanceKey: 'workspace-switcher',
                slotKey: 'content'
            })
        ])
        expect(() => classifyPublicDashboardPlacements(layout)).toThrow(PublicApplicationUnavailableError)
    })

    it('keeps menu runtime failures retryable', async () => {
        await expect(
            projectPublicDashboardRuntime({
                executor: {} as DbExecutor,
                resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: false } } as never,
                workspaceId: null,
                workspaceAvailable: true,
                locale: 'en',
                effectiveLayout: canonicalLayout([widget('menuWidget', 'main-menu', { variant: 'generated' }, ids.menuWidget)]),
                resolveRuntimeData: async () => new Map([[ids.menuWidget, { status: 'server-error' } as never]])
            })
        ).rejects.toBeInstanceOf(PublicRuntimeTransientError)
    })

    it('keeps public navigation available with no workspace and defers workspace-backed widgets', async () => {
        const resolveRuntimeData = jest.fn(async () => new Map([[ids.menuWidget, menuPayload]]))
        const result = await projectPublicDashboardRuntime({
            executor: {} as DbExecutor,
            resolved: { application: { id: applicationId, schemaName: 'app_test', workspacesEnabled: true } } as never,
            workspaceId: null,
            workspaceAvailable: false,
            locale: 'en',
            effectiveLayout: canonicalLayout(),
            resolveRuntimeData
        })

        expect(result.workspaceAvailability).toBe('none')
        expect(result.placements.find(({ widgetKey }) => widgetKey === 'menuWidget')?.runtimeData).toMatchObject({
            status: 'ready',
            data: { items: [{ key: 'nav.hub.Learning' }] }
        })
        expect(result.placements.find(({ widgetKey }) => widgetKey === 'interpretationNetworkWorkspace')?.runtimeData).toEqual({
            status: 'deferred'
        })
        expect(resolveRuntimeData).toHaveBeenCalledTimes(1)
    })
})
