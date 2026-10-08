import { buildLmsHomeSeedZoneWidgets } from '../../domains/templates/data/lms.seed-dashboard'

describe('LMS LearnerHome Dashboard seed', () => {
    it('seeds actor-scoped course and track tabs as first-class Entity-backed placements and keeps library views', () => {
        const placements = buildLmsHomeSeedZoneWidgets()
        const assignmentTabs = placements.find(({ instanceKey }) => instanceKey === 'learner-home-assignment-tabs')
        const libraryTabs = placements.find(({ instanceKey }) => instanceKey === 'learner-home-content-tabs')

        expect(assignmentTabs).toMatchObject({
            widgetKey: 'detailsTabs',
            rendererConfig: {
                tabs: [
                    { slotKey: 'tab:my-courses', label: { en: 'My Courses', ru: 'Мои курсы' }, isDefault: true },
                    { slotKey: 'tab:my-tracks', label: { en: 'My Tracks', ru: 'Мои треки' } }
                ]
            }
        })
        expect(libraryTabs).toMatchObject({
            widgetKey: 'detailsTabs',
            rendererConfig: {
                tabs: [
                    { slotKey: 'tab:recent', label: { en: 'Recent', ru: 'Недавние' }, isDefault: true },
                    { slotKey: 'tab:starred', label: { en: 'Starred', ru: 'Избранное' } },
                    { slotKey: 'tab:shared', label: { en: 'Shared with me', ru: 'Доступные мне' } }
                ]
            }
        })

        for (const [instanceKey, slotKey, targetKind] of [
            ['learner-home-my-courses', 'tab:my-courses', 'course'],
            ['learner-home-my-tracks', 'tab:my-tracks', 'track']
        ] as const) {
            const child = placements.find((placement) => placement.instanceKey === instanceKey)
            expect(child).toMatchObject({
                widgetKey: 'detailsTable',
                parentInstanceKey: 'learner-home-assignment-tabs',
                slotKey,
                rendererConfig: { variant: 'learner-enrollments' }
            })
            const target = child?.bindings?.slots.find(({ slot }) => slot === 'rows')?.targets[0]
            expect(target).toMatchObject({
                entityKind: 'object',
                entityCodename: 'Enrollments',
                selector: { kind: 'learner-enrollment-set', targetKind },
                projection: expect.arrayContaining([
                    { field: 'title', componentCodename: 'TargetTitle' },
                    { field: 'assignedUser', componentCodename: 'AssignedUserId' },
                    { field: 'targetKind', componentCodename: 'TargetType' }
                ])
            })
        }

        const libraryChildren = placements.filter((placement) => placement.parentInstanceKey === 'learner-home-content-tabs')
        expect(libraryChildren).toHaveLength(3)
        expect(libraryChildren.map(({ slotKey }) => slotKey).sort()).toEqual(['tab:recent', 'tab:shared', 'tab:starred'])
        expect(libraryChildren.every(({ rendererConfig }) => rendererConfig.variant === 'library')).toBe(true)
    })
})
