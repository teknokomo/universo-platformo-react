import type { DbExecutor } from '@universo-react/utils'
import {
    lockApplicationForPublicGuestWithdrawal,
    lockPublicApplicationForGuestAssessment
} from '../../persistence/publicGuestApplicationStore'

const makeExecutor = (rows: unknown[] = []) =>
    ({
        query: jest.fn().mockResolvedValue(rows)
    } as unknown as DbExecutor & { query: jest.Mock })

describe('public guest application lifecycle store', () => {
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
