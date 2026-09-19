import { createMockDbExecutor } from '../utils/dbMocks'
import {
    createApplicationAliasAtomically,
    findApplicationIdByActiveAlias,
    listApplicationAliases,
    lockApplicationAliasTransitions,
    releaseApplicationAlias,
    updateApplicationAliasPolicy
} from '../../persistence/applicationAliasesStore'

describe('applicationAliasesStore', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const aliasId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
    const row = {
        id: aliasId,
        applicationId,
        alias: 'meridian-73',
        isPrimary: false,
        releasedAt: null,
        createdAt: new Date('2026-09-15T10:00:00.000Z'),
        updatedAt: new Date('2026-09-15T10:00:00.000Z')
    }

    it('delegates create and primary transition to the guarded atomic SQL function', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ ...row, isPrimary: true }])

        await expect(
            createApplicationAliasAtomically(executor, { applicationId, alias: 'meridian-73', makePrimary: true, userId })
        ).resolves.toMatchObject({ applicationId, alias: 'meridian-73', isPrimary: true })

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('FROM applications.create_application_alias($1, $2, $3, $4)')
        expect(String(sql)).not.toContain('UPDATE applications.obj_application_aliases')
        expect(parameters).toEqual([applicationId, 'meridian-73', true, userId])
    })

    it('releases an alias by clearing primary and setting released_at in one fail-closed UPDATE', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ ...row, releasedAt: new Date('2026-09-15T11:00:00.000Z') }])

        await releaseApplicationAlias(executor, aliasId, userId)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('SET is_primary = false')
        expect(String(sql)).toContain('released_at = now()')
        expect(String(sql)).toContain('AND released_at IS NULL')
        expect(String(sql)).toContain('RETURNING')
        expect(parameters).toEqual([aliasId, userId])
    })

    it('serializes application alias transitions with a parameterized advisory transaction lock', async () => {
        const { executor } = createMockDbExecutor()

        await lockApplicationAliasTransitions(executor, applicationId)

        expect(executor.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [`application-aliases:${applicationId}`])
    })

    it('filters released aliases by default but can include them explicitly', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ count: 0 }]).mockResolvedValueOnce([])

        await listApplicationAliases(executor, {
            limit: 50,
            offset: 0,
            sortBy: 'created',
            sortOrder: 'desc',
            includeReleased: false
        })

        expect(String(executor.query.mock.calls[0][0])).toContain('aa.released_at IS NULL')
        expect(String(executor.query.mock.calls[1][0])).toContain('aa.released_at IS NULL')

        executor.query.mockClear()
        executor.query.mockResolvedValueOnce([{ count: 0 }]).mockResolvedValueOnce([])
        await listApplicationAliases(executor, {
            limit: 50,
            offset: 0,
            sortBy: 'created',
            sortOrder: 'desc',
            includeReleased: true
        })

        expect(String(executor.query.mock.calls[0][0])).not.toContain('aa.released_at IS NULL')
        expect(String(executor.query.mock.calls[1][0])).not.toContain('aa.released_at IS NULL')
    })

    it('updates routing policy through the guarded SQL function', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ applicationId, routingMode: 'canonical' }])

        await updateApplicationAliasPolicy(executor, applicationId, 'canonical', userId)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('FROM applications.update_application_alias_routing_mode($1, $2, $3)')
        expect(String(sql)).not.toContain('UPDATE applications.obj_applications')
        expect(parameters).toEqual([applicationId, 'canonical', userId])
    })

    it('resolves an alias without reading the RLS-protected alias table directly', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ applicationId }])

        await expect(findApplicationIdByActiveAlias(executor, 'meridian-73')).resolves.toBe(applicationId)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('applications.resolve_application_alias($1)')
        expect(String(sql)).not.toContain('applications.obj_application_aliases')
        expect(parameters).toEqual(['meridian-73'])
    })

    it('returns null when the resolver reports an unknown or inactive alias', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ applicationId: null }])
        await expect(findApplicationIdByActiveAlias(executor, 'unknown-app')).resolves.toBeNull()

        executor.query.mockResolvedValueOnce([])
        await expect(findApplicationIdByActiveAlias(executor, 'unknown-app')).resolves.toBeNull()
    })
})
