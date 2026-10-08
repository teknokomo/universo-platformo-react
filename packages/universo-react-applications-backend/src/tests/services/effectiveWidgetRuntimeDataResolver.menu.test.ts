import './effectiveWidgetRuntimeDataResolver.testMocks'
import { UpdateFailure } from '../../shared/runtimeHelpers'
import {
    createMockDbExecutor,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    runtimeStore,
    resolveEffectiveWidgetRuntimeData,
    objectId,
    recordId,
    componentId,
    applicationId,
    workspaceId,
    candidateWithHeading,
    candidate,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('resolveEffectiveWidgetRuntimeData menu projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('returns bounded manual menu data after source validation without persistence identifiers', async () => {
        const { executor } = createMockDbExecutor()
        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')

        expect(resolved.get('placement-menu-1')).toEqual({
            status: 'ready',
            data: {
                kind: 'menu',
                title: '',
                showTitle: false,
                overflowLabel: 'More',
                items: [{ key: 'manual.item-1', label: 'Course catalogue', icon: null, kind: 'link', href: '/catalogue' }],
                overflowItems: []
            }
        })
        const serialized = JSON.stringify(resolved.get('placement-menu-1'))
        for (const physicalId of [objectId, recordId, componentId, applicationId, workspaceId]) {
            expect(serialized).not.toContain(physicalId)
        }
        expect(serialized).not.toContain('privateJson')
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).toHaveBeenCalledTimes(1)
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledTimes(1)
        const metadataOrder = (runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mock.invocationCallOrder[0]
        const recordOrder = (runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mock.invocationCallOrder[0]
        expect(metadataOrder).toBeLessThan(recordOrder)
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({
                schemaName: 'tenant_app',
                workspaceId,
                workspacesEnabled: true,
                currentUserId: scope.currentUserId,
                permissions: scope.permissions
            })
        )
    })

    it('resolves an optional Object semantic-key heading to its localized title without exposing Entity or record ids', async () => {
        const { executor } = createMockDbExecutor()
        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidateWithHeading()], 'ru')

        expect(resolved.get('placement-menu-1')).toEqual({
            status: 'ready',
            data: {
                kind: 'menu',
                title: 'Основная навигация',
                showTitle: true,
                overflowLabel: 'Ещё',
                items: [{ key: 'manual.item-1', label: 'Course catalogue', icon: null, kind: 'link', href: '/catalogue' }],
                overflowItems: []
            }
        })
        const serialized = JSON.stringify(resolved.get('placement-menu-1'))
        for (const physicalId of [objectId, recordId, componentId, applicationId, workspaceId]) {
            expect(serialized).not.toContain(physicalId)
        }
        expect(serialized).not.toContain('main-navigation')
        const [, , requestedComponents] = (runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mock.calls[0]
        expect([...requestedComponents.entries()]).toEqual([
            ['MenuItems', expect.arrayContaining(['Key', 'Title', 'Label', 'Href', 'Order'])]
        ])
    })

    it('keeps a manual menu empty when its bound heading exists but its required item source has no rows', async () => {
        const { executor } = createMockDbExecutor()
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ recordId, data: { key: 'main-navigation', title: 'Main navigation' } }])

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidateWithHeading()], 'en')

        expect(resolved.get('placement-menu-1')).toEqual({ status: 'empty' })
    })

    it('fails closed on unsafe manual links and does not fetch records from a stale source', async () => {
        const { executor } = createMockDbExecutor()
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValueOnce([
            { recordId, data: { label: 'Bad link', href: `/open/${recordId}`, order: 1 } }
        ])
        const unsafe = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')
        expect(unsafe.get('placement-menu-1')).toEqual({ status: 'malformed-config' })
        expect(JSON.stringify(unsafe.get('placement-menu-1'))).not.toContain(recordId)
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce({
            objectsByCodename: new Map(),
            componentsByObjectId: new Map()
        })
        const stale = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')
        expect(stale.get('placement-menu-1')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledTimes(1)
    })

    it('distinguishes required-missing, empty, permission-denied, and network-error states', async () => {
        const { executor } = createMockDbExecutor()
        const unbound = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate({ bindings: null })], 'en')
        expect(unbound.get('placement-menu-1')).toEqual({ status: 'required-missing' })
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValueOnce([])
        const empty = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')
        expect(empty.get('placement-menu-1')).toEqual({ status: 'empty' })
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('denied'), { code: '42501' })
        )
        const denied = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')
        expect(denied.get('placement-menu-1')).toEqual({ status: 'permission-denied' })
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('offline'), { code: 'ECONNRESET' })
        )
        const offline = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')
        expect(offline.get('placement-menu-1')).toEqual({ status: 'network-error' })
    })

    it.each([
        [403, 'permission-denied'],
        [404, 'stale-source'],
        [409, 'malformed-config']
    ] as const)('maps typed widget runtime failure %i to %s', async (statusCode, expectedStatus) => {
        const { executor } = createMockDbExecutor()
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockRejectedValueOnce(
            new UpdateFailure(statusCode, { error: 'typed widget runtime failure' })
        )

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate()], 'en')

        expect(resolved.get('placement-menu-1')).toEqual({ status: expectedStatus })
    })

    it('builds generated menus from published host metadata and returns semantic targets only', async () => {
        const { executor } = createMockDbExecutor()
        ;(runtimeStore.loadPublishedDashboardMenuEntities as jest.Mock).mockResolvedValueOnce([
            {
                id: objectId,
                kind: 'hub',
                codename: 'LearningHub',
                presentation: null,
                config: { sortOrder: 1 },
                tableName: null
            },
            {
                id: recordId,
                kind: 'object',
                codename: 'ProgressLedger',
                presentation: null,
                config: { sortOrder: 2, hubs: [objectId] },
                tableName: 'app_progress_ledger'
            },
            {
                id: applicationId,
                kind: 'object',
                codename: 'InternalSettings',
                presentation: null,
                config: { sortOrder: 1, runtime: { menuVisibility: 'secondary' } },
                tableName: 'app_internal_settings'
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a7',
                kind: 'object',
                codename: 'ContentProjects',
                presentation: { name: { _primary: 'en', locales: { en: { content: 'Content Projects' } } } },
                config: { sortOrder: 2, hubs: [objectId], runtime: { menuVisibility: 'primary', icon: 'folder' } },
                tableName: 'app_content_projects'
            },
            {
                id: componentId,
                kind: 'page',
                codename: 'Welcome',
                presentation: null,
                config: { sortOrder: 0, runtime: { menuVisibility: 'visible', icon: 'home' } },
                tableName: null
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a5',
                kind: 'page',
                codename: 'CourseOverview',
                presentation: null,
                config: { sortOrder: 1, hubs: [objectId], runtime: { menuVisibility: 'secondary', icon: 'school' } },
                tableName: null
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a6',
                kind: 'page',
                codename: 'HiddenDraft',
                presentation: null,
                config: { sortOrder: 0, runtime: { menuVisibility: 'hidden' } },
                tableName: null
            }
        ])

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            scope,
            [candidate({ config: { variant: 'generated' }, bindings: null })],
            'en'
        )
        const value = resolved.get('placement-menu-1')
        expect(value).toMatchObject({
            status: 'ready',
            data: {
                kind: 'menu',
                items: [
                    {
                        key: 'nav.page.Welcome',
                        label: 'Welcome',
                        icon: 'home',
                        kind: 'section',
                        target: { kind: 'page', codename: 'Welcome' }
                    },
                    {
                        key: 'nav.hub.LearningHub',
                        label: 'LearningHub',
                        icon: 'folder',
                        kind: 'group',
                        target: { kind: 'hub', codename: 'LearningHub' }
                    },
                    {
                        key: 'nav.LearningHub.page.CourseOverview',
                        label: 'CourseOverview',
                        icon: 'school',
                        kind: 'section',
                        target: { kind: 'page', codename: 'CourseOverview' }
                    },
                    {
                        key: 'nav.LearningHub.object.ContentProjects',
                        label: 'Content Projects',
                        icon: 'folder',
                        kind: 'section',
                        target: { kind: 'object', codename: 'ContentProjects' }
                    },
                    { key: 'runtime-workspaces', kind: 'workspaces' }
                ]
            }
        })
        const serialized = JSON.stringify(value)
        for (const physicalId of [objectId, recordId, applicationId, workspaceId]) expect(serialized).not.toContain(physicalId)
        expect(serialized).not.toContain('ProgressLedger')
        expect(serialized).not.toContain('InternalSettings')
        expect(serialized).not.toContain('HiddenDraft')
        expect(serialized).not.toContain('table_name')
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).not.toHaveBeenCalled()
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
        expect(runtimeStore.loadPublishedDashboardMenuEntities).toHaveBeenCalledWith(executor, 'tenant_app')
    })

    it('filters permission-gated generated menu targets using the current application role', async () => {
        const { executor } = createMockDbExecutor()
        const reportsEntity = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a8',
            kind: 'object',
            codename: 'Reports',
            presentation: { name: { _primary: 'en', locales: { en: { content: 'Reports' } } } },
            config: {
                sortOrder: 3,
                runtime: { menuVisibility: 'primary', icon: 'analytics', requiresPermission: 'readReports' }
            },
            tableName: 'app_reports'
        }
        const generatedMenu = [candidate({ config: { variant: 'generated' }, bindings: null })]

        ;(runtimeStore.loadPublishedDashboardMenuEntities as jest.Mock).mockResolvedValueOnce([reportsEntity])
        const memberResult = await resolveEffectiveWidgetRuntimeData(executor, { ...scope, role: 'member' }, generatedMenu, 'en')
        const memberMenu = memberResult.get('placement-menu-1')
        expect(memberMenu?.status).toBe('ready')
        expect(JSON.stringify(memberMenu)).not.toContain('Reports')
        ;(runtimeStore.loadPublishedDashboardMenuEntities as jest.Mock).mockResolvedValueOnce([reportsEntity])
        const editorResult = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                role: 'editor',
                permissions: { ...scope.permissions, readReports: true }
            },
            generatedMenu,
            'en'
        )
        expect(JSON.stringify(editorResult.get('placement-menu-1'))).toContain('Reports')
    })

    it('rejects unsupported renderer configuration and source state without fallback', async () => {
        const { executor } = createMockDbExecutor()
        const malformed = await resolveEffectiveWidgetRuntimeData(
            executor,
            scope,
            [candidate({ config: { variant: 'automatic' }, bindings: null })],
            'en'
        )
        expect(malformed.get('placement-menu-1')).toEqual({ status: 'malformed-config' })
        expect(runtimeStore.loadPublishedDashboardMenuEntities).not.toHaveBeenCalled()
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).not.toHaveBeenCalled()
    })
})
