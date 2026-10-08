import { createMockDbExecutor } from '../utils/dbMocks'
import { resolveEffectiveWidgetRuntimeData } from '../../services/effectiveWidgetRuntimeDataResolver'
import { loadSavedRuntimeReportSource, SavedRuntimeReportSourceError } from '../../persistence/savedRuntimeReportSourceStore'

jest.mock('../../persistence/savedRuntimeReportSourceStore', () => ({
    ...jest.requireActual('../../persistence/savedRuntimeReportSourceStore'),
    loadSavedRuntimeReportSource: jest.fn()
}))

const scope = {
    schemaName: 'app_test',
    workspaceId: null,
    workspacesEnabled: false,
    currentUserId: '0190a9b5-3cde-7abc-8def-0123456789b4',
    permissions: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: true
    }
}
const widget = {
    id: 'saved-report',
    widgetKey: 'detailsTable',
    config: { variant: 'report', reportCodename: 'LearnerProgress' },
    isActive: true
}

describe('effective saved report readiness', () => {
    beforeEach(() => jest.resetAllMocks())

    it('projects only semantic identity and localized title from the authorized source', async () => {
        jest.mocked(loadSavedRuntimeReportSource).mockResolvedValue({
            codename: 'LearnerProgress',
            title: { en: 'Progress', ru: 'Прогресс' },
            datasource: { kind: 'records.list', sectionCodename: 'PrivateSource' },
            columns: [{ field: 'PrivateColumn', label: 'Secret', type: 'text' }]
        })
        const { executor } = createMockDbExecutor()
        const result = await resolveEffectiveWidgetRuntimeData(executor, scope, [widget], 'ru-RU')
        expect(loadSavedRuntimeReportSource).toHaveBeenCalledWith(executor, scope, 'LearnerProgress')
        expect(result.get(widget.id)).toEqual({ status: 'ready', data: { kind: 'report', codename: 'LearnerProgress', title: 'Прогресс' } })
        expect(JSON.stringify([...result.values()])).not.toContain('Private')
    })

    it.each(['permission-denied', 'stale-source', 'malformed-config'] as const)(
        'preserves %s as a localized runtime state',
        async (reason) => {
            jest.mocked(loadSavedRuntimeReportSource).mockRejectedValue(new SavedRuntimeReportSourceError(reason))
            const { executor } = createMockDbExecutor()
            const result = await resolveEffectiveWidgetRuntimeData(executor, scope, [widget])
            expect(result.get(widget.id)).toMatchObject({ status: reason })
        }
    )

    it('does not read inactive reports or malformed report references', async () => {
        const { executor } = createMockDbExecutor()
        const result = await resolveEffectiveWidgetRuntimeData(executor, scope, [
            { ...widget, isActive: false },
            { ...widget, id: 'invalid', config: { variant: 'report', reportCodename: 'Invalid reference' } }
        ])
        expect(loadSavedRuntimeReportSource).not.toHaveBeenCalled()
        expect(result.has(widget.id)).toBe(false)
        expect(result.get('invalid')).toMatchObject({ status: 'malformed-config' })
    })
})
