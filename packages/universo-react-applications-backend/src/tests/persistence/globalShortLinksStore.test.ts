import { isUuidV7 } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'
import {
    createGlobalShortLink,
    findActiveGlobalShortLinkApplicationId,
    findActiveGlobalShortLinkTarget,
    lockActiveGlobalShortLinkApplication,
    listGlobalShortLinks,
    releaseActiveGlobalShortLinksForAccessLink,
    releaseActiveGlobalShortLinksForWorkspace,
    releaseGlobalShortLink
} from '../../persistence/globalShortLinksStore'

describe('globalShortLinksStore', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const linkId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const actorUserId = '550e8400-e29b-41d4-a716-446655440000'
    const now = new Date('2026-10-11T10:00:00.000Z')
    const applicationEntryRow = {
        id: linkId,
        slug: 'lyceum-marathon-7',
        targetKind: 'application-entry',
        applicationId,
        sectionKey: null,
        accessLinkId: null,
        accessLinkSlug: null,
        workspaceId: null,
        resourceTargetKind: null,
        entityTypeCodename: null,
        releasedAt: null,
        createdAt: now,
        updatedAt: now
    }

    it('inserts normalized typed targets with a UUID v7 id and atomic active-slug conflict handling', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([applicationEntryRow])

        const result = await createGlobalShortLink(
            executor,
            { slug: 'Lyceum-Marathon-7', target: { kind: 'application-entry', applicationId } },
            actorUserId
        )

        expect(result).toMatchObject({ slug: 'lyceum-marathon-7', target: { kind: 'application-entry', applicationId } })
        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('INSERT INTO "applications"."obj_global_short_links"')
        expect(String(sql)).toContain('ON CONFLICT (slug)')
        expect(String(sql)).toContain('_app_archived = false')
        expect(String(sql)).toContain('DO NOTHING')
        expect(parameters).toEqual([
            expect.stringMatching(/^.+$/),
            'lyceum-marathon-7',
            'application-entry',
            applicationId,
            null,
            null,
            null,
            null,
            null,
            null,
            actorUserId
        ])
        expect(isUuidV7(String(parameters[0]))).toBe(true)
    })

    it('returns null when an active slug conflict wins the concurrent insert race', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([])

        await expect(
            createGlobalShortLink(
                executor,
                { slug: 'lyceum-marathon-7', target: { kind: 'application-entry', applicationId } },
                actorUserId
            )
        ).resolves.toBeNull()
    })

    it('resolves only through the active-link SQL function and binds the normalized slug', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([
            {
                targetKind: 'lms-access-link',
                applicationId,
                sectionKey: null,
                accessLinkId: '019ccefc-2f7b-7b36-82f4-85cdb1312270',
                accessLinkSlug: 'grade-7-quiz',
                workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269',
                resourceTargetKind: null,
                entityTypeCodename: null
            }
        ])

        await expect(findActiveGlobalShortLinkTarget(executor, ' Grade-7-Entry ')).resolves.toEqual({
            kind: 'lms-access-link',
            applicationId,
            accessLinkId: '019ccefc-2f7b-7b36-82f4-85cdb1312270',
            accessLinkSlug: 'grade-7-quiz',
            workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        })
        expect(executor.query.mock.calls[0][0]).toContain('FROM applications.resolve_global_short_link($1)')
        expect(executor.query.mock.calls[0][1]).toEqual(['grade-7-entry'])
    })

    it('rejects invalid lookup slugs before touching the database', async () => {
        const { executor } = createMockDbExecutor()
        await expect(findActiveGlobalShortLinkTarget(executor, 'path/segment')).rejects.toThrow()
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('finds a releasable link application through active-link predicates', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ applicationId }])

        await expect(findActiveGlobalShortLinkApplicationId(executor, linkId)).resolves.toBe(applicationId)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('application_id AS "applicationId"')
        expect(String(sql)).toContain('released_at IS NULL')
        expect(String(sql)).toContain('_upl_deleted = false')
        expect(String(sql)).toContain('_app_deleted = false')
        expect(parameters).toEqual([linkId])
    })

    it('releases every active global URL bound to an AccessLink identity', async () => {
        const { executor } = createMockDbExecutor()
        const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'

        await releaseActiveGlobalShortLinksForAccessLink(executor, applicationId, accessLinkId, actorUserId)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain("target_kind = 'lms-access-link'")
        expect(String(sql)).toContain('access_link_id = $2')
        expect(String(sql)).toContain('released_by = $3')
        expect(parameters).toEqual([applicationId, accessLinkId, actorUserId])
    })

    it('releases only active LMS links for an archived workspace and reports the affected rows', async () => {
        const { executor } = createMockDbExecutor()
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        executor.query.mockResolvedValueOnce([{ id: linkId }, { id: '019ccefc-2f7b-7b36-82f4-85cdb1312274' }])

        await expect(releaseActiveGlobalShortLinksForWorkspace(executor, applicationId, workspaceId, actorUserId)).resolves.toBe(2)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('"applications"."obj_global_short_links"')
        expect(String(sql)).toContain("target_kind = 'lms-access-link'")
        expect(String(sql)).toContain('access_link_workspace_id = $2')
        expect(String(sql)).toContain('released_at IS NULL')
        expect(String(sql)).toContain('RETURNING id')
        expect(parameters).toEqual([applicationId, workspaceId, actorUserId])
    })

    it('locks a live application row before creating a target-bound short link', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ locked: true }])

        await expect(lockActiveGlobalShortLinkApplication(executor, applicationId)).resolves.toBe(true)

        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('applications.lock_active_global_short_link_application($1)')
        expect(parameters).toEqual([applicationId])
    })

    it('does not lock an application the current actor cannot manage', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ locked: false }])

        await expect(lockActiveGlobalShortLinkApplication(executor, applicationId)).resolves.toBe(false)
    })

    it('does not broaden a list when the application scope is missing or invalid', async () => {
        const { executor } = createMockDbExecutor()

        await expect(listGlobalShortLinks(executor, { applicationId: '', limit: 25, offset: 0 })).rejects.toThrow(
            'applicationId must be a UUID v7'
        )
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('applies active, released and application filters with bound pagination parameters', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([])

        await listGlobalShortLinks(executor, { applicationId, limit: 25, offset: 50 })
        const [activeSql, activeParameters] = executor.query.mock.calls[0]
        expect(String(activeSql)).toContain('released_at IS NULL')
        expect(String(activeSql)).toContain('application_id = $1')
        expect(String(activeSql)).toContain('_upl_deleted = false')
        expect(String(activeSql)).toContain('LIMIT $2')
        expect(String(activeSql)).toContain('OFFSET $3')
        expect(activeParameters).toEqual([applicationId, 25, 50])

        await listGlobalShortLinks(executor, { applicationId, includeReleased: true, limit: 10, offset: 0 })
        const [allSql, allParameters] = executor.query.mock.calls[1]
        expect(String(allSql)).not.toContain('released_at IS NULL')
        expect(allParameters).toEqual([applicationId, 10, 0])
    })

    it('releases once with a fail-closed predicate and increments the version', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ ...applicationEntryRow, releasedAt: now, updatedAt: now }])

        const result = await releaseGlobalShortLink(executor, linkId, applicationId, actorUserId)

        expect(result?.releasedAt).toBe(now.toISOString())
        const [sql, parameters] = executor.query.mock.calls[0]
        expect(String(sql)).toContain('released_at = now()')
        expect(String(sql)).toContain('_upl_version = _upl_version + 1')
        expect(String(sql)).toContain('AND released_at IS NULL')
        expect(String(sql)).toContain('AND _upl_archived = false')
        expect(String(sql)).toContain('AND application_id = $2')
        expect(String(sql)).toContain('released_by = $3')
        expect(String(sql)).toContain('_upl_updated_by = $3')
        expect(String(sql)).toContain('RETURNING')
        expect(parameters).toEqual([linkId, applicationId, actorUserId])
    })

    it('returns null when release is repeated or the link is no longer active', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([])
        await expect(releaseGlobalShortLink(executor, linkId, applicationId, actorUserId)).resolves.toBeNull()
    })

    it('allows the same slug to be created after its active link is released', async () => {
        const { executor } = createMockDbExecutor()
        const replacementId = '019ccefc-2f7b-7b36-82f4-85cdb1312271'
        executor.query
            .mockResolvedValueOnce([{ ...applicationEntryRow, releasedAt: now, updatedAt: now }])
            .mockResolvedValueOnce([{ ...applicationEntryRow, id: replacementId, releasedAt: null }])

        await expect(releaseGlobalShortLink(executor, linkId, applicationId, actorUserId)).resolves.toMatchObject({
            slug: applicationEntryRow.slug,
            releasedAt: now.toISOString()
        })
        await expect(
            createGlobalShortLink(
                executor,
                { slug: applicationEntryRow.slug, target: { kind: 'application-entry', applicationId } },
                actorUserId
            )
        ).resolves.toMatchObject({ id: replacementId, slug: applicationEntryRow.slug, releasedAt: null })

        expect(String(executor.query.mock.calls[0][0])).toContain('released_at = now()')
        expect(String(executor.query.mock.calls[1][0])).toContain('ON CONFLICT (slug)')
        expect(String(executor.query.mock.calls[1][0])).toContain('WHERE released_at IS NULL')
        expect(executor.query.mock.calls[1][1]).toEqual([
            expect.stringMatching(/^.+$/),
            applicationEntryRow.slug,
            'application-entry',
            applicationId,
            null,
            null,
            null,
            null,
            null,
            null,
            actorUserId
        ])
    })

    it('persists and resolves application-resource targets by codename without entity UUIDs', async () => {
        const { executor } = createMockDbExecutor()
        const resourceTarget = {
            kind: 'application-resource' as const,
            applicationId,
            targetKind: 'page' as const,
            entityTypeCodename: 'home'
        }
        const resourceRow = {
            ...applicationEntryRow,
            targetKind: 'application-resource',
            sectionKey: null,
            accessLinkId: null,
            accessLinkSlug: null,
            workspaceId: null,
            resourceTargetKind: 'page',
            entityTypeCodename: 'home'
        }
        executor.query.mockResolvedValueOnce([resourceRow]).mockResolvedValueOnce([
            {
                targetKind: 'application-resource',
                applicationId,
                sectionKey: null,
                accessLinkId: null,
                accessLinkSlug: null,
                workspaceId: null,
                resourceTargetKind: 'page',
                entityTypeCodename: 'home'
            }
        ])

        await expect(createGlobalShortLink(executor, { slug: 'lyceum-home', target: resourceTarget }, actorUserId)).resolves.toMatchObject({
            target: resourceTarget
        })
        const [insertSql, insertParameters] = executor.query.mock.calls[0]
        expect(String(insertSql)).toContain('resource_target_kind, entity_type_codename')
        expect(insertParameters).toEqual([
            expect.stringMatching(/^.+$/),
            'lyceum-home',
            'application-resource',
            applicationId,
            null,
            null,
            null,
            null,
            'page',
            'home',
            actorUserId
        ])
        await expect(findActiveGlobalShortLinkTarget(executor, 'lyceum-home')).resolves.toEqual(resourceTarget)
    })
})
