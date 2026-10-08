import { getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { orderDashboardSeedPlacements } from '../../domains/templates/services/dashboardSeedPlacement'

const workflowObjectLayouts = [
    ['enrollments', 'Enrollments', 'enrollments-records'],
    ['assignmentSubmissions', 'AssignmentSubmissions', 'assignment-submissions-records'],
    ['trainingAttendance', 'TrainingAttendance', 'training-attendance-records'],
    ['certificateIssues', 'CertificateIssues', 'certificate-issues-records'],
    ['developmentPlanTasks', 'DevelopmentPlanTasks', 'development-plan-tasks-records'],
    ['notificationOutbox', 'NotificationOutbox', 'notification-outbox-records']
] as const

describe('LMS workflow object Dashboard seed', () => {
    it.each(workflowObjectLayouts)('provides an Entity-backed records table for %s', (layoutCodename, entityCodename, instanceKey) => {
        const layout = lmsTemplate.seed.scopedLayouts?.find(({ codename }) => codename === layoutCodename)
        expect(layout).toMatchObject({
            templateKey: 'dashboard',
            baseLayoutCodename: 'main',
            scopeEntityCodename: entityCodename,
            scopeEntityKind: 'object',
            isDefault: true,
            isActive: true
        })

        const placements = lmsTemplate.seed.layoutZoneWidgets?.[layoutCodename] ?? []
        const records = placements.find((placement) => placement.instanceKey === instanceKey)
        expect(records).toMatchObject({
            zone: 'center',
            widgetKey: 'detailsTable',
            rendererConfig: {
                variant: 'records',
                showSearch: true,
                maxRows: 50
            },
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            expect.objectContaining({
                                entityKind: 'object',
                                entityCodename,
                                selector: { kind: 'record-set' }
                            })
                        ]
                    }
                ]
            }
        })

        if (!records) throw new Error(`${entityCodename} records placement is missing`)
        const definition = getLayoutWidgetDefinition(records.widgetKey, records.rendererConfig)
        if (!definition) throw new Error(`${entityCodename} records widget definition is missing`)
        expect(() => validateWidgetBindings(definition, records.bindings)).not.toThrow()
        expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
    })
})
