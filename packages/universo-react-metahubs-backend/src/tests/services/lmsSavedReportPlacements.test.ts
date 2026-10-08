import { getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { orderDashboardSeedPlacements } from '../../domains/templates/services/dashboardSeedPlacement'

describe('LMS saved report placements', () => {
    it.each([
        ['courseBuilder', 'course-builder-player', 'course', 'Courses', 'CourseItems', 'tab:player'],
        ['trackBuilder', 'track-builder-player', 'track', 'LearningTracks', 'TrackSteps', 'tab:player']
    ] as const)('%s keeps its specialized learner player entity-backed', (layoutCodename, instanceKey, variant, parent, items, slotKey) => {
        const placements = lmsTemplate.seed.layoutZoneWidgets?.[layoutCodename] ?? []
        const player = placements.find(({ instanceKey: candidate }) => candidate === instanceKey)

        expect(player).toMatchObject({
            widgetKey: 'learnerPlayer',
            rendererConfig: { variant, displayMode: 'player', sequenceMode: 'strict' },
            parentInstanceKey: `${layoutCodename === 'courseBuilder' ? 'course' : 'track'}-builder-tabs`,
            slotKey,
            bindings: {
                version: 1,
                slots: expect.arrayContaining([
                    expect.objectContaining({
                        slot: 'parent',
                        targets: [expect.objectContaining({ entityCodename: parent, selector: { kind: 'record-set' } })]
                    }),
                    expect.objectContaining({
                        slot: 'items',
                        targets: [
                            expect.objectContaining({
                                entityCodename: items,
                                selector: { kind: 'relation-set', parentSlot: 'parent' }
                            })
                        ]
                    })
                ])
            }
        })
        const definition = getLayoutWidgetDefinition(player!.widgetKey, player!.rendererConfig)!
        expect(() => validateWidgetBindings(definition, player!.bindings)).not.toThrow()
        expect(placements.find(({ instanceKey: candidate }) => candidate === player?.parentInstanceKey)?.rendererConfig?.tabs).toEqual(
            expect.arrayContaining([expect.objectContaining({ slotKey, label: { en: 'Player', ru: 'Проигрыватель' } })])
        )
        expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
    })

    it.each(['reportsDashboard', 'courseBuilder', 'trackBuilder'])(
        'emits first-class canonical report references in %s',
        (layoutCodename) => {
            const placements = lmsTemplate.seed.layoutZoneWidgets?.[layoutCodename] ?? []
            const reports = placements.filter(({ rendererConfig }) => rendererConfig?.variant === 'report')
            expect(reports.map(({ rendererConfig }) => rendererConfig?.reportCodename)).toEqual([
                'LearningContentSummary',
                'LearnerProgress'
            ])
            for (const report of reports) {
                expect(report.widgetKey).toBe('detailsTable')
                expect(report.rendererConfig).toEqual({ variant: 'report', reportCodename: expect.any(String) })
                expect(report.bindings).toBeUndefined()
                const definition = getLayoutWidgetDefinition(report.widgetKey, report.rendererConfig)!
                expect(definition.bindingSlots).toEqual([])
                expect(() => validateWidgetBindings(definition, { version: 1, slots: [] })).not.toThrow()
                if (layoutCodename === 'reportsDashboard') {
                    expect(report.parentInstanceKey).toBeNull()
                    expect(report.slotKey).toBeNull()
                } else {
                    const tabs = placements.find(({ instanceKey }) => instanceKey === report.parentInstanceKey)
                    expect(tabs?.widgetKey).toBe('detailsTabs')
                    expect(report.slotKey).toBe('tab:reports')
                    expect(tabs?.rendererConfig?.tabs).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({ slotKey: 'tab:reports', label: { en: 'Reports', ru: 'Отчёты' } })
                        ])
                    )
                }
            }
            expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
        }
    )
})
