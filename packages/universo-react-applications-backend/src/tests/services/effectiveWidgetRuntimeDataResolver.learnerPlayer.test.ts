import './effectiveWidgetRuntimeDataResolver.testMocks'
import {
    createMockDbExecutor,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    getLayoutWidgetDefinition,
    runtimeStore,
    runtimeObjectMetadata,
    runtimeAccess,
    resolveEffectiveWidgetRuntimeData,
    objectId,
    componentId,
    parentObjectId,
    childObjectId,
    parentRecordId,
    childRecordId,
    learnerTargetRecordId,
    learnerPlayerCandidate,
    metadataForSlot,
    metadataEnvelope,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

const trackCourseObjectId = '0190a9b5-3cde-7abc-8def-0123456789d4'
const trackCourseItemsObjectId = '0190a9b5-3cde-7abc-8def-0123456789d5'
const trackRecordId = '0190a9b5-3cde-7abc-8def-0123456789d6'
const trackStepRecordId = '0190a9b5-3cde-7abc-8def-0123456789d7'
const trackCourseRecordId = '0190a9b5-3cde-7abc-8def-0123456789d8'
const trackCourseItemRecordIds = ['0190a9b5-3cde-7abc-8def-0123456789d9', '0190a9b5-3cde-7abc-8def-0123456789da']
const trackResourceRecordIds = ['0190a9b5-3cde-7abc-8def-0123456789db', '0190a9b5-3cde-7abc-8def-0123456789dc']

const trackPlayerCandidate = () => {
    const definition = getLayoutWidgetDefinition('learnerPlayer', { variant: 'track' })
    const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
    const items = definition?.bindingSlots?.find(({ key }) => key === 'items')
    if (!parent || !items) throw new Error('Track learnerPlayer binding contract is incomplete')
    const projection = (slot: typeof parent) =>
        slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    return {
        ...learnerPlayerCandidate(),
        config: { variant: 'track', displayMode: 'player', sequenceMode: 'strict' },
        bindings: {
            version: 1,
            slots: [
                {
                    slot: 'parent',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'LearningTracks',
                            selector: { kind: 'record-set' },
                            projection: projection(parent)
                        }
                    ]
                },
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'TrackSteps',
                            selector: { kind: 'relation-set', parentSlot: 'parent' },
                            projection: projection(items)
                        }
                    ]
                }
            ]
        }
    }
}

const trackCourseItemRows = () =>
    trackResourceRecordIds.map((resourceRecordId, index) => ({
        recordId: trackCourseItemRecordIds[index],
        data: {
            parent: trackCourseRecordId,
            title: `Course resource ${index + 1}`,
            targetObjectCodename: 'LearningResources',
            targetRecordId: resourceRecordId,
            order: index + 1
        }
    }))

const createTrackPlayerHarness = (courseItems = trackCourseItemRows()) => {
    const { executor } = createMockDbExecutor()
    const candidate = trackPlayerCandidate()
    const trackDefinition = getLayoutWidgetDefinition('learnerPlayer', candidate.config)
    const trackParentSlot = trackDefinition?.bindingSlots?.find(({ key }) => key === 'parent')
    const trackItemsSlot = trackDefinition?.bindingSlots?.find(({ key }) => key === 'items')
    const courseDefinition = getLayoutWidgetDefinition('learnerPlayer', { variant: 'course' })
    const courseParentSlot = courseDefinition?.bindingSlots?.find(({ key }) => key === 'parent')
    const courseItemsSlot = courseDefinition?.bindingSlots?.find(({ key }) => key === 'items')
    if (!trackParentSlot || !trackItemsSlot || !courseParentSlot || !courseItemsSlot) {
        throw new Error('LearnerPlayer binding contracts are incomplete')
    }

    const metadata = metadataEnvelope([
        metadataForSlot(parentObjectId, 'LearningTracks', trackParentSlot),
        metadataForSlot(childObjectId, 'TrackSteps', trackItemsSlot, parentObjectId),
        metadataForSlot(trackCourseObjectId, 'Courses', courseParentSlot),
        metadataForSlot(trackCourseItemsObjectId, 'CourseItems', courseItemsSlot, trackCourseObjectId)
    ])
    const trackStepComponents = metadata.componentsByObjectId.get(childObjectId) ?? []
    metadata.componentsByObjectId.set(
        childObjectId,
        trackStepComponents.map((component) =>
            ['TrackId', 'SortOrder'].includes(component.codename) ? { ...component, uiConfig: { serverOwned: true } } : component
        )
    )
    ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValue(metadata)
    ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
        (_executor: unknown, input: { query: { slot: string; target: { entityCodename: string } } }) => {
            if (input.query.target.entityCodename === 'LearningTracks') {
                return [{ recordId: trackRecordId, data: { title: 'Track', order: 1 } }]
            }
            if (input.query.target.entityCodename === 'TrackSteps') {
                return [
                    {
                        recordId: trackStepRecordId,
                        data: { parent: trackRecordId, title: 'Track step', targetRecordId: trackCourseRecordId, order: 1 }
                    }
                ]
            }
            if (input.query.target.entityCodename === 'CourseItems') return courseItems
            return []
        }
    )

    const runtimeObjects = new Map([
        [
            'Courses',
            {
                id: trackCourseObjectId,
                codename: 'Courses',
                tableName: 'courses',
                config: {},
                attrs: []
            }
        ],
        [
            'LearningResources',
            {
                id: objectId,
                codename: 'LearningResources',
                tableName: 'learning_resources',
                config: {},
                attrs: [
                    {
                        id: componentId,
                        codename: 'Body',
                        column_name: 'body',
                        data_type: 'JSONB',
                        is_required: false,
                        validation_rules: {},
                        target_object_id: null,
                        target_object_kind: null,
                        ui_config: {}
                    }
                ]
            }
        ]
    ])
    ;(runtimeObjectMetadata.resolveRuntimeObjectCollectionByCodename as jest.Mock).mockImplementation(
        (_executor: unknown, _schemaIdent: string, codename: string) => runtimeObjects.get(codename) ?? null
    )

    const rowsById = new Map<string, Record<string, unknown>>([
        [trackCourseRecordId, { id: trackCourseRecordId }],
        [
            trackResourceRecordIds[0],
            {
                id: trackResourceRecordIds[0],
                body: { format: 'editorjs', blocks: [{ id: 'resource-1', type: 'paragraph', data: { text: 'First lesson' } }] }
            }
        ],
        [
            trackResourceRecordIds[1],
            {
                id: trackResourceRecordIds[1],
                body: { format: 'editorjs', blocks: [{ id: 'resource-2', type: 'paragraph', data: { text: 'Second lesson' } }] }
            }
        ]
    ])
    ;(runtimeAccess.loadRuntimeRowByIdWithRecordAccess as jest.Mock).mockImplementation(
        async (input: { rowId: string }) => rowsById.get(input.rowId) ?? null
    )

    return { candidate, executor, rowsById }
}

describe('resolveEffectiveWidgetRuntimeData learnerPlayer projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('keeps scoped CourseItem sequence availability independent for each course parent', async () => {
        const { executor } = createMockDbExecutor()
        const learnerCandidate = learnerPlayerCandidate()
        const secondParentRecordId = '0190a9b5-3cde-7abc-8def-0123456789d1'
        const secondChildRecordId = '0190a9b5-3cde-7abc-8def-0123456789d2'
        const secondTargetRecordId = '0190a9b5-3cde-7abc-8def-0123456789d3'
        const definition = getLayoutWidgetDefinition('learnerPlayer', learnerCandidate.config)
        const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
        const items = definition?.bindingSlots?.find(({ key }) => key === 'items')
        if (!parent || !items) throw new Error('learnerPlayer slots are missing')
        const metadata = metadataEnvelope([
            metadataForSlot(parentObjectId, 'Courses', parent),
            metadataForSlot(childObjectId, 'CourseItems', items, parentObjectId)
        ])
        const courseItemComponents = metadata.componentsByObjectId.get(childObjectId) ?? []
        metadata.componentsByObjectId.set(
            childObjectId,
            courseItemComponents.map((component) =>
                ['CourseId', 'SortOrder'].includes(component.codename) ? { ...component, uiConfig: { serverOwned: true } } : component
            )
        )
        const courseItemsObject = metadata.objectsByCodename.get('CourseItems')
        if (!courseItemsObject) throw new Error('CourseItems runtime metadata is missing')
        metadata.objectsByCodename.set('CourseItems', {
            ...courseItemsObject,
            config: {
                ...courseItemsObject.config,
                runtimeRecordParentAccess: {
                    mode: 'parentRecord',
                    parentObjectCodename: 'Courses',
                    parentFieldCodename: 'CourseId'
                },
                runtimeProgress: {
                    sequencePolicy: { mode: 'sequential', scopeFieldCodename: 'CourseId', orderFieldCodename: 'SortOrder' }
                }
            }
        })
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadata)
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
            (_executor: unknown, input: { query: { slot: string } }) => {
                if (input.query.slot === 'parent') {
                    return [
                        { recordId: parentRecordId, data: { title: 'Course', order: 1 } },
                        { recordId: secondParentRecordId, data: { title: 'Second course', order: 2 } }
                    ]
                }
                if (input.query.slot === 'items') {
                    return [
                        {
                            recordId: childRecordId,
                            data: {
                                parent: parentRecordId,
                                title: { locales: { en: { content: 'Introduction' } } },
                                targetObjectCodename: 'LearningResources',
                                targetRecordId: learnerTargetRecordId,
                                order: 1
                            }
                        },
                        {
                            recordId: secondChildRecordId,
                            data: {
                                parent: secondParentRecordId,
                                title: 'Second introduction',
                                targetObjectCodename: 'LearningResources',
                                targetRecordId: secondTargetRecordId,
                                order: 1
                            }
                        }
                    ]
                }
                return []
            }
        )
        ;(runtimeObjectMetadata.resolveRuntimeObjectCollectionByCodename as jest.Mock).mockResolvedValue({
            id: objectId,
            codename: 'LearningResources',
            tableName: 'learning_resources',
            config: {},
            attrs: [
                {
                    id: componentId,
                    codename: 'Body',
                    column_name: 'body',
                    data_type: 'JSONB',
                    is_required: false,
                    validation_rules: {},
                    target_object_id: null,
                    target_object_kind: null,
                    ui_config: {}
                }
            ]
        })
        ;(runtimeAccess.loadRuntimeRowByIdWithRecordAccess as jest.Mock).mockResolvedValue({
            id: learnerTargetRecordId,
            body: { format: 'editorjs', blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }] }
        })
        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            { ...scope, schemaName: 'app_0190a9b53cde7abc8def0123456789b4' },
            [learnerCandidate],
            'en'
        )
        expect(resolved.get('placement-learner-player')).toEqual({
            status: 'ready',
            data: {
                kind: 'learner-player',
                parents: [
                    {
                        key: 'row-1',
                        label: 'Course',
                        target: { entityCodename: 'Courses', recordHandle: expect.stringMatching(/^rh1\./u) }
                    },
                    {
                        key: 'row-2',
                        label: 'Second course',
                        target: { entityCodename: 'Courses', recordHandle: expect.stringMatching(/^rh1\./u) }
                    }
                ],
                items: [
                    {
                        key: 'row-1',
                        parentKey: 'row-1',
                        title: 'Introduction',
                        blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }],
                        progressTarget: { objectCodename: 'CourseItems', recordHandle: expect.stringMatching(/^rh1\./u) },
                        availability: 'available'
                    },
                    {
                        key: 'row-2',
                        parentKey: 'row-2',
                        title: 'Second introduction',
                        blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }],
                        progressTarget: { objectCodename: 'CourseItems', recordHandle: expect.stringMatching(/^rh1\./u) },
                        availability: 'available'
                    }
                ]
            }
        })
        const serialized = JSON.stringify(resolved.get('placement-learner-player'))
        for (const physicalId of [parentRecordId, secondParentRecordId, childRecordId, secondChildRecordId]) {
            expect(serialized).not.toContain(physicalId)
        }
        expect(serialized).not.toContain(learnerTargetRecordId)
        expect(runtimeAccess.loadRuntimeRowByIdWithRecordAccess).toHaveBeenCalledWith(
            expect.objectContaining({ rowId: learnerTargetRecordId, objectCodename: 'LearningResources', minimumAccessLevel: 'read' })
        )
    })

    it('fails closed when the progress scope does not match the learner player parent relation', async () => {
        const { executor } = createMockDbExecutor()
        const learnerCandidate = learnerPlayerCandidate()
        const definition = getLayoutWidgetDefinition('learnerPlayer', learnerCandidate.config)
        const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
        const items = definition?.bindingSlots?.find(({ key }) => key === 'items')
        if (!parent || !items) throw new Error('learnerPlayer slots are missing')

        const metadata = metadataEnvelope([
            metadataForSlot(parentObjectId, 'Courses', parent),
            metadataForSlot(childObjectId, 'CourseItems', items, parentObjectId)
        ])
        const courseItemsObject = metadata.objectsByCodename.get('CourseItems')
        if (!courseItemsObject) throw new Error('CourseItems runtime metadata is missing')
        metadata.objectsByCodename.set('CourseItems', {
            ...courseItemsObject,
            config: {
                ...courseItemsObject.config,
                runtimeRecordParentAccess: {
                    mode: 'parentRecord',
                    parentObjectCodename: 'Courses',
                    parentFieldCodename: 'UnexpectedCourseId'
                },
                runtimeProgress: {
                    sequencePolicy: {
                        mode: 'sequential',
                        scopeFieldCodename: 'UnexpectedCourseId',
                        orderFieldCodename: 'SortOrder'
                    }
                }
            }
        })
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadata)
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
            (_executor: unknown, input: { query: { slot: string } }) => {
                if (input.query.slot === 'parent') {
                    return [{ recordId: parentRecordId, data: { title: 'Course', order: 1 } }]
                }
                if (input.query.slot === 'items') {
                    return [
                        {
                            recordId: childRecordId,
                            data: {
                                parent: parentRecordId,
                                title: 'Introduction',
                                targetObjectCodename: 'LearningResources',
                                targetRecordId: learnerTargetRecordId,
                                order: 1
                            }
                        }
                    ]
                }
                return []
            }
        )

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            { ...scope, schemaName: 'app_0190a9b53cde7abc8def0123456789b4' },
            [learnerCandidate],
            'en'
        )

        expect(resolved.get(learnerCandidate.id)).toEqual({ status: 'malformed-config' })
        expect(runtimeAccess.loadRuntimeRowByIdWithRecordAccess).not.toHaveBeenCalled()
    })

    it('resolves TrackStep to CourseItems and LearningResources.Body while keeping TrackStep progress identity private to the projection', async () => {
        const { candidate: trackCandidate, executor } = createTrackPlayerHarness()
        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            { ...scope, schemaName: 'app_0190a9b53cde7abc8def0123456789b4' },
            [trackCandidate],
            'en'
        )

        expect(resolved.get(trackCandidate.id)).toEqual({
            status: 'ready',
            data: {
                kind: 'learner-player',
                parents: [
                    {
                        key: 'row-1',
                        label: 'Track',
                        target: { entityCodename: 'LearningTracks', recordHandle: expect.stringMatching(/^rh1\./u) }
                    }
                ],
                items: [
                    {
                        key: 'row-1',
                        parentKey: 'row-1',
                        title: 'Track step',
                        blocks: [
                            { id: 'resource-1', type: 'paragraph', data: { text: 'First lesson' } },
                            { id: 'resource-2', type: 'paragraph', data: { text: 'Second lesson' } }
                        ],
                        progressTarget: { objectCodename: 'TrackSteps', recordHandle: expect.stringMatching(/^rh1\./u) },
                        availability: 'available'
                    }
                ]
            }
        })

        const serialized = JSON.stringify(resolved.get(trackCandidate.id))
        for (const referencedId of [trackCourseRecordId, ...trackCourseItemRecordIds, ...trackResourceRecordIds]) {
            expect(serialized).not.toContain(referencedId)
        }
        expect(serialized).not.toContain(trackStepRecordId)

        const accessCalls = (runtimeAccess.loadRuntimeRowByIdWithRecordAccess as jest.Mock).mock.calls.map(([input]) => input)
        expect(accessCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rowId: trackCourseRecordId,
                    objectCodename: 'Courses',
                    currentWorkspaceId: scope.workspaceId,
                    currentUserId: scope.currentUserId,
                    permissions: scope.permissions,
                    minimumAccessLevel: 'read'
                }),
                ...trackResourceRecordIds.map((rowId) =>
                    expect.objectContaining({
                        rowId,
                        objectCodename: 'LearningResources',
                        currentWorkspaceId: scope.workspaceId,
                        currentUserId: scope.currentUserId,
                        permissions: scope.permissions,
                        minimumAccessLevel: 'read'
                    })
                )
            ])
        )

        const nestedCourseItemsInput = (runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mock.calls
            .map(([, input]) => input)
            .find((input) => input.query.target.entityCodename === 'CourseItems')
        expect(nestedCourseItemsInput).toEqual(
            expect.objectContaining({
                schemaName: 'app_0190a9b53cde7abc8def0123456789b4',
                workspaceId: scope.workspaceId,
                workspacesEnabled: true,
                currentUserId: scope.currentUserId,
                permissions: scope.permissions,
                parentObjectId: trackCourseObjectId,
                query: expect.objectContaining({
                    kind: 'relation-set',
                    selector: expect.objectContaining({
                        relationComponentCodename: 'CourseId',
                        parentRecordIds: [trackCourseRecordId]
                    })
                })
            })
        )
    })

    it.each(['missing-course', 'unavailable-course-items', 'unauthorized-resource'] as const)(
        'keeps a TrackStep non-completable when nested content is missing or unreadable (%s)',
        async (failure) => {
            const { candidate: trackCandidate, executor, rowsById } = createTrackPlayerHarness()
            if (failure === 'missing-course') rowsById.delete(trackCourseRecordId)
            if (failure === 'unauthorized-resource') rowsById.delete(trackResourceRecordIds[0])
            if (failure === 'unavailable-course-items') {
                ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
                    (_executor: unknown, input: { query: { slot: string; target: { entityCodename: string } } }) => {
                        if (input.query.target.entityCodename === 'LearningTracks') {
                            return [{ recordId: trackRecordId, data: { title: 'Track', order: 1 } }]
                        }
                        if (input.query.target.entityCodename === 'TrackSteps') {
                            return [
                                {
                                    recordId: trackStepRecordId,
                                    data: { parent: trackRecordId, title: 'Track step', targetRecordId: trackCourseRecordId, order: 1 }
                                }
                            ]
                        }
                        return []
                    }
                )
            }

            const resolved = await resolveEffectiveWidgetRuntimeData(
                executor,
                { ...scope, schemaName: 'app_0190a9b53cde7abc8def0123456789b4' },
                [trackCandidate],
                'en'
            )
            const item = resolved.get(trackCandidate.id)?.data
            expect(item).toEqual(
                expect.objectContaining({
                    kind: 'learner-player',
                    items: [
                        expect.objectContaining({
                            progressTarget: { objectCodename: 'TrackSteps', recordHandle: expect.stringMatching(/^rh1\./u) },
                            availability: 'locked'
                        })
                    ]
                })
            )
            const serialized = JSON.stringify(item)
            for (const referencedId of [trackCourseRecordId, ...trackCourseItemRecordIds, ...trackResourceRecordIds]) {
                expect(serialized).not.toContain(referencedId)
            }
            expect(item?.items[0]).not.toHaveProperty('progressPercent')
        }
    )

    it('locks a TrackStep whose referenced LearningResources have no usable Body blocks', async () => {
        const { candidate: trackCandidate, executor, rowsById } = createTrackPlayerHarness()
        for (const resourceRecordId of trackResourceRecordIds) {
            rowsById.set(resourceRecordId, { id: resourceRecordId, body: { format: 'editorjs', blocks: [] } })
        }

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            { ...scope, schemaName: 'app_0190a9b53cde7abc8def0123456789b4' },
            [trackCandidate],
            'en'
        )

        expect(resolved.get(trackCandidate.id)?.data).toEqual(
            expect.objectContaining({
                kind: 'learner-player',
                items: [
                    expect.objectContaining({
                        blocks: [],
                        availability: 'locked',
                        progressTarget: { objectCodename: 'TrackSteps', recordHandle: expect.stringMatching(/^rh1\./u) }
                    })
                ]
            })
        )
    })
})
