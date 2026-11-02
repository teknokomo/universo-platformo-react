import type { DbExecutor } from '@universo-react/utils'
import {
    hasPublicMessengerApplicationLayout,
    lockApplicationForPublicGuestWithdrawal,
    lockPublicApplicationForGuestAssessment,
    lockPublicGuestRuntimeLayoutState
} from '../../persistence/publicGuestApplicationStore'

const makeExecutor = (rows: unknown[] = []) =>
    ({
        query: jest.fn().mockResolvedValue(rows)
    } as unknown as DbExecutor & { query: jest.Mock })

describe('public guest application lifecycle store', () => {
    it('detects an active published Messenger layout while holding a share lock', async () => {
        const executor = makeExecutor([{ layouts: true, widgets: true }, { id: 'layout-1' }])

        await expect(hasPublicMessengerApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334442')).resolves.toBe(true)

        const [tableCheckSql, tableCheckParams] = executor.query.mock.calls[0]
        expect(tableCheckSql).toContain("table_name = '_app_layouts'")
        expect(tableCheckParams).toEqual(['app_018f8a787b8f7c1da111222233334442'])

        const [layoutSql, layoutParams] = executor.query.mock.calls[1]
        expect(layoutSql).toContain('"app_018f8a787b8f7c1da111222233334442"."_app_layouts"')
        expect(layoutSql).toContain('l.template_key = $1')
        expect(layoutSql).toContain('FOR SHARE')
        expect(layoutParams).toEqual(['messenger-app'])
    })

    it('allows existing guest runtimes when per-application layout tables are absent', async () => {
        const executor = makeExecutor([{ layouts: false, widgets: false }])

        await expect(hasPublicMessengerApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334442')).resolves.toBe(false)
        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it('takes a shared lock from the same transaction family as layout mutations', async () => {
        const schemaName = 'app_018f8a787b8f7c1da111222233334442'
        const executor = makeExecutor()

        await lockPublicGuestRuntimeLayoutState(executor, schemaName)

        expect(executor.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock_shared(hashtextextended($1::text, 0))', [
            `${schemaName}:application-layout-mutations`
        ])
    })

    it('shares the application row only while public runtime is active', async () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334443'
        const executor = makeExecutor([{ id: applicationId }])

        await expect(lockPublicApplicationForGuestAssessment(executor, applicationId)).resolves.toBe(true)

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('a.is_public = true')
        expect(sql).toContain('a._app_published = true')
        expect(sql).toContain('FOR SHARE')
        expect(sql).toContain('_upl_deleted = false AND a._app_deleted = false')
        expect(params).toEqual([applicationId])
    })

    it('fails closed when the application has been withdrawn', async () => {
        const executor = makeExecutor([])

        await expect(lockPublicApplicationForGuestAssessment(executor, '018f8a78-7b8f-7c1d-a111-222233334443')).resolves.toBe(false)
    })

    it('takes an update lock and reads the app tenant configuration for atomic withdrawal', async () => {
        const application = {
            id: '018f8a78-7b8f-7c1d-a111-222233334443',
            schemaName: 'app_018f8a787b8f7c1da111222233334442',
            settings: { publicRuntime: { guest: {} } },
            isPublic: true,
            workspacesEnabled: true
        }
        const executor = makeExecutor([application])

        await expect(lockApplicationForPublicGuestWithdrawal(executor, application.id)).resolves.toEqual(application)

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('FOR UPDATE')
        expect(sql).toContain('a.schema_name AS "schemaName"')
        expect(params).toEqual([application.id])
    })
})
