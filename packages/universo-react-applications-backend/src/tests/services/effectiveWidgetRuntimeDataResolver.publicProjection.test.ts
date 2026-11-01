import './effectiveWidgetRuntimeDataResolver.testMocks'
import {
    createMockDbExecutor,
    dashboardRowsRuntimeComponents,
    getLayoutWidgetDefinition,
    metadataEnvelope,
    metadataForSlot,
    metricObjectId,
    objectId,
    recordSetCandidate,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    resolveEffectiveWidgetRuntimeData,
    runtimeObjectCatalog,
    runtimeStore,
    runtimeUnion,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('anonymous published widget projection metadata', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('rejects a detailsTitle source whose Title presentation identifies a person before reading records', async () => {
        const { executor } = createMockDbExecutor()
        const config = { level: 'h2' as const }
        const definition = getLayoutWidgetDefinition('detailsTitle', config)
        const contentSlot = definition?.bindingSlots?.find(({ key }) => key === 'content')
        if (!contentSlot) throw new Error('detailsTitle content slot is missing')
        const metadata = metadataForSlot(metricObjectId, 'PublishedContent', contentSlot)
        const unsafeMetadata = {
            ...metadata,
            components: metadata.components.map((component) =>
                component.codename === 'Title'
                    ? {
                          ...component,
                          presentation: {
                              name: { _primary: 'en', locales: { en: { content: 'Full Name' } } }
                          }
                      }
                    : component
            )
        } as const
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadataEnvelope([unsafeMetadata]))
        const candidate = {
            id: 'placement-details-title-public',
            widgetKey: 'detailsTitle',
            config,
            isActive: true,
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'PublishedContent',
                                selector: { kind: 'semantic-key', field: 'key', value: 'welcome' },
                                projection: contentSlot.requirements.components.map(({ field, componentCodename }) => ({
                                    field,
                                    componentCodename
                                }))
                            }
                        ]
                    }
                ]
            }
        } as const

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app'
            },
            [candidate],
            'en'
        )

        expect(resolved.get('placement-details-title-public')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })

    it('rejects an unapproved neutral Title Component before reading its potentially personal value', async () => {
        const { executor } = createMockDbExecutor()
        const config = { level: 'h2' as const }
        const definition = getLayoutWidgetDefinition('detailsTitle', config)
        const contentSlot = definition?.bindingSlots?.find(({ key }) => key === 'content')
        if (!contentSlot) throw new Error('detailsTitle content slot is missing')
        const metadata = metadataForSlot(metricObjectId, 'PublishedContent', contentSlot)
        const unapprovedMetadata = {
            ...metadata,
            components: metadata.components.map((component) =>
                component.codename === 'Title' ? { ...component, uiConfig: {} } : component
            )
        } as const
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadataEnvelope([unapprovedMetadata]))
        const candidate = {
            id: 'placement-details-title-unapproved-public',
            widgetKey: 'detailsTitle',
            config,
            isActive: true,
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'PublishedContent',
                                selector: { kind: 'semantic-key', field: 'key', value: 'welcome' },
                                projection: contentSlot.requirements.components.map(({ field, componentCodename }) => ({
                                    field,
                                    componentCodename
                                }))
                            }
                        ]
                    }
                ]
            }
        } as const

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app'
            },
            [candidate],
            'en'
        )

        expect(resolved.get('placement-details-title-unapproved-public')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })

    it('allows entity-schema details tables when the bound slot has no fixed component requirements', async () => {
        const { executor } = createMockDbExecutor()
        const config = { variant: 'records', maxRows: 20 }
        const definition = getLayoutWidgetDefinition('detailsTable', config)
        const rowsSlot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!rowsSlot) throw new Error('detailsTable rows slot is missing')

        const metadata = metadataEnvelope([metadataForSlot(objectId, 'PublishedRecords', rowsSlot)])
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce({
            ...metadata,
            componentsByObjectId: new Map()
        })
        ;(runtimeObjectCatalog.loadRuntimeReadableComponents as jest.Mock).mockResolvedValueOnce(dashboardRowsRuntimeComponents)
        ;(runtimeUnion.executeRuntimeRecordsUnionQuery as jest.Mock).mockResolvedValueOnce({
            targetPayloads: [
                {
                    objectCollection: {},
                    columns: [{ field: 'Title', headerName: 'Title' }],
                    reorderFieldCodename: null
                }
            ],
            rows: [],
            total: 0,
            limit: 20,
            offset: 0
        })

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app'
            },
            [recordSetCandidate('detailsTable', 'rows', 'PublishedRecords', config)],
            'en'
        )

        expect(resolved.get('placement-detailsTable')).toMatchObject({ status: 'ready', data: { kind: 'table' } })
        expect(runtimeUnion.executeRuntimeRecordsUnionQuery).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['Messenger', 'messenger-app'],
        ['Dashboard', undefined]
    ] as const)(
        'omits Object references from anonymous published %s tables even when the reference field is approved',
        async (_template, policy) => {
            const { executor } = createMockDbExecutor()
            const config = { variant: 'records', maxRows: 20 }
            const definition = getLayoutWidgetDefinition('detailsTable', config)
            const rowsSlot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
            if (!rowsSlot) throw new Error('detailsTable rows slot is missing')

            const metadata = metadataEnvelope([metadataForSlot(objectId, 'PublishedRecords', rowsSlot)])
            ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce({
                ...metadata,
                componentsByObjectId: new Map()
            })
            ;(runtimeObjectCatalog.loadRuntimeReadableComponents as jest.Mock).mockResolvedValueOnce([
                { ...dashboardRowsRuntimeComponents[0]!, ui_config: { publicMessengerSafe: true } },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789e8',
                    codename: 'Category',
                    column_name: 'cmp_category',
                    data_type: 'REF' as const,
                    is_required: false,
                    target_object_id: metricObjectId,
                    target_object_kind: 'object',
                    presentation: { name: { _primary: 'en', locales: { en: { content: 'Category' } } } },
                    validation_rules: {},
                    sort_order: 1,
                    ui_config: { publicMessengerSafe: true }
                }
            ])
            ;(runtimeUnion.executeRuntimeRecordsUnionQuery as jest.Mock).mockResolvedValueOnce({
                targetPayloads: [{ objectCollection: {}, columns: [{ field: 'Title', headerName: 'Title' }], reorderFieldCodename: null }],
                rows: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            const publicScope = {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                ...(policy ? { publicRuntimePolicy: policy } : {})
            }
            const resolved = await resolveEffectiveWidgetRuntimeData(
                executor,
                publicScope,
                [recordSetCandidate('detailsTable', 'rows', 'PublishedRecords', config)],
                'en'
            )

            expect(resolved.get('placement-detailsTable')).toMatchObject({
                status: 'ready',
                data: { kind: 'table', columns: [{ key: 'Title', label: 'Title' }] }
            })
            expect(runtimeUnion.executeRuntimeRecordsUnionQuery).toHaveBeenCalledWith(
                expect.objectContaining({ datasource: expect.objectContaining({ projectedFields: ['Title'] }) })
            )
        }
    )

    it('does not select an unapproved neutral Title Component for an anonymous records table', async () => {
        const { executor } = createMockDbExecutor()
        const config = { variant: 'records', maxRows: 20 }
        const definition = getLayoutWidgetDefinition('detailsTable', config)
        const rowsSlot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!rowsSlot) throw new Error('detailsTable rows slot is missing')

        const metadata = metadataEnvelope([metadataForSlot(objectId, 'PublishedRecords', rowsSlot)])
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce({
            ...metadata,
            componentsByObjectId: new Map()
        })
        ;(runtimeObjectCatalog.loadRuntimeReadableComponents as jest.Mock).mockResolvedValueOnce(
            dashboardRowsRuntimeComponents.map((component) => ({ ...component, ui_config: {} }))
        )

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app'
            },
            [recordSetCandidate('detailsTable', 'rows', 'PublishedRecords', config)],
            'en'
        )

        expect(resolved.get('placement-detailsTable')).toEqual({ status: 'malformed-config' })
        expect(runtimeUnion.executeRuntimeRecordsUnionQuery).not.toHaveBeenCalled()
    })
})
