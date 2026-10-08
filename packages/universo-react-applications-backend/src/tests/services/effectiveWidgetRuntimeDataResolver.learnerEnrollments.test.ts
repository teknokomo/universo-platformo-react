import './effectiveWidgetRuntimeDataResolver.testMocks'
import { validateWidgetBindings } from '@universo-react/types'
import {
    createMockDbExecutor,
    getLayoutWidgetDefinition,
    metadataEnvelope,
    metadataForSlot,
    objectId,
    recordId,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    resolveEffectiveWidgetRuntimeData,
    runtimeStore,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

const actorId = '550e8400-e29b-41d4-a716-446655440000'

const learnerEnrollmentCandidate = (targetKind: 'course' | 'track') => {
    const config = { variant: 'learner-enrollments', maxRows: 24 }
    const definition = getLayoutWidgetDefinition('detailsTable', config)
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
    if (!definition || !slot) throw new Error('Learner Enrollment detailsTable contract is missing')
    const projection = slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: [
            {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: 'Enrollments',
                        selector: { kind: 'learner-enrollment-set', targetKind },
                        projection
                    }
                ]
            }
        ]
    })
    return {
        candidate: {
            id: `learner-${targetKind}`,
            widgetKey: 'detailsTable',
            config,
            isActive: true,
            bindings
        },
        slot
    }
}

describe('resolveEffectiveWidgetRuntimeData learner Enrollment tables', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it.each([
        ['course', 'Compliance Refresh Course', 'Курс обновления требований'],
        ['track', 'Compliance refresh track', 'Трек повторения требований']
    ] as const)('projects only the safe title column for the current actor %s assignments', async (targetKind, titleEn, titleRu) => {
        const { executor } = createMockDbExecutor()
        const { candidate, slot } = learnerEnrollmentCandidate(targetKind)
        runtimeStore.loadRuntimeWidgetBindingMetadata.mockResolvedValueOnce(
            metadataEnvelope([metadataForSlot(objectId, 'Enrollments', slot)])
        )
        runtimeStore.loadWidgetBindingRuntimeRecords.mockResolvedValueOnce([
            {
                recordId,
                data: {
                    title: { _primary: 'en', locales: { en: { content: titleEn }, ru: { content: titleRu } } },
                    assignedUser: actorId,
                    targetKind
                }
            }
        ])

        const result = await resolveEffectiveWidgetRuntimeData(executor, { ...scope, currentUserId: actorId }, [candidate], 'en')

        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({
                currentUserId: actorId,
                query: expect.objectContaining({ kind: 'learner-enrollment-set', selector: { targetKind } }),
                object: expect.objectContaining({ codename: 'Enrollments' })
            })
        )
        expect(result.get(candidate.id)).toEqual({
            status: 'ready',
            data: {
                kind: 'table',
                columns: [{ key: 'title', label: 'TargetTitle' }],
                rows: [{ key: 'row-1', cells: [{ key: 'title', value: titleEn }] }]
            }
        })
        const serialized = JSON.stringify(result.get(candidate.id))
        for (const technicalValue of [actorId, recordId, objectId, 'AssignedUserId', 'TargetType']) {
            expect(serialized).not.toContain(technicalValue)
        }
    })

    it('denies actor-scoped Enrollment tables before metadata or record reads when no trusted actor exists', async () => {
        const { executor } = createMockDbExecutor()
        const { candidate } = learnerEnrollmentCandidate('course')

        const result = await resolveEffectiveWidgetRuntimeData(executor, { ...scope, currentUserId: null }, [candidate], 'en')

        expect(result.get(candidate.id)).toEqual({ status: 'permission-denied' })
        expect(runtimeStore.loadRuntimeWidgetBindingMetadata).not.toHaveBeenCalled()
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })
})
