import './effectiveWidgetRuntimeDataResolver.testMocks'
import {
    createMockDbExecutor,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    getLayoutWidgetDefinition,
    resolveWidgetBindingSlotDefinition,
    runtimeStore,
    resolveEffectiveWidgetRuntimeData,
    parentObjectId,
    childObjectId,
    parentRecordId,
    childRecordId,
    relationBuilderCandidate,
    metadataForSlot,
    metadataEnvelope,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('resolveEffectiveWidgetRuntimeData relationBuilder projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('expands Dashboard binding slot families before runtime metadata authorization', async () => {
        const { executor } = createMockDbExecutor()
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce({
            objectsByCodename: new Map(),
            componentsByObjectId: new Map()
        })

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [relationBuilderCandidate()], 'en')

        expect(resolved.get('placement-relation-1')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).toHaveBeenCalledTimes(1)
        const requests = (runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mock.calls[0]?.[2] as Map<string, string[]>
        expect(requests.get('ParentRecords')).toEqual(['Title', 'SortOrder'])
        expect(requests.get('MaterialRecords')).toEqual(['Parent', 'Title', 'SortOrder'])
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })

    it.each([
        { title: 'Materials', locale: 'en', expectedTitle: 'Materials' },
        { title: { en: 'Materials', ru: 'Материалы' }, locale: 'en', expectedTitle: 'Materials' },
        { title: { en: 'Materials', ru: 'Материалы' }, locale: 'ru-RU', expectedTitle: 'Материалы' }
    ])('projects relation-set panels with localized presentation in $locale', async ({ title, locale, expectedTitle }) => {
        const { executor } = createMockDbExecutor()
        const baseCandidate = relationBuilderCandidate()
        const relationCandidate = {
            ...baseCandidate,
            config: { ...baseCandidate.config, panels: [{ ...baseCandidate.config.panels[0], title }] }
        }
        const definition = getLayoutWidgetDefinition('relationBuilder', relationCandidate.config)
        const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
        const panel = definition ? resolveWidgetBindingSlotDefinition(definition, 'panel:materials') : undefined
        if (!parent || !panel) throw new Error('relationBuilder slots are missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope([
                metadataForSlot(parentObjectId, 'ParentRecords', parent),
                metadataForSlot(childObjectId, 'MaterialRecords', panel, parentObjectId)
            ])
        )
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
            (_executor: unknown, input: { query: { slot: string } }) => {
                if (input.query.slot === 'parent') {
                    return [
                        {
                            recordId: parentRecordId,
                            data: { title: { locales: { en: { content: 'Course 1' } } }, order: 1 }
                        }
                    ]
                }
                if (input.query.slot === 'panel:materials') {
                    return [
                        {
                            recordId: childRecordId,
                            data: {
                                parent: parentRecordId,
                                title: { locales: { en: { content: 'Lesson 1' } } },
                                order: 1,
                                _upl_version: 3
                            }
                        }
                    ]
                }
                return []
            }
        )

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [relationCandidate], locale)
        expect(resolved.get('placement-relation-1')).toEqual({
            status: 'ready',
            data: {
                kind: 'relation',
                parents: [
                    {
                        key: 'row-1',
                        label: 'Course 1',
                        target: { entityCodename: 'ParentRecords', recordHandle: expect.stringMatching(/^rh1\./u) }
                    }
                ],
                panels: [
                    {
                        slotKey: 'panel:materials',
                        title: expectedTitle,
                        targetEntityCodename: 'MaterialRecords',
                        parentFieldCodename: 'Parent',
                        rows: [
                            {
                                key: 'row-1',
                                parentKey: 'row-1',
                                label: 'Lesson 1',
                                target: {
                                    entityCodename: 'MaterialRecords',
                                    recordHandle: expect.stringMatching(/^rh1\./u),
                                    version: 3
                                }
                            }
                        ]
                    }
                ]
            }
        })
        const payload = resolved.get('placement-relation-1')
        const serialized = JSON.stringify(payload)
        for (const physicalId of [parentObjectId, childObjectId]) expect(serialized).not.toContain(physicalId)
        expect(serialized).not.toContain(parentRecordId)
        expect(serialized).not.toContain(childRecordId)
        expect(serialized).toContain('"recordHandle":"rh1.')
        expect(serialized).not.toContain(`Course 1 ${parentRecordId}`)
        expect(serialized).not.toContain(`Lesson 1 ${childRecordId}`)
    })

    it('projects localized, bounded relation display columns from the authorized relation-set projection', async () => {
        const { executor } = createMockDbExecutor()
        const candidate = relationBuilderCandidate([
            { fieldCodename: 'Category', valueType: 'string', localized: true, required: false },
            { fieldCodename: 'Summary', valueType: 'string', localized: false, required: false },
            { fieldCodename: 'Score', valueType: 'number', localized: false, required: false },
            { fieldCodename: 'ReferenceCode', valueType: 'string', localized: false, required: false },
            { fieldCodename: 'Description', valueType: 'string', localized: false, required: false }
        ])
        const definition = getLayoutWidgetDefinition('relationBuilder', candidate.config)
        const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
        const panel = definition ? resolveWidgetBindingSlotDefinition(definition, 'panel:materials') : undefined
        if (!parent || !panel) throw new Error('relationBuilder slots are missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope([
                metadataForSlot(parentObjectId, 'ParentRecords', parent),
                metadataForSlot(childObjectId, 'MaterialRecords', panel, parentObjectId)
            ])
        )
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockImplementation(
            (_executor: unknown, input: { query: { slot: string } }) => {
                if (input.query.slot === 'parent') {
                    return [
                        {
                            recordId: parentRecordId,
                            data: { title: { locales: { en: { content: 'Course 1' } } }, order: 1 }
                        }
                    ]
                }
                if (input.query.slot === 'panel:materials') {
                    return [
                        {
                            recordId: childRecordId,
                            data: {
                                parent: parentRecordId,
                                title: { locales: { en: { content: 'Lesson 1' } } },
                                order: 1,
                                _upl_version: '6',
                                display1: { locales: { en: { content: 'Core' }, ru: { content: 'Основной' } } },
                                display2: '{"private":"value"}',
                                display3: 17,
                                display4: '0190a9b5-3cde-7abc-8def-0123456789c7',
                                display5: 'x'.repeat(300)
                            }
                        }
                    ]
                }
                return []
            }
        )

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [candidate], 'ru-RU')

        expect(resolved.get(candidate.id)).toMatchObject({
            status: 'ready',
            data: {
                kind: 'relation',
                panels: [
                    {
                        displayColumns: [
                            { key: 'display1', label: 'RU Category' },
                            { key: 'display2', label: 'RU Summary' },
                            { key: 'display3', label: 'RU Score' },
                            { key: 'display4', label: 'RU ReferenceCode' },
                            { key: 'display5', label: 'RU Description' }
                        ],
                        rows: [
                            {
                                target: {
                                    entityCodename: 'MaterialRecords',
                                    recordHandle: expect.stringMatching(/^rh1\./u),
                                    version: 6
                                },
                                cells: [
                                    { key: 'display1', value: 'Основной' },
                                    { key: 'display2', value: '' },
                                    { key: 'display3', value: '17' },
                                    { key: 'display4', value: '' },
                                    { key: 'display5', value: 'x'.repeat(240) }
                                ]
                            }
                        ]
                    }
                ]
            }
        })
        const serialized = JSON.stringify(resolved.get(candidate.id))
        expect(serialized).not.toContain('_upl_version')
        expect(serialized).not.toContain('SortOrder')
        expect(serialized).not.toContain(`"parent":"${parentRecordId}"`)
        expect(serialized).not.toContain('"order":')
        expect(serialized).not.toContain(childObjectId)
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({
                query: expect.objectContaining({
                    kind: 'relation-set',
                    slot: 'panel:materials',
                    projection: expect.arrayContaining([
                        { field: 'display1', componentCodename: 'Category' },
                        { field: 'display2', componentCodename: 'Summary' },
                        { field: 'display3', componentCodename: 'Score' },
                        { field: 'display4', componentCodename: 'ReferenceCode' },
                        { field: 'display5', componentCodename: 'Description' }
                    ])
                })
            })
        )
    })

    it('fails closed when a configured relation display field is missing from the bound projection', async () => {
        const { executor } = createMockDbExecutor()
        const candidate = relationBuilderCandidate([{ fieldCodename: 'Category', valueType: 'string', localized: false, required: false }])
        const invalidCandidate = {
            ...candidate,
            bindings: {
                ...candidate.bindings,
                slots: candidate.bindings.slots.map((binding) =>
                    binding.slot === 'panel:materials'
                        ? {
                              ...binding,
                              targets: binding.targets.map((target) => ({
                                  ...target,
                                  projection: target.projection.filter(({ field }) => field !== 'display1')
                              }))
                          }
                        : binding
                )
            }
        }

        const resolved = await resolveEffectiveWidgetRuntimeData(executor, scope, [invalidCandidate])

        expect(resolved.get(candidate.id)).toEqual({ status: 'malformed-config' })
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).not.toHaveBeenCalled()
    })
})
